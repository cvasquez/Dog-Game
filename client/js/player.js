import { getFrameCount } from './sprites.js';
import {
  GRAVITY, MOVE_SPEED, JUMP_FORCE, FRICTION, MAX_FALL_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, SURFACE_Y, WORLD_WIDTH,
  DOG_BREEDS, HAZARD_TILES, TILE, UPGRADES, EMOTES, STAMINA_DIG_COST, STAMINA_RUN_COST, SPRINT_SPEED_MULT, STAMINA_SPRINT_COST, MANTLE_FRAMES,
  BASE_MAX_STAMINA, BASE_STAMINA_REGEN_RATE, STAMINA_REGEN_DELAY, RESPAWN_FRAMES,
  STAMINA_EXHAUSTION_TIME, STAMINA_CLING_COST, STAMINA_CLIMB_COST,
  STAMINA_CLIMB_JUMP, CLIMB_SPEED, CLING_SLIDE_SPEED, CLIMB_JUMP_FORCE,
  ACCEL_GROUND, DECEL_GROUND, DECEL_AIR,
  COYOTE_TIME, JUMP_BUFFER_TIME, JUMP_CUT_MULTIPLIER, APEX_GRAVITY_MULT,
  calcDecorationBonuses,
  BASE_MAX_HP, HP_REGEN_RATE, HP_REGEN_DELAY, LAVA_DAMAGE,
  FALL_DAMAGE_MIN_BLOCKS, FALL_DAMAGE_SCALE, FALL_DAMAGE_STUN_FRAMES,
  BOUNCY_TILES, BOUNCY_FORCE, ICY_TILES, SLIPPERY_TILES,
  IDLE_SIT_DELAY, PRESTIGE_STAT_BONUS, PRESTIGE_HP_BONUS,
} from '../../shared/constants.js';

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
    // Emote ability system (RPG-style buffs with cooldowns)
    this.emoteBuff = null;        // { effect, timer, emoteId } — active buff
    this.emoteCooldowns = {};     // { [emoteId]: framesRemaining }
    this.resources = {
      bones: 0, gems: 0, fossils: 0, gold: 0, diamonds: 0, artifacts: 0,
      mushrooms: 0, crystals: 0, frozen_gems: 0, relics: 0,
    };
    this.bankedResources = {
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

    // Mantle animation state
    this.mantling = false;
    this.mantleTimer = 0;
    this.mantleStartX = 0;
    this.mantleStartY = 0;
    this.mantleMidX = 0;
    this.mantleMidY = 0;
    this.mantleEndX = 0;
    this.mantleEndY = 0;

    // Prestige level (persistent across resets)
    this.prestigeLevel = 0;

    // Breed-adjusted base stats (before upgrades)
    const s = this.breed.stats;
    this.baseMoveSpeed = MOVE_SPEED * s.moveSpeed;
    this.baseJumpForce = JUMP_FORCE * s.jumpForce;
    this.baseDigSpeed = s.digSpeed;
    this.baseLootBonus = s.lootBonus || 0;
    this.baseMaxStamina = BASE_MAX_STAMINA * s.maxStamina;
    this.baseStaminaRegen = BASE_STAMINA_REGEN_RATE * s.staminaRegen;
    this.baseClimbEfficiency = 1.0;
    this.baseMaxHP = BASE_MAX_HP * (s.maxHP || 1.0);

    // Active stats (recalculated when upgrades change)
    this.moveSpeed = this.baseMoveSpeed;
    this.jumpForce = this.baseJumpForce;
    this.digSpeed = this.baseDigSpeed;
    this.lootBonus = this.baseLootBonus;
    this.climbEfficiency = 1.0;

    // Upgrades
    this.ownedUpgrades = [];
    // Discovered blueprints (decoration IDs that require blueprints)
    this.discoveredBlueprints = [];

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

    // Per-breed hitbox dimensions (derived from opaque sprite bounds)
    this.hitboxWidth = this.breed.hitboxWidth || PLAYER_WIDTH;
    this.hitboxHeight = this.breed.hitboxHeight || PLAYER_HEIGHT;

    // Health
    this.maxHP = this.baseMaxHP;
    this.hp = this.maxHP;
    this.hpRegenTimer = 0;  // frames since last damage
    this.lastDamageType = null; // for death screen message

    // Death
    this.dead = false;
    this.respawnTimer = 0;

    // Interpolation
    this.targetX = this.x;
    this.targetY = this.y;

    // Squash & stretch (visual only)
    this.scaleX = 1;
    this.scaleY = 1;
    this.squashTimer = 0;

    // Landing detection for particles/shake
    this.justLanded = false;
    this.landingVelocity = 0;

    // Fall distance tracking (for distance-based fall damage)
    this.fallPeakY = this.y;

    // Wall slide detection for particles
    this.wallSliding = false;
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
        this.hp = this.maxHP;
        this.lastDamageType = null;
        this.fallPeakY = SURFACE_Y - 1;
      }
      return;
    }

    // Mantle animation: two-phase interpolation through midpoint (tile corner)
    if (this.mantling) {
      this.mantleTimer--;
      const t = 1 - (this.mantleTimer / MANTLE_FRAMES);
      const halfPoint = Math.floor(MANTLE_FRAMES / 2);
      if (t <= 0.5) {
        // Phase 1: start → midpoint (sprite center reaches tile corner)
        const p = t * 2; // 0→1 over first half
        const ease = 1 - (1 - p) * (1 - p); // ease-out
        this.x = this.mantleStartX + (this.mantleMidX - this.mantleStartX) * ease;
        this.y = this.mantleStartY + (this.mantleMidY - this.mantleStartY) * ease;
      } else {
        // Phase 2: midpoint → end (pull over and land on top)
        const p = (t - 0.5) * 2; // 0→1 over second half
        const ease = p * p; // ease-in
        this.x = this.mantleMidX + (this.mantleEndX - this.mantleMidX) * ease;
        this.y = this.mantleMidY + (this.mantleEndY - this.mantleMidY) * ease;
      }
      this.vx = 0;
      this.vy = 0;
      if (this.mantleTimer <= 0) {
        this.mantling = false;
        this.x = this.mantleEndX;
        this.y = this.mantleEndY;
        this.grounded = true;
        // Small push in mantle direction for fluid feel
        this.vx = this.mantleSide < 0 ? -this.moveSpeed * 0.3 : this.moveSpeed * 0.3;
      }
      // Update animation state for mantle
      this.animState = 'mantle';
      this.animTimer++;
      this.animFrame = this.mantleTimer > halfPoint ? 0 : 1;
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

      // Running drains stamina; sprinting drains extra
      const moving = (input.left || input.right) && this.grounded;
      const sprinting = input.sprint && !this.exhausted && this.stamina > 0 && moving;
      const effectiveSpeed = sprinting ? this.moveSpeed * SPRINT_SPEED_MULT : this.moveSpeed;
      this._movingDrain = false;
      if (moving && !this.exhausted) {
        this.stamina -= STAMINA_RUN_COST;
        if (sprinting) {
          this.stamina -= STAMINA_SPRINT_COST;
          this._movingDrain = true;
        }
        if (this.stamina <= 0) this.triggerExhaustion();
      }

      // Acceleration-based horizontal movement
      const targetVx = input.left ? -effectiveSpeed : input.right ? effectiveSpeed : 0;
      if (targetVx !== 0) {
        if (input.left) this.facing = -1;
        if (input.right) this.facing = 1;
        if (this.grounded) {
          // Smooth acceleration on ground with faster turning
          const turning = (this.vx > 0 && targetVx < 0) || (this.vx < 0 && targetVx > 0);
          this.vx += Math.sign(targetVx) * ACCEL_GROUND * (turning ? 1.5 : 1);
          if (Math.abs(this.vx) > effectiveSpeed) {
            this.vx = Math.sign(this.vx) * effectiveSpeed;
          }
        } else {
          // In air: direction control at base speed, preserve sprint momentum (no acceleration)
          if (Math.abs(this.vx) <= effectiveSpeed) {
            this.vx = Math.sign(targetVx) * effectiveSpeed;
          }
        }
      } else {
        // Decelerate (additive for consistent stop distance)
        if (this.grounded) {
          // Biome surface effects: icy/slippery tiles reduce deceleration
          let decelRate = ACCEL_GROUND * 0.85;
          if (this.isOnIce(world)) decelRate *= 0.15;        // very slippery
          else if (this.isOnSlippery(world)) decelRate *= 0.4; // somewhat slippery
          if (Math.abs(this.vx) <= decelRate) this.vx = 0;
          else this.vx -= Math.sign(this.vx) * decelRate;
        } else {
          this.vx *= DECEL_AIR;
          if (Math.abs(this.vx) < 0.1) this.vx = 0;
        }
      }

      // Jump with coyote time and buffer
      const canJump = this.grounded || this.coyoteTimer > 0;
      if (this.jumpBufferTimer > 0 && canJump) {
        this.vy = this.jumpForce;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.jumpWasCut = false;
        // Jump stretch
        this.scaleX = 0.85;
        this.scaleY = 1.2;
        this.squashTimer = 6;
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

    // Stamina regen on ground after delay (not while running/sprinting/digging)
    if (this.grounded && !this.exhausted && !this._movingDrain && !this.digging && this.groundedTimer > STAMINA_REGEN_DELAY) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate);
    }

    // HP regen (slow, requires being grounded for a while)
    this.hpRegenTimer++;
    if (this.grounded && this.hpRegenTimer > HP_REGEN_DELAY && this.hp < this.maxHP) {
      this.hp = Math.min(this.maxHP, this.hp + HP_REGEN_RATE);
    }

    // --- PHYSICS ---
    const prevGrounded = this.grounded;
    const preVy = this.vy;

    const newX = this.x + this.vx * dt;
    if (!this.collidesAtH(world, newX, this.y)) {
      this.x = newX;
    } else {
      if (this.vx > 0) {
        this.x = Math.floor(newX + this.hitboxWidth / 2) - this.hitboxWidth / 2;
      } else if (this.vx < 0) {
        this.x = Math.floor(newX - this.hitboxWidth / 2) + 1 + this.hitboxWidth / 2;
      }
      this.vx = 0;
    }

    const newY = this.y + this.vy * dt;
    if (!this.collidesAt(world, this.x, newY)) {
      this.y = newY;
      this.grounded = false;
      // Track highest point (lowest Y) while airborne
      if (this.y < this.fallPeakY) this.fallPeakY = this.y;
    } else {
      if (this.vy > 0) {
        // Landing
        const groundTileY = Math.floor(newY);
        this.y = groundTileY;
        while (this.collidesAt(world, this.x, this.y) && this.y > 0) this.y -= 0.1;
        this.y += 0.001;
        this.grounded = true;
        this.vy = 0;
        if (this.clinging) this.releaseCling();
      } else {
        // Hitting ceiling — try corner correction (nudge horizontally to slip past)
        let corrected = false;
        // Prefer the direction the player is moving; fall back to the other side
        const primaryDir = this.vx >= 0 ? 1 : -1;
        const dirs = [primaryDir, -primaryDir];
        for (const dir of dirs) {
          // Try progressively larger nudges up to just under half the hitbox width
          for (let n = 0.1; n <= 0.45; n += 0.1) {
            if (!this.collidesAt(world, this.x + dir * n, newY)) {
              this.x += dir * n;
              this.y = newY;
              corrected = true;
              break;
            }
          }
          if (corrected) break;
        }
        if (!corrected) {
          this.y = Math.floor(this.y - this.hitboxHeight) + this.hitboxHeight;
          this.vy = 0;
        }
      }
    }

    // Landing detection
    this.justLanded = false;
    if (this.grounded && !prevGrounded && preVy > 1) {
      // Check for bouncy tiles (mushroom biome)
      const tileBelow = this.getTileBelow(world);
      if (BOUNCY_TILES.has(tileBelow)) {
        this.vy = this.jumpForce * BOUNCY_FORCE;
        this.grounded = false;
        this.justLanded = true;
        this.landingVelocity = preVy;
        this.scaleX = 0.85;
        this.scaleY = 1.2;
        this.squashTimer = 6;
        this.fallPeakY = this.y;
      } else {
        this.justLanded = true;
        this.landingVelocity = preVy;
        // Land squash
        const intensity = Math.min(1, preVy / MAX_FALL_SPEED);
        this.scaleX = 1 + 0.25 * intensity;
        this.scaleY = 1 - 0.25 * intensity;
        this.squashTimer = 6;

        // Distance-based fall damage (HP loss + stun)
        const fallBlocks = this.y - this.fallPeakY;
        if (fallBlocks > FALL_DAMAGE_MIN_BLOCKS) {
          const excess = fallBlocks - FALL_DAMAGE_MIN_BLOCKS;
          const damage = excess * excess * FALL_DAMAGE_SCALE;
          this.takeDamage(damage, 'fall');
          if (!this.dead) {
            // Stun only — no stamina drain from landing
            this.exhausted = true;
            this.exhaustionTimer = FALL_DAMAGE_STUN_FRAMES;
          }
        }
      }
      this.fallPeakY = this.y;
    }

    // Wall slide detection
    this.wallSliding = this.clinging && !this.climbing;

    this.x = Math.max(1 + this.hitboxWidth / 2, Math.min(WORLD_WIDTH - 1 - this.hitboxWidth / 2, this.x));

    // Squash & stretch decay (lerp back to 1.0)
    if (this.squashTimer > 0) {
      this.squashTimer--;
      this.scaleX += (1 - this.scaleX) * 0.3;
      this.scaleY += (1 - this.scaleY) * 0.3;
    } else {
      this.scaleX = 1;
      this.scaleY = 1;
    }

    // Animation state machine
    let newState;
    if (this.clinging || this.climbing) {
      newState = 'climb';
    } else if (this.digging) {
      newState = 'dig';
    } else if (!this.grounded) {
      newState = 'jump';
    } else if (Math.abs(this.vx) > 0.5) {
      newState = 'walk';
    } else {
      newState = 'idle';
    }

    // Track idle duration for sit transition
    if (newState === 'idle') {
      this.idleTimer++;
      if (this.grounded && this.idleTimer > IDLE_SIT_DELAY) {
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
    const rates = { walk: 8, dig: 6, climb: 8, jump: 8, idle: 99, sit: 30 };
    const rate = rates[this.animState] || 8;
    const maxFrames = getFrameCount(this.breedId, this.animState);
    if (this.animTimer > rate) {
      this.animFrame = (this.animFrame + 1) % maxFrames;
      this.animTimer = 0;
      // Sit: hold on last frame
      if (this.animState === 'sit' && this.animFrame === 0) {
        this.animFrame = maxFrames - 1; // stay seated
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
    const cy2 = Math.floor(this.y - this.hitboxHeight / 2);
    for (const ty of [cy, cy2]) {
      for (const tx of [cx, Math.floor(this.x - this.hitboxWidth / 2), Math.floor(this.x + this.hitboxWidth / 2 - 0.01)]) {
        if (HAZARD_TILES.has(world.getTile(tx, ty))) {
          this.takeDamage(LAVA_DAMAGE, 'lava');
          return;
        }
      }
    }
  }

  takeDamage(amount, source) {
    if (this.dead) return;
    this.hp -= amount;
    this.hpRegenTimer = 0;
    this.lastDamageType = source;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  die() {
    this.dead = true;
    this.respawnTimer = RESPAWN_FRAMES;
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
    const wx = side < 0 ? this.x - this.hitboxWidth / 2 - 0.1 : this.x + this.hitboxWidth / 2 + 0.1;
    const headY = this.y - this.hitboxHeight + 0.1;
    const feetY = this.y - 0.15;
    const hasWallAtFeet = world.isSolid(Math.floor(wx), Math.floor(feetY));
    const hasWallAtHead = world.isSolid(Math.floor(wx), Math.floor(headY));
    if (!hasWallAtFeet || hasWallAtHead) return false;

    // The ledge top: find the topmost solid tile in the wall column near the player
    // Limit search to 2 tiles above the head to prevent warping up tall shafts
    const wallTx = Math.floor(wx);
    const minScanY = Math.floor(headY) - 2;
    let ledgeY = Math.floor(feetY);
    while (ledgeY > 0 && ledgeY > minScanY && world.isSolid(wallTx, ledgeY - 1)) ledgeY--;

    // Can mantle if the player's head is at or above the ledge
    // and there's space on top of the ledge for the player
    const topY = ledgeY - 1; // tile above the ledge
    const onTopX = wallTx;
    if (world.isSolid(onTopX, topY)) return false;

    // Compute mantle position near the wall edge
    const margin = 0.05;
    let mantleX;
    if (side < 0) {
      mantleX = wallTx + 1 + this.hitboxWidth / 2 + margin;
    } else {
      mantleX = wallTx - this.hitboxWidth / 2 - margin;
    }

    // Check there's room for the player at the mantle position
    if (this.collidesAt(world, mantleX, ledgeY)) return false;

    this._mantleLedgeY = ledgeY;
    this._mantleX = mantleX;
    this._mantleWallTx = wallTx;
    return true;
  }

  performMantle(world, side) {
    // Start animated mantle: interpolate from current position through
    // a midpoint where the sprite center aligns with the tile corner,
    // then to the final position on top of the ledge.
    this.mantling = true;
    this.mantleTimer = MANTLE_FRAMES;
    this.mantleStartX = this.x;
    this.mantleStartY = this.y;
    // Midpoint: sprite center (x, y - 0.5) at the tile corner
    const cornerX = side < 0 ? this._mantleWallTx + 1 : this._mantleWallTx;
    this.mantleMidX = cornerX;
    this.mantleMidY = this._mantleLedgeY + 0.5; // +0.5 so sprite center lands on corner
    this.mantleEndX = this._mantleX;
    this.mantleEndY = this._mantleLedgeY;
    this.mantleSide = side;
    this.vx = 0;
    this.vy = 0;
    if (this.clinging) this.releaseCling();
  }

  getTileBelow(world) {
    return world.getTile(Math.floor(this.x), Math.floor(this.y + 0.1));
  }

  isOnIce(world) {
    const tile = this.getTileBelow(world);
    return ICY_TILES.has(tile);
  }

  isOnSlippery(world) {
    const tile = this.getTileBelow(world);
    return SLIPPERY_TILES.has(tile);
  }

  checkWall(world, side) {
    const wx = side < 0 ? this.x - this.hitboxWidth / 2 - 0.1 : this.x + this.hitboxWidth / 2 + 0.1;
    const headY = this.y - this.hitboxHeight + 0.1;
    const midY = this.y - this.hitboxHeight / 2;
    const feetY = this.y - 0.15;
    return world.isSolid(Math.floor(wx), Math.floor(headY)) ||
           world.isSolid(Math.floor(wx), Math.floor(midY)) ||
           world.isSolid(Math.floor(wx), Math.floor(feetY));
  }

  collidesAt(world, px, py) {
    const left = Math.floor(px - this.hitboxWidth / 2);
    const right = Math.floor(px + this.hitboxWidth / 2 - 0.01);
    const top = Math.floor(py - this.hitboxHeight);
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
    const left = Math.floor(px - this.hitboxWidth / 2);
    const right = Math.floor(px + this.hitboxWidth / 2 - 0.01);
    const top = Math.floor(py - this.hitboxHeight + inset);
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
      // Don't override position during mantle animation
      if (!this.mantling) {
        const dx = state.x - this.x;
        const dy = state.y - this.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) { this.x = state.x; this.y = state.y; }
        else { this.x += dx * 0.1; this.y += dy * 0.1; }
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
    this.dead = state.dead;
    this.color = state.color;
    this.breedId = state.color; // server sends breedId as color
    this.name = state.name;
    // Sync stamina from server for multiplayer
    if (state.stamina != null) this.stamina = state.stamina;
    if (state.maxStamina != null) this.maxStamina = state.maxStamina;
    if (state.exhausted != null) this.exhausted = state.exhausted;
  }

  applyUpgrades(decorations) {
    // Reset to base stats
    this.moveSpeed = this.baseMoveSpeed;
    this.jumpForce = this.baseJumpForce;
    this.digSpeed = this.baseDigSpeed;
    this.lootBonus = this.baseLootBonus;
    this.climbEfficiency = this.baseClimbEfficiency;
    const oldMax = this.maxStamina;
    const oldMaxHP = this.maxHP;
    this.maxStamina = this.baseMaxStamina;
    this.staminaRegenRate = this.baseStaminaRegen;
    this.maxHP = this.baseMaxHP;

    // Apply prestige bonuses (permanent across resets)
    if (this.prestigeLevel > 0) {
      const pBonus = this.prestigeLevel * PRESTIGE_STAT_BONUS;
      this.moveSpeed += this.baseMoveSpeed * pBonus;
      this.jumpForce += this.baseJumpForce * pBonus;
      this.digSpeed += this.baseDigSpeed * pBonus;
      this.maxStamina += this.baseMaxStamina * pBonus;
      this.staminaRegenRate += this.baseStaminaRegen * pBonus;
      this.maxHP += this.baseMaxHP * (this.prestigeLevel * PRESTIGE_HP_BONUS);
    }

    // Apply each owned upgrade's effects additively (self-only)
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

    // Apply decoration bonuses (shared — benefit all players)
    if (decorations && decorations.length > 0) {
      const db = calcDecorationBonuses(decorations);
      if (db.moveSpeed) this.moveSpeed += this.baseMoveSpeed * db.moveSpeed;
      if (db.jumpForce) this.jumpForce += this.baseJumpForce * db.jumpForce;
      if (db.digSpeed) this.digSpeed += this.baseDigSpeed * db.digSpeed;
      if (db.lootBonus) this.lootBonus += db.lootBonus;
      if (db.maxStamina) this.maxStamina += this.baseMaxStamina * db.maxStamina;
      if (db.staminaRegen) this.staminaRegenRate += this.baseStaminaRegen * db.staminaRegen;
      if (db.climbEfficiency) this.climbEfficiency += db.climbEfficiency;
    }

    // Apply active emote buff (temporary, self-only)
    if (this.emoteBuff) {
      const e = this.emoteBuff.effect;
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
    // Scale current HP proportionally if max changed
    if (oldMaxHP > 0 && this.maxHP !== oldMaxHP) {
      this.hp = (this.hp / oldMaxHP) * this.maxHP;
    }
  }

  // Activate an emote ability buff (client-side, 60fps frames)
  activateEmoteBuff(emoteId) {
    const emDef = EMOTES[emoteId];
    if (!emDef || !emDef.effect) return false;
    // Check cooldown
    if (this.emoteCooldowns[emoteId]) return false;
    // Start buff and cooldown (in 60fps frames)
    this.emoteBuff = { effect: emDef.effect, timer: Math.round(emDef.duration * 60), emoteId };
    this.emoteCooldowns[emoteId] = Math.round(emDef.cooldown * 60);
    return true;
  }

  // Tick down emote buff and cooldowns (call once per frame at 60fps)
  updateEmoteTimers(decorations) {
    let recalc = false;
    if (this.emoteBuff) {
      this.emoteBuff.timer--;
      if (this.emoteBuff.timer <= 0) {
        this.emoteBuff = null;
        recalc = true;
      }
    }
    for (const id in this.emoteCooldowns) {
      this.emoteCooldowns[id]--;
      if (this.emoteCooldowns[id] <= 0) delete this.emoteCooldowns[id];
    }
    if (recalc) this.applyUpgrades(decorations);
  }
}
