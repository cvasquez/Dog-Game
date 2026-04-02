import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, IDLE_ZOOM_SCALE, IDLE_ZOOM_IN_SPEED, IDLE_ZOOM_OUT_SPEED } from '../../shared/constants.js';

export class Camera {
  constructor(viewWidth, viewHeight) {
    this.x = 0;
    this.y = 0;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.smoothing = 0.1;
    // Screen shake
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Idle zoom
    this.zoom = 1.0;
    this.targetZoom = 1.0;
  }

  shake(intensity, frames) {
    this.shakeIntensity = intensity;
    this.shakeTimer = frames;
  }

  follow(targetX, targetY) {
    // Update zoom interpolation
    this.updateZoom();

    // Use zoom-adjusted view size so camera centers correctly when zoomed
    const effectiveW = this.viewWidth / this.zoom;
    const effectiveH = this.viewHeight / this.zoom;

    // Target center of view on the player
    const tx = targetX * TILE_SIZE - effectiveW / 2;
    const ty = targetY * TILE_SIZE - effectiveH / 2;

    // Smooth follow
    this.x += (tx - this.x) * this.smoothing;
    this.y += (ty - this.y) * this.smoothing;

    // Screen shake
    if (this.shakeTimer > 0) {
      const decay = this.shakeTimer / 6;
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
      this.x += this.shakeOffsetX;
      this.y += this.shakeOffsetY;
      this.shakeTimer--;
    }

    // Clamp to world bounds (using effective view size for zoom)
    this.x = Math.max(0, Math.min(WORLD_WIDTH * TILE_SIZE - effectiveW, this.x));
    this.y = Math.max(0, Math.min(WORLD_HEIGHT * TILE_SIZE - effectiveH, this.y));
  }

  // Get visible tile range for culling
  getVisibleRange() {
    const effectiveW = this.viewWidth / this.zoom;
    const effectiveH = this.viewHeight / this.zoom;
    const startX = Math.max(0, Math.floor(this.x / TILE_SIZE) - 1);
    const startY = Math.max(0, Math.floor(this.y / TILE_SIZE) - 1);
    const endX = Math.min(WORLD_WIDTH, Math.ceil((this.x + effectiveW) / TILE_SIZE) + 1);
    const endY = Math.min(WORLD_HEIGHT, Math.ceil((this.y + effectiveH) / TILE_SIZE) + 1);
    return { startX, startY, endX, endY };
  }

  // World coords to screen coords
  worldToScreen(wx, wy) {
    return {
      x: wx * TILE_SIZE - this.x,
      y: wy * TILE_SIZE - this.y,
    };
  }

  setIdleZoom(active) {
    this.targetZoom = active ? IDLE_ZOOM_SCALE : 1.0;
  }

  updateZoom() {
    const speed = this.targetZoom > this.zoom ? IDLE_ZOOM_IN_SPEED : IDLE_ZOOM_OUT_SPEED;
    this.zoom += (this.targetZoom - this.zoom) * speed;
    // Snap when very close
    if (Math.abs(this.zoom - this.targetZoom) < 0.001) this.zoom = this.targetZoom;
  }

  resize(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
  }
}
