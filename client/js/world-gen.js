import {
  WORLD_WIDTH, WORLD_HEIGHT, TILE, SURFACE_Y, BIOMES, placeShopFloors,
} from '../../shared/constants.js';

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

  // --- Pass 1: Base terrain ---
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const i = y * WORLD_WIDTH + x;

      if (x === 0 || x === WORLD_WIDTH - 1 || y >= WORLD_HEIGHT - 5) {
        tiles[i] = TILE.BEDROCK;
        continue;
      }
      if (y < SURFACE_Y) { tiles[i] = TILE.AIR; continue; }
      if (y === SURFACE_Y) { tiles[i] = TILE.GRASS; continue; }

      const depth = y - SURFACE_Y;
      let baseTile;
      if (depth <= 43) baseTile = TILE.DIRT;
      else if (depth <= 113) baseTile = TILE.CLAY;
      else baseTile = TILE.STONE;

      // Resource placement
      const r = rand();
      let tile = baseTile;

      if (depth <= 43) {
        if (r < 0.05) tile = TILE.BONE;
      } else if (depth <= 113) {
        if (r < 0.03) tile = TILE.BONE;
        else if (r < 0.05) tile = TILE.GEM;
        else if (r < 0.06) tile = TILE.FOSSIL;
      } else if (depth <= 193) {
        if (r < 0.02) tile = TILE.GEM;
        else if (r < 0.04) tile = TILE.FOSSIL;
        else if (r < 0.055) tile = TILE.GOLD;
        else if (r < 0.06) tile = TILE.DIAMOND;
      } else {
        if (r < 0.01) tile = TILE.GOLD;
        else if (r < 0.02) tile = TILE.DIAMOND;
        else if (r < 0.025) tile = TILE.ARTIFACT;
      }

      tiles[i] = tile;
    }
  }

  // --- Pass 2: Caves ---
  const numCaves = 30 + Math.floor(rand() * 20);
  for (let c = 0; c < numCaves; c++) {
    const cx = 2 + Math.floor(rand() * (WORLD_WIDTH - 4));
    const cy = SURFACE_Y + 5 + Math.floor(rand() * (WORLD_HEIGHT - SURFACE_Y - 20));
    const cw = 2 + Math.floor(rand() * 4);
    const ch = 2 + Math.floor(rand() * 3);
    carveRect(tiles, cx, cy, cw, ch, TILE.AIR);
  }

  // --- Pass 3: Starter tunnels ---
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

  // --- Pass 4: Granite formations (undiggable obstacles) ---
  const numGranite = 15 + Math.floor(rand() * 15);
  for (let g = 0; g < numGranite; g++) {
    const depth = 15 + Math.floor(rand() * (WORLD_HEIGHT - SURFACE_Y - 30));
    const gy = SURFACE_Y + depth;
    const gx = 2 + Math.floor(rand() * (WORLD_WIDTH - 6));
    // Irregular shapes: horizontal bars, L-shapes, blobs
    const shape = Math.floor(rand() * 4);
    if (shape === 0) {
      // Horizontal bar
      const len = 3 + Math.floor(rand() * 5);
      carveRect(tiles, gx, gy, len, 1, TILE.GRANITE);
    } else if (shape === 1) {
      // Vertical bar
      const len = 2 + Math.floor(rand() * 4);
      carveRect(tiles, gx, gy, 1, len, TILE.GRANITE);
    } else if (shape === 2) {
      // L-shape
      const len = 2 + Math.floor(rand() * 3);
      carveRect(tiles, gx, gy, len, 1, TILE.GRANITE);
      carveRect(tiles, gx, gy, 1, len, TILE.GRANITE);
    } else {
      // Blob (2x2 or 3x2)
      const bw = 2 + Math.floor(rand() * 2);
      carveRect(tiles, gx, gy, bw, 2, TILE.GRANITE);
    }
  }

  // --- Pass 5: Lava pools ---
  const numLava = 8 + Math.floor(rand() * 10);
  for (let l = 0; l < numLava; l++) {
    // Lava only appears deep (depth > 80)
    const depth = 80 + Math.floor(rand() * (WORLD_HEIGHT - SURFACE_Y - 100));
    const ly = SURFACE_Y + depth;
    const lx = 2 + Math.floor(rand() * (WORLD_WIDTH - 8));
    const lw = 2 + Math.floor(rand() * 5);
    // Lava pools: carve air above, lava at bottom
    carveRect(tiles, lx, ly - 2, lw, 2, TILE.AIR);
    carveRect(tiles, lx, ly, lw, 1, TILE.LAVA);
    // Sometimes add a second row of lava
    if (rand() < 0.3) {
      carveRect(tiles, lx + 1, ly + 1, Math.max(1, lw - 2), 1, TILE.LAVA);
    }
  }

  // --- Pass 6: Underground biomes ---
  for (const biome of BIOMES) {
    // Number of biome instances based on rarity
    const count = Math.floor(2 + rand() * 3 * biome.rarity);
    for (let b = 0; b < count; b++) {
      const depth = biome.minDepth + Math.floor(rand() * (biome.maxDepth - biome.minDepth));
      const by = SURFACE_Y + depth;
      const bx = 3 + Math.floor(rand() * (WORLD_WIDTH - biome.maxSize.w - 6));
      const bw = biome.minSize.w + Math.floor(rand() * (biome.maxSize.w - biome.minSize.w));
      const bh = biome.minSize.h + Math.floor(rand() * (biome.maxSize.h - biome.minSize.h));

      generateBiomeRoom(tiles, rand, biome, bx, by, bw, bh);
    }
  }

  // --- Pass 7: Treasure rooms (granite-enclosed, resource-rich) ---
  const numTreasure = 2 + Math.floor(rand() * 3);
  for (let t = 0; t < numTreasure; t++) {
    const depth = 40 + Math.floor(rand() * (WORLD_HEIGHT - SURFACE_Y - 60));
    const ty = SURFACE_Y + depth;
    const tx = 4 + Math.floor(rand() * (WORLD_WIDTH - 12));
    const tw = 4 + Math.floor(rand() * 2);
    const th = 3 + Math.floor(rand() * 2);

    // Granite shell (3 sides + bottom, one diggable entrance on a side)
    const entranceSide = Math.floor(rand() * 2); // 0=left, 1=right
    for (let dy = -1; dy <= th; dy++) {
      for (let dx = -1; dx <= tw; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (x <= 0 || x >= WORLD_WIDTH - 1 || y >= WORLD_HEIGHT - 5 || y <= SURFACE_Y) continue;
        const isEdge = dx === -1 || dx === tw || dy === -1 || dy === th;
        if (isEdge) {
          // Leave entrance gap
          const isEntrance = (entranceSide === 0 && dx === -1 && dy >= 1 && dy < th - 1) ||
                             (entranceSide === 1 && dx === tw && dy >= 1 && dy < th - 1);
          if (!isEntrance) {
            tiles[y * WORLD_WIDTH + x] = TILE.GRANITE;
          }
        } else {
          // Interior: high-value resources
          const r = rand();
          if (depth < 80) {
            tiles[y * WORLD_WIDTH + x] = r < 0.3 ? TILE.GEM : r < 0.5 ? TILE.FOSSIL : TILE.AIR;
          } else if (depth < 150) {
            tiles[y * WORLD_WIDTH + x] = r < 0.25 ? TILE.GOLD : r < 0.4 ? TILE.DIAMOND : r < 0.55 ? TILE.GEM : TILE.AIR;
          } else {
            tiles[y * WORLD_WIDTH + x] = r < 0.2 ? TILE.DIAMOND : r < 0.35 ? TILE.ARTIFACT : r < 0.5 ? TILE.GOLD : TILE.AIR;
          }
        }
      }
    }
  }

  // --- Pass 8: Crumbling tiles (bridges over caves and lava) ---
  const numCrumble = 12 + Math.floor(rand() * 10);
  for (let c = 0; c < numCrumble; c++) {
    const depth = 20 + Math.floor(rand() * (WORLD_HEIGHT - SURFACE_Y - 40));
    const cy = SURFACE_Y + depth;
    const cx = 3 + Math.floor(rand() * (WORLD_WIDTH - 6));
    const cw = 2 + Math.floor(rand() * 4);
    // Place crumble tiles as a thin bridge (1 tile thick)
    for (let dx = 0; dx < cw; dx++) {
      const x = cx + dx;
      if (x <= 0 || x >= WORLD_WIDTH - 1) continue;
      // Only place if tile below is air (so it's a bridge over a gap)
      const below = tiles[(cy + 1) * WORLD_WIDTH + x];
      if (below === TILE.AIR || below === undefined) {
        tiles[cy * WORLD_WIDTH + x] = TILE.CRUMBLE;
        // Clear tile above so player can land on it
        if (cy > SURFACE_Y + 1) {
          tiles[(cy - 1) * WORLD_WIDTH + x] = TILE.AIR;
        }
      }
    }
  }

  // --- Pass 9: Shop floors (undiggable platforms at surface) ---
  placeShopFloors(tiles);

  return tiles;
}

