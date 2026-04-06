import {
  WORLD_WIDTH, WORLD_HEIGHT, TILE, SOLID_TILES, HARDNESS, RESOURCE_NAMES,
  RESOURCE_VALUE, HAZARD_TILES, GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION,
  MAX_FALL_SPEED, PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, SERVER_TICK_MS, MSG,
  DECORATIONS, EMOTES, PARK_TOP, PARK_BOTTOM, DOG_BREEDS, STAMINA_DIG_COST, STAMINA_RUN_COST, SPRINT_SPEED_MULT, STAMINA_SPRINT_COST,
  UPGRADES, calcDecorationBonuses, BASE_MAX_STAMINA, BASE_STAMINA_REGEN_RATE,
  STAMINA_REGEN_DELAY, STAMINA_EXHAUSTION_TIME, EMOTE_DISPLAY_TICKS, RESPAWN_TICKS, placeShopFloors,
  FALL_DAMAGE_MIN_BLOCKS, FALL_DAMAGE_SCALE, FALL_DAMAGE_STUN_FRAMES,
  BOUNCY_TILES, BOUNCY_FORCE,
  COOP_DIG_RANGE, COOP_DIG_BONUS,
  ACCEL_GROUND, DECEL_AIR, JUMP_CUT_MULTIPLIER, APEX_GRAVITY_MULT,
  COYOTE_TIME, JUMP_BUFFER_TIME,
  CLIMB_SPEED, CLING_SLIDE_SPEED, CLIMB_JUMP_FORCE,
  STAMINA_CLIMB_COST, STAMINA_CLING_COST, STAMINA_CLIMB_JUMP,
  ICY_TILES, SLIPPERY_TILES,
  BASE_MAX_HP, HP_REGEN_RATE, HP_REGEN_DELAY, LAVA_DAMAGE,
} from '../shared/constants.js';
import crypto from 'crypto';
import { Packr } from 'msgpackr';
import { generateWorld } from './world-gen.js';
import { saveWorld, loadWorld, savePlayer, loadPlayer, listWorlds } from './persistence.js';

const rooms = new Map();
const AUTO_SAVE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DECORATIONS_PER_ROOM = 200;
const packr = new Packr({ useRecords: false, mapsAsObjects: true });

// Compare two objects shallowly (for digTarget, emoteBuff)
function shallowEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

// Compute delta between previous and current player state.
// Returns partial object with only changed fields (always includes id), or null if nothing changed.
function computeDelta(prev, current) {
  if (!prev) return { ...current };
  const delta = { id: current.id };
  let changed = false;
  for (const key of Object.keys(current)) {
    if (key === 'id') continue;
    const cur = current[key];
    const old = prev[key];
    if (cur !== null && typeof cur === 'object') {
      // Object fields: digTarget, emoteBuff — shallow compare
      if (!shallowEqual(cur, old)) {
        delta[key] = cur;
        changed = true;
      }
    } else if (cur !== old) {
      delta[key] = cur;
      changed = true;
    }
  }
  return changed ? delta : null;
}

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
    fallPeakY: SURFACE_Y - 1,
    // Jump mechanics (matching client prediction)
    prevJump: false,
    jumpHeld: false,
    jumpWasCut: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    // HP
    maxHP: BASE_MAX_HP * (s.maxHP || 1),
    hp: BASE_MAX_HP * (s.maxHP || 1),
    hpRegenTimer: 0,
    lastDamageType: null,
    // Climbing/wall mechanics
    climbing: false,
    clinging: false,
    clingWallSide: 0,
    mantling: false,
    climbEfficiency: s.climbEfficiency || 1.0,
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
        takeDamage(player, LAVA_DAMAGE, 'lava');
        return;
      }
    }
  }
}

function takeDamage(player, amount, source) {
  if (player.dead) return;
  player.hp -= amount;
  player.lastDamageType = source;
  player.hpRegenTimer = 0;
  if (player.hp <= 0) {
    player.hp = 0;
    player.dead = true;
    player.respawnTimer = RESPAWN_TICKS;
  }
}

// Horizontal collision with vertical inset (matching client collidesAtH)
function collidesAtH(room, px, py, pw, ph) {
  const inset = 0.15;
  const left = Math.floor(px - pw / 2);
  const right = Math.floor(px + pw / 2 - 0.01);
  const top = Math.floor(py - ph + inset);
  const bottom = Math.floor(py - 0.01 - inset);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(room, tx, ty)) return true;
    }
  }
  return false;
}

