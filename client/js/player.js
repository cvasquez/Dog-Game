import {
  GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION, MAX_FALL_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, WORLD_WIDTH,
} from '../../shared/constants.js';

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

    // Interpolation for remote players
    this.targetX = this.x;
    this.targetY = this.y;
  }

  // Client-side prediction for the local player
  predictUpdate(input, world, dt) {
    // Horizontal movement
    if (input.left) { this.vx = -MOVE_SPEED; this.facing = -1; }
    else if (input.right) { this.vx = MOVE_SPEED; this.facing = 1; }
    else { this.vx *= FRICTION; if (Math.abs(this.vx) < 0.1) this.vx = 0; }

    // Jump
    if (input.jump && this.grounded) {
      this.vy = JUMP_FORCE;
      this.grounded = false;
    }

    // Gravity
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // Move X
    const newX = this.x + this.vx * dt;
    if (!this.collidesAt(world, newX, this.y)) {
      this.x = newX;
    } else {
      if (this.vx > 0) this.x = Math.floor(this.x + PLAYER_WIDTH / 2) - PLAYER_WIDTH / 2;
      else if (this.vx < 0) this.x = Math.floor(this.x - PLAYER_WIDTH / 2) + 1 + PLAYER_WIDTH / 2;
      this.vx = 0;
    }

    // Move Y
    const newY = this.y + this.vy * dt;
    if (!this.collidesAt(world, this.x, newY)) {
      this.y = newY;
      this.grounded = false;
    } else {
      if (this.vy > 0) {
        this.y = Math.floor(this.y) + 0.01;
        while (!this.collidesAt(world, this.x, this.y + 0.1)) this.y += 0.1;
        this.grounded = true;
      } else {
        this.y = Math.floor(this.y - PLAYER_HEIGHT) + PLAYER_HEIGHT + 1;
      }
      this.vy = 0;
    }

    // Clamp
    this.x = Math.max(1 + PLAYER_WIDTH / 2, Math.min(WORLD_WIDTH - 1 - PLAYER_WIDTH / 2, this.x));

    // Animation
    this.animTimer++;
    if (Math.abs(this.vx) > 0.5 || this.digging) {
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
      // For local player: only correct if too far off
      const dx = state.x - this.x;
      const dy = state.y - this.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.x = state.x;
        this.y = state.y;
      } else {
        // Gentle nudge
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
