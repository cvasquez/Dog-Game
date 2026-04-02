import {
  WORLD_WIDTH, WORLD_HEIGHT, TILE, SOLID_TILES, HARDNESS, RESOURCE_NAMES,
  RESOURCE_VALUE, HAZARD_TILES, GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION,
  MAX_FALL_SPEED, PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, SERVER_TICK_MS, MSG,
  DECORATIONS, EMOTES, PARK_TOP, PARK_BOTTOM, DOG_BREEDS, STAMINA_DIG_COST, STAMINA_RUN_COST, SPRINT_SPEED_MULT, STAMINA_SPRINT_COST,
  UPGRADES, calcDecorationBonuses, BASE_MAX_STAMINA, BASE_STAMINA_REGEN_RATE,
  STAMINA_REGEN_DELAY, STAMINA_EXHAUSTION_TIME, EMOTE_DISPLAY_TICKS, RESPAWN_TICKS, placeShopFloors,
  FALL_DAMAGE_THRESHOLD, FALL_DAMAGE_MULTIPLIER, FALL_DAMAGE_STUN_FRAMES,
  BOUNCY_TILES, BOUNCY_FORCE,
  COOP_DIG_RANGE, COOP_DIG_BONUS,
} from '../shared/constants.js';
import crypto from 'crypto';
import { generateWorld } from './world-gen.js';
import { saveWorld, loadWorld, savePlayer, loadPlayer, listWorlds } from './persistence.js';

const rooms = new Map();
const AUTO_SAVE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DECORATIONS_PER_ROOM = 200;

function genRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[bytes[i] % chars.length];
  return id;
}

function createPlayer(id, name, breedId) {
  const breed = DOG_BREEDS[breedId] || DOG_BREEDS[0];
  const s = breed.stats;
  const unlockedEmotes = [0, 1];
  if (breed.freeEmote != null && !unlockedEmotes.includes(breed.freeEmote)) {
    unlockedEmotes.push(breed.freeEmote);
  }
  return {
    id,
    name: name || 'Dog',
    breedId: breedId || 0,
    color: breedId || 0,
    x: WORLD_WIDTH / 2,
    y: SURFACE_Y - 1,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    dead: false,
    respawnTimer: 0,
    input: { left: false, right: false, up: false, down: false, jump: false, dig: false },
    digging: false,
    digTarget: null,
    digProgress: 0,
    resources: {
      bones: 0, gems: 0, fossils: 0, gold: 0, diamonds: 0, artifacts: 0,
      mushrooms: 0, crystals: 0, frozen_gems: 0, relics: 0,
    },
    unlockedEmotes,
    activeEmote: null,
    emoteTimer: 0,
    // Emote ability system
    emoteBuff: null,        // { effect, timer } — active buff from emote
    emoteCooldowns: {},     // { [emoteId]: ticksRemaining }
    // Per-breed hitbox dimensions (derived from opaque sprite bounds)
    hitboxWidth: breed.hitboxWidth || PLAYER_WIDTH,
    hitboxHeight: breed.hitboxHeight || PLAYER_HEIGHT,
    // Breed stats
    moveSpeed: MOVE_SPEED * s.moveSpeed,
    jumpForce: JUMP_FORCE * s.jumpForce,
    digSpeed: s.digSpeed,
    lootBonus: s.lootBonus || 0,
    // Upgrades
    ownedUpgrades: [],
    // Stamina
    maxStamina: BASE_MAX_STAMINA * s.maxStamina,
    stamina: BASE_MAX_STAMINA * s.maxStamina,
    staminaRegenRate: BASE_STAMINA_REGEN_RATE * s.staminaRegen,
    exhausted: false,
    exhaustionTimer: 0,
    groundedTimer: 0,
    ws: null,
  };
}

function getTile(room, x, y) {
  if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return TILE.BEDROCK;
  return room.tiles[y * WORLD_WIDTH + x];
}

