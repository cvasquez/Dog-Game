import { WORLD_WIDTH, WORLD_HEIGHT, TILE, SOLID_TILES } from '/shared/constants.js';

export class World {
  constructor() {
    this.tiles = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
  }

  loadFromArray(arr) {
    for (let i = 0; i < arr.length && i < this.tiles.length; i++) {
      this.tiles[i] = arr[i];
    }
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TILE.BEDROCK;
    return this.tiles[y * this.width + x];
  }

  setTile(x, y, tile) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.tiles[y * this.width + x] = tile;
  }

  isSolid(x, y) {
    return SOLID_TILES.has(this.getTile(x, y));
  }
}
