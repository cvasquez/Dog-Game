import {
  GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION, MAX_FALL_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, WORLD_WIDTH,
  DOG_BREEDS, HAZARD_TILES, TILE, UPGRADES, STAMINA_DIG_COST,
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

// Platformer feel constants (Celeste/SMB-inspired)
const ACCEL_GROUND = 0.8;       // ground acceleration per frame
const ACCEL_AIR = 0.5;          // air acceleration (less control)
const DECEL_GROUND = 0.7;       // ground deceleration when no input
const DECEL_AIR = 0.95;         // air deceleration (preserve momentum)
const COYOTE_TIME = 6;          // frames after leaving edge where jump still works
const JUMP_BUFFER_TIME = 6;     // frames before landing where jump input is remembered
const JUMP_CUT_MULTIPLIER = 0.4; // vy multiplied by this when releasing jump early
const APEX_GRAVITY_MULT = 0.5;  // reduced gravity near jump apex for floaty feel

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
    this.animState = 'idle';
    this.idleTimer = 0;
    this.isLocal = false;

    // Breed-adjusted base stats (before upgrades)
    const s = this.breed.stats;
    this.baseMoveSpeed = MOVE_SPEED * s.moveSpeed;
    this.baseJumpForce = JUMP_FORCE * s.jumpForce;
    this.baseDigSpeed = s.digSpeed;
    this.baseLootBonus = s.lootBonus || 0;
    this.baseMaxStamina = BASE_MAX_STAMINA * s.maxStamina;
    this.baseStaminaRegen = BASE_STAMINA_REGEN_RATE * s.staminaRegen;
    this.baseClimbEfficiency = 1.0;

    // Active stats (recalculated when upgrades change)
    this.moveSpeed = this.baseMoveSpeed;
    this.jumpForce = this.baseJumpForce;
    this.digSpeed = this.baseDigSpeed;
    this.lootBonus = this.baseLootBonus;
    this.climbEfficiency = 1.0;

    // Upgrades
    this.ownedUpgrades = [];

    // Stamina
    this.maxStamina = this.baseMaxStamina;
    this.stamina = this.maxStamina;
    this.staminaRegenRate = this.baseStaminaRegen;
    this.climbing = false;
    this.clinging = false;
    this.clingWallSide = 0;
    this.exhausted = false;
    this.exhaustionTimer = 0;
    this.groundedTimer = 0;
    this.prevJump = false;
    this.coyoteTimer = 0;      // frames since last grounded
    this.jumpBufferTimer = 0;  // frames since jump was pressed
    this.jumpHeld = false;     // is jump still held (for variable height)
    this.jumpWasCut = false;   // prevents cutting jump velocity every frame
    this.wasGrounded = false;

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

    // Jump buffer: remember jump presses for a few frames
    if (jumpPressed) this.jumpBufferTimer = JUMP_BUFFER_TIME;
    else if (this.jumpBufferTimer > 0) this.jumpBufferTimer--;

    // Track jump held for variable jump height
    this.jumpHeld = input.jump;

    const wallLeft = this.checkWall(world, -1);
    const wallRight = this.checkWall(world, 1);
    const nextToWall = wallLeft || wallRight;

    // Exhaustion recovery
    if (this.exhausted) {
      this.exhaustionTimer--;
      if (this.exhaustionTimer <= 0) this.exhausted = false;
    }

    // Coyote time: track frames since leaving ground
    if (this.grounded) {
      this.groundedTimer++;
      this.coyoteTimer = COYOTE_TIME;
    } else {
      this.groundedTimer = 0;
      if (this.coyoteTimer > 0) this.coyoteTimer--;
    }

    // --- CLIMBING ---
    // Ledge detection: if head is above the wall top and space above ledge is clear, mantle up
    const ledgeSide = (wallLeft && input.left) ? -1 : (wallRight && input.right) ? 1 : 0;
    if (ledgeSide !== 0 && !this.grounded && this.canMantle(world, ledgeSide)) {
      this.performMantle(world, ledgeSide);
    } else {
      // Only cling if actively pressing toward the wall
      const canCling = nextToWall && !this.grounded && !this.exhausted && this.stamina > 0;

      if (canCling && !this.clinging && !this.grounded) {
        const movingToward = (wallLeft && input.left) || (wallRight && input.right);
        if (movingToward) {
          this.clinging = true;
          this.clingWallSide = wallLeft ? -1 : 1;
          this.facing = this.clingWallSide; // face the wall
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
    }

    // --- MOVEMENT ---
    if (this.clinging) {
      // Face the wall while clinging
      this.facing = this.clingWallSide;

      // Check for mantle while climbing up
      if (input.up && this.canMantle(world, this.clingWallSide)) {
        this.performMantle(world, this.clingWallSide);
      } else if (input.up && this.stamina > 0) {
        this.vx = 0;
        this.climbing = true;
        this.vy = -CLIMB_SPEED;
        this.stamina -= STAMINA_CLIMB_COST / this.climbEfficiency;
      } else {
        this.vx = 0;
        this.climbing = false;
        this.vy = CLING_SLIDE_SPEED;
        this.stamina -= STAMINA_CLING_COST / this.climbEfficiency;
      }
      if (this.stamina < 0) this.stamina = 0;

      if (jumpPressed && this.stamina >= STAMINA_CLIMB_JUMP) {
        this.stamina -= STAMINA_CLIMB_JUMP;
        this.vy = CLIMB_JUMP_FORCE;
        const pushAway = (this.clingWallSide < 0 && input.right) ||
                         (this.clingWallSide > 0 && input.left);
        this.vx = -this.clingWallSide * this.moveSpeed * (pushAway ? 0.3 : 0.08);
        this.releaseCling();
      } else if (jumpPressed && this.stamina > 0) {
        this.vy = CLIMB_JUMP_FORCE * (this.stamina / STAMINA_CLIMB_JUMP) * 0.5;
        const pushAway = (this.clingWallSide < 0 && input.right) ||
                         (this.clingWallSide > 0 && input.left);
        this.vx = -this.clingWallSide * this.moveSpeed * (pushAway ? 0.2 : 0.08);
        this.stamina = 0;
        this.releaseCling();
      }
    } else {
      this.climbing = false;

      // Acceleration-based horizontal movement
      const targetVx = input.left ? -this.moveSpeed : input.right ? this.moveSpeed : 0;
      if (targetVx !== 0) {
        if (input.left) this.facing = -1;
        if (input.right) this.facing = 1;
        const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;
        // Accelerate toward target, with faster turning
        const turning = (this.vx > 0 && targetVx < 0) || (this.vx < 0 && targetVx > 0);
        this.vx += Math.sign(targetVx) * accel * (turning ? 1.5 : 1);
        // Clamp to max speed
        if (Math.abs(this.vx) > this.moveSpeed) {
          this.vx = Math.sign(this.vx) * this.moveSpeed;
        }
      } else {
        // Decelerate
        const decel = this.grounded ? DECEL_GROUND : DECEL_AIR;
        this.vx *= decel;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
      }

      // Jump with coyote time and buffer
      const canJump = this.grounded || this.coyoteTimer > 0;
      if (this.jumpBufferTimer > 0 && canJump) {
        this.vy = this.jumpForce;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.jumpWasCut = false;
      }

      // Variable jump height: cut jump short ONCE when releasing
      if (!this.jumpHeld && this.vy < 0 && !this.jumpWasCut) {
        this.vy *= JUMP_CUT_MULTIPLIER;
        this.jumpWasCut = true;
      }

      // Gravity with apex hang
      const nearApex = Math.abs(this.vy) < 1.5 && !this.grounded;
      const gravMult = nearApex ? APEX_GRAVITY_MULT : 1.0;
      this.vy += GRAVITY * gravMult;
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

    // Animation state machine
    let newState;
    if (this.clinging || this.climbing) {
      newState = 'climb';
    } else if (this.digging) {
      newState = 'dig';
    } else if (!this.grounded && this.vy < -0.5) {
      newState = 'jump';
    } else if (Math.abs(this.vx) > 0.5) {
      newState = 'walk';
    } else {
      newState = 'idle';
    }

    // Track idle duration for sit transition
    if (newState === 'idle') {
      this.idleTimer++;
      if (this.grounded && this.idleTimer > 120) { // ~2 seconds
        newState = 'sit';
      }
    } else {
      this.idleTimer = 0;
    }

    // Reset frame on state change
    if (newState !== this.animState) {
      this.animState = newState;
      this.animFrame = 0;
      this.animTimer = 0;
    }

    // Advance frame
    this.animTimer++;
    const rates = { walk: 8, dig: 6, climb: 8, jump: 99, idle: 99, sit: 30 };
    const rate = rates[this.animState] || 8;
    const maxFrames = this.animState === 'sit' ? 2 : 2;
    if (this.animTimer > rate) {
      this.animFrame = (this.animFrame + 1) % maxFrames;
      this.animTimer = 0;
      // Sit: hold on last frame
      if (this.animState === 'sit' && this.animFrame === 0) {
        this.animFrame = 1; // stay seated
      }
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

  canMantle(world, side) {
    // Check if the player's head is above the ledge and can step onto it
    const wx = side < 0 ? this.x - PLAYER_WIDTH / 2 - 0.1 : this.x + PLAYER_WIDTH / 2 + 0.1;
    const headY = this.y - PLAYER_HEIGHT + 0.1;
    const feetY = this.y - 0.15;
    const hasWallAtFeet = world.isSolid(Math.floor(wx), Math.floor(feetY));
    const hasWallAtHead = world.isSolid(Math.floor(wx), Math.floor(headY));
    if (!hasWallAtFeet || hasWallAtHead) return false;

    // The ledge top: find the topmost solid tile in the wall column near the player
    const wallTx = Math.floor(wx);
    let ledgeY = Math.floor(feetY);
    while (ledgeY > 0 && world.isSolid(wallTx, ledgeY - 1)) ledgeY--;

    // Can mantle if the player's head is at or above the ledge
    // and there's space on top of the ledge for the player
    const topY = ledgeY - 1; // tile above the ledge
    const onTopX = wallTx;
    if (world.isSolid(onTopX, topY)) return false;

    // Compute mantle position near the wall edge
    const margin = 0.05;
    let mantleX;
    if (side < 0) {
      mantleX = wallTx + 1 + PLAYER_WIDTH / 2 + margin;
    } else {
      mantleX = wallTx - PLAYER_WIDTH / 2 - margin;
    }

    // Check there's room for the player at the mantle position
    if (this.collidesAt(world, mantleX, ledgeY)) return false;

    this._mantleLedgeY = ledgeY;
    this._mantleX = mantleX;
    return true;
  }

  performMantle(world, side) {
    // Smoothly move player to the top of the ledge near the wall edge
    this.x = this._mantleX;
    this.y = this._mantleLedgeY;
    this.vy = 0;
    // Preserve a small amount of horizontal momentum for fluid feel
    this.vx = side < 0 ? -this.moveSpeed * 0.3 : this.moveSpeed * 0.3;
    this.grounded = true;
    if (this.clinging) this.releaseCling();
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
    this.dead = state.dead;
    this.color = state.color;
    this.breedId = state.color; // server sends breedId as color
    this.name = state.name;
  }

  applyUpgrades() {
    // Reset to base stats
    this.moveSpeed = this.baseMoveSpeed;
    this.jumpForce = this.baseJumpForce;
    this.digSpeed = this.baseDigSpeed;
    this.lootBonus = this.baseLootBonus;
    this.climbEfficiency = this.baseClimbEfficiency;
    const oldMax = this.maxStamina;
    this.maxStamina = this.baseMaxStamina;
    this.staminaRegenRate = this.baseStaminaRegen;

    // Apply each owned upgrade's effects additively
    for (const id of this.ownedUpgrades) {
      const upgrade = UPGRADES.find(u => u.id === id);
      if (!upgrade) continue;
      const e = upgrade.effect;
      if (e.moveSpeed) this.moveSpeed += this.baseMoveSpeed * e.moveSpeed;
      if (e.jumpForce) this.jumpForce += this.baseJumpForce * e.jumpForce;
      if (e.digSpeed) this.digSpeed += this.baseDigSpeed * e.digSpeed;
      if (e.lootBonus) this.lootBonus += e.lootBonus;
      if (e.maxStamina) this.maxStamina += this.baseMaxStamina * e.maxStamina;
      if (e.staminaRegen) this.staminaRegenRate += this.baseStaminaRegen * e.staminaRegen;
      if (e.climbEfficiency) this.climbEfficiency += e.climbEfficiency;
    }

    // Scale current stamina proportionally if max changed
    if (oldMax > 0 && this.maxStamina !== oldMax) {
      this.stamina = (this.stamina / oldMax) * this.maxStamina;
    }
  }
}