function setTile(room, x, y, tile) {
  if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return;
  room.tiles[y * WORLD_WIDTH + x] = tile;
}

function isSolid(room, x, y) {
  return SOLID_TILES.has(getTile(room, x, y));
}

// AABB collision check against tile grid (uses per-player hitbox dimensions)
function collidesAt(room, px, py, pw, ph) {
  const left = Math.floor(px - pw / 2);
  const right = Math.floor(px + pw / 2 - 0.01);
  const top = Math.floor(py - ph);
  const bottom = Math.floor(py - 0.01);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(room, tx, ty)) return true;
    }
  }
  return false;
}

function checkHazards(room, player) {
  const cx = Math.floor(player.x);
  const cy = Math.floor(player.y - 0.01);
  const cy2 = Math.floor(player.y - player.hitboxHeight / 2);
  for (const ty of [cy, cy2]) {
    for (const tx of [cx, Math.floor(player.x - player.hitboxWidth / 2), Math.floor(player.x + player.hitboxWidth / 2 - 0.01)]) {
      if (HAZARD_TILES.has(getTile(room, tx, ty))) {
        player.dead = true;
        player.respawnTimer = RESPAWN_TICKS;
        return;
      }
    }
  }
}

function updatePlayer(room, player, dt) {
  // Respawn timer
  if (player.dead) {
    player.respawnTimer--;
    if (player.respawnTimer <= 0) {
      player.dead = false;
      player.x = WORLD_WIDTH / 2;
      player.y = SURFACE_Y - 1;
      player.vx = 0;
      player.vy = 0;
    }
    return;
  }

  // Check hazards (lava)
  checkHazards(room, player);
  if (player.dead) return;

  const inp = player.input;

  // Horizontal movement (use breed speed)
  const baseSpeed = player.moveSpeed || MOVE_SPEED;
  const moving = (inp.left || inp.right) && player.grounded;
  const sprinting = inp.sprint && !player.exhausted && player.stamina > 0 && moving;
  const speed = sprinting ? baseSpeed * SPRINT_SPEED_MULT : baseSpeed;
  player._movingDrain = false;
  if (moving && !player.exhausted) {
    // Running always costs stamina; sprinting costs extra on top
    player.stamina -= STAMINA_RUN_COST;
    if (sprinting) {
      player.stamina -= STAMINA_SPRINT_COST;
      player._movingDrain = true;
    }
    if (player.stamina <= 0) {
      player.exhausted = true;
      player.exhaustionTimer = STAMINA_EXHAUSTION_TIME;
      player.stamina = 0;
    }
  }
  if (inp.left) {
    // In air, preserve sprint momentum (don't reduce vx below current speed)
    if (player.grounded || Math.abs(player.vx) <= speed) player.vx = -speed;
    player.facing = -1;
  } else if (inp.right) {
    if (player.grounded || Math.abs(player.vx) <= speed) player.vx = speed;
    player.facing = 1;
  } else {
    player.vx *= FRICTION;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;
  }

  // Jump (use breed jump force)
  const jumpF = player.jumpForce || JUMP_FORCE;
  if (inp.jump && player.grounded) {
    player.vy = jumpF;
    player.grounded = false;
  }

  // Gravity
  player.vy += GRAVITY;
  if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;

  // Move X
  const pw = player.hitboxWidth;
  const ph = player.hitboxHeight;
  const newX = player.x + player.vx * dt;
  if (!collidesAt(room, newX, player.y, pw, ph)) {
    player.x = newX;
  } else {
    // Push to nearest non-colliding X
    if (player.vx > 0) player.x = Math.floor(player.x + pw / 2) - pw / 2;
    else if (player.vx < 0) player.x = Math.floor(player.x - pw / 2) + 1 + pw / 2;
    player.vx = 0;
  }

  // Move Y
  const newY = player.y + player.vy * dt;
  if (!collidesAt(room, player.x, newY, pw, ph)) {
    player.y = newY;
    player.grounded = false;
  } else {
    if (player.vy > 0) {
      const preVy = player.vy;
      // Landing
      player.y = Math.floor(player.y) + 0.01;
      // Find the exact ground
      while (!collidesAt(room, player.x, player.y + 0.1, pw, ph)) player.y += 0.1;
      player.grounded = true;
      player.vy = 0;

      // Check for bouncy tiles
      const tileBelow = getTile(room, Math.floor(player.x), Math.floor(player.y + 0.1));
      if (BOUNCY_TILES.has(tileBelow) && preVy > 1) {
        const jumpF = player.jumpForce || JUMP_FORCE;
        player.vy = jumpF * BOUNCY_FORCE;
        player.grounded = false;
      } else {
        // Fall damage (non-lethal)
        if (preVy > FALL_DAMAGE_THRESHOLD) {
          const damage = (preVy - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_MULTIPLIER;
          player.stamina -= damage;
          if (player.stamina <= 0) {
            player.stamina = 0;
            player.exhausted = true;
            player.exhaustionTimer = FALL_DAMAGE_STUN_FRAMES;
          }
        }
      }
    } else {
      // Hit ceiling
      player.y = Math.floor(player.y - ph) + ph;
      player.vy = 0;
    }
  }

  // Clamp position
  player.x = Math.max(1 + pw / 2, Math.min(WORLD_WIDTH - 1 - pw / 2, player.x));
  player.y = Math.max(ph, Math.min(WORLD_HEIGHT - 1, player.y));

  // Stamina: regen on ground, exhaustion recovery
  if (player.exhausted) {
    player.exhaustionTimer--;
    if (player.exhaustionTimer <= 0) player.exhausted = false;
  }
  if (player.grounded) {
    player.groundedTimer++;
  } else {
    player.groundedTimer = 0;
  }
  if (player.grounded && !player.exhausted && !player._movingDrain && player.groundedTimer > STAMINA_REGEN_DELAY) {
    player.stamina = Math.min(player.maxStamina, player.stamina + player.staminaRegenRate);
  }

  // Digging
  handleDigging(room, player);

  // Emote timer
  if (player.activeEmote !== null) {
    player.emoteTimer--;
    if (player.emoteTimer <= 0) player.activeEmote = null;
  }

  // Emote buff timer
  if (player.emoteBuff) {
    player.emoteBuff.timer--;
    if (player.emoteBuff.timer <= 0) {
      player.emoteBuff = null;
      applyServerUpgrades(player, room);
    }
  }

  // Emote cooldown timers
  for (const id in player.emoteCooldowns) {
    player.emoteCooldowns[id]--;
    if (player.emoteCooldowns[id] <= 0) delete player.emoteCooldowns[id];
  }
}

function handleDigging(room, player) {
  const inp = player.input;
  if (!inp.dig) {
    player.digging = false;
    player.digTarget = null;
    return;
  }

  // Determine dig target based on input direction
  let tx = Math.floor(player.x);
  let ty = Math.floor(player.y - player.hitboxHeight / 2);

  if (inp.down) ty = Math.floor(player.y + 0.1);
  else if (inp.up) ty = Math.floor(player.y - player.hitboxHeight) - 1;
  else if (inp.left) { tx = Math.floor(player.x - player.hitboxWidth / 2 - 0.1); ty = Math.floor(player.y - 0.5); }
  else if (inp.right) { tx = Math.floor(player.x + player.hitboxWidth / 2 + 0.1); ty = Math.floor(player.y - 0.5); }
  else {
    // Dig in facing direction
    if (player.facing > 0) tx = Math.floor(player.x + player.hitboxWidth / 2 + 0.1);
    else tx = Math.floor(player.x - player.hitboxWidth / 2 - 0.1);
    ty = Math.floor(player.y - 0.5);
  }

  const tileType = getTile(room, tx, ty);
  if (!SOLID_TILES.has(tileType) || tileType === TILE.BEDROCK || tileType === TILE.GRANITE || tileType === TILE.SHOP_FLOOR) {
    player.digging = false;
    player.digTarget = null;
    return;
  }

  // Update target (load existing tile damage if any)
  const tileKey = tx + ',' + ty;
  if (!player.digTarget || player.digTarget.x !== tx || player.digTarget.y !== ty) {
    player.digTarget = { x: tx, y: ty };
    player.digProgress = room.tileDamage.get(tileKey) || 0;
  }

  // Digging costs stamina
  if (player.stamina <= 0 || player.exhausted) {
    player.digTarget = null;
    player.digging = false;
    return;
  }

  player.digging = true;
  player.stamina -= STAMINA_DIG_COST;
  if (player.stamina < 0) player.stamina = 0;

  // Cooperative digging bonus: check if other players are digging nearby
  let coopBonus = 0;
  for (const [, other] of room.players) {
    if (other.id === player.id || !other.digging) continue;
    const dist = Math.abs(other.x - player.x) + Math.abs(other.y - player.y);
    if (dist <= COOP_DIG_RANGE) {
      coopBonus = COOP_DIG_BONUS;
      break;
    }
  }
  player.digProgress += (player.digSpeed || 1) * (1 + coopBonus);

  // Persist damage on the tile
  room.tileDamage.set(tileKey, player.digProgress);

  const hardness = HARDNESS[tileType] || 3;
  if (player.digProgress >= hardness) {
    // Tile breaks
    const resourceName = RESOURCE_NAMES[tileType];
    setTile(room, tx, ty, TILE.AIR);

    // Broadcast tile update
    broadcast(room, { type: MSG.TILE_UPDATE, x: tx, y: ty, tile: TILE.AIR });

    // Give resource if it was a resource tile
    if (resourceName) {
      let amount = 1;
      // Breed loot bonus: chance for double loot
      if (player.lootBonus && Math.random() < player.lootBonus) {
        amount = 2;
      }
      player.resources[resourceName] = (player.resources[resourceName] || 0) + amount;
      broadcast(room, {
        type: MSG.RESOURCE_COLLECTED,
        playerId: player.id,
        resource: resourceName,
        amount: player.resources[resourceName],
      });
    }

    room.tileDamage.delete(tileKey);
    player.digging = false;
    player.digTarget = null;
    player.digProgress = 0;
  }
}

function broadcast(room, message) {
  const data = JSON.stringify(message);
  for (const [, player] of room.players) {
    if (player.ws && player.ws.readyState === 1) {
      player.ws.send(data);
    }
  }
}

function sendTo(player, message) {
  if (player.ws && player.ws.readyState === 1) {
    player.ws.send(JSON.stringify(message));
  }
}

function tickRoom(room) {
  const dt = SERVER_TICK_MS / 1000;
  for (const [, player] of room.players) {
    updatePlayer(room, player, dt);
  }

  // Build state snapshot
  const players = [];
  for (const [, p] of room.players) {
    players.push({
      id: p.id,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      facing: p.facing,
      grounded: p.grounded,
      dead: p.dead,
      digging: p.digging,
      digTarget: p.digTarget,
      digProgress: p.digProgress,
      activeEmote: p.activeEmote,
      emoteBuff: p.emoteBuff ? { emoteId: p.emoteBuff.emoteId, timer: p.emoteBuff.timer } : null,
      color: p.color,
      name: p.name,
      stamina: p.stamina,
      maxStamina: p.maxStamina,
      exhausted: p.exhausted,
    });
  }
  broadcast(room, { type: MSG.STATE, players });
}

export function createRoom(hostPlayer, ws) {
  let roomId;
  do { roomId = genRoomId(); } while (rooms.has(roomId));

  const seed = Math.floor(Math.random() * 2147483647);
  const tiles = generateWorld(seed);

  const room = {
    id: roomId,
    seed,
    tiles,
    players: new Map(),
    decorations: [],
    tileDamage: new Map(),
    tickInterval: null,
    autoSaveInterval: null,
  };

  room.tickInterval = setInterval(() => tickRoom(room), SERVER_TICK_MS);
  room.autoSaveInterval = setInterval(() => doSave(room), AUTO_SAVE_MS);

  rooms.set(roomId, room);

  // Add host
  hostPlayer.ws = ws;
  room.players.set(hostPlayer.id, hostPlayer);

  return room;
}

export function joinRoom(roomId, player, ws) {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.players.size >= 4) return null;

  player.ws = ws;

  // Restore player data if they've been here before
  const saved = loadPlayer(roomId, player.name);
  if (saved) {
    player.resources = saved.resources;
    player.unlockedEmotes = saved.unlockedEmotes;
    player.ownedUpgrades = saved.ownedUpgrades || [];
    applyServerUpgrades(player, room);
  }

  room.players.set(player.id, player);
  return room;
}

