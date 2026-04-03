import {
  TILE_SIZE, TILE, SURFACE_Y, WORLD_WIDTH, WORLD_HEIGHT,
  PLAYER_WIDTH, PLAYER_HEIGHT, EMOTES, HARDNESS, SHOP_LOCATIONS, BANK_LOCATION,
  DARKNESS_START_DEPTH, DARKNESS_MAX_DEPTH, DARKNESS_MAX_ALPHA,
  DARKNESS_INNER_RADIUS, DARKNESS_OUTER_RADIUS, CRUMBLE_TILES,
} from '../../shared/constants.js';
import { getTileSprite, getDogSprite, getDecorationSprite, getSkyGradient, getShopMachineSprite, getBankSprite } from './sprites.js';

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

    const logicalW = Math.ceil(window.innerWidth / this.scale);
    const logicalH = Math.ceil(window.innerHeight / this.scale);

    // Use devicePixelRatio for sharper text rendering
    this.canvas.width = logicalW * ratio;
    this.canvas.height = logicalH * ratio;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(ratio, ratio);
    this.ctx.imageSmoothingEnabled = false;

    this.renderWidth = logicalW;
    this.renderHeight = logicalH;
  }

  getViewSize() {
    return { width: this.renderWidth, height: this.renderHeight };
  }

  clear() {
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.renderWidth, this.renderHeight);
  }

  beginZoom(camera) {
    if (camera.zoom === 1.0) return;
    this.ctx.save();
    // Scale from the center of the viewport
    const cx = this.renderWidth / 2;
    const cy = this.renderHeight / 2;
    // Round translate values to avoid sub-pixel seams
    this.ctx.translate(Math.round(cx), Math.round(cy));
    this.ctx.scale(camera.zoom, camera.zoom);
    this.ctx.translate(-Math.round(cx), -Math.round(cy));
    // Ensure pixel art stays crisp during zoom
    this.ctx.imageSmoothingEnabled = false;
  }

  endZoom(camera) {
    if (camera.zoom === 1.0) return;
    this.ctx.restore();
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
    if (player.dead) return; // Don't draw dead players
    const breedId = player.breedId != null ? player.breedId : (player.color || 0);
    const animState = player.animState || 'idle';
    const sprite = getDogSprite(breedId, animState, player.animFrame || 0);
    if (!sprite) return;

    // Snap grounded players to tile grid to prevent sub-pixel overlap with ground
    const renderY = player.grounded ? Math.floor(player.y) : player.y;
    const screenPos = camera.worldToScreen(player.x, renderY);
    const sx = screenPos.x - TILE_SIZE / 2;
    const sy = screenPos.y - TILE_SIZE;

    // Squash & stretch
    const sclX = player.scaleX || 1;
    const sclY = player.scaleY || 1;

    this.ctx.save();
    // Translate to sprite center-bottom for scaling pivot
    const cx = Math.floor(sx + TILE_SIZE / 2);
    const cy = Math.floor(sy + TILE_SIZE);
    this.ctx.translate(cx, cy);
    this.ctx.scale(player.facing < 0 ? -sclX : sclX, sclY);
    this.ctx.drawImage(sprite, -TILE_SIZE / 2, -TILE_SIZE);
    this.ctx.restore();

    // Buff glow effect
    if (player.emoteBuff) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.2 + 0.1 * Math.sin(Date.now() * 0.006);
      this.ctx.shadowColor = '#4FC3F7';
      this.ctx.shadowBlur = 8;
      this.ctx.fillStyle = '#4FC3F7';
      this.ctx.fillRect(Math.floor(screenPos.x - TILE_SIZE / 2 - 1), Math.floor(sy - 1), TILE_SIZE + 2, TILE_SIZE + 2);
      this.ctx.restore();
    }

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

  drawShopMachines(camera) {
    for (const shop of SHOP_LOCATIONS) {
      const sprite = getShopMachineSprite(shop.type);
      if (!sprite) continue;
      // Machine sits on surface: bottom at SURFACE_Y, so top at SURFACE_Y - 2
      const sx = shop.x * TILE_SIZE - camera.x;
      const sy = (SURFACE_Y - 2) * TILE_SIZE - camera.y;
      this.ctx.drawImage(sprite, Math.floor(sx), Math.floor(sy));
    }
  }

  drawBankMachine(camera) {
    const sprite = getBankSprite();
    if (!sprite) return;
    const sx = BANK_LOCATION.x * TILE_SIZE - camera.x;
    const sy = (SURFACE_Y - 2) * TILE_SIZE - camera.y;
    this.ctx.drawImage(sprite, Math.floor(sx), Math.floor(sy));
  }

  drawBankPrompt(camera) {
    const bankCenterX = (BANK_LOCATION.x + BANK_LOCATION.width / 2) * TILE_SIZE;
    const sx = bankCenterX - camera.x;
    const sy = (SURFACE_Y - 3) * TILE_SIZE - camera.y;

    const text = `[B] ${BANK_LOCATION.name}`;
    this.ctx.font = '5px "Press Start 2P", monospace';
    const tw = this.ctx.measureText(text).width;
    const pad = 3;

    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const rx = Math.floor(sx - tw / 2 - pad);
    const ry = Math.floor(sy - 4);
    const rw = tw + pad * 2;
    const rh = 10;
    this.ctx.fillRect(rx, ry, rw, rh);

    this.ctx.strokeStyle = '#D4A574';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(rx, ry, rw, rh);

    this.ctx.fillStyle = '#FFF3E0';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, Math.floor(sx), Math.floor(sy));
  }

  drawShopPrompt(nearbyShop, camera) {
    if (!nearbyShop) return;
    const shopCenterX = (nearbyShop.x + nearbyShop.width / 2) * TILE_SIZE;
    const sx = shopCenterX - camera.x;
    const sy = (SURFACE_Y - 3) * TILE_SIZE - camera.y;

    // Background pill
    const text = `[B] ${nearbyShop.name}`;
    this.ctx.font = '5px "Press Start 2P", monospace';
    const tw = this.ctx.measureText(text).width;
    const pad = 3;

    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const rx = Math.floor(sx - tw / 2 - pad);
    const ry = Math.floor(sy - 4);
    const rw = tw + pad * 2;
    const rh = 10;
    this.ctx.fillRect(rx, ry, rw, rh);

    // Border
    this.ctx.strokeStyle = '#8D6E63';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(rx, ry, rw, rh);

    // Text
    this.ctx.fillStyle = '#FFF3E0';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, Math.floor(sx), Math.floor(sy));
  }

  drawPings(pings, camera) {
    for (const ping of pings) {
      const screenPos = camera.worldToScreen(ping.x, ping.y);
      const alpha = Math.min(1, ping.life / 60);
      const pulse = 1 + 0.2 * Math.sin(Date.now() * 0.008);

      this.ctx.save();
      this.ctx.globalAlpha = alpha;

      // Outer ring
      this.ctx.strokeStyle = '#4FC3F7';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, 6 * pulse, 0, Math.PI * 2);
      this.ctx.stroke();

      // Inner dot
      this.ctx.fillStyle = '#4FC3F7';
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, 2, 0, Math.PI * 2);
      this.ctx.fill();

      // Name label
      this.ctx.font = '4px "Press Start 2P", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(ping.playerName, screenPos.x, screenPos.y - 10);

      this.ctx.restore();
    }
  }

  drawDeathScreen(respawnTimer, maxRespawnFrames, damageType) {
    // Dark overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(0, 0, this.renderWidth, this.renderHeight);

    const cx = this.renderWidth / 2;
    const cy = this.renderHeight / 2;

    // Death message based on cause
    const messages = {
      lava: 'You fell in lava!',
      fall: 'You fell to your doom!',
      crumble: 'The floor gave way!',
    };
    const message = messages[damageType] || 'You died!';

    this.ctx.fillStyle = '#EF5350';
    this.ctx.font = '10px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(message, cx, cy - 20);

    // Respawn countdown
    const secs = Math.ceil(respawnTimer / 60);
    this.ctx.fillStyle = '#FFF';
    this.ctx.font = '7px "Press Start 2P", monospace';
    this.ctx.fillText(`Respawning in ${secs}...`, cx, cy + 5);

    // Progress bar
    const barW = 80;
    const barH = 4;
    const progress = 1 - (respawnTimer / maxRespawnFrames);
    this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
    this.ctx.fillRect(cx - barW / 2, cy + 15, barW, barH);
    this.ctx.fillStyle = '#EF5350';
    this.ctx.fillRect(cx - barW / 2, cy + 15, barW * progress, barH);
  }

  // Draw crumbling tile overlay (shaking + cracks)
  drawCrumblingTiles(crumbleTiles, camera) {
    for (const [key, info] of crumbleTiles) {
      const sx = info.x * TILE_SIZE - camera.x;
      const sy = info.y * TILE_SIZE - camera.y;

      // Shake offset increases as timer runs out
      const progress = 1 - (info.timer / info.maxTimer);
      const shakeAmt = progress * 2;
      const shakeX = (Math.random() - 0.5) * shakeAmt;
      const shakeY = (Math.random() - 0.5) * shakeAmt;

      // Draw crack overlay
      this.ctx.save();
      this.ctx.translate(shakeX, shakeY);

      // Darken progressively
      this.ctx.fillStyle = `rgba(0, 0, 0, ${progress * 0.4})`;
      this.ctx.fillRect(Math.floor(sx), Math.floor(sy), TILE_SIZE, TILE_SIZE);

      // Crack lines
      this.ctx.strokeStyle = `rgba(40, 20, 10, ${0.5 + progress * 0.5})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      // Diagonal crack
      this.ctx.moveTo(Math.floor(sx + 3), Math.floor(sy + 2));
      this.ctx.lineTo(Math.floor(sx + TILE_SIZE / 2), Math.floor(sy + TILE_SIZE / 2));
      this.ctx.lineTo(Math.floor(sx + TILE_SIZE - 3), Math.floor(sy + TILE_SIZE - 2));
      // Cross crack
      this.ctx.moveTo(Math.floor(sx + TILE_SIZE - 4), Math.floor(sy + 3));
      this.ctx.lineTo(Math.floor(sx + TILE_SIZE / 2), Math.floor(sy + TILE_SIZE / 2));
      this.ctx.lineTo(Math.floor(sx + 4), Math.floor(sy + TILE_SIZE - 4));
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  // Draw darkness vignette that intensifies with depth
  drawDarknessVignette(depth) {
    if (depth <= DARKNESS_START_DEPTH) return;

    const t = Math.min(1, (depth - DARKNESS_START_DEPTH) / (DARKNESS_MAX_DEPTH - DARKNESS_START_DEPTH));
    const alpha = t * DARKNESS_MAX_ALPHA;

    const cx = this.renderWidth / 2;
    const cy = this.renderHeight / 2;
    const diag = Math.sqrt(cx * cx + cy * cy);

    const innerR = diag * DARKNESS_INNER_RADIUS * (1 - t * 0.3); // inner shrinks with depth
    const outerR = diag * DARKNESS_OUTER_RADIUS;

    const grd = this.ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(0,0,0,${alpha})`);

    this.ctx.fillStyle = grd;
    this.ctx.fillRect(0, 0, this.renderWidth, this.renderHeight);
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
