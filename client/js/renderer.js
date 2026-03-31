import {
  TILE_SIZE, TILE, SURFACE_Y, WORLD_WIDTH, WORLD_HEIGHT,
  PLAYER_WIDTH, PLAYER_HEIGHT, DOG_COLORS, EMOTES, HARDNESS,
} from '../../shared/constants.js';
import { getTileSprite, getDogSprite, getDecorationSprite, getSkyGradient } from './sprites.js';

// Internal render resolution
const RENDER_WIDTH = 640;
const RENDER_HEIGHT = 400;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderWidth = RENDER_WIDTH;
    this.renderHeight = RENDER_HEIGHT;
    this.scale = 1;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    // Scale to fill window while maintaining aspect
    const scaleX = window.innerWidth / RENDER_WIDTH;
    const scaleY = window.innerHeight / RENDER_HEIGHT;
    this.scale = Math.max(scaleX, scaleY);

    this.canvas.width = Math.ceil(window.innerWidth / this.scale);
    this.canvas.height = Math.ceil(window.innerHeight / this.scale);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.imageSmoothingEnabled = false;

    this.renderWidth = this.canvas.width;
    this.renderHeight = this.canvas.height;
  }

  getViewSize() {
    return { width: this.renderWidth, height: this.renderHeight };
  }

  clear() {
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.renderWidth, this.renderHeight);
  }

  drawSky(camera) {
    const skyPixelHeight = SURFACE_Y * TILE_SIZE;
    const screenY = -camera.y;

    if (screenY + skyPixelHeight > 0) {
      const sky = getSkyGradient(this.renderWidth, skyPixelHeight);
      this.ctx.drawImage(sky, 0, screenY, this.renderWidth, skyPixelHeight);
    }
  }

  drawUnderground(camera) {
    const groundY = SURFACE_Y * TILE_SIZE - camera.y;
    if (groundY < this.renderHeight) {
      const grd = this.ctx.createLinearGradient(0, Math.max(0, groundY), 0, this.renderHeight);
      grd.addColorStop(0, '#3E2723');
      grd.addColorStop(0.5, '#1B0000');
      grd.addColorStop(1, '#000');
      this.ctx.fillStyle = grd;
      this.ctx.fillRect(0, Math.max(0, groundY), this.renderWidth, this.renderHeight - Math.max(0, groundY));
    }
  }

  drawTiles(world, camera) {
    const { startX, startY, endX, endY } = camera.getVisibleRange();

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = world.getTile(x, y);
        if (tile === TILE.AIR) continue;

        const sprite = getTileSprite(tile);
        if (!sprite) continue;

        const sx = x * TILE_SIZE - camera.x;
        const sy = y * TILE_SIZE - camera.y;
        this.ctx.drawImage(sprite, Math.floor(sx), Math.floor(sy));
      }
    }
  }

  drawDecorations(decorations, camera) {
    for (const dec of decorations) {
      const sprite = getDecorationSprite(dec.id);
      if (!sprite) continue;
      const sx = dec.x * TILE_SIZE - camera.x;
      const sy = dec.y * TILE_SIZE - camera.y;
      this.ctx.drawImage(sprite, Math.floor(sx), Math.floor(sy));
    }
  }

  drawPlayer(player, camera, isLocal) {
    const sprite = getDogSprite(player.color, player.animFrame || 0, player.digging, player.facing);
    if (!sprite) return;

    const screenPos = camera.worldToScreen(player.x, player.y);
    const sx = screenPos.x - TILE_SIZE / 2;
    const sy = screenPos.y - TILE_SIZE;

    this.ctx.save();
    if (player.facing < 0) {
      // Flip horizontally
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(sprite, Math.floor(-sx - TILE_SIZE), Math.floor(sy));
    } else {
      this.ctx.drawImage(sprite, Math.floor(sx), Math.floor(sy));
    }
    this.ctx.restore();

    // Name tag
    this.ctx.fillStyle = isLocal ? '#4FC3F7' : '#FFF';
    this.ctx.font = '5px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(player.name, Math.floor(screenPos.x), Math.floor(sy - 2));

    // Dig progress indicator
    if (player.digging && player.digTarget) {
      this.drawDigProgress(player, camera);
    }

    // Emote bubble
    if (player.activeEmote !== null) {
      this.drawEmoteBubble(player, camera, screenPos);
    }
  }

  drawDigProgress(player, camera) {
    const tx = player.digTarget.x;
    const ty = player.digTarget.y;
    const sx = tx * TILE_SIZE - camera.x;
    const sy = ty * TILE_SIZE - camera.y;

    // Flash overlay on the tile being dug
    const alpha = 0.2 + 0.2 * Math.sin(Date.now() * 0.01);
    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    this.ctx.fillRect(Math.floor(sx), Math.floor(sy), TILE_SIZE, TILE_SIZE);

    // Progress bar
    const progress = player.digProgress / (HARDNESS[player.digTarget.tile] || 3);
    if (progress > 0 && progress < 1) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.ctx.fillRect(Math.floor(sx), Math.floor(sy - 3), TILE_SIZE, 2);
      this.ctx.fillStyle = '#4FC3F7';
      this.ctx.fillRect(Math.floor(sx), Math.floor(sy - 3), TILE_SIZE * Math.min(1, progress), 2);
    }
  }

  drawEmoteBubble(player, camera, screenPos) {
    const emote = EMOTES[player.activeEmote];
    if (!emote) return;

    const bx = Math.floor(screenPos.x);
    const by = Math.floor(screenPos.y - TILE_SIZE - 12);

    // Bubble background
    this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
    this.ctx.beginPath();
    this.ctx.arc(bx, by, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // Bubble pointer
    this.ctx.beginPath();
    this.ctx.moveTo(bx - 2, by + 7);
    this.ctx.lineTo(bx, by + 11);
    this.ctx.lineTo(bx + 2, by + 7);
    this.ctx.fill();

    // Symbol
    this.ctx.fillStyle = '#333';
    this.ctx.font = '8px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(emote.symbol, bx, by);
  }

  drawParkZone(camera) {
    // Light overlay on the dog park area to distinguish it
    const sy = 3 * TILE_SIZE - camera.y;
    const height = 4 * TILE_SIZE;
    if (sy + height > 0 && sy < this.renderHeight) {
      this.ctx.fillStyle = 'rgba(139, 195, 74, 0.08)';
      this.ctx.fillRect(0, Math.floor(sy), this.renderWidth, height);
    }
  }

  // Draw placement preview when in decoration placement mode
  drawPlacementPreview(x, y, decId, valid, camera) {
    const sprite = getDecorationSprite(decId);
    if (!sprite) return;
    const sx = x * TILE_SIZE - camera.x;
    const sy = y * TILE_SIZE - camera.y;
    this.ctx.globalAlpha = 0.5;
    this.ctx.drawImage(sprite, Math.floor(sx), Math.floor(sy));
    this.ctx.globalAlpha = 1;
    if (!valid) {
      this.ctx.strokeStyle = '#F44336';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(Math.floor(sx), Math.floor(sy), sprite.width, sprite.height);
    }
  }
}