export function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const player = room.players.get(playerId);
  if (player) {
    // Save player data
    savePlayer(roomId, player.name, player.resources, player.unlockedEmotes, player.ownedUpgrades);
    room.players.delete(playerId);
    broadcast(room, { type: MSG.PLAYER_LEFT, playerId });
  }

  // Clean up empty rooms
  if (room.players.size === 0) {
    doSave(room);
    clearInterval(room.tickInterval);
    clearInterval(room.autoSaveInterval);
    rooms.delete(roomId);
  }
}

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function tryLoadRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);

  const saved = loadWorld(roomId);
  if (!saved) return null;

  // Ensure shop floors exist (backwards compat with old saves)
  placeShopFloors(saved.tiles);

  const room = {
    id: roomId,
    seed: saved.seed,
    tiles: saved.tiles,
    players: new Map(),
    decorations: saved.decorations || [],
    tileDamage: new Map(),
    tickInterval: null,
    autoSaveInterval: null,
  };

  room.tickInterval = setInterval(() => tickRoom(room), SERVER_TICK_MS);
  room.autoSaveInterval = setInterval(() => doSave(room), AUTO_SAVE_MS);

  rooms.set(roomId, room);
  return room;
}

function doSave(room) {
  saveWorld(room.id, room.seed, room.tiles, room.decorations);
  for (const [, player] of room.players) {
    savePlayer(room.id, player.name, player.resources, player.unlockedEmotes, player.ownedUpgrades);
  }
}

