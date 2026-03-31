import {
  GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION, MAX_FALL_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, WORLD_WIDTH,
  DOG_BREEDS, HAZARD_TILES, TILE,
} from '../../shared/constants.js';

// Base stamina constants (modified by breed)
const BASE_MAX_STAMINA = 100;
const STAMINA_CLING_COST = 0.4;
const STAMINA_CLIMB_COST = 1.0;
const STAMINA_CLIMB_JUMP = 20;
const BASE_STAMINA_REGEN_RATE = 1.2;
const STAMINA_REGEN_DELAY = 30;
const STAMINA_EXHAUSTION_TIME = 45;
const CLIMB_SPEED = 2.5;
const CLING_SLIDE_SPEED = 0.5;
const CLIMB_JUMP_FORCE = -9.0;

export class Player {
  constructor(id, name, breedId) {
    this.id = id;
    this.name = name || 'Dog';
    this.breedId = breedId || 0;
    this.breed = DOG_BREEDS[this.breedId] || DOG_BREEDS[0];
    this.color = this.breedId; // for sprite lookup
    this.x = WORLD_WIDTH / 2;
    this.y = SURFACE_Y - 1;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.digging = false;
    this.digTarget = null;
    this.digProgress = 0;
    this.activeEmote = null;
    this.emoteTimer = 0;
    this.resources = {
      bones: 0, gems: 0, fossils: 0, gold: 0, diamonds: 0, artifacts: 0,
      mushrooms: 0, crystals: 0, frozen_gems: 0, relics: 0,
    };
    this.unlockedEmotes = [0, 1];
    // Add breed's free emote
    if (this.breed.freeEmote != null && !this.unlockedEmotes.includes(this.breed.freeEmote)) {
      this.unlockedEmotes.push(this.breed.freeEmote);
    }
    this.animFrame = 0;
    this.animTimer = 0;
    this.isLocal = false;

    // Breed-adjusted stats
    const s = this.breed.stats;
    this.moveSpeed = MOVE_SPEED * s.moveSpeed;
    this.jumpForce = JUMP_FORCE * s.jumpForce;
    this.digSpeed = s.digSpeed;
    this.lootBonus = s.lootBonus || 0;

    // Stamina
    this.maxStamina = BASE_MAX_STAMINA * s.maxStamina;
    this.stamina = this.maxStamina;
    this.staminaRegenRate = BASE_STAMINA_REGEN_RATE * s.staminaRegen;
    this.climbing = false;
    this.clinging = false;
    this.clingWallSide = 0;
    this.exhausted = false;
    this.exhaustionTimer = 0;
    this.groundedTimer = 0;
    this.prevJump = false;

    // Lava damage
    this.dead = false;
    this.respawnTimer = 0;

    // Interpolation
    this.targetX = this.x;
    this.targetY = this.y;
  }