function generateBiomeRoom(tiles, rand, biome, bx, by, bw, bh) {
  // Fill with biome base tile
  for (let dy = 0; dy < bh; dy++) {
    for (let dx = 0; dx < bw; dx++) {
      const x = bx + dx;
      const y = by + dy;
      if (x <= 0 || x >= WORLD_WIDTH - 1 || y >= WORLD_HEIGHT - 5) continue;

      // Edge tiles are solid biome walls
      const isEdge = dx === 0 || dx === bw - 1 || dy === 0 || dy === bh - 1;

      if (isEdge) {
        tiles[y * WORLD_WIDTH + x] = biome.baseTile;
      } else {
        // Interior: mostly air with resource tiles and some base tile pillars
        const r = rand();
        if (r < biome.resourceChance) {
          tiles[y * WORLD_WIDTH + x] = biome.resourceTile;
        } else if (r < biome.resourceChance + 0.08) {
          // Occasional pillar/structure
          tiles[y * WORLD_WIDTH + x] = biome.baseTile;
        } else {
          tiles[y * WORLD_WIDTH + x] = TILE.AIR;
        }
      }
    }
  }

  // Add a few floating platforms inside larger biomes
  if (bw >= 8 && bh >= 6) {
    const numPlatforms = 1 + Math.floor(rand() * 3);
    for (let p = 0; p < numPlatforms; p++) {
      const px = bx + 2 + Math.floor(rand() * (bw - 5));
      const py = by + 2 + Math.floor(rand() * (bh - 4));
      const pw = 2 + Math.floor(rand() * 3);
      for (let dx = 0; dx < pw; dx++) {
        const x = px + dx;
        if (x > 0 && x < WORLD_WIDTH - 1) {
          tiles[py * WORLD_WIDTH + x] = biome.baseTile;
        }
      }
    }
  }
}

function carveRect(tiles, x, y, w, h, tile) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < WORLD_WIDTH - 1 && ny > SURFACE_Y && ny < WORLD_HEIGHT - 5) {
        tiles[ny * WORLD_WIDTH + nx] = tile;
      }
    }
  }
}