export function handleMessage(roomId, playerId, msg) {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.get(playerId);
  if (!player) return;

  switch (msg.type) {
    case MSG.INPUT:
      player.input = {
        left: !!msg.left,
        right: !!msg.right,
        up: !!msg.up,
        down: !!msg.down,
        jump: !!msg.jump,
        dig: !!msg.dig,
        sprint: !!msg.sprint,
      };
      break;

    case MSG.EMOTE: {
      if (!Number.isInteger(msg.emoteId) || msg.emoteId < 0 || msg.emoteId >= EMOTES.length) break;
      const emDef = EMOTES[msg.emoteId];
      if (!emDef || !player.unlockedEmotes.includes(msg.emoteId)) break;
      // Check cooldown
      if (player.emoteCooldowns[msg.emoteId]) {
        sendTo(player, { type: MSG.ERROR, message: `${emDef.name} is on cooldown` });
        break;
      }
      // Display emote bubble
      player.activeEmote = msg.emoteId;
      player.emoteTimer = EMOTE_DISPLAY_TICKS;
      // Activate buff
      if (emDef.effect) {
        const durationTicks = Math.round(emDef.duration * (1000 / SERVER_TICK_MS));
        const cooldownTicks = Math.round(emDef.cooldown * (1000 / SERVER_TICK_MS));
        player.emoteBuff = { effect: emDef.effect, timer: durationTicks, emoteId: msg.emoteId };
        player.emoteCooldowns[msg.emoteId] = cooldownTicks;
        applyServerUpgrades(player, room);
      }
      broadcast(room, {
        type: MSG.EMOTE_TRIGGERED, playerId, emoteId: msg.emoteId,
        buffDuration: emDef.duration, cooldown: emDef.cooldown,
      });
      break;
    }

    case MSG.PLACE_DECORATION: {
      if (!Number.isInteger(msg.decorationId)) break;
      const decDef = DECORATIONS.find(d => d.id === msg.decorationId);
      if (!decDef) break;
      // Validate coordinates
      const decX = Math.floor(Number(msg.x));
      const decY = Math.floor(Number(msg.y));
      if (!Number.isFinite(decX) || !Number.isFinite(decY)) break;
      if (decX < 0 || decX >= WORLD_WIDTH) break;
      // Check decoration limit per room
      if (room.decorations.length >= MAX_DECORATIONS_PER_ROOM) {
        sendTo(player, { type: MSG.ERROR, message: 'Room decoration limit reached' });
        break;
      }
      // Check if player can afford it
      if (!canAfford(player.resources, decDef.cost)) {
        sendTo(player, { type: MSG.ERROR, message: 'Cannot afford this decoration' });
        break;
      }
      // Check placement is in park zone
      if (decY < PARK_TOP || decY + decDef.h - 1 > PARK_BOTTOM) {
        sendTo(player, { type: MSG.ERROR, message: 'Must place in the dog park area' });
        break;
      }
      deductCost(player.resources, decDef.cost);
      const decoration = { id: decDef.id, x: decX, y: decY, placedBy: player.name };
      room.decorations.push(decoration);
      broadcast(room, { type: MSG.DECORATION_PLACED, decoration });
      // Recalculate stats for ALL players (decoration buffs are shared)
      for (const [, p] of room.players) {
        applyServerUpgrades(p, room);
      }
      sendTo(player, { type: MSG.PURCHASE_RESULT, success: true, resources: player.resources });
      break;
    }

    case MSG.BUY_EMOTE: {
      if (!Number.isInteger(msg.emoteId) || msg.emoteId < 0) break;
      const emoteDef = EMOTES.find(e => e.id === msg.emoteId);
      if (!emoteDef || !emoteDef.cost) break;
      if (player.unlockedEmotes.includes(msg.emoteId)) break;
      if (!canAfford(player.resources, emoteDef.cost)) {
        sendTo(player, { type: MSG.ERROR, message: 'Cannot afford this emote' });
        break;
      }
      deductCost(player.resources, emoteDef.cost);
      player.unlockedEmotes.push(msg.emoteId);
      sendTo(player, { type: MSG.PURCHASE_RESULT, success: true, resources: player.resources, unlockedEmotes: player.unlockedEmotes });
      break;
    }

    case MSG.BUY_UPGRADE: {
      if (!Number.isInteger(msg.upgradeId) || msg.upgradeId < 0) break;
      const upgrade = UPGRADES.find(u => u.id === msg.upgradeId);
      if (!upgrade) break;
      if (player.ownedUpgrades.includes(msg.upgradeId)) break;
      if (upgrade.requires != null && !player.ownedUpgrades.includes(upgrade.requires)) break;
      if (!canAfford(player.resources, upgrade.cost)) {
        sendTo(player, { type: MSG.ERROR, message: 'Cannot afford this upgrade' });
        break;
      }
      deductCost(player.resources, upgrade.cost);
      player.ownedUpgrades.push(msg.upgradeId);
      applyServerUpgrades(player, room);
      sendTo(player, { type: MSG.PURCHASE_RESULT, success: true, resources: player.resources, ownedUpgrades: player.ownedUpgrades });
      break;
    }

    case MSG.SAVE:
      doSave(room);
      broadcast(room, { type: MSG.SAVED });
      break;

    case MSG.LOAD_WORLD:
      sendTo(player, { type: MSG.WORLD_LIST, worlds: listWorlds() });
      break;

    case MSG.PING: {
      const px = typeof msg.x === 'number' && Number.isFinite(msg.x)
        ? Math.max(0, Math.min(WORLD_WIDTH - 1, msg.x)) : player.x;
      const py = typeof msg.y === 'number' && Number.isFinite(msg.y)
        ? Math.max(0, Math.min(WORLD_HEIGHT - 1, msg.y)) : player.y;
      broadcast(room, {
        type: MSG.PING_PLACED,
        x: px, y: py,
        playerName: player.name,
        playerId: player.id,
      });
      break;
    }
  }
}

