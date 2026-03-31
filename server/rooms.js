import {
  WORLD_WIDTH, WORLD_HEIGHT, TILE, SOLID_TILES, HARDNESS, RESOURCE_NAMES,
  RESOURCE_VALUE, GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION, MAX_FALL_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, SERVER_TICK_MS, MSG,
  DECORATIONS, EMOTES, PARK_TOP, PARK_BOTTOM,
} from '../shared/constants.js';
import { generateWorld } from './world-gen.js';
import { saveWorld, loadWorld, savePlayer, loadPlayer, listWorlds } from './persistence.js';

const rooms = new Map();
const AUTO_SAVE_MS = 5 * 60 * 1000; // 5 minutes

function genRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function createPlayer(id, name, colorIndex) {
  return {
    id,
    name: name || 'Dog',
    color: colorIndex || 0,
    x: WORLD_WIDTH / 2,
    y: SURFACE_Y - 1,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    input: { left: false, right: false, up: false, down: false, jump: false, dig: false },
    digging: false,
    digTarget: null,
    digProgress: 0,
    resources: { bones: 0, gems: 0, fossils: 0, gold: 0, diamonds: 0, artifacts: 0 },
    unlockedEmotes: [0, 1],
    activeEmote: null,
    emoteTimer: 0,
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

// AABB collision check against tile grid
function collidesAt(room, px, py) {
  const left = Math.floor(px - PLAYER_WIDTH / 2);
  const right = Math.floor(px + PLAYER_WIDTH / 2 - 0.01);
  const top = Math.floor(py - PLAYER_HEIGHT);
  const bottom = Math.floor(py - 0.01);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(room, tx, ty)) return true;
    }
  }
  return false;
}

function updatePlayer(room, player, dt) {
  const inp = player.input;

  // Horizontal movement
  if (inp.left) { player.vx = -MOVE_SPEED; player.facing = -1; }
  else if (inp.right) { player.vx = MOVE_SPEED; player.facing = 1; }
  else { player.vx *= FRICTION; if (Math.abs(player.vx) < 0.1) player.vx = 0; }

  // Jump
  if (inp.jump && player.grounded) {
    player.vy = JUMP_FORCE;
    player.grounded = false;
  }

  // Gravity
  player.vy += GRAVITY;
  if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;

  // Move X
  const newX = player.x + player.vx * dt;
  if (!collidesAt(room, newX, player.y)) {
    player.x = newX;
  } else {
    // Push to nearest non-colliding X
    if (player.vx > 0) player.x = Math.floor(player.x + PLAYER_WIDTH / 2) - PLAYER_WIDTH / 2;
    else if (player.vx < 0) player.x = Math.floor(player.x - PLAYER_WIDTH / 2) + 1 + PLAYER_WIDTH / 2;
    player.vx = 0;
  }

  // Move Y
  const newY = player.y + player.vy * dt;
  if (!collidesAt(room, player.x, newY)) {
    player.y = newY;
    player.grounded = false;
  } else {
    if (player.vy > 0) {
      // Landing
      player.y = Math.floor(player.y) + 0.01;
      // Find the exact ground
      while (!collidesAt(room, player.x, player.y + 0.1)) player.y += 0.1;
      player.grounded = true;
    } else {
      // Hit ceiling
      player.y = Math.floor(player.y - PLAYER_HEIGHT) + PLAYER_HEIGHT + 1;
    }
    player.vy = 0;
  }

  // Clamp position
  player.x = Math.max(1 + PLAYER_WIDTH / 2, Math.min(WORLD_WIDTH - 1 - PLAYER_WIDTH / 2, player.x));
  player.y = Math.max(PLAYER_HEIGHT, Math.min(WORLD_HEIGHT - 1, player.y));

  // Digging
  handleDigging(room, player);

  // Emote timer
  if (player.activeEmote !== null) {
    player.emoteTimer--;
    if (player.emoteTimer <= 0) player.activeEmote = null;
  }
}

