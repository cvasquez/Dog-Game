import {
  TILE_SIZE, TILE, SURFACE_Y, TILE_COLORS, RESOURCE_NAMES, HARDNESS,
  SOLID_TILES, WORLD_WIDTH, PLAYER_WIDTH, PLAYER_HEIGHT, DECORATIONS,
  EMOTES, PARK_TOP, PARK_BOTTOM,
} from '../../shared/constants.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { ParticleSystem } from './particles.js';
import { HUD } from './hud.js';
import { Shop } from './shop.js';
import { EmoteWheel } from './emotes.js';
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
    this.emoteWheel = new EmoteWheel();

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
  }

  start(playerName, colorIndex, saveData) {
    // Generate or load world
    if (saveData) {
      this.seed = saveData.seed;
      this.worldId = saveData.id;
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
    this.localPlayer = new Player('local', playerName, colorIndex);
    this.localPlayer.isLocal = true;
    this.localPlayer.x = WORLD_WIDTH / 2;
    this.localPlayer.y = SURFACE_Y - 1;

    // Restore player state from save
    if (saveData && saveData.player) {
      this.localPlayer.x = saveData.player.x;
      this.localPlayer.y = saveData.player.y;
      this.localPlayer.resources = saveData.player.resources;
      this.localPlayer.unlockedEmotes = saveData.player.unlockedEmotes;
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
      this.shop.show(this.localPlayer.resources, this.localPlayer.unlockedEmotes);
      this.notify('Emote unlocked!');
    };

    // Show game
    this.canvas.style.display = 'block';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('hud').style.display = 'block';

    this.hud.setRoomCode(this.worldId, true);
    this.hud.updateResources(this.localPlayer.resources);

    // Controls hint
    const hint = document.createElement('div');
    hint.className = 'controls-hint';
    hint.innerHTML = 'WASD/Arrows: Move<br>Shift/J/K + Direction: Dig<br>Space: Jump | Up + Wall: Climb<br>R: Recall to surface (lose 50% loot)<br>E: Emotes | B: Shop | Tab: Save';
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
    // Shop toggle
    if (this.input.justPressed('KeyB')) {
      if (this.shop.visible) this.shop.hide();
      else this.shop.show(this.localPlayer.resources, this.localPlayer.unlockedEmotes);
    }

    // Save
    if (this.input.justPressed('Tab')) {
      this.save();
      this.notify('World saved!');
    }

    // Emote wheel
    if (this.input.isDown('KeyE')) {
      this.emoteWheel.show(this.localPlayer.unlockedEmotes, this.input.mouseX, this.input.mouseY);
    } else if (this.emoteWheel.visible) {
      const selected = this.emoteWheel.getSelected();
      this.emoteWheel.hide();
      if (selected !== null) {
        this.localPlayer.activeEmote = selected;
        this.localPlayer.emoteTimer = 60;
      }
    }

    if (this.input.justPressed('Escape')) {
      this.placingDecoration = null;
    }

    // Emergency recall to surface (R key)
    if (this.input.justPressed('KeyR') && this.localPlayer.y > SURFACE_Y + 1) {
      this.recallToSurface();
    }

    if (!this.shop.visible && !this.emoteWheel.visible) {
      const inputState = this.input.getState();
      this.localPlayer.predictUpdate(inputState, this.world, dt);
      this.handleDigging(inputState);
    }

    // Update stamina HUD
    this.hud.updateStamina(this.localPlayer.stamina, this.localPlayer.maxStamina, this.localPlayer.exhausted);

    this.camera.follow(this.localPlayer.x, this.localPlayer.y);
    this.particles.update();

    const depth = Math.max(0, Math.floor(this.localPlayer.y - SURFACE_Y));
    this.hud.updateDepth(depth);
    this.hud.updatePlayerList(this.players);
    this.input.update();
  }

  handleDigging(input) {
    const p = this.localPlayer;
    const isDigging = input.dig;

    if (!isDigging) {
      this.digTarget = null;
      this.digProgress = 0;
      p.digging = false;
      return;
    }

    // Determine target tile based on direction or facing
    let tx = Math.floor(p.x);
    let ty = Math.floor(p.y - PLAYER_HEIGHT / 2);

    if (input.down) ty = Math.floor(p.y + 0.1);
    else if (input.up) ty = Math.floor(p.y - PLAYER_HEIGHT) - 1;
    else if (input.left) { tx = Math.floor(p.x - PLAYER_WIDTH / 2 - 0.1); ty = Math.floor(p.y - 0.5); }
    else if (input.right) { tx = Math.floor(p.x + PLAYER_WIDTH / 2 + 0.1); ty = Math.floor(p.y - 0.5); }
    else {
      // Dig in facing direction
      if (p.facing > 0) tx = Math.floor(p.x + PLAYER_WIDTH / 2 + 0.1);
      else tx = Math.floor(p.x - PLAYER_WIDTH / 2 - 0.1);
      ty = Math.floor(p.y - 0.5);
    }

    const tileType = this.world.getTile(tx, ty);
    if (!SOLID_TILES.has(tileType) || tileType === TILE.BEDROCK || tileType === TILE.GRANITE) {
      this.digTarget = null;
      this.digProgress = 0;
      p.digging = false;
      return;
    }

    // Check if target changed
    if (!this.digTarget || this.digTarget.x !== tx || this.digTarget.y !== ty) {
      this.digTarget = { x: tx, y: ty };
      this.digProgress = 0;
    }

    p.digging = true;
    p.digTarget = { x: tx, y: ty, tile: tileType };
    this.digProgress += (p.digSpeed || 1);
    p.digProgress = this.digProgress;

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
        this.notify(`+${amount} ${resourceName}!`);
      }

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
    this.renderer.drawSky(this.camera);
    this.renderer.drawUnderground(this.camera);
    this.renderer.drawTiles(this.world, this.camera);
    this.renderer.drawParkZone(this.camera);
    this.renderer.drawDecorations(this.decorations, this.camera);

    for (const [, player] of this.players) {
      this.renderer.drawPlayer(player, this.camera, player.isLocal);
    }

    this.particles.render(ctx, this.camera);

    if (this.placingDecoration !== null) {
      const mouseWorld = this.screenToWorld(this.input.mouseX, this.input.mouseY);
      const tx = Math.floor(mouseWorld.x);
      const ty = Math.floor(mouseWorld.y);
      const valid = ty >= PARK_TOP && ty <= PARK_BOTTOM;
      this.renderer.drawPlacementPreview(tx, ty, this.placingDecoration, valid, this.camera);
    }

    this.emoteWheel.render();
  }

  handleCanvasClick(e) {
    if (this.placingDecoration === null) return;
    const mouseWorld = this.screenToWorld(e.clientX, e.clientY);
    const tx = Math.floor(mouseWorld.x);
    const ty = Math.floor(mouseWorld.y);

    if (ty >= PARK_TOP && ty <= PARK_BOTTOM) {
      const decoration = {
        id: this.placingDecoration,
        x: tx, y: ty,
        placedBy: this.localPlayer.name,
      };
      this.decorations.push(decoration);
      this.placingDecoration = null;
      this.notify('Decoration placed!');
    } else {
      this.notify('Must place in the dog park area (above ground)');
    }
  }

  recallToSurface() {
    const p = this.localPlayer;
    // Lose 50% of all resources
    const lost = {};
    for (const [key, amount] of Object.entries(p.resources)) {
      const penalty = Math.floor(amount / 2);
      if (penalty > 0) lost[key] = penalty;
      p.resources[key] = amount - penalty;
    }
    // Teleport to surface
    p.x = WORLD_WIDTH / 2;
    p.y = SURFACE_Y - 1;
    p.vx = 0;
    p.vy = 0;
    p.grounded = false;
    p.stamina = p.maxStamina;

    this.hud.updateResources(p.resources);
    const lostStr = Object.entries(lost).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
    if (lostStr) {
      this.notify(`Recalled to surface! Lost: ${lostStr}`);
    } else {
      this.notify('Recalled to surface!');
    }
  }

  screenToWorld(screenX, screenY) {
    const scale = this.renderer.scale;
    return {
      x: (screenX / scale + this.camera.x) / TILE_SIZE,
      y: (screenY / scale + this.camera.y) / TILE_SIZE,
    };
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
      },
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
