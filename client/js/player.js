import {
  GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION, MAX_FALL_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, WORLD_WIDTH,
} from '../../shared/constants.js';

// Stamina constants
const MAX_STAMINA = 100;
const STAMINA_CLIMB_COST = 1.2;   // per frame while climbing
const STAMINA_REGEN_RATE = 1.5;   // per frame while grounded
const CLIMB_SPEED = 2.0;          // tiles per second

export class Player {
  constructor(id, name, color) {
    this.id = id;
    this.name = name || 'Dog';
    this.color = color || 0;
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
    this.resources = { bones: 0, gems: 0, fossils: 0, gold: 0, diamonds: 0, artifacts: 0 };
    this.unlockedEmotes = [0, 1];
    this.animFrame = 0;
    this.animTimer = 0;
    this.isLocal = false;

    // Climbing / stamina
    this.stamina = MAX_STAMINA;
    this.maxStamina = MAX_STAMINA;
    this.climbing = false;

    // Interpolation for remote players
    this.targetX = this.x;
    this.targetY = this.y;
  }

  // Client-side prediction for the local player
  predictUpdate(input, world, dt) {
    // Check if next to a wall (for climbing)
    const wallLeft = this.isSolidAt(world, this.x - PLAYER_WIDTH / 2 - 0.15, this.y - PLAYER_HEIGHT / 2);
    const wallRight = this.isSolidAt(world, this.x + PLAYER_WIDTH / 2 + 0.15, this.y - PLAYER_HEIGHT / 2);
    const nextToWall = wallLeft || wallRight;

    // Wall climbing: hold up next to a wall while airborne with stamina
    if (input.up && nextToWall && !this.grounded && this.stamina > 0) {
      this.climbing = true;
      this.vy = -CLIMB_SPEED;
      this.stamina -= STAMINA_CLIMB_COST;
      if (this.stamina < 0) this.stamina = 0;
      // Slow horizontal movement while climbing
      if (input.left) { this.vx = -MOVE_SPEED * 0.3; this.facing = -1; }
      else if (input.right) { this.vx = MOVE_SPEED * 0.3; this.facing = 1; }
      else { this.vx = 0; }
    } else {
      this.climbing = false;

      // Normal horizontal movement
      if (input.left) { this.vx = -MOVE_SPEED; this.facing = -1; }
      else if (input.right) { this.vx = MOVE_SPEED; this.facing = 1; }
      else { this.vx *= FRICTION; if (Math.abs(this.vx) < 0.1) this.vx = 0; }

      // Jump
      if (input.jump && this.grounded) {
        this.vy = JUMP_FORCE;
        this.grounded = false;
      }

      // Wall jump: press jump while next to wall and airborne
      if (input.jump && !this.grounded && nextToWall && this.stamina > 10) {
        this.vy = JUMP_FORCE * 0.8;
        this.vx = wallLeft ? MOVE_SPEED * 1.5 : -MOVE_SPEED * 1.5;
        this.stamina -= 10;
      }

      // Gravity (reduced while climbing/clinging)
      this.vy += GRAVITY;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    }

    // Regen stamina on ground
    if (this.grounded) {
      this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN_RATE);
    }

    // Move X — use inset collision box (shrink top/bottom by 0.15) to avoid ground false positives
    const newX = this.x + this.vx * dt;
    if (!this.collidesAtH(world, newX, this.y)) {
      this.x = newX;
    } else {
      // Snap to tile edge
      if (this.vx > 0) {
        const rightEdge = Math.floor(newX + PLAYER_WIDTH / 2);
        this.x = rightEdge - PLAYER_WIDTH / 2;
      } else if (this.vx < 0) {
        const leftEdge = Math.floor(newX - PLAYER_WIDTH / 2) + 1;
        this.x = leftEdge + PLAYER_WIDTH / 2;
      }
      this.vx = 0;
    }

    // Move Y
    const newY = this.y + this.vy * dt;
    if (!this.collidesAt(world, this.x, newY)) {
      this.y = newY;
      this.grounded = false;
    } else {
      if (this.vy > 0) {
        // Landing: find exact ground position
        const groundTileY = Math.floor(newY);
        this.y = groundTileY;
        // Verify we're not inside a tile; nudge up if needed
        while (this.collidesAt(world, this.x, this.y) && this.y > 0) {
          this.y -= 0.1;
        }
        this.y += 0.001; // tiny offset to stay just above
        this.grounded = true;
      } else {
        // Hit ceiling
        this.y = Math.floor(this.y - PLAYER_HEIGHT) + PLAYER_HEIGHT + 1;
      }
      this.vy = 0;
    }

    // Clamp
    this.x = Math.max(1 + PLAYER_WIDTH / 2, Math.min(WORLD_WIDTH - 1 - PLAYER_WIDTH / 2, this.x));

    // Animation
    this.animTimer++;
    if (this.climbing) {
      if (this.animTimer > 6) { this.animFrame = (this.animFrame + 1) % 2; this.animTimer = 0; }
    } else if (Math.abs(this.vx) > 0.5 || this.digging) {
      if (this.animTimer > 8) { this.animFrame = (this.animFrame + 1) % 2; this.animTimer = 0; }
    } else {
      this.animFrame = 0;
    }

    // Emote timer
    if (this.activeEmote !== null) {
      this.emoteTimer--;
      if (this.emoteTimer <= 0) this.activeEmote = null;
    }
  }

  // Check if a specific world position is solid
  isSolidAt(world, wx, wy) {
    return world.isSolid(Math.floor(wx), Math.floor(wy));
  }

  // Full AABB collision check
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

  // Horizontal collision: inset the vertical range to avoid ground overlap
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

  // Smooth interpolation for remote players
  interpolate(dt) {
    if (this.isLocal) return;
    const lerpSpeed = 0.3;
    this.x += (this.targetX - this.x) * lerpSpeed;
    this.y += (this.targetY - this.y) * lerpSpeed;
  }

  // Apply server state
  applyServerState(state) {
    if (this.isLocal) {
      const dx = state.x - this.x;
      const dy = state.y - this.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.x = state.x;
        this.y = state.y;
      } else {
        this.x += dx * 0.1;
        this.y += dy * 0.1;
      }
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
