import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '/shared/constants.js';

export class Camera {
  constructor(viewWidth, viewHeight) {
    this.x = 0;
    this.y = 0;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.smoothing = 0.1;
  }

  follow(targetX, targetY) {
    // Target center of view on the player
    const tx = targetX * TILE_SIZE - this.viewWidth / 2;
    const ty = targetY * TILE_SIZE - this.viewHeight / 2;

    // Smooth follow
    this.x += (tx - this.x) * this.smoothing;
    this.y += (ty - this.y) * this.smoothing;

    // Clamp to world bounds
    this.x = Math.max(0, Math.min(WORLD_WIDTH * TILE_SIZE - this.viewWidth, this.x));
    this.y = Math.max(0, Math.min(WORLD_HEIGHT * TILE_SIZE - this.viewHeight, this.y));
  }

  // Get visible tile range for culling
  getVisibleRange() {
    const startX = Math.max(0, Math.floor(this.x / TILE_SIZE) - 1);
    const startY = Math.max(0, Math.floor(this.y / TILE_SIZE) - 1);
    const endX = Math.min(WORLD_WIDTH, Math.ceil((this.x + this.viewWidth) / TILE_SIZE) + 1);
    const endY = Math.min(WORLD_HEIGHT, Math.ceil((this.y + this.viewHeight) / TILE_SIZE) + 1);
    return { startX, startY, endX, endY };
  }

  // World coords to screen coords
  worldToScreen(wx, wy) {
    return {
      x: wx * TILE_SIZE - this.x,
      y: wy * TILE_SIZE - this.y,
    };
  }

  resize(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
  }
}
