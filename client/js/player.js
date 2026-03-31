import {
  GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION, MAX_FALL_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, WORLD_WIDTH,
} from '../../shared/constants.js';

// Stamina constants (BotW-style)
const MAX_STAMINA = 100;
const STAMINA_CLING_COST = 0.4;    // per frame just holding onto wall
const STAMINA_CLIMB_COST = 1.0;    // per frame actively climbing up
const STAMINA_CLIMB_JUMP = 20;     // cost for a climb-jump (leap off wall upward)
const STAMINA_REGEN_RATE = 1.2;    // per frame while grounded (after delay)
const STAMINA_REGEN_DELAY = 30;    // frames on ground before regen starts
const STAMINA_EXHAUSTION_TIME = 45; // frames of exhaustion after hitting 0

const CLIMB_SPEED = 2.5;           // tiles per second climbing up
const CLING_SLIDE_SPEED = 0.5;     // tiles per second sliding down while clinging
const CLIMB_JUMP_FORCE = -9.0;     // upward force for climb-jump

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

    // Climbing / stamina (BotW-style)
    this.stamina = MAX_STAMINA;
    this.maxStamina = MAX_STAMINA;
    this.climbing = false;       // actively climbing up
    this.clinging = false;       // holding onto wall (may be sliding down)
    this.clingWallSide = 0;      // -1 = wall on left, 1 = wall on right
    this.exhausted = false;      // stamina hit 0, can't climb until recovered
    this.exhaustionTimer = 0;
    this.groundedTimer = 0;      // frames spent on ground (for regen delay)
    this.prevJump = false;       // for jump edge detection

    // Interpolation for remote players
    this.targetX = this.x;
    this.targetY = this.y;
  }

  predictUpdate(input, world, dt) {
    // Detect jump press (edge trigger)
    const jumpPressed = input.jump && !this.prevJump;
    this.prevJump = input.jump;

    // Check walls
    const wallLeft = this.checkWall(world, -1);
    const wallRight = this.checkWall(world, 1);
    const nextToWall = wallLeft || wallRight;

    // Exhaustion recovery
    if (this.exhausted) {
      this.exhaustionTimer--;
      if (this.exhaustionTimer <= 0) {
        this.exhausted = false;
      }
    }

    // Grounded timer for regen delay
    if (this.grounded) {
      this.groundedTimer++;
    } else {
      this.groundedTimer = 0;
    }

    // --- CLIMBING STATE MACHINE ---
    const canCling = nextToWall && !this.grounded && !this.exhausted && this.stamina > 0;

    // Enter cling: touch a wall while airborne
    if (canCling && !this.clinging && !this.grounded) {
      // Auto-cling when moving toward a wall or falling near one
      const movingTowardWall = (wallLeft && (input.left || this.vx < -0.5)) ||
                                (wallRight && (input.right || this.vx > 0.5));
      const falling = this.vy > 1;
      if (movingTowardWall || falling) {
        this.clinging = true;
        this.clingWallSide = wallLeft ? -1 : 1;
        this.vx = 0;
        this.vy = 0;
      }
    }

    // Release cling conditions
    if (this.clinging) {
      // Lost the wall
      const stillOnWall = this.clingWallSide < 0 ? wallLeft : wallRight;
      if (!stillOnWall) {
        this.releaseCling();
      }
      // Touched ground
      else if (this.grounded) {
        this.releaseCling();
      }
      // Pressed away from wall or down
      else if ((this.clingWallSide < 0 && input.right) ||
               (this.clingWallSide > 0 && input.left) ||
               input.down) {
        this.releaseCling();
        // Small push away from wall
        this.vx = -this.clingWallSide * MOVE_SPEED * 0.5;
      }
      // Stamina ran out
      else if (this.stamina <= 0) {
        this.triggerExhaustion();
      }
    }

    // --- MOVEMENT ---
    if (this.clinging) {
      // While clinging to wall
      this.vx = 0;

      if (input.up && this.stamina > 0) {
        // Actively climbing up
        this.climbing = true;
        this.vy = -CLIMB_SPEED;
        this.stamina -= STAMINA_CLIMB_COST;
      } else {
        // Just holding on — slow slide down
        this.climbing = false;
        this.vy = CLING_SLIDE_SPEED;
        this.stamina -= STAMINA_CLING_COST;
      }

      if (this.stamina < 0) this.stamina = 0;

      // Climb-jump: press jump while clinging
      if (jumpPressed && this.stamina >= STAMINA_CLIMB_JUMP) {
        this.stamina -= STAMINA_CLIMB_JUMP;
        this.vy = CLIMB_JUMP_FORCE;
        // Small push away from wall so you can clear ledges
        this.vx = -this.clingWallSide * MOVE_SPEED * 0.3;
        this.releaseCling();
      } else if (jumpPressed && this.stamina > 0) {
        // Not enough for full climb-jump but do a smaller one with remaining stamina
        this.vy = CLIMB_JUMP_FORCE * (this.stamina / STAMINA_CLIMB_JUMP) * 0.5;
        this.vx = -this.clingWallSide * MOVE_SPEED * 0.2;
        this.stamina = 0;
        this.releaseCling();
      }

    } else {
      // Normal movement (not clinging)
      this.climbing = false;

      // Horizontal
      if (input.left) { this.vx = -MOVE_SPEED; this.facing = -1; }
      else if (input.right) { this.vx = MOVE_SPEED; this.facing = 1; }
      else { this.vx *= FRICTION; if (Math.abs(this.vx) < 0.1) this.vx = 0; }

      // Ground jump
      if (jumpPressed && this.grounded) {
        this.vy = JUMP_FORCE;
        this.grounded = false;
      }

      // Gravity
      this.vy += GRAVITY;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    }

    // Stamina regen: only on ground, after delay
    if (this.grounded && !this.exhausted && this.groundedTimer > STAMINA_REGEN_DELAY) {
      this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN_RATE);
    }

    // --- PHYSICS ---
    // Move X
    const newX = this.x + this.vx * dt;
    if (!this.collidesAtH(world, newX, this.y)) {
      this.x = newX;
    } else {
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
        // Landing
        const groundTileY = Math.floor(newY);
        this.y = groundTileY;
        while (this.collidesAt(world, this.x, this.y) && this.y > 0) {
          this.y -= 0.1;
        }
        this.y += 0.001;
        this.grounded = true;
        // Release cling on landing
        if (this.clinging) this.releaseCling();
      } else {
        // Hit ceiling
        this.y = Math.floor(this.y - PLAYER_HEIGHT) + PLAYER_HEIGHT + 1;
        // If climbing and hit ceiling, stop
        if (this.clinging) {
          this.vy = 0;
        }
      }
      this.vy = 0;
    }

    // Clamp
    this.x = Math.max(1 + PLAYER_WIDTH / 2, Math.min(WORLD_WIDTH - 1 - PLAYER_WIDTH / 2, this.x));

    // Animation
    this.animTimer++;
    if (this.clinging || this.climbing) {
      if (this.climbing) {
        if (this.animTimer > 6) { this.animFrame = (this.animFrame + 1) % 2; this.animTimer = 0; }
      } else {
        // Slow idle cling animation
        if (this.animTimer > 15) { this.animFrame = (this.animFrame + 1) % 2; this.animTimer = 0; }
      }
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
    // Fall with reduced max speed so it feels like you're flailing
    this.vy = Math.min(this.vy, 2);
  }

  // Check if there's a wall on the given side (-1 = left, 1 = right)
  // Checks multiple points along the player's height for reliability
  checkWall(world, side) {
    const wx = side < 0
      ? this.x - PLAYER_WIDTH / 2 - 0.1
      : this.x + PLAYER_WIDTH / 2 + 0.1;
    // Check at head, mid, and feet level
    const headY = this.y - PLAYER_HEIGHT + 0.1;
    const midY = this.y - PLAYER_HEIGHT / 2;
    const feetY = this.y - 0.15;
    return world.isSolid(Math.floor(wx), Math.floor(headY)) ||
           world.isSolid(Math.floor(wx), Math.floor(midY)) ||
           world.isSolid(Math.floor(wx), Math.floor(feetY));
  }

  isSolidAt(world, wx, wy) {
    return world.isSolid(Math.floor(wx), Math.floor(wy));
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
    const lerpSpeed = 0.3;
    this.x += (this.targetX - this.x) * lerpSpeed;
    this.y += (this.targetY - this.y) * lerpSpeed;
  }

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
