import { TILE_SIZE, TILE, MSG, SURFACE_Y, TILE_COLORS, RESOURCE_NAMES, EMOTE_DISPLAY_FRAMES, RESPAWN_FRAMES, getNearbyShop, getNearbyBank, SOLID_TILES, DECORATIONS, PARK_TOP, PARK_BOTTOM, EMOTES } from '../../shared/constants.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { ParticleSystem } from './particles.js';
import { Network } from './network.js';
import { HUD } from './hud.js';
import { Shop } from './shop.js';
import { Bank } from './bank.js';
import { ActionBar } from './emotes.js';
import mpDebug from './mp-debug.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input();
    this.world = new World();
    this.camera = null;
    this.particles = new ParticleSystem();
    this.network = new Network();
    this.hud = new HUD();
    this.shop = new Shop();
    this.bank = new Bank();
    this.actionBar = new ActionBar(this.hud);

    this.localPlayer = null;
    this.players = new Map();
    this.decorations = [];
    this.roomId = null;
    this.running = false;
    this.lastTime = 0;
    this.placingDecoration = null; // id of decoration being placed, or null
    this.pings = []; // { x, y, playerName, life }
    // Input history for server reconciliation — stores state snapshots
    // keyed by the input seq at which each snapshot was taken
    this.inputHistory = [];
    this._lastInputSeq = 0;
  }

  async start(roomId, playerName, breedId) {
    // Connect to server
    const joinData = await this.network.connect(roomId, playerName, breedId);

    // Setup world
    this.world.loadFromArray(joinData.world);
    this.roomId = joinData.roomId;
    this.decorations = joinData.decorations || [];

    // Setup camera
    const viewSize = this.renderer.getViewSize();
    this.camera = new Camera(viewSize.width, viewSize.height);

    // Setup local player
    const localData = joinData.players.find(p => p.id === joinData.playerId);
    this.localPlayer = new Player(joinData.playerId, localData.name, localData.color);
    this.localPlayer.isLocal = true;
    this.localPlayer.serverAuthoritative = true; // server owns stamina/exhaustion/digging
    this.localPlayer.x = localData.x;
    this.localPlayer.y = localData.y;
    if (localData.resources) this.localPlayer.resources = localData.resources;
    if (localData.bankedResources) this.localPlayer.bankedResources = localData.bankedResources;
    if (localData.unlockedEmotes) this.localPlayer.unlockedEmotes = localData.unlockedEmotes;
    if (localData.ownedUpgrades) {
      this.localPlayer.ownedUpgrades = localData.ownedUpgrades;
      this.localPlayer.applyUpgrades(this.decorations);
    }
    this.players.set(this.localPlayer.id, this.localPlayer);

    // Bank callbacks — send deposit/withdraw to server
    this.bank.onDeposit = (key, amount) => {
      this.network.send({ type: MSG.DEPOSIT, resource: key, amount });
    };
    this.bank.onWithdraw = (key, amount) => {
      this.network.send({ type: MSG.WITHDRAW, resource: key, amount });
    };

    // Setup remote players
    for (const pd of joinData.players) {
      if (pd.id === joinData.playerId) continue;
      const rp = new Player(pd.id, pd.name, pd.color);
      rp.x = pd.x;
      rp.y = pd.y;
      rp.targetX = pd.x;
      rp.targetY = pd.y;
      this.players.set(pd.id, rp);
    }

    // Setup network handlers
    this.setupNetworkHandlers();

    // Setup shop callbacks
    this.shop.onBuyDecoration = (decId) => {
      this.network.sendBuyDecoration(decId);
      this.placingDecoration = decId;
      this.shop.hide();
      this.notify('Click in the dog park to place your decoration!');
    };
    this.shop.onBuyEmote = (emoteId) => {
      this.network.sendBuyEmote(emoteId);
    };
    this.shop.onBuyUpgrade = (upgradeId) => {
      this.network.sendBuyUpgrade(upgradeId);
    };

    // Show game canvas
    this.canvas.style.display = 'block';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.actionBar.show();

    // Update HUD
    this.hud.setRoomCode(this.roomId);
    this.hud.updateResources(this.localPlayer.resources);

    // Show key legend (same as single-player)
    const legend = document.getElementById('keyLegend');
    const legendHint = document.getElementById('keyLegendHint');
    const keysHidden = localStorage.getItem('doggame_keysVisible') === 'false';
    if (legend) {
      legend.classList.toggle('hidden', keysHidden);
      legend.style.display = '';
    }
    if (legendHint) {
      legendHint.style.display = keysHidden ? '' : 'none';
    }

    // Canvas click for decoration placement
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    // Window resize
    window.addEventListener('resize', () => {
      this.renderer.resize();
      if (this.camera) {
        const vs = this.renderer.getViewSize();
        this.camera.resize(vs.width, vs.height);
      }
    });

    // Start game loop
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setupNetworkHandlers() {
    this.network.on(MSG.STATE, (msg) => {
      for (const ps of msg.players) {
        const player = this.players.get(ps.id);
        if (player) {
          player.applyServerState(ps, this.world, this.inputHistory);
        }
      }
      // Log RTT periodically
      mpDebug.rtt(this.network.rtt);
    });

    this.network.on(MSG.TILE_UPDATE, (msg) => {
      const oldTile = this.world.getTile(msg.x, msg.y);
      this.world.setTile(msg.x, msg.y, msg.tile);
      // Particles for tile break
      if (msg.tile === TILE.AIR && oldTile !== TILE.AIR) {
        const colors = TILE_COLORS[oldTile];
        const color = colors ? colors.main : '#795548';
        this.particles.emitDig(
          msg.x * TILE_SIZE + TILE_SIZE / 2,
          msg.y * TILE_SIZE + TILE_SIZE / 2,
          color
        );
        // Sparkle if it was a resource
        if (RESOURCE_NAMES[oldTile]) {
          const gemColor = colors && colors.gem ? colors.gem : '#FFD700';
          this.particles.emitSparkle(
            msg.x * TILE_SIZE + TILE_SIZE / 2,
            msg.y * TILE_SIZE + TILE_SIZE / 2,
            gemColor
          );
        }
      }
    });

    this.network.on(MSG.RESOURCE_COLLECTED, (msg) => {
      if (msg.playerId === this.localPlayer.id) {
        this.localPlayer.resources[msg.resource] = msg.amount;
        this.hud.updateResources(this.localPlayer.resources);
        // Floating text at player position
        this.particles.emitText(
          this.localPlayer.x * TILE_SIZE,
          (this.localPlayer.y - 1) * TILE_SIZE,
          `+1 ${msg.resource}`,
          '#FFD700'
        );
      }
    });

    this.network.on(MSG.PLAYER_JOINED, (msg) => {
      const p = new Player(msg.player.id, msg.player.name, msg.player.color);
      p.x = msg.player.x;
      p.y = msg.player.y;
      p.targetX = msg.player.x;
      p.targetY = msg.player.y;
      this.players.set(p.id, p);
      this.notify(`${msg.player.name} joined!`);
    });

    this.network.on(MSG.PLAYER_LEFT, (msg) => {
      const p = this.players.get(msg.playerId);
      if (p) this.notify(`${p.name} left`);
      this.players.delete(msg.playerId);
    });

    this.network.on(MSG.DECORATION_PLACED, (msg) => {
      this.decorations.push(msg.decoration);
      // Recalculate local player stats (decoration buffs affect everyone)
      this.localPlayer.applyUpgrades(this.decorations);
      this.notify(`${msg.decoration.placedBy} placed a decoration!`);
    });

    this.network.on(MSG.EMOTE_TRIGGERED, (msg) => {
      const p = this.players.get(msg.playerId);
      if (p) {
        p.activeEmote = msg.emoteId;
        p.emoteTimer = EMOTE_DISPLAY_FRAMES;
        // Show buff activation for remote players (visual only)
        if (msg.buffDuration && !p.isLocal) {
          p.emoteBuff = { emoteId: msg.emoteId, timer: Math.round(msg.buffDuration * 60) };
        }
      }
    });

    this.network.on(MSG.PURCHASE_RESULT, (msg) => {
      if (msg.success) {
        if (msg.resources) {
          this.localPlayer.resources = msg.resources;
          this.hud.updateResources(this.localPlayer.resources);
        }
        if (msg.unlockedEmotes) {
          this.localPlayer.unlockedEmotes = msg.unlockedEmotes;
        }
        if (msg.ownedUpgrades) {
          this.localPlayer.ownedUpgrades = msg.ownedUpgrades;
          this.localPlayer.applyUpgrades(this.decorations);
        }
        // Refresh shop if open
        if (this.shop.visible) {
          this.shop.show(this.localPlayer.resources, this.localPlayer.unlockedEmotes, this.localPlayer.ownedUpgrades, null, this.localPlayer.discoveredBlueprints);
        }
        this.notify('Purchase successful!');
      }
    });

    this.network.on(MSG.BANK_UPDATE, (msg) => {
      this.localPlayer.resources = msg.resources;
      this.localPlayer.bankedResources = msg.bankedResources;
      this.hud.updateResources(this.localPlayer.resources);
      if (this.bank.visible) {
        this.bank.show(this.localPlayer.resources, this.localPlayer.bankedResources);
      }
    });

    this.network.on(MSG.DIG_REJECTED, (msg) => {
      this.notify(msg.reason === 'no_stamina' ? 'Too tired to dig!' : 'Nothing to dig here!');
    });

    this.network.on(MSG.SAVED, () => {
      this.notify('World saved!');
    });

    this.network.on(MSG.ERROR, (msg) => {
      this.notify(msg.message);
    });

    this.network.on(MSG.PING_PLACED, (msg) => {
      this.pings.push({ x: msg.x, y: msg.y, playerName: msg.playerName, life: 600 }); // 10 seconds
      this.notify(`${msg.playerName} pinged a location!`);
    });

    this.network.on('close', () => {
      this.notify('Disconnected from server');
    });
  }

  loop(timestamp) {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // Track nearby shop/bank for prompt rendering
    this.nearbyShop = getNearbyShop(this.localPlayer.x, this.localPlayer.y);
    this.nearbyBank = getNearbyBank(this.localPlayer.x, this.localPlayer.y);

    // Handle shop/bank toggle — only when near a machine at the surface
    if (this.input.justPressed('KeyB')) {
      if (this.shop.visible) {
        this.shop.hide();
      } else if (this.bank.visible) {
        this.bank.hide();
      } else if (this.nearbyBank) {
        this.bank.show(this.localPlayer.resources, this.localPlayer.bankedResources || {});
      } else if (this.nearbyShop) {
        this.shop.show(this.localPlayer.resources, this.localPlayer.unlockedEmotes, this.localPlayer.ownedUpgrades, this.nearbyShop.type, this.localPlayer.discoveredBlueprints);
      } else {
        this.notify('Find a shop at the surface to buy items!');
      }
    }

    // Handle save
    if (this.input.justPressed('Tab')) {
      this.network.sendSave();
    }

    // Toggle key legend (H key)
    if (this.input.justPressed('KeyH') && !this.shop.visible && !this.bank.visible) {
      const legend = document.getElementById('keyLegend');
      const legendHint = document.getElementById('keyLegendHint');
      if (legend) {
        const nowHidden = !legend.classList.contains('hidden');
        legend.classList.toggle('hidden', nowHidden);
        if (legendHint) legendHint.style.display = nowHidden ? '' : 'none';
        localStorage.setItem('doggame_keysVisible', String(!nowHidden));
      }
    }

    // Recall to surface (R key) — uses Scratch emote if unlocked
    if (this.input.justPressed('KeyR') && this.localPlayer.y > SURFACE_Y + 1) {
      const scratchEmote = EMOTES.findIndex(e => e && e.isRecall);
      if (scratchEmote >= 0 && this.localPlayer.unlockedEmotes.includes(scratchEmote) && !this.localPlayer.emoteCooldowns[scratchEmote]) {
        this.network.sendEmote(scratchEmote);
        this.localPlayer.activeEmote = scratchEmote;
        this.localPlayer.emoteTimer = EMOTE_DISPLAY_FRAMES;
        this.localPlayer.emoteCooldowns[scratchEmote] = Math.round(EMOTES[scratchEmote].cooldown * 60);
        this.notify('Scratched your way back to the surface!');
      } else if (scratchEmote < 0 || !this.localPlayer.unlockedEmotes.includes(scratchEmote)) {
        this.notify('Unlock the Scratch emote to recall!');
      } else {
        this.notify('Recall is on cooldown!');
      }
    }

    // Action bar — number keys 1-8 trigger emotes
    for (let k = 1; k <= 8; k++) {
      if (this.input.justPressed('Digit' + k)) {
        const emoteId = this.actionBar.getEmoteForSlot(k);
        if (emoteId != null && !this.localPlayer.emoteCooldowns[emoteId]) {
          const emDef = EMOTES[emoteId];
          this.network.sendEmote(emoteId);
          this.localPlayer.activeEmote = emoteId;
          this.localPlayer.emoteTimer = EMOTE_DISPLAY_FRAMES;
          if (emDef && emDef.isRecall) {
            // Recall: server handles teleport, just start cooldown locally
            this.localPlayer.emoteCooldowns[emoteId] = Math.round(emDef.cooldown * 60);
            this.notify('Scratched your way back to the surface!');
          } else {
            this.localPlayer.activateEmoteBuff(emoteId);
            this.localPlayer.applyUpgrades(this.decorations);
          }
        }
      }
    }
    this.actionBar.update(this.localPlayer.unlockedEmotes, this.localPlayer.emoteCooldowns);
    this.actionBar.activeEmoteId = this.localPlayer.emoteBuff ? this.localPlayer.emoteBuff.emoteId : null;

    // Tick emote buff/cooldown timers
    this.localPlayer.updateEmoteTimers(this.decorations);

    // Exploration ping
    if (this.input.justPressed('KeyP')) {
      this.network.send({ type: MSG.PING, x: this.localPlayer.x, y: this.localPlayer.y });
    }

    // Update pings
    for (let i = this.pings.length - 1; i >= 0; i--) {
      this.pings[i].life--;
      if (this.pings[i].life <= 0) this.pings.splice(i, 1);
    }

    // Cancel decoration placement or close shop/bank on Escape
    if (this.input.justPressed('Escape')) {
      if (this.shop.visible) {
        this.shop.hide();
      } else if (this.bank.visible) {
        this.bank.hide();
      }
      this.placingDecoration = null;
    }

    if (!this.shop.visible) {
      // Send input to server
      const inputState = this.input.getState();
      mpDebug.input(inputState);
      this.network.sendInput(inputState);

      // Client-side prediction
      const prevAnim = this.localPlayer.animState;
      const prevGrounded = this.localPlayer.grounded;
      this.localPlayer.predictUpdate(inputState, this.world, dt);

      // Store prediction state for server reconciliation
      const seq = this.network.inputSeq;
      if (seq > this._lastInputSeq) {
        this._lastInputSeq = seq;
        this.inputHistory.push({
          seq,
          input: { ...inputState },
          x: this.localPlayer.x,
          y: this.localPlayer.y,
          vx: this.localPlayer.vx,
          vy: this.localPlayer.vy,
        });
        // Cap ring buffer at ~2 seconds of input changes
        if (this.inputHistory.length > 120) this.inputHistory.shift();
      }

      mpDebug.prediction(this.localPlayer);
      if (this.localPlayer.animState !== prevAnim) {
        mpDebug.animChange(prevAnim, this.localPlayer.animState, this.localPlayer);
      }
      if (this.localPlayer.grounded !== prevGrounded) {
        mpDebug.groundedChange(prevGrounded, this.localPlayer.grounded, this.localPlayer);
      }
    }

    // Landing effects: particles + screen shake
    if (this.localPlayer.justLanded) {
      this.particles.emitLand(
        this.localPlayer.x * TILE_SIZE,
        this.localPlayer.y * TILE_SIZE
      );
      if (this.localPlayer.landingVelocity > 8) {
        const intensity = Math.min(3, (this.localPlayer.landingVelocity - 8) * 0.75);
        this.camera.shake(intensity, 6);
      }
    }
    // Wall slide particles
    if (this.localPlayer.wallSliding && Math.random() < 0.3) {
      const wx = this.localPlayer.clingWallSide < 0
        ? (this.localPlayer.x - this.localPlayer.hitboxWidth / 2) * TILE_SIZE
        : (this.localPlayer.x + this.localPlayer.hitboxWidth / 2) * TILE_SIZE;
      this.particles.emitWallSlide(wx, (this.localPlayer.y - this.localPlayer.hitboxHeight / 2) * TILE_SIZE, this.localPlayer.clingWallSide);
    }

    // Update remote players
    for (const [id, player] of this.players) {
      if (!player.isLocal) {
        player.interpolate(dt, performance.now());
        // Derive animation state — use interpolated velocity for walk/idle
        // to avoid flickering at 20Hz server update rate
        if (player.mantling) player.animState = 'mantle';
        else if (player.climbing || player.clinging) player.animState = 'climb';
        else if (player.digging) player.animState = 'dig';
        else if (Math.abs(player.interpVx || 0) > 0.02) player.animState = 'walk';
        else player.animState = 'idle';
        // Advance frames
        player.animTimer = (player.animTimer || 0) + 1;
        if (player.animTimer > 8) {
          player.animFrame = ((player.animFrame || 0) + 1) % 2;
          player.animTimer = 0;
        }
        // Emote timer
        if (player.activeEmote !== null) {
          player.emoteTimer--;
          if (player.emoteTimer <= 0) player.activeEmote = null;
        }
      }
    }

    // Determine stamina drain source
    let drainSource = null;
    if (this.localPlayer.digging) drainSource = 'DIG';
    else if (this.localPlayer.climbing) drainSource = 'CLIMB';
    else if (this.localPlayer.clinging) drainSource = 'CLING';
    else if (this.input.sprint && this.localPlayer.grounded && (this.input.left || this.input.right)) drainSource = 'SPRINT';

    // Update stamina HUD
    this.hud.updateStamina(this.localPlayer.stamina, this.localPlayer.maxStamina, this.localPlayer.exhausted, drainSource);
    this.hud.updateBuff(this.localPlayer.emoteBuff);

    // Trigger idle zoom when sitting
    this.camera.setIdleZoom(this.localPlayer.animState === 'sit');

    // Update camera
    this.camera.follow(this.localPlayer.x, this.localPlayer.y);

    // Update particles
    this.particles.update();

    // Update HUD depth
    const depth = Math.max(0, Math.floor(this.localPlayer.y - SURFACE_Y));
    this.hud.updateDepth(depth);
    this.hud.updatePlayerList(this.players);

    // Contextual hints
    this.hud.updateHints();
    if (this.localPlayer.clinging) {
      this.hud.showHint('walljump', 'Press SPACE on a wall to wall jump!');
    }

    // Update input state (for justPressed)
    this.input.update();
  }

  render() {
    const ctx = this.renderer.ctx;

    this.renderer.clear();

    // Apply idle camera zoom
    this.renderer.beginZoom(this.camera);

    this.renderer.drawSky(this.camera);
    this.renderer.drawUnderground(this.camera);
    this.renderer.drawTiles(this.world, this.camera);
    this.renderer.drawParkZone(this.camera);
    this.renderer.drawDecorations(this.decorations, this.camera);
    this.renderer.drawShopMachines(this.camera);
    this.renderer.drawBankMachine(this.camera);

    // Draw all players
    for (const [id, player] of this.players) {
      this.renderer.drawPlayer(player, this.camera, player.isLocal);
    }

    // Draw particles
    this.particles.render(ctx, this.camera);

    // Draw pings
    if (this.pings.length > 0) {
      this.renderer.drawPings(this.pings, this.camera);
    }

    // Shop interaction prompt
    if (this.nearbyShop && !this.shop.visible) {
      this.renderer.drawShopPrompt(this.nearbyShop, this.camera);
    }

    // Bank interaction prompt
    if (this.nearbyBank) {
      this.renderer.drawBankPrompt(this.camera);
    }

    // Draw decoration placement preview
    if (this.placingDecoration !== null) {
      const mouseWorld = this.screenToWorld(this.input.mouseX, this.input.mouseY);
      const tx = Math.floor(mouseWorld.x);
      const ty = Math.floor(mouseWorld.y);
      const placeDef = DECORATIONS.find(d => d.id === this.placingDecoration);
      let valid = (placeDef && placeDef.canPlaceAnywhere) || (ty >= PARK_TOP && ty <= PARK_BOTTOM);
      if (valid && placeDef && !placeDef.canPlaceAnywhere) {
        const bottomY = ty + placeDef.h;
        let touchesGround = false;
        for (let dx = 0; dx < placeDef.w; dx++) {
          if (SOLID_TILES.has(this.world.getTile(tx + dx, bottomY))) {
            touchesGround = true;
            break;
          }
        }
        if (!touchesGround) valid = false;
      }
      this.renderer.drawPlacementPreview(tx, ty, this.placingDecoration, valid, this.camera);
    }

    this.renderer.endZoom(this.camera);

    // Death screen overlay (drawn outside zoom so it fills the full screen)
    if (this.localPlayer.dead) {
      this.renderer.drawDeathScreen(this.localPlayer.respawnTimer, RESPAWN_FRAMES);
    }

    // Action bar is HTML-based, no canvas render needed
  }

  handleCanvasClick(e) {
    if (this.placingDecoration === null) return;

    const mouseWorld = this.screenToWorld(e.clientX, e.clientY);
    const tx = Math.floor(mouseWorld.x);
    const ty = Math.floor(mouseWorld.y);

    const decDef = DECORATIONS.find(d => d.id === this.placingDecoration);
    let canPlaceHere = (decDef && decDef.canPlaceAnywhere) || (ty >= PARK_TOP && ty <= PARK_BOTTOM);
    if (canPlaceHere && decDef && !decDef.canPlaceAnywhere) {
      const bottomY = ty + decDef.h;
      let touchesGround = false;
      for (let dx = 0; dx < decDef.w; dx++) {
        if (SOLID_TILES.has(this.world.getTile(tx + dx, bottomY))) {
          touchesGround = true;
          break;
        }
      }
      canPlaceHere = touchesGround;
    }
    if (canPlaceHere) {
      this.network.sendPlaceDecoration(this.placingDecoration, tx, ty);
      this.placingDecoration = null;
    } else {
      this.notify('Must place on the ground in the dog park area');
    }
  }

  screenToWorld(screenX, screenY) {
    const scale = this.renderer.scale;
    const logX = screenX / scale;
    const logY = screenY / scale;
    const cx = this.renderer.renderWidth / 2;
    const cy = this.renderer.renderHeight / 2;
    const zoom = this.camera.zoom;
    return {
      x: ((logX - cx) / zoom + cx + this.camera.x) / TILE_SIZE,
      y: ((logY - cy) / zoom + cy + this.camera.y) / TILE_SIZE,
    };
  }

  notify(text) {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = text;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}
