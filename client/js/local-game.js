import {
  TILE_SIZE, TILE, SURFACE_Y, TILE_COLORS, RESOURCE_NAMES, HARDNESS,
  SOLID_TILES, WORLD_WIDTH, WORLD_HEIGHT, DECORATIONS,
  EMOTES, PARK_TOP, PARK_BOTTOM, STAMINA_DIG_COST, UPGRADES, EMOTE_DISPLAY_FRAMES,
  RESPAWN_FRAMES, getNearbyShop, placeShopFloors, BLUEPRINT_DROPS,
  CRUMBLE_TILES, CRUMBLE_DELAY_FRAMES, ACHIEVEMENTS, BIOMES,
} from '../../shared/constants.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { ParticleSystem } from './particles.js';
import { HUD } from './hud.js';
import { Shop } from './shop.js';
import { ActionBar } from './emotes.js';
import { generateWorld } from './world-gen.js';

const SAVE_KEY = 'doggame_worlds';
const AUTO_SAVE_MS = 60_000; // auto-save every minute

export class LocalGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input();
    this.world = new World();
    this.camera = null;
    this.particles = new ParticleSystem();
    this.hud = new HUD();
    this.shop = new Shop();
    this.actionBar = new ActionBar();

    this.localPlayer = null;
    this.players = new Map();
    this.decorations = [];
    this.worldId = null;
    this.seed = 0;
    this.running = false;
    this.lastTime = 0;
    this.placingDecoration = null;

    // Digging state
    this.digTarget = null;
    this.digProgress = 0;

    // Persistent tile damage: Map of "x,y" -> accumulated dig progress
    this.tileDamage = new Map();

    // Crumbling tiles: Map of "x,y" -> { x, y, timer, maxTimer }
    this.crumblingTiles = new Map();

    // Passive resource generation timer
    this.lastGenTime = Date.now();

    // Achievement system
    this.achievements = new Set();
    this.stats = {
      totalBones: 0, totalGems: 0, totalGold: 0, totalDiamonds: 0,
      totalArtifacts: 0, maxDepth: 0, tilesDigged: 0,
      deaths: 0, fallDamagesTaken: 0,
    };
    this.achievementQueue = []; // pending popups
  }

  start(playerName, breedId, saveData) {
    // Generate or load world
    if (saveData) {
      this.seed = saveData.seed;
      this.worldId = saveData.id;
      // Ensure shop floors exist (backwards compat with old saves)
      placeShopFloors(saveData.tiles);
      this.world.loadFromArray(saveData.tiles);
      this.decorations = saveData.decorations || [];
    } else {
      this.seed = Math.floor(Math.random() * 2147483647);
      this.worldId = this.genId();
      const tiles = generateWorld(this.seed);
      this.world.loadFromArray(tiles);
      this.decorations = [];
    }

    // Setup camera
    const viewSize = this.renderer.getViewSize();
    this.camera = new Camera(viewSize.width, viewSize.height);

    // Setup player
    this.localPlayer = new Player('local', playerName, breedId);
    this.localPlayer.isLocal = true;
    this.localPlayer.x = WORLD_WIDTH / 2;
    this.localPlayer.y = SURFACE_Y - 1;

    // Restore player state from save
    if (saveData && saveData.player) {
      this.localPlayer.x = saveData.player.x;
      this.localPlayer.y = saveData.player.y;
      this.localPlayer.resources = saveData.player.resources;
      this.localPlayer.unlockedEmotes = saveData.player.unlockedEmotes;
      if (saveData.player.ownedUpgrades) {
        this.localPlayer.ownedUpgrades = saveData.player.ownedUpgrades;
      }
      if (saveData.player.discoveredBlueprints) {
        this.localPlayer.discoveredBlueprints = saveData.player.discoveredBlueprints;
      }
      if (saveData.player.prestigeLevel) {
        this.localPlayer.prestigeLevel = saveData.player.prestigeLevel;
      }
      if (saveData.player.hp != null) {
        this.localPlayer.hp = saveData.player.hp;
      }
      this.localPlayer.applyUpgrades(this.decorations);
      if (saveData.player.hp != null) {
        this.localPlayer.hp = saveData.player.hp; // re-set after applyUpgrades scales it
      }
    }
    // Restore achievements and stats
    if (saveData && saveData.achievements) {
      this.achievements = new Set(saveData.achievements);
    }
    if (saveData && saveData.stats) {
      Object.assign(this.stats, saveData.stats);
    }

    this.players.set('local', this.localPlayer);

    // Setup shop
    this.shop.onBuyDecoration = (decId) => {
      const decDef = DECORATIONS.find(d => d.id === decId);
      if (!decDef || !this.canAfford(decDef.cost)) {
        this.notify('Cannot afford this decoration');
        return;
      }
      this.deductCost(decDef.cost);
      this.hud.updateResources(this.localPlayer.resources);
      this.placingDecoration = decId;
      this.shop.hide();
      this.notify('Click in the dog park to place your decoration!');
    };
    this.shop.onBuyEmote = (emoteId) => {
      const emoteDef = EMOTES.find(e => e.id === emoteId);
      if (!emoteDef || !emoteDef.cost) return;
      if (this.localPlayer.unlockedEmotes.includes(emoteId)) return;
      if (!this.canAfford(emoteDef.cost)) {
        this.notify('Cannot afford this emote');
        return;
      }
      this.deductCost(emoteDef.cost);
      this.localPlayer.unlockedEmotes.push(emoteId);
      this.hud.updateResources(this.localPlayer.resources);
      this.refreshShop();
      this.notify('Emote unlocked!');
    };
    this.shop.onBuyUpgrade = (upgradeId) => {
      const upgrade = UPGRADES.find(u => u.id === upgradeId);
      if (!upgrade) return;
      if (this.localPlayer.ownedUpgrades.includes(upgradeId)) return;
      if (upgrade.requires != null && !this.localPlayer.ownedUpgrades.includes(upgrade.requires)) return;
      if (!this.canAfford(upgrade.cost)) {
        this.notify('Cannot afford this upgrade');
        return;
      }
      this.deductCost(upgrade.cost);
      this.localPlayer.ownedUpgrades.push(upgradeId);
      this.localPlayer.applyUpgrades(this.decorations);
      this.hud.updateResources(this.localPlayer.resources);
      this.refreshShop();
      this.notify(`${upgrade.name} equipped!`);
      this.checkAchievement('first_upgrade');
      if (this.localPlayer.ownedUpgrades.length >= UPGRADES.length) this.checkAchievement('all_upgrades');
    };
    this.shop.onPrestige = () => {
      this.prestige();
    };

    // Show game
    this.canvas.style.display = 'block';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.actionBar.show();

    this.hud.setRoomCode(this.worldId, true);
    this.hud.updateResources(this.localPlayer.resources);

    // Controls hint
    const hint = document.createElement('div');
    hint.className = 'controls-hint';
    hint.innerHTML = 'WASD/Arrows: Move | Shift: Sprint<br>F/J/K + Direction: Dig<br>Space: Jump | Up + Wall: Climb<br>R: Recall to surface (lose 50% loot)<br>B: Shop (at surface) | Tab: Save';
    document.body.appendChild(hint);

    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    window.addEventListener('resize', () => {
      this.renderer.resize();
      if (this.camera) {
        const vs = this.renderer.getViewSize();
        this.camera.resize(vs.width, vs.height);
      }
    });

    // Auto-save interval
    this.autoSaveInterval = setInterval(() => this.save(), AUTO_SAVE_MS);

    // Start loop
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
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
    // Track nearby shop for prompt rendering
    this.nearbyShop = getNearbyShop(this.localPlayer.x, this.localPlayer.y);

    // Shop toggle — only when near a shop machine at the surface
    if (this.input.justPressed('KeyB')) {
      if (this.shop.visible) {
        this.shop.hide();
      } else if (this.nearbyShop) {
        this.shop.show(this.localPlayer.resources, this.localPlayer.unlockedEmotes, this.localPlayer.ownedUpgrades, this.nearbyShop.type, this.localPlayer.discoveredBlueprints, this.localPlayer.prestigeLevel, this.achievements, this.stats);
      } else {
        this.notify('Find a shop at the surface to buy items!');
      }
    }

    // Save
    if (this.input.justPressed('Tab')) {
      this.save();
      this.notify('World saved!');
    }

    // Action bar — number keys 1-8 trigger emotes
    for (let k = 1; k <= 8; k++) {
      if (this.input.justPressed('Digit' + k)) {
        const emoteId = this.actionBar.getEmoteForSlot(k);
        if (emoteId != null && !this.localPlayer.emoteCooldowns[emoteId]) {
          const emDef = EMOTES[emoteId];
          this.localPlayer.activeEmote = emoteId;
          this.localPlayer.emoteTimer = EMOTE_DISPLAY_FRAMES;
          if (emDef && emDef.isRecall) {
            this.emoteRecallToSurface(emoteId);
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

    if (this.input.justPressed('Escape')) {
      if (this.shop.visible) {
        this.shop.hide();
      }
      this.placingDecoration = null;
    }

    // Emergency recall to surface (R key)
    if (this.input.justPressed('KeyR') && this.localPlayer.y > SURFACE_Y + 1) {
      this.recallToSurface();
    }

    if (!this.shop.visible) {
      const inputState = this.input.getState();
      this.localPlayer.predictUpdate(inputState, this.world, dt);
      this.handleDigging(inputState);
    }

    // Landing effects: particles + screen shake
    const p = this.localPlayer;
    if (p.justLanded) {
      this.particles.emitLand(
        p.x * TILE_SIZE,
        p.y * TILE_SIZE
      );
      if (p.landingVelocity > 8) {
        const intensity = Math.min(3, (p.landingVelocity - 8) * 0.75);
        this.camera.shake(intensity, 6);
      }
    }
    // Wall slide particles
    if (p.wallSliding && Math.random() < 0.3) {
      const wx = p.clingWallSide < 0
        ? (p.x - p.hitboxWidth / 2) * TILE_SIZE
        : (p.x + p.hitboxWidth / 2) * TILE_SIZE;
      this.particles.emitWallSlide(wx, (p.y - p.hitboxHeight / 2) * TILE_SIZE, p.clingWallSide);
    }

    // Determine stamina drain source for HUD
    let drainSource = null;
    if (p.digging) drainSource = 'DIG';
    else if (p.climbing) drainSource = 'CLIMB';
    else if (p.clinging) drainSource = 'CLING';
    else if (this.input.sprint && p.grounded && (this.input.left || this.input.right)) drainSource = 'SPRINT';

    // Update HUD
    this.hud.updateHP(p.hp, p.maxHP);
    this.hud.updateStamina(p.stamina, p.maxStamina, p.exhausted, drainSource);
    this.hud.updateBuff(p.emoteBuff);

    // Crumbling tiles: check if player is standing on any
    if (p.grounded && !p.dead) {
      const footTiles = [
        { x: Math.floor(p.x), y: Math.floor(p.y + 0.1) },
        { x: Math.floor(p.x - p.hitboxWidth / 2), y: Math.floor(p.y + 0.1) },
        { x: Math.floor(p.x + p.hitboxWidth / 2 - 0.01), y: Math.floor(p.y + 0.1) },
      ];
      for (const ft of footTiles) {
        const tile = this.world.getTile(ft.x, ft.y);
        if (CRUMBLE_TILES.has(tile)) {
          const key = ft.x + ',' + ft.y;
          if (!this.crumblingTiles.has(key)) {
            this.crumblingTiles.set(key, { x: ft.x, y: ft.y, timer: CRUMBLE_DELAY_FRAMES, maxTimer: CRUMBLE_DELAY_FRAMES });
          }
        }
      }
    }
    // Tick crumbling tiles
    for (const [key, info] of this.crumblingTiles) {
      info.timer--;
      if (info.timer <= 0) {
        this.world.setTile(info.x, info.y, TILE.AIR);
        this.particles.emitDig(
          info.x * TILE_SIZE + TILE_SIZE / 2,
          info.y * TILE_SIZE + TILE_SIZE / 2,
          '#8D6E63'
        );
        this.crumblingTiles.delete(key);
        // Track for achievements
        this.checkAchievement('crumble_fall');
      }
    }

    // Trigger idle zoom when sitting
    this.camera.setIdleZoom(p.animState === 'sit');
    this.camera.setDepthZoom(p.y);

    this.camera.follow(p.x, p.y);
    this.particles.update();

    const depth = Math.max(0, Math.floor(this.localPlayer.y - SURFACE_Y));
    this.hud.updateDepth(depth);
    this.hud.updatePlayerList(this.players);

    // Track max depth for achievements
    if (depth > this.stats.maxDepth) {
      this.stats.maxDepth = depth;
      if (depth >= 50) this.checkAchievement('depth_50');
      if (depth >= 100) this.checkAchievement('depth_100');
      if (depth >= 150) this.checkAchievement('depth_150');
      if (depth >= 200) this.checkAchievement('depth_200');
      if (depth >= 240) this.checkAchievement('depth_240');
    }

    // Track biome discoveries
    for (const biome of BIOMES) {
      if (depth >= biome.minDepth && depth <= biome.maxDepth) {
        this.checkAchievement('biome_' + biome.id);
      }
    }

    // Track fall damage for achievements
    if (p.lastDamageType === 'fall' && !p.dead) {
      this.checkAchievement('fall_damage');
    }
    if (p.lastDamageType === 'lava' && p.dead) {
      this.checkAchievement('survive_lava');
    }

    // Passive resource generation from decorations
    const now = Date.now();
    const elapsed = now - this.lastGenTime;
    if (elapsed > 10000) { // check every 10 seconds
      for (const dec of this.decorations) {
        const def = DECORATIONS.find(d => d.id === dec.id);
        if (!def || !def.generates) continue;
        if (!dec.lastGenTime) dec.lastGenTime = now;
        if (now - dec.lastGenTime >= def.generates.intervalMs) {
          dec.lastGenTime = now;
          const res = def.generates.resource;
          p.resources[res] = (p.resources[res] || 0) + 1;
          this.hud.updateResources(p.resources);
          this.notify(`${def.name} produced 1 ${res}!`);
        }
      }
      this.lastGenTime = now;
    }

    // Contextual hints
    this.hud.updateHints();
    if (p.checkWall && !p.grounded) {
      const nearWall = p.checkWall(this.world, -1) || p.checkWall(this.world, 1);
      if (nearWall && !p.clinging) {
        this.hud.showHint('climb', 'Hold SHIFT + direction toward wall to climb!');
      }
    }
    if (p.clinging) {
      this.hud.showHint('walljump', 'Press SPACE on a wall to wall jump!');
    }
    if (depth > 5 && depth < 20) {
      this.hud.showHint('sprint', 'Hold SHIFT while moving to sprint!');
    }

    this.input.update();
  }

  handleDigging(input) {
    const p = this.localPlayer;
    const isDigging = input.dig;

    if (!isDigging) {
      this.digTarget = null;
      p.digging = false;
      return;
    }

    // Determine target tile based on direction or facing
    let tx = Math.floor(p.x);
    let ty = Math.floor(p.y - p.hitboxHeight / 2);

    if (input.down) ty = Math.floor(p.y + 0.1);
    else if (input.up) ty = Math.floor(p.y - p.hitboxHeight) - 1;
    else if (input.left) { tx = Math.floor(p.x - p.hitboxWidth / 2 - 0.1); ty = Math.floor(p.y - 0.5); }
    else if (input.right) { tx = Math.floor(p.x + p.hitboxWidth / 2 + 0.1); ty = Math.floor(p.y - 0.5); }
    else {
      // Dig in facing direction
      if (p.facing > 0) tx = Math.floor(p.x + p.hitboxWidth / 2 + 0.1);
      else tx = Math.floor(p.x - p.hitboxWidth / 2 - 0.1);
      ty = Math.floor(p.y - 0.5);
    }

    const tileType = this.world.getTile(tx, ty);
    if (!SOLID_TILES.has(tileType) || tileType === TILE.BEDROCK || tileType === TILE.GRANITE || tileType === TILE.SHOP_FLOOR) {
      this.digTarget = null;
      p.digging = false;
      return;
    }

    // Update target (load existing tile damage if any)
    const tileKey = tx + ',' + ty;
    if (!this.digTarget || this.digTarget.x !== tx || this.digTarget.y !== ty) {
      this.digTarget = { x: tx, y: ty };
      this.digProgress = this.tileDamage.get(tileKey) || 0;
    }

    // Digging costs stamina
    if (p.stamina <= 0 || p.exhausted) {
      this.digTarget = null;
      p.digging = false;
      return;
    }

    p.digging = true;
    p.digTarget = { x: tx, y: ty, tile: tileType };
    p.stamina -= STAMINA_DIG_COST;
    if (p.stamina < 0) p.stamina = 0;
    this.digProgress += (p.digSpeed || 1);
    p.digProgress = this.digProgress;

    // Persist damage on the tile
    this.tileDamage.set(tileKey, this.digProgress);

    const hardness = HARDNESS[tileType] || 3;
    if (this.digProgress >= hardness) {
      // Break tile
      const resourceName = RESOURCE_NAMES[tileType];
      const colors = TILE_COLORS[tileType];

      this.world.setTile(tx, ty, TILE.AIR);

      // Particles
      const color = colors ? colors.main : '#795548';
      this.particles.emitDig(
        tx * TILE_SIZE + TILE_SIZE / 2,
        ty * TILE_SIZE + TILE_SIZE / 2,
        color
      );

      // Resource sparkle + collection
      if (resourceName) {
        const gemColor = colors && colors.gem ? colors.gem : '#FFD700';
        this.particles.emitSparkle(
          tx * TILE_SIZE + TILE_SIZE / 2,
          ty * TILE_SIZE + TILE_SIZE / 2,
          gemColor
        );
        let amount = 1;
        if (p.lootBonus && Math.random() < p.lootBonus) amount = 2;
        p.resources[resourceName] = (p.resources[resourceName] || 0) + amount;
        this.hud.updateResources(p.resources);

        // Track stats for achievements
        this.stats.tilesDigged++;
        if (resourceName === 'bones') { this.stats.totalBones += amount; if (this.stats.totalBones >= 100) this.checkAchievement('collect_100_bones'); }
        if (resourceName === 'gems') { this.stats.totalGems += amount; if (this.stats.totalGems >= 50) this.checkAchievement('collect_50_gems'); }
        if (resourceName === 'gold') { this.stats.totalGold += amount; if (this.stats.totalGold >= 25) this.checkAchievement('collect_25_gold'); }
        if (resourceName === 'diamonds') { this.stats.totalDiamonds += amount; if (this.stats.totalDiamonds >= 10) this.checkAchievement('collect_10_diamonds'); }
        if (resourceName === 'artifacts') { this.stats.totalArtifacts += amount; if (this.stats.totalArtifacts >= 5) this.checkAchievement('collect_5_artifacts'); }
        // Floating text
        this.particles.emitText(
          tx * TILE_SIZE + TILE_SIZE / 2,
          ty * TILE_SIZE - 4,
          `+${amount} ${resourceName}`,
          gemColor
        );

        // Blueprint discovery
        const blueprintDrop = BLUEPRINT_DROPS[tileType];
        if (blueprintDrop && !p.discoveredBlueprints.includes(blueprintDrop.decorationId)) {
          if (Math.random() < blueprintDrop.chance) {
            p.discoveredBlueprints.push(blueprintDrop.decorationId);
            const decDef = DECORATIONS.find(d => d.id === blueprintDrop.decorationId);
            this.notify(`Blueprint discovered: ${decDef.name}!`);
            this.checkAchievement('first_blueprint');
            // Check if all blueprints discovered
            const totalBlueprints = DECORATIONS.filter(d => d.requiresBlueprint).length;
            if (p.discoveredBlueprints.length >= totalBlueprints) this.checkAchievement('all_blueprints');
            this.particles.emitText(
              tx * TILE_SIZE + TILE_SIZE / 2,
              ty * TILE_SIZE - 16,
              `BLUEPRINT!`,
              '#FFD700'
            );
          }
        }
      }

      this.tileDamage.delete(tileKey);
      this.digTarget = null;
      this.digProgress = 0;
      p.digging = false;
      p.digTarget = null;
      p.digProgress = 0;
    }
  }

  render() {
    const ctx = this.renderer.ctx;
    this.renderer.clear();

    // Apply camera zoom (idle + depth)
    this.renderer.beginZoom(this.camera);

    this.renderer.drawSky(this.camera);
    this.renderer.drawUnderground(this.camera);
    this.renderer.drawTiles(this.world, this.camera);
    this.renderer.drawParkZone(this.camera);
    this.renderer.drawDecorations(this.decorations, this.camera);
    this.renderer.drawShopMachines(this.camera);

    // Draw crumbling tile effects
    if (this.crumblingTiles.size > 0) {
      this.renderer.drawCrumblingTiles(this.crumblingTiles, this.camera);
    }

    for (const [, player] of this.players) {
      this.renderer.drawPlayer(player, this.camera, player.isLocal);
    }

    this.particles.render(ctx, this.camera);

    // Shop interaction prompt
    if (this.nearbyShop && !this.shop.visible) {
      this.renderer.drawShopPrompt(this.nearbyShop, this.camera);
    }

    if (this.placingDecoration !== null) {
      const mouseWorld = this.screenToWorld(this.input.mouseX, this.input.mouseY);
      const tx = Math.floor(mouseWorld.x);
      const ty = Math.floor(mouseWorld.y);
      const placeDef = DECORATIONS.find(d => d.id === this.placingDecoration);
      let valid = (placeDef && placeDef.canPlaceAnywhere) || (ty >= PARK_TOP && ty <= PARK_BOTTOM);
      // Must touch ground
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

    // Darkness vignette (drawn outside zoom so it covers the full screen)
    const depth = Math.max(0, Math.floor(this.localPlayer.y - SURFACE_Y));
    this.renderer.drawDarknessVignette(depth);

    // Death screen overlay (drawn outside zoom so it fills the full screen)
    if (this.localPlayer.dead) {
      this.renderer.drawDeathScreen(this.localPlayer.respawnTimer, RESPAWN_FRAMES, this.localPlayer.lastDamageType);
    }

    // Achievement popup
    this.renderAchievementPopup(ctx);

    // Action bar is HTML-based, no canvas render needed
  }

  handleCanvasClick(e) {
    if (this.placingDecoration === null) return;
    const mouseWorld = this.screenToWorld(e.clientX, e.clientY);
    const tx = Math.floor(mouseWorld.x);
    const ty = Math.floor(mouseWorld.y);

    const decDef = DECORATIONS.find(d => d.id === this.placingDecoration);
    let canPlaceHere = (decDef && decDef.canPlaceAnywhere) || (ty >= PARK_TOP && ty <= PARK_BOTTOM);
    // Must touch ground
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
      const decoration = {
        id: this.placingDecoration,
        x: tx, y: ty,
        placedBy: this.localPlayer.name,
      };
      this.decorations.push(decoration);
      this.placingDecoration = null;
      // Recalculate stats (decoration buffs affect all players)
      this.localPlayer.applyUpgrades(this.decorations);
      this.notify('Decoration placed!');
      this.checkAchievement('first_decoration');
    } else {
      this.notify('Must place on the ground in the dog park area');
    }
  }

  recallToSurface() {
    const p = this.localPlayer;

    // Find nearest recall beacon
    let nearestBeacon = null;
    let nearestDist = Infinity;
    for (const dec of this.decorations) {
      const def = DECORATIONS.find(d => d.id === dec.id);
      if (!def || !def.isRecallBeacon) continue;
      const dist = Math.abs(dec.x - p.x) + Math.abs(dec.y - p.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBeacon = dec;
      }
    }

    // Penalty: 25% with beacon, 50% without
    const penaltyRate = nearestBeacon ? 0.25 : 0.5;
    const lost = {};
    for (const [key, amount] of Object.entries(p.resources)) {
      const penalty = Math.floor(amount * penaltyRate);
      if (penalty > 0) lost[key] = penalty;
      p.resources[key] = amount - penalty;
    }

    // Teleport to beacon or surface
    if (nearestBeacon) {
      p.x = nearestBeacon.x + 0.5;
      p.y = nearestBeacon.y;
    } else {
      p.x = WORLD_WIDTH / 2;
      p.y = SURFACE_Y - 1;
    }
    p.vx = 0;
    p.vy = 0;
    p.grounded = false;
    p.stamina = p.maxStamina;

    this.hud.updateResources(p.resources);
    const lostStr = Object.entries(lost).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
    const dest = nearestBeacon ? 'beacon' : 'surface';
    if (lostStr) {
      this.notify(`Recalled to ${dest}! Lost: ${lostStr}`);
    } else {
      this.notify(`Recalled to ${dest}!`);
    }
  }

  emoteRecallToSurface(emoteId) {
    const p = this.localPlayer;
    const emDef = EMOTES[emoteId];
    // Start cooldown
    p.emoteCooldowns[emoteId] = Math.round(emDef.cooldown * 60);
    // Teleport to surface with no penalty
    p.x = WORLD_WIDTH / 2;
    p.y = SURFACE_Y - 1;
    p.vx = 0;
    p.vy = 0;
    p.grounded = false;
    p.stamina = p.maxStamina;
    this.notify('Scratched your way back to the surface!');
  }

  screenToWorld(screenX, screenY) {
    const scale = this.renderer.scale;
    // Convert screen coords to logical coords, then account for zoom
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

  refreshShop() {
    if (this.shop.visible) {
      this.shop.show(this.localPlayer.resources, this.localPlayer.unlockedEmotes, this.localPlayer.ownedUpgrades, null, this.localPlayer.discoveredBlueprints, this.localPlayer.prestigeLevel, this.achievements, this.stats);
    }
  }

  // Economy helpers
  canAfford(cost) {
    for (const [key, amount] of Object.entries(cost)) {
      if ((this.localPlayer.resources[key] || 0) < amount) return false;
    }
    return true;
  }

  deductCost(cost) {
    for (const [key, amount] of Object.entries(cost)) {
      this.localPlayer.resources[key] = (this.localPlayer.resources[key] || 0) - amount;
    }
  }

  // Persistence via localStorage
  save() {
    const data = {
      id: this.worldId,
      seed: this.seed,
      tiles: Array.from(this.world.tiles),
      decorations: this.decorations,
      player: {
        x: this.localPlayer.x,
        y: this.localPlayer.y,
        resources: this.localPlayer.resources,
        unlockedEmotes: this.localPlayer.unlockedEmotes,
        ownedUpgrades: this.localPlayer.ownedUpgrades,
        discoveredBlueprints: this.localPlayer.discoveredBlueprints,
        prestigeLevel: this.localPlayer.prestigeLevel,
        hp: this.localPlayer.hp,
      },
      achievements: Array.from(this.achievements),
      stats: this.stats,
      savedAt: Date.now(),
    };

    const saves = this.getSaves();
    const idx = saves.findIndex(s => s.id === this.worldId);
    if (idx >= 0) saves[idx] = data;
    else saves.push(data);

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    } catch {
      this.notify('Save failed (storage full)');
    }
  }

  genId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  // --- Achievement System ---
  checkAchievement(id) {
    if (this.achievements.has(id)) return;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return;
    this.achievements.add(id);
    this.achievementQueue.push({ ...def, timer: 240 }); // 4 seconds display
  }

  renderAchievementPopup(ctx) {
    if (this.achievementQueue.length === 0) return;
    const popup = this.achievementQueue[0];
    popup.timer--;
    if (popup.timer <= 0) {
      this.achievementQueue.shift();
      return;
    }

    const rw = this.renderer.renderWidth;
    // Slide in/out animation
    const slideIn = Math.min(1, (240 - popup.timer) / 20);
    const slideOut = Math.min(1, popup.timer / 20);
    const alpha = Math.min(slideIn, slideOut);

    const boxW = 200;
    const boxH = 36;
    const bx = rw / 2 - boxW / 2;
    const by = 10 + (1 - alpha) * -20;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Background
    ctx.fillStyle = 'rgba(30, 15, 5, 0.9)';
    ctx.fillRect(bx, by, boxW, boxH);
    // Gold border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxW, boxH);

    // Icon
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFF';
    ctx.fillText(popup.icon, bx + 8, by + boxH / 2);

    // Title
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('Achievement!', bx + 30, by + 12);

    // Name
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#FFF3E0';
    ctx.fillText(popup.name, bx + 30, by + 26);

    ctx.restore();
  }

  // --- Prestige System ---
  prestige() {
    const p = this.localPlayer;
    p.prestigeLevel++;

    // Reset resources
    for (const key of Object.keys(p.resources)) {
      p.resources[key] = 0;
    }

    // Reset upgrades (keep blueprints)
    p.ownedUpgrades = [];

    // Regenerate world
    this.seed = Math.floor(Math.random() * 2147483647);
    const tiles = generateWorld(this.seed);
    this.world.loadFromArray(tiles);

    // Reset decorations
    this.decorations = [];

    // Reset tile damage and crumbling tiles
    this.tileDamage.clear();
    this.crumblingTiles.clear();

    // Teleport to surface, full HP/stamina
    p.x = WORLD_WIDTH / 2;
    p.y = SURFACE_Y - 1;
    p.vx = 0;
    p.vy = 0;
    p.dead = false;
    p.applyUpgrades(this.decorations);
    p.hp = p.maxHP;
    p.stamina = p.maxStamina;

    // Update HUD
    this.hud.updateResources(p.resources);

    // Track prestige achievements
    this.checkAchievement('prestige_1');
    if (p.prestigeLevel >= 3) this.checkAchievement('prestige_3');
    if (p.prestigeLevel >= 5) this.checkAchievement('prestige_5');

    this.save();
    this.notify(`Prestige ${p.prestigeLevel}! +${p.prestigeLevel * 8}% all stats`);
  }

  notify(text) {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = text;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // Static: list saved worlds from localStorage
  static getSaves() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    } catch { return []; }
  }

  getSaves() {
    return LocalGame.getSaves();
  }

  static deleteSave(worldId) {
    const saves = LocalGame.getSaves().filter(s => s.id !== worldId);
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }
}