// --- Wall/climb helpers (matching client/js/player.js) ---

function checkWall(room, player, side) {
  const wx = side < 0 ? player.x - player.hitboxWidth / 2 - 0.1 : player.x + player.hitboxWidth / 2 + 0.1;
  const headY = player.y - player.hitboxHeight + 0.1;
  const midY = player.y - player.hitboxHeight / 2;
  const feetY = player.y - 0.15;
  return isSolid(room, Math.floor(wx), Math.floor(headY)) ||
         isSolid(room, Math.floor(wx), Math.floor(midY)) ||
         isSolid(room, Math.floor(wx), Math.floor(feetY));
}

function canMantle(room, player, side) {
  const wx = side < 0 ? player.x - player.hitboxWidth / 2 - 0.1 : player.x + player.hitboxWidth / 2 + 0.1;
  const headY = player.y - player.hitboxHeight + 0.1;
  const feetY = player.y - 0.15;
  const hasWallAtFeet = isSolid(room, Math.floor(wx), Math.floor(feetY));
  const hasWallAtHead = isSolid(room, Math.floor(wx), Math.floor(headY));
  if (!hasWallAtFeet || hasWallAtHead) return null;

  const wallTx = Math.floor(wx);
  const minScanY = Math.floor(headY) - 2;
  let ledgeY = Math.floor(feetY);
  while (ledgeY > 0 && ledgeY > minScanY && isSolid(room, wallTx, ledgeY - 1)) ledgeY--;

  const topY = ledgeY - 1;
  if (isSolid(room, wallTx, topY)) return null;

  const margin = 0.05;
  let mantleX;
  if (side < 0) {
    mantleX = wallTx + 1 + player.hitboxWidth / 2 + margin;
  } else {
    mantleX = wallTx - player.hitboxWidth / 2 - margin;
  }

  if (collidesAt(room, mantleX, ledgeY, player.hitboxWidth, player.hitboxHeight)) return null;
  return { x: mantleX, y: ledgeY };
}

function isOnIce(room, player) {
  const tile = getTile(room, Math.floor(player.x), Math.floor(player.y + 0.1));
  return ICY_TILES.has(tile);
}

function isOnSlippery(room, player) {
  const tile = getTile(room, Math.floor(player.x), Math.floor(player.y + 0.1));
  return SLIPPERY_TILES.has(tile);
}

function releaseCling(player) {
  player.clinging = false;
  player.climbing = false;
  player.clingWallSide = 0;
}

function triggerExhaustion(player) {
  player.exhausted = true;
  player.exhaustionTimer = STAMINA_EXHAUSTION_TIME;
  player.stamina = 0;
  releaseCling(player);
  player.vy = Math.min(player.vy, 2);
}

