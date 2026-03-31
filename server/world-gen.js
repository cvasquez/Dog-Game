import { WORLD_WIDTH, WORLD_HEIGHT, TILE, SURFACE_Y } from '../shared/constants.js';

// Mulberry32 seeded PRNG
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function generateWorld(seed) {
  const rand = mulberry32(seed);
  const tiles = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const i = y * WORLD_WIDTH + x;

      // Bedrock walls
      if (x === 0 || x === WORLD_WIDTH - 1 || y >= WORLD_HEIGHT - 5) {
        tiles[i] = TILE.BEDROCK;
        continue;
      }

      // Sky
      if (y < SURFACE_Y) {
        tiles[i] = TILE.AIR;
        continue;
      }

      // Surface grass
      if (y === SURFACE_Y) {
        tiles[i] = TILE.GRASS;
        continue;
      }

      // Underground layers
      const depth = y - SURFACE_Y;
      let baseTile;
      if (depth <= 43) baseTile = TILE.DIRT;
      else if (depth <= 113) baseTile = TILE.CLAY;
      else if (depth <= 193) baseTile = TILE.STONE;
      else baseTile = TILE.STONE; // deep stone (same tile, rarer resources)

      // Resource generation based on depth
      const r = rand();
      let tile = baseTile;

      if (depth <= 43) {
        // Dirt zone
        if (r < 0.05) tile = TILE.BONE;
      } else if (depth <= 113) {
        // Clay zone
        if (r < 0.03) tile = TILE.BONE;
        else if (r < 0.05) tile = TILE.GEM;
        else if (r < 0.06) tile = TILE.FOSSIL;
      } else if (depth <= 193) {
        // Stone zone
        if (r < 0.02) tile = TILE.GEM;
        else if (r < 0.04) tile = TILE.FOSSIL;
        else if (r < 0.055) tile = TILE.GOLD;
        else if (r < 0.06) tile = TILE.DIAMOND;
      } else {
        // Deep stone
        if (r < 0.01) tile = TILE.GOLD;
        else if (r < 0.02) tile = TILE.DIAMOND;
        else if (r < 0.025) tile = TILE.ARTIFACT;
      }

      tiles[i] = tile;
    }
  }

  // Carve caves (small air pockets)
  const numCaves = 30 + Math.floor(rand() * 20);
  for (let c = 0; c < numCaves; c++) {
    const cx = 2 + Math.floor(rand() * (WORLD_WIDTH - 4));
    const cy = SURFACE_Y + 5 + Math.floor(rand() * (WORLD_HEIGHT - SURFACE_Y - 20));
    const cw = 2 + Math.floor(rand() * 4);
    const ch = 2 + Math.floor(rand() * 3);
    for (let dy = 0; dy < ch; dy++) {
      for (let dx = 0; dx < cw; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx > 0 && nx < WORLD_WIDTH - 1 && ny < WORLD_HEIGHT - 5) {
          tiles[ny * WORLD_WIDTH + nx] = TILE.AIR;
        }
      }
    }
  }

  // Pre-dig starter tunnels near surface
  const numTunnels = 3 + Math.floor(rand() * 3);
  for (let t = 0; t < numTunnels; t++) {
    const tx = 5 + Math.floor(rand() * (WORLD_WIDTH - 10));
    for (let dy = 1; dy <= 3 + Math.floor(rand() * 4); dy++) {
      const ty = SURFACE_Y + dy;
      if (ty < WORLD_HEIGHT - 5) {
        tiles[ty * WORLD_WIDTH + tx] = TILE.AIR;
      }
    }
  }

  return tiles;
}
