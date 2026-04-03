import {
  TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT,
  IDLE_ZOOM_SCALE, IDLE_ZOOM_IN_SPEED, IDLE_ZOOM_OUT_SPEED,
  DEPTH_ZOOM_START, DEPTH_ZOOM_MAX_DEPTH, DEPTH_ZOOM_MAX_SCALE, DEPTH_ZOOM_SPEED,
  SURFACE_Y,
} from '../../shared/constants.js';

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

    // Depth zoom
    this.depthZoom = 1.0;
    this.idleZoomActive = false;
  }

  shake(intensity, frames) {
    this.shakeIntensity = intensity;
    this.shakeTimer = frames;
  }

  follow(targetX, targetY) {
    // Update zoom interpolation
    this.updateZoom();

    // The renderer zooms around the viewport center, so the camera must
    // always place the player at viewWidth/2, viewHeight/2 in pre-transform
    // screen coordinates — NOT at effectiveW/2 (which caused the player
    // to drift toward the upper-left when zoomed).
    const tx = targetX * TILE_SIZE - this.viewWidth / 2;
    const ty = targetY * TILE_SIZE - this.viewHeight / 2;

    // Smooth follow toward target
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

    // Clamp to world bounds.
    // The renderer's zoom-from-center transform means the visible world area
    // spans viewWidth/zoom pixels centered on viewWidth/2 in pre-transform space.
    // We need the world edges to stay within (or beyond) the screen edges.
    const cx = this.viewWidth / 2;
    const cy = this.viewHeight / 2;
    const halfVisW = cx / this.zoom;
    const halfVisH = cy / this.zoom;

    // Left edge of visible world: camera.x + cx - halfVisW >= 0
    const minX = -(cx - halfVisW);
    // Right edge: camera.x + cx + halfVisW <= worldWidth
    const maxX = WORLD_WIDTH * TILE_SIZE - cx - halfVisW;
    // Top edge: camera.y + cy - halfVisH >= 0
    const minY = -(cy - halfVisH);
    // Bottom edge: camera.y + cy + halfVisH <= worldHeight
    const maxY = WORLD_HEIGHT * TILE_SIZE - cy - halfVisH;

    this.x = Math.round(Math.max(minX, Math.min(maxX, this.x)));
    this.y = Math.round(Math.max(minY, Math.min(maxY, this.y)));
  }

  // Get visible tile range for culling
  getVisibleRange() {
    // The renderer zooms around viewport center, so visible world area
    // is viewWidth/zoom wide, centered on (camera.x + viewWidth/2)
    const cx = this.viewWidth / 2;
    const cy = this.viewHeight / 2;
    const halfVisW = cx / this.zoom;
    const halfVisH = cy / this.zoom;

    const worldLeft = this.x + cx - halfVisW;
    const worldTop = this.y + cy - halfVisH;
    const worldRight = this.x + cx + halfVisW;
    const worldBottom = this.y + cy + halfVisH;

    const startX = Math.max(0, Math.floor(worldLeft / TILE_SIZE) - 1);
    const startY = Math.max(0, Math.floor(worldTop / TILE_SIZE) - 1);
    const endX = Math.min(WORLD_WIDTH, Math.ceil(worldRight / TILE_SIZE) + 1);
    const endY = Math.min(WORLD_HEIGHT, Math.ceil(worldBottom / TILE_SIZE) + 1);
    return { startX, startY, endX, endY };
  }

  // World coords to screen coords (pre-transform)
  worldToScreen(wx, wy) {
    return {
      x: wx * TILE_SIZE - this.x,
      y: wy * TILE_SIZE - this.y,
    };
  }

  setIdleZoom(active) {
    this.idleZoomActive = active;
  }

  setDepthZoom(playerY) {
    const depth = Math.max(0, playerY - SURFACE_Y);
    if (depth < DEPTH_ZOOM_START) {
      this.depthZoom = 1.0;
    } else {
      const t = Math.min(1, (depth - DEPTH_ZOOM_START) / (DEPTH_ZOOM_MAX_DEPTH - DEPTH_ZOOM_START));
      // Ease-in for smooth transition
      this.depthZoom = 1.0 + (DEPTH_ZOOM_MAX_SCALE - 1.0) * (t * t);
    }
  }

  updateZoom() {
    // Compute target: idle zoom takes precedence (stacks with depth zoom)
    const baseTarget = this.depthZoom;
    const idleTarget = this.idleZoomActive ? Math.max(baseTarget, IDLE_ZOOM_SCALE) : baseTarget;
    this.targetZoom = idleTarget;

    const speed = this.targetZoom > this.zoom ? Math.max(IDLE_ZOOM_IN_SPEED, DEPTH_ZOOM_SPEED) : IDLE_ZOOM_OUT_SPEED;
    this.zoom += (this.targetZoom - this.zoom) * speed;
    // Snap when very close
    if (Math.abs(this.zoom - this.targetZoom) < 0.001) this.zoom = this.targetZoom;
    // Snap to nearest zoom where TILE_SIZE * zoom is an integer,
    // ensuring every game pixel maps to the same number of screen pixels
    this.zoom = Math.round(this.zoom * TILE_SIZE) / TILE_SIZE;
  }

  resize(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
  }
}