// --- Main player update (mirrors client/js/player.js predictUpdate) ---

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
      player.fallPeakY = SURFACE_Y - 1;
      player.hp = player.maxHP;
      player.stamina = player.maxStamina;
      player.hpRegenTimer = 0;
      player.lastDamageType = null;
      releaseCling(player);
    }
    return;
  }

  // Mantle: server teleports instantly (client animates visually)
  if (player.mantling) {
    player.mantling = false;
  }

  // Check hazards (lava)
  checkHazards(room, player);
  if (player.dead) return;

  const inp = player.input;
  const pw = player.hitboxWidth;
  const ph = player.hitboxHeight;

  // Jump edge detection (matching client)
  const jumpPressed = inp.jump && !player.prevJump;
  player.prevJump = inp.jump;

  if (jumpPressed) player.jumpBufferTimer = JUMP_BUFFER_TIME;
  else if (player.jumpBufferTimer > 0) player.jumpBufferTimer--;

  player.jumpHeld = inp.jump;

  const wallLeft = checkWall(room, player, -1);
  const wallRight = checkWall(room, player, 1);
  const nextToWall = wallLeft || wallRight;

  // Exhaustion recovery
  if (player.exhausted) {
    player.exhaustionTimer--;
    if (player.exhaustionTimer <= 0) player.exhausted = false;
  }

  // Coyote time
  if (player.grounded) {
    player.groundedTimer++;
    player.coyoteTimer = COYOTE_TIME;
  } else {
    player.groundedTimer = 0;
    if (player.coyoteTimer > 0) player.coyoteTimer--;
  }

  // --- CLIMBING (matching client) ---
  const ledgeSide = (wallLeft && inp.left) ? -1 : (wallRight && inp.right) ? 1 : 0;
  const mantleTarget = ledgeSide !== 0 && !player.grounded ? canMantle(room, player, ledgeSide) : null;

  if (mantleTarget) {
    // Perform mantle: server teleports to final position
    player.mantling = true;
    player.x = mantleTarget.x;
    player.y = mantleTarget.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.fallPeakY = mantleTarget.y;
    releaseCling(player);
  } else {
    // Wall cling logic
    const canClingNow = nextToWall && !player.grounded && !player.exhausted && player.stamina > 0;

    if (canClingNow && !player.clinging && !player.grounded) {
      const movingToward = (wallLeft && inp.left) || (wallRight && inp.right);
      if (movingToward) {
        player.clinging = true;
        player.clingWallSide = wallLeft ? -1 : 1;
        player.facing = player.clingWallSide;
        player.vx = 0;
        player.vy = 0;
        player.fallPeakY = player.y;
      }
    }

    if (player.clinging) {
      const stillOnWall = player.clingWallSide < 0 ? wallLeft : wallRight;
      if (!stillOnWall || player.grounded) {
        releaseCling(player);
      } else if ((player.clingWallSide < 0 && inp.right) ||
                 (player.clingWallSide > 0 && inp.left) || inp.down) {
        releaseCling(player);
        player.vx = -player.clingWallSide * (player.moveSpeed || MOVE_SPEED) * 0.5;
      } else if (player.stamina <= 0) {
        triggerExhaustion(player);
      }
    }
  }

  // --- MOVEMENT ---
  if (player.clinging) {
    player.facing = player.clingWallSide;

    // Check for mantle while climbing up
    const climbMantle = inp.up ? canMantle(room, player, player.clingWallSide) : null;
    if (climbMantle) {
      player.mantling = true;
      player.x = climbMantle.x;
      player.y = climbMantle.y;
      player.vx = 0;
      player.vy = 0;
      player.grounded = true;
      player.fallPeakY = climbMantle.y;
      releaseCling(player);
    } else if (inp.up && player.stamina > 0) {
      player.vx = 0;
      player.climbing = true;
      player.vy = -CLIMB_SPEED;
      player.stamina -= STAMINA_CLIMB_COST / (player.climbEfficiency || 1);
    } else {
      player.vx = 0;
      player.climbing = false;
      player.vy = CLING_SLIDE_SPEED;
      player.stamina -= STAMINA_CLING_COST / (player.climbEfficiency || 1);
    }
    if (player.stamina < 0) player.stamina = 0;

    // Wall jump
    if (jumpPressed && player.stamina >= STAMINA_CLIMB_JUMP) {
      player.stamina -= STAMINA_CLIMB_JUMP;
      player.vy = CLIMB_JUMP_FORCE;
      const pushAway = (player.clingWallSide < 0 && inp.right) ||
                       (player.clingWallSide > 0 && inp.left);
      player.vx = -player.clingWallSide * (player.moveSpeed || MOVE_SPEED) * (pushAway ? 0.3 : 0.08);
      releaseCling(player);
    } else if (jumpPressed && player.stamina > 0) {
      player.vy = CLIMB_JUMP_FORCE * (player.stamina / STAMINA_CLIMB_JUMP) * 0.5;
      const pushAway = (player.clingWallSide < 0 && inp.right) ||
                       (player.clingWallSide > 0 && inp.left);
      player.vx = -player.clingWallSide * (player.moveSpeed || MOVE_SPEED) * (pushAway ? 0.2 : 0.08);
      player.stamina = 0;
      releaseCling(player);
    }
  } else {
    player.climbing = false;

    // Acceleration-based horizontal movement (matching client)
    const baseSpeed = player.moveSpeed || MOVE_SPEED;
    const moving = (inp.left || inp.right) && player.grounded;
    const sprinting = inp.sprint && !player.exhausted && player.stamina > 0 && moving;
    const effectiveSpeed = sprinting ? baseSpeed * SPRINT_SPEED_MULT : baseSpeed;
    player._movingDrain = false;
    if (moving && !player.exhausted) {
      player.stamina -= STAMINA_RUN_COST;
      if (sprinting) {
        player.stamina -= STAMINA_SPRINT_COST;
        player._movingDrain = true;
      }
      if (player.stamina <= 0) {
        triggerExhaustion(player);
      }
    }

    const targetVx = inp.left ? -effectiveSpeed : inp.right ? effectiveSpeed : 0;
    if (targetVx !== 0) {
      if (inp.left) player.facing = -1;
      if (inp.right) player.facing = 1;
      if (player.grounded) {
        // Smooth acceleration with faster turning
        const turning = (player.vx > 0 && targetVx < 0) || (player.vx < 0 && targetVx > 0);
        player.vx += Math.sign(targetVx) * ACCEL_GROUND * (turning ? 1.5 : 1);
        if (Math.abs(player.vx) > effectiveSpeed) {
          player.vx = Math.sign(player.vx) * effectiveSpeed;
        }
      } else {
        // In air: direction control at base speed, preserve sprint momentum
        if (Math.abs(player.vx) <= effectiveSpeed) {
          player.vx = Math.sign(targetVx) * effectiveSpeed;
        }
      }
    } else {
      // Decelerate
      if (player.grounded) {
        let decelRate = ACCEL_GROUND * 0.85;
        if (isOnIce(room, player)) decelRate *= 0.15;
        else if (isOnSlippery(room, player)) decelRate *= 0.4;
        if (Math.abs(player.vx) <= decelRate) player.vx = 0;
        else player.vx -= Math.sign(player.vx) * decelRate;
      } else {
        player.vx *= DECEL_AIR;
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
      }
    }

    // Jump with coyote time and buffer (matching client)
    const canJump = player.grounded || player.coyoteTimer > 0;
    if (player.jumpBufferTimer > 0 && canJump) {
      player.vy = player.jumpForce || JUMP_FORCE;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.jumpBufferTimer = 0;
      player.jumpWasCut = false;
    }

    // Variable jump height: cut jump short on release
    if (!player.jumpHeld && player.vy < 0 && !player.jumpWasCut) {
      player.vy *= JUMP_CUT_MULTIPLIER;
      player.jumpWasCut = true;
    }

    // Gravity with apex hang
    const nearApex = Math.abs(player.vy) < 1.5 && !player.grounded;
    const gravMult = nearApex ? APEX_GRAVITY_MULT : 1.0;
    player.vy += GRAVITY * gravMult;
    if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;
  }

  // --- PHYSICS ---
  // Horizontal movement uses collidesAtH (vertical inset, matching client)
  const newX = player.x + player.vx * dt;
  if (!collidesAtH(room, newX, player.y, pw, ph)) {
    player.x = newX;
  } else {
    // Snap based on attempted position (matching client)
    if (player.vx > 0) player.x = Math.floor(newX + pw / 2) - pw / 2;
    else if (player.vx < 0) player.x = Math.floor(newX - pw / 2) + 1 + pw / 2;
    player.vx = 0;
  }

  const newY = player.y + player.vy * dt;
  if (!collidesAt(room, player.x, newY, pw, ph)) {
    player.y = newY;
    player.grounded = false;
    if (player.y < player.fallPeakY) player.fallPeakY = player.y;
  } else {
    if (player.vy > 0) {
      const preVy = player.vy;
      // Landing snap (matching client: snap to tile boundary, walk up until clear)
      const groundTileY = Math.floor(newY);
      player.y = groundTileY;
      while (collidesAt(room, player.x, player.y, pw, ph) && player.y > 0) player.y -= 0.1;
      player.y += 0.001;
      player.grounded = true;
      player.vy = 0;
      if (player.clinging) releaseCling(player);

      // Bouncy tiles
      const tileBelow = getTile(room, Math.floor(player.x), Math.floor(player.y + 0.1));
      if (BOUNCY_TILES.has(tileBelow) && preVy > 1) {
        const jumpF = player.jumpForce || JUMP_FORCE;
        player.vy = jumpF * BOUNCY_FORCE;
        player.grounded = false;
        player.fallPeakY = player.y;
      } else {
        // Fall damage (using HP system)
        const fallBlocks = player.y - player.fallPeakY;
        if (fallBlocks > FALL_DAMAGE_MIN_BLOCKS) {
          const excess = fallBlocks - FALL_DAMAGE_MIN_BLOCKS;
          const damage = excess * excess * FALL_DAMAGE_SCALE;
          takeDamage(player, damage, 'fall');
          if (!player.dead) {
            player.exhausted = true;
            player.exhaustionTimer = FALL_DAMAGE_STUN_FRAMES;
          }
        }
      }
      player.fallPeakY = player.y;
    } else {
      // Hit ceiling — corner correction (matching client)
      let corrected = false;
      const primaryDir = player.vx >= 0 ? 1 : -1;
      const dirs = [primaryDir, -primaryDir];
      for (const dir of dirs) {
        for (let n = 0.1; n <= 0.45; n += 0.1) {
          if (!collidesAt(room, player.x + dir * n, newY, pw, ph)) {
            player.x += dir * n;
            player.y = newY;
            corrected = true;
            break;
          }
        }
        if (corrected) break;
      }
      if (!corrected) {
        player.y = Math.floor(player.y - ph) + ph;
        player.vy = 0;
      }
    }
  }

  // Clamp position
  player.x = Math.max(1 + pw / 2, Math.min(WORLD_WIDTH - 1 - pw / 2, player.x));
  player.y = Math.max(ph, Math.min(WORLD_HEIGHT - 1, player.y));

  // Stamina regen on ground after delay
  if (player.grounded && !player.exhausted && !player._movingDrain && !player.digging && player.groundedTimer > STAMINA_REGEN_DELAY) {
    player.stamina = Math.min(player.maxStamina, player.stamina + player.staminaRegenRate);
  }

  // HP regen (slow, requires being grounded for a while)
  player.hpRegenTimer++;
  if (player.grounded && player.hpRegenTimer > HP_REGEN_DELAY && player.hp < player.maxHP) {
    player.hp = Math.min(player.maxHP, player.hp + HP_REGEN_RATE);
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
    player.digTarget = { x: tx, y: ty, tile: tileType };
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

function handleInstantDig(room, player, digCount) {
  const inp = player.input;
  let dx = 0, dy = 0;
  if (inp.down) { dy = 1; }
  else if (inp.up) { dy = -1; }
  else if (inp.left) { dx = -1; }
  else if (inp.right) { dx = 1; }
  else {
    dx = player.facing > 0 ? 1 : -1;
  }

  let tx, ty;
  if (dy > 0) {
    tx = Math.floor(player.x);
    ty = Math.floor(player.y + 0.1);
  } else if (dy < 0) {
    tx = Math.floor(player.x);
    ty = Math.floor(player.y - player.hitboxHeight) - 1;
  } else {
    tx = dx > 0
      ? Math.floor(player.x + player.hitboxWidth / 2 + 0.1)
      : Math.floor(player.x - player.hitboxWidth / 2 - 0.1);
    ty = Math.floor(player.y - 0.5);
  }

  for (let i = 0; i < digCount; i++) {
    const cx = tx + dx * i;
    const cy = ty + dy * i;
    if (cx < 0 || cx >= WORLD_WIDTH || cy < 0 || cy >= WORLD_HEIGHT) break;
    const tileType = getTile(room, cx, cy);
    if (!SOLID_TILES.has(tileType) || tileType === TILE.BEDROCK || tileType === TILE.GRANITE || tileType === TILE.SHOP_FLOOR) continue;

    const resourceName = RESOURCE_NAMES[tileType];
    setTile(room, cx, cy, TILE.AIR);
    broadcast(room, { type: MSG.TILE_UPDATE, x: cx, y: cy, tile: TILE.AIR });

    if (resourceName) {
      let amount = 1;
      if (player.lootBonus && Math.random() < player.lootBonus) amount = 2;
      player.resources[resourceName] = (player.resources[resourceName] || 0) + amount;
      broadcast(room, {
        type: MSG.RESOURCE_COLLECTED,
        playerId: player.id,
        resource: resourceName,
        amount: player.resources[resourceName],
      });
    }

    room.tileDamage.delete(cx + ',' + cy);
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

function buildPlayerSnapshot(p) {
  return {
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
    climbing: p.climbing,
    clinging: p.clinging,
    clingWallSide: p.clingWallSide,
    mantling: p.mantling,
    hp: p.hp,
    maxHP: p.maxHP,
  };
}

function tickRoom(room) {
  const dt = SERVER_TICK_MS / 1000;
  for (const [, player] of room.players) {
    updatePlayer(room, player, dt);
  }

  // Build current snapshots for all players
  const currentSnapshots = new Map();
  for (const [id, p] of room.players) {
    currentSnapshots.set(id, buildPlayerSnapshot(p));
  }

  // Send per-recipient delta-encoded, selective, binary STATE messages
  for (const [recipientId, recipient] of room.players) {
    if (!recipient.ws || recipient.ws.readyState !== 1) continue;

    const players = [];
    for (const [playerId, snapshot] of currentSnapshots) {
      // Skip recipient's own movement data (client predicts that), but
      // always send server-authoritative fields like digging/stamina/hp
      if (playerId === recipientId && !recipient.needsFullState) {
        // Send only server-authoritative fields the client can't predict
        const snap = snapshot;
        const prev = room.prevStates.get(playerId);
        const selfDelta = { id: snap.id };
        let selfChanged = false;
        for (const key of ['digging', 'digTarget', 'digProgress', 'stamina', 'maxStamina',
                           'exhausted', 'hp', 'maxHP', 'dead', 'activeEmote', 'climbing',
                           'clinging', 'clingWallSide', 'mantling']) {
          const cur = snap[key];
          const old = prev?.[key];
          if (cur !== null && typeof cur === 'object') {
            if (!shallowEqual(cur, old)) { selfDelta[key] = cur; selfChanged = true; }
          } else if (cur !== old) { selfDelta[key] = cur; selfChanged = true; }
        }
        if (selfChanged) players.push(selfDelta);
        continue;
      }

      const prev = room.prevStates.get(playerId);
      const delta = computeDelta(prev, snapshot);
      if (delta) players.push(delta);
    }

    recipient.needsFullState = false;

    // Only send if there's data
    if (players.length > 0) {
      const packed = packr.pack({ type: MSG.STATE, players });
      recipient.ws.send(packed);
    }
  }

  // Update previous states for next tick's delta computation
  for (const [id, snapshot] of currentSnapshots) {
    room.prevStates.set(id, snapshot);
  }
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
    prevStates: new Map(),
    tickInterval: null,
    autoSaveInterval: null,
  };

  room.tickInterval = setInterval(() => tickRoom(room), SERVER_TICK_MS);
  room.autoSaveInterval = setInterval(() => doSave(room), AUTO_SAVE_MS);

  rooms.set(roomId, room);

  // Add host
  hostPlayer.ws = ws;
  hostPlayer.needsFullState = true;
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

  player.needsFullState = true;
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
    room.prevStates.delete(playerId);
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
    prevStates: new Map(),
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
      // Handle recall emotes (teleport to surface)
      if (emDef.isRecall) {
        const cooldownTicks = Math.round(emDef.cooldown * (1000 / SERVER_TICK_MS));
        player.emoteCooldowns[msg.emoteId] = cooldownTicks;
        player.x = WORLD_WIDTH / 2;
        player.y = SURFACE_Y - 1;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
        player.fallPeakY = SURFACE_Y - 1;
      } else if (emDef.isDig) {
        const cooldownTicks = Math.round(emDef.cooldown * (1000 / SERVER_TICK_MS));
        player.emoteCooldowns[msg.emoteId] = cooldownTicks;
        handleInstantDig(room, player, emDef.digCount || 3);
      } else if (emDef.effect) {
        // Activate buff
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
      // Check decoration touches ground (solid tile below its bottom edge)
      if (!decDef.canPlaceAnywhere) {
        const bottomY = decY + decDef.h;
        let touchesGround = false;
        for (let dx = 0; dx < decDef.w; dx++) {
          if (isSolid(room, decX + dx, bottomY)) {
            touchesGround = true;
            break;
          }
        }
        if (!touchesGround) {
          sendTo(player, { type: MSG.ERROR, message: 'Decoration must be placed on the ground' });
          break;
        }
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
  player.climbEfficiency = 1.0;

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
    if (e.climbEfficiency) player.climbEfficiency += e.climbEfficiency;
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
    if (db.climbEfficiency) player.climbEfficiency += db.climbEfficiency;
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
    if (e.climbEfficiency) player.climbEfficiency += e.climbEfficiency;
  }
}

export { createPlayer, broadcast, sendTo };