function handleDigging(room, player) {
  const inp = player.input;
  if (!inp.dig) {
    player.digging = false;
    player.digTarget = null;
    player.digProgress = 0;
    return;
  }

  // Determine dig target based on input direction
  let tx = Math.floor(player.x);
  let ty = Math.floor(player.y - PLAYER_HEIGHT / 2);

  if (inp.down) ty = Math.floor(player.y + 0.1);
  else if (inp.up) ty = Math.floor(player.y - PLAYER_HEIGHT - 0.1);
  else if (inp.left) { tx = Math.floor(player.x - PLAYER_WIDTH / 2 - 0.1); ty = Math.floor(player.y - 0.5); }
  else if (inp.right) { tx = Math.floor(player.x + PLAYER_WIDTH / 2 + 0.1); ty = Math.floor(player.y - 0.5); }
  else {
    // Dig in facing direction
    if (player.facing > 0) tx = Math.floor(player.x + PLAYER_WIDTH / 2 + 0.1);
    else tx = Math.floor(player.x - PLAYER_WIDTH / 2 - 0.1);
    ty = Math.floor(player.y - 0.5);
  }

  const tileType = getTile(room, tx, ty);
  if (!SOLID_TILES.has(tileType) || tileType === TILE.BEDROCK) {
    player.digging = false;
    player.digTarget = null;
    player.digProgress = 0;
    return;
  }

  // Check if target changed
  if (!player.digTarget || player.digTarget.x !== tx || player.digTarget.y !== ty) {
    player.digTarget = { x: tx, y: ty };
    player.digProgress = 0;
  }

  player.digging = true;
  player.digProgress++;

  const hardness = HARDNESS[tileType] || 3;
  if (player.digProgress >= hardness) {
    // Tile breaks
    const resourceName = RESOURCE_NAMES[tileType];
    setTile(room, tx, ty, TILE.AIR);

    // Broadcast tile update
    broadcast(room, { type: MSG.TILE_UPDATE, x: tx, y: ty, tile: TILE.AIR });

    // Give resource if it was a resource tile
    if (resourceName) {
      player.resources[resourceName] = (player.resources[resourceName] || 0) + 1;
      broadcast(room, {
        type: MSG.RESOURCE_COLLECTED,
        playerId: player.id,
        resource: resourceName,
        amount: player.resources[resourceName],
      });
    }

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
      digging: p.digging,
      digTarget: p.digTarget,
      digProgress: p.digProgress,
      activeEmote: p.activeEmote,
      color: p.color,
      name: p.name,
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
    savePlayer(roomId, player.name, player.resources, player.unlockedEmotes);
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

  const room = {
    id: roomId,
    seed: saved.seed,
    tiles: saved.tiles,
    players: new Map(),
    decorations: saved.decorations || [],
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
    savePlayer(room.id, player.name, player.resources, player.unlockedEmotes);
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
      };
      break;

    case MSG.EMOTE:
      if (player.unlockedEmotes.includes(msg.emoteId)) {
        player.activeEmote = msg.emoteId;
        player.emoteTimer = 40; // ~2 seconds at 20Hz
        broadcast(room, { type: MSG.EMOTE_TRIGGERED, playerId, emoteId: msg.emoteId });
      }
      break;

    case MSG.PLACE_DECORATION: {
      const decDef = DECORATIONS.find(d => d.id === msg.decorationId);
      if (!decDef) break;
      // Check if player can afford it
      if (!canAfford(player.resources, decDef.cost)) {
        sendTo(player, { type: MSG.ERROR, message: 'Cannot afford this decoration' });
        break;
      }
      // Check placement is in park zone
      if (msg.y < PARK_TOP || msg.y + decDef.h - 1 > PARK_BOTTOM) {
        sendTo(player, { type: MSG.ERROR, message: 'Must place in the dog park area' });
        break;
      }
      deductCost(player.resources, decDef.cost);
      const decoration = { id: decDef.id, x: msg.x, y: msg.y, placedBy: player.name };
      room.decorations.push(decoration);
      broadcast(room, { type: MSG.DECORATION_PLACED, decoration });
      sendTo(player, { type: MSG.PURCHASE_RESULT, success: true, resources: player.resources });
      break;
    }

    case MSG.BUY_EMOTE: {
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

    case MSG.SAVE:
      doSave(room);
      broadcast(room, { type: MSG.SAVED });
      break;

    case MSG.LOAD_WORLD:
      sendTo(player, { type: MSG.WORLD_LIST, worlds: listWorlds() });
      break;
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

export { createPlayer, broadcast, sendTo };