  predictUpdate(input, world, dt) {
    // Respawn timer
    if (this.dead) {
      this.respawnTimer--;
      if (this.respawnTimer <= 0) {
        this.dead = false;
        this.x = WORLD_WIDTH / 2;
        this.y = SURFACE_Y - 1;
        this.vx = 0;
        this.vy = 0;
        this.stamina = this.maxStamina;
      }
      return;
    }

    // Check for lava
    this.checkHazards(world);
    if (this.dead) return;

    const jumpPressed = input.jump && !this.prevJump;
    this.prevJump = input.jump;

    const wallLeft = this.checkWall(world, -1);
    const wallRight = this.checkWall(world, 1);
    const nextToWall = wallLeft || wallRight;

    // Exhaustion recovery
    if (this.exhausted) {
      this.exhaustionTimer--;
      if (this.exhaustionTimer <= 0) this.exhausted = false;
    }

    if (this.grounded) this.groundedTimer++;
    else this.groundedTimer = 0;

    // --- CLIMBING ---
    // Only cling if actively pressing toward the wall
    const canCling = nextToWall && !this.grounded && !this.exhausted && this.stamina > 0;

    if (canCling && !this.clinging && !this.grounded) {
      const movingToward = (wallLeft && input.left) || (wallRight && input.right);
      if (movingToward) {
        this.clinging = true;
        this.clingWallSide = wallLeft ? -1 : 1;
        this.vx = 0;
        this.vy = 0;
      }
    }

    if (this.clinging) {
      const stillOnWall = this.clingWallSide < 0 ? wallLeft : wallRight;
      if (!stillOnWall || this.grounded) {
        this.releaseCling();
      } else if ((this.clingWallSide < 0 && input.right) ||
                 (this.clingWallSide > 0 && input.left) || input.down) {
        this.releaseCling();
        this.vx = -this.clingWallSide * this.moveSpeed * 0.5;
      } else if (this.stamina <= 0) {
        this.triggerExhaustion();
      }
    }

    // --- MOVEMENT ---
    if (this.clinging) {
      this.vx = 0;
      if (input.up && this.stamina > 0) {
        this.climbing = true;
        this.vy = -CLIMB_SPEED;
        this.stamina -= STAMINA_CLIMB_COST;
      } else {
        this.climbing = false;
        this.vy = CLING_SLIDE_SPEED;
        this.stamina -= STAMINA_CLING_COST;
      }
      if (this.stamina < 0) this.stamina = 0;

      if (jumpPressed && this.stamina >= STAMINA_CLIMB_JUMP) {
        this.stamina -= STAMINA_CLIMB_JUMP;
        this.vy = CLIMB_JUMP_FORCE;
        // Only push away from wall if pressing away; otherwise jump straight up
        const pushAway = (this.clingWallSide < 0 && input.right) ||
                         (this.clingWallSide > 0 && input.left);
        this.vx = pushAway ? -this.clingWallSide * this.moveSpeed * 0.3 : 0;
        this.releaseCling();
      } else if (jumpPressed && this.stamina > 0) {
        this.vy = CLIMB_JUMP_FORCE * (this.stamina / STAMINA_CLIMB_JUMP) * 0.5;
        const pushAway = (this.clingWallSide < 0 && input.right) ||
                         (this.clingWallSide > 0 && input.left);
        this.vx = pushAway ? -this.clingWallSide * this.moveSpeed * 0.2 : 0;
        this.stamina = 0;
        this.releaseCling();
      }
    } else {
      this.climbing = false;
      if (input.left) { this.vx = -this.moveSpeed; this.facing = -1; }
      else if (input.right) { this.vx = this.moveSpeed; this.facing = 1; }
      else { this.vx *= FRICTION; if (Math.abs(this.vx) < 0.1) this.vx = 0; }

      if (jumpPressed && this.grounded) {
        this.vy = this.jumpForce;
        this.grounded = false;
      }

      this.vy += GRAVITY;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    }

    // Stamina regen on ground after delay
    if (this.grounded && !this.exhausted && this.groundedTimer > STAMINA_REGEN_DELAY) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate);
    }

    // --- PHYSICS ---
    const newX = this.x + this.vx * dt;
    if (!this.collidesAtH(world, newX, this.y)) {
      this.x = newX;
    } else {
      if (this.vx > 0) {
        this.x = Math.floor(newX + PLAYER_WIDTH / 2) - PLAYER_WIDTH / 2;
      } else if (this.vx < 0) {
        this.x = Math.floor(newX - PLAYER_WIDTH / 2) + 1 + PLAYER_WIDTH / 2;
      }
      this.vx = 0;
    }

    const newY = this.y + this.vy * dt;
    if (!this.collidesAt(world, this.x, newY)) {
      this.y = newY;
      this.grounded = false;
    } else {
      if (this.vy > 0) {
        const groundTileY = Math.floor(newY);
        this.y = groundTileY;
        while (this.collidesAt(world, this.x, this.y) && this.y > 0) this.y -= 0.1;
        this.y += 0.001;
        this.grounded = true;
        if (this.clinging) this.releaseCling();
      } else {
        this.y = Math.floor(this.y - PLAYER_HEIGHT) + PLAYER_HEIGHT + 1;
        if (this.clinging) this.vy = 0;
      }
      this.vy = 0;
    }

    this.x = Math.max(1 + PLAYER_WIDTH / 2, Math.min(WORLD_WIDTH - 1 - PLAYER_WIDTH / 2, this.x));

    // Animation
    this.animTimer++;
    if (this.clinging || this.climbing) {
      const rate = this.climbing ? 6 : 15;
      if (this.animTimer > rate) { this.animFrame = (this.animFrame + 1) % 2; this.animTimer = 0; }
    } else if (Math.abs(this.vx) > 0.5 || this.digging) {
      if (this.animTimer > 8) { this.animFrame = (this.animFrame + 1) % 2; this.animTimer = 0; }
    } else {
      this.animFrame = 0;
    }

    if (this.activeEmote !== null) {
      this.emoteTimer--;
      if (this.emoteTimer <= 0) this.activeEmote = null;
    }
  }

  checkHazards(world) {
    // Check tiles around player's position for lava
    const cx = Math.floor(this.x);
    const cy = Math.floor(this.y - 0.01);
    const cy2 = Math.floor(this.y - PLAYER_HEIGHT / 2);
    for (const ty of [cy, cy2]) {
      for (const tx of [cx, Math.floor(this.x - PLAYER_WIDTH / 2), Math.floor(this.x + PLAYER_WIDTH / 2 - 0.01)]) {
        if (HAZARD_TILES.has(world.getTile(tx, ty))) {
          this.die();
          return;
        }
      }
    }
  }

  die() {
    this.dead = true;
    this.respawnTimer = 90; // ~1.5 seconds
  }

  releaseCling() {
    this.clinging = false;
    this.climbing = false;
    this.clingWallSide = 0;
  }

  triggerExhaustion() {
    this.exhausted = true;
    this.exhaustionTimer = STAMINA_EXHAUSTION_TIME;
    this.stamina = 0;
    this.releaseCling();
    this.vy = Math.min(this.vy, 2);
  }

  checkWall(world, side) {
    const wx = side < 0 ? this.x - PLAYER_WIDTH / 2 - 0.1 : this.x + PLAYER_WIDTH / 2 + 0.1;
    const headY = this.y - PLAYER_HEIGHT + 0.1;
    const midY = this.y - PLAYER_HEIGHT / 2;
    const feetY = this.y - 0.15;
    return world.isSolid(Math.floor(wx), Math.floor(headY)) ||
           world.isSolid(Math.floor(wx), Math.floor(midY)) ||
           world.isSolid(Math.floor(wx), Math.floor(feetY));
  }

  collidesAt(world, px, py) {
    const left = Math.floor(px - PLAYER_WIDTH / 2);
    const right = Math.floor(px + PLAYER_WIDTH / 2 - 0.01);
    const top = Math.floor(py - PLAYER_HEIGHT);
    const bottom = Math.floor(py - 0.01);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (world.isSolid(tx, ty)) return true;
      }
    }
    return false;
  }

  collidesAtH(world, px, py) {
    const inset = 0.15;
    const left = Math.floor(px - PLAYER_WIDTH / 2);
    const right = Math.floor(px + PLAYER_WIDTH / 2 - 0.01);
    const top = Math.floor(py - PLAYER_HEIGHT + inset);
    const bottom = Math.floor(py - 0.01 - inset);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (world.isSolid(tx, ty)) return true;
      }
    }
    return false;
  }

  interpolate(dt) {
    if (this.isLocal) return;
    this.x += (this.targetX - this.x) * 0.3;
    this.y += (this.targetY - this.y) * 0.3;
  }

  applyServerState(state) {
    if (this.isLocal) {
      const dx = state.x - this.x;
      const dy = state.y - this.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) { this.x = state.x; this.y = state.y; }
      else { this.x += dx * 0.1; this.y += dy * 0.1; }
      this.grounded = state.grounded;
    } else {
      this.targetX = state.x;
      this.targetY = state.y;
      this.vx = state.vx;
      this.vy = state.vy;
    }
    this.facing = state.facing;
    this.digging = state.digging;
    this.digTarget = state.digTarget;
    this.digProgress = state.digProgress;
    this.activeEmote = state.activeEmote;
    this.color = state.color;
    this.name = state.name;
  }
}