function canAfford(resources, cost) {
  for (const [key, amount] of Object.entries(cost)) {
    if ((resources[key] || 0) < amount) return false;
  }
  return true;
}

function deductCost(resources, cost) {
  for (const [key, amount] of Object.entries(cost)) {
    resources[key] = (resources[key] || 0) - amount;
  }
}

function applyServerUpgrades(player, room) {
  const breed = DOG_BREEDS[player.breedId] || DOG_BREEDS[0];
  const s = breed.stats;
  // Reset to base
  player.moveSpeed = MOVE_SPEED * s.moveSpeed;
  player.jumpForce = JUMP_FORCE * s.jumpForce;
  player.digSpeed = s.digSpeed;
  player.lootBonus = s.lootBonus || 0;
  const baseMax = BASE_MAX_STAMINA * s.maxStamina;
  const baseRegen = BASE_STAMINA_REGEN_RATE * s.staminaRegen;
  player.maxStamina = baseMax;
  player.staminaRegenRate = baseRegen;

  // Apply personal upgrades
  for (const id of player.ownedUpgrades) {
    const upgrade = UPGRADES.find(u => u.id === id);
    if (!upgrade) continue;
    const e = upgrade.effect;
    if (e.moveSpeed) player.moveSpeed += MOVE_SPEED * s.moveSpeed * e.moveSpeed;
    if (e.jumpForce) player.jumpForce += JUMP_FORCE * s.jumpForce * e.jumpForce;
    if (e.digSpeed) player.digSpeed += s.digSpeed * e.digSpeed;
    if (e.lootBonus) player.lootBonus += e.lootBonus;
    if (e.maxStamina) player.maxStamina += baseMax * e.maxStamina;
    if (e.staminaRegen) player.staminaRegenRate += baseRegen * e.staminaRegen;
  }

  // Apply decoration bonuses (shared — benefit all players)
  if (room && room.decorations.length > 0) {
    const db = calcDecorationBonuses(room.decorations);
    if (db.moveSpeed) player.moveSpeed += MOVE_SPEED * s.moveSpeed * db.moveSpeed;
    if (db.jumpForce) player.jumpForce += JUMP_FORCE * s.jumpForce * db.jumpForce;
    if (db.digSpeed) player.digSpeed += s.digSpeed * db.digSpeed;
    if (db.lootBonus) player.lootBonus += db.lootBonus;
    if (db.maxStamina) player.maxStamina += baseMax * db.maxStamina;
    if (db.staminaRegen) player.staminaRegenRate += baseRegen * db.staminaRegen;
  }

  // Apply active emote buff (temporary, self-only)
  if (player.emoteBuff) {
    const e = player.emoteBuff.effect;
    if (e.moveSpeed) player.moveSpeed += MOVE_SPEED * s.moveSpeed * e.moveSpeed;
    if (e.jumpForce) player.jumpForce += JUMP_FORCE * s.jumpForce * e.jumpForce;
    if (e.digSpeed) player.digSpeed += s.digSpeed * e.digSpeed;
    if (e.lootBonus) player.lootBonus += e.lootBonus;
    if (e.maxStamina) player.maxStamina += baseMax * e.maxStamina;
    if (e.staminaRegen) player.staminaRegenRate += baseRegen * e.staminaRegen;
  }
}

export { createPlayer, broadcast, sendTo };
