import { TILE, TILE_COLORS, DOG_COLORS, TILE_SIZE, DOG_BREEDS, SHOP_LOCATIONS } from '../../shared/constants.js';
import { DOG_SPRITES, SPRITE_PALETTE, DECORATION_SPRITES, DECORATION_PALETTES, SHOP_SPRITES, SHOP_PALETTES } from '../../shared/sprite-data.js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js';

const spriteCache = new Map();

// Custom sprite overrides loaded from Supabase (breed_key -> sprite_data)
const customSprites = {};
let customPalette = null;

// Mutable decoration data — starts with file defaults, overridden by DB on server
let activeDecorationSprites = { ...DECORATION_SPRITES };
let activeDecorationPalettes = { ...DECORATION_PALETTES };

// Mutable shop sprite data — starts with file defaults, overridden by Supabase
let activeShopSprites = { ...SHOP_SPRITES };
let activeShopPalettes = { ...SHOP_PALETTES };

// Load decoration sprites from Supabase, falling back to server API, then file defaults
export async function loadDecorationSprites() {
  // Try Supabase first (works on GitHub Pages and multiplayer)
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('decoration_sprites')
          .select('dec_id, pixels, palette')
          .order('dec_id');
        if (!error && data && data.length > 0) {
          for (const row of data) {
            activeDecorationSprites[row.dec_id] = row.pixels;
            activeDecorationPalettes[row.dec_id] = row.palette;
          }
          spriteCache.forEach((v, k) => { if (k.startsWith('dec_')) spriteCache.delete(k); });
          return;
        }
      } catch {
        // Fall through to server API
      }
    }
  }
  // Fallback: try local server API (multiplayer with SQLite)
  try {
    const res = await fetch('/api/decoration-sprites');
    if (!res.ok) return;
    const data = await res.json();
    if (data.sprites) activeDecorationSprites = data.sprites;
    if (data.palettes) activeDecorationPalettes = data.palettes;
    spriteCache.forEach((v, k) => { if (k.startsWith('dec_')) spriteCache.delete(k); });
  } catch {
    // Server not available — keep file defaults
  }
}

// Load shop sprites from Supabase, falling back to file defaults
export async function loadShopSprites() {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from('shop_sprites')
      .select('shop_type, pixels, palette');
    if (!error && data && data.length > 0) {
      for (const row of data) {
        activeShopSprites[row.shop_type] = row.pixels;
        activeShopPalettes[row.shop_type] = row.palette;
      }
      spriteCache.forEach((v, k) => { if (k.startsWith('shop_')) spriteCache.delete(k); });
    }
  } catch {
    // Keep file defaults
  }
}

// Load custom sprites from Supabase (non-blocking, falls back to defaults)
export async function loadCustomSprites() {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from('custom_sprites')
      .select('breed_key, sprite_data, palette')
      .eq('is_public', true)
      .order('updated_at', { ascending: false });
    if (error || !data) return;
    // Use the most recent custom sprite per breed
    for (const row of data) {
      if (!customSprites[row.breed_key]) {
        // Ensure sprite_data is an object (JSONB may arrive as string in some configs)
        let sd = row.sprite_data;
        if (typeof sd === 'string') { try { sd = JSON.parse(sd); } catch { continue; } }
        if (sd && typeof sd === 'object' && sd.idle) {
          customSprites[row.breed_key] = sd;
          if (!customPalette && row.palette) customPalette = row.palette;
        }
      }
    }
    // Clear sprite cache so new sprites are rendered
    spriteCache.forEach((v, k) => { if (k.startsWith('dog_')) spriteCache.delete(k); });
  } catch (e) {
    console.warn('Failed to load custom sprites:', e);
  }
}

function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Generate tile sprite
function genTileSprite(tileType) {
  const S = TILE_SIZE;
  const c = createCanvas(S, S);
  const ctx = c.getContext('2d');
  const colors = TILE_COLORS[tileType];
  if (!colors) return null;

  // Base fill
  drawRect(ctx, 0, 0, S, S, colors.main);
  // Top edge highlight
  drawRect(ctx, 0, 0, S, 2, colors.top);
  // Bottom edge shadow
  drawRect(ctx, 0, S - 1, S, 1, colors.accent);

  // Texture details
  if (tileType === TILE.DIRT || tileType === TILE.BONE) {
    // Dirt speckles
    ctx.fillStyle = colors.accent;
    for (let i = 0; i < 6; i++) {
      const sx = (i * 7 + 3) % S;
      const sy = (i * 11 + 4) % S;
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
  if (tileType === TILE.CLAY || tileType === TILE.GEM || tileType === TILE.FOSSIL) {
    // Clay lines
    ctx.fillStyle = colors.accent;
    drawRect(ctx, 0, 5, S, 1, colors.accent);
    drawRect(ctx, 0, 11, S, 1, colors.accent);
  }
  if (tileType === TILE.STONE || tileType === TILE.GOLD || tileType === TILE.DIAMOND || tileType === TILE.ARTIFACT) {
    // Stone cracks
    ctx.fillStyle = colors.accent;
    ctx.fillRect(3, 3, 4, 1);
    ctx.fillRect(9, 8, 5, 1);
    ctx.fillRect(2, 12, 3, 1);
  }
  if (tileType === TILE.GRASS) {
    // Grass blades on top
    ctx.fillStyle = '#66BB6A';
    for (let i = 0; i < S; i += 3) {
      ctx.fillRect(i, 0, 1, 1);
    }
  }
  if (tileType === TILE.BEDROCK) {
    // Dark cracks
    ctx.fillStyle = '#181818';
    ctx.fillRect(2, 2, 3, 1);
    ctx.fillRect(8, 6, 4, 1);
    ctx.fillRect(4, 10, 2, 1);
    ctx.fillRect(10, 13, 3, 1);
  }
  if (tileType === TILE.GRANITE) {
    // Dense speckled texture
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(1, 3, 2, 2);
    ctx.fillRect(7, 1, 3, 1);
    ctx.fillRect(4, 8, 2, 2);
    ctx.fillRect(10, 5, 2, 2);
    ctx.fillRect(2, 12, 3, 1);
    ctx.fillRect(12, 11, 2, 2);
    // Light flecks
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(5, 2, 1, 1);
    ctx.fillRect(11, 9, 1, 1);
    ctx.fillRect(3, 14, 1, 1);
  }
  if (tileType === TILE.SHOP_FLOOR) {
    // Cobblestone/paved look
    ctx.fillStyle = '#455A64';
    ctx.fillRect(0, 7, S, 1);
    ctx.fillRect(7, 0, 1, 7);
    ctx.fillRect(3, 8, 1, 8);
    ctx.fillRect(11, 8, 1, 8);
    // Light flecks
    ctx.fillStyle = '#78909C';
    ctx.fillRect(2, 3, 2, 1);
    ctx.fillRect(9, 5, 2, 1);
    ctx.fillRect(5, 11, 2, 1);
    ctx.fillRect(13, 13, 2, 1);
  }
  if (tileType === TILE.LAVA) {
    // Animated lava surface glow
    ctx.fillStyle = '#FF8F00';
    ctx.fillRect(2, 1, 4, 2);
    ctx.fillRect(9, 3, 3, 2);
    ctx.fillRect(5, 6, 5, 2);
    ctx.fillRect(1, 10, 3, 2);
    ctx.fillRect(11, 8, 3, 2);
    // Bright hotspots
    ctx.fillStyle = '#FFAB00';
    ctx.fillRect(3, 2, 2, 1);
    ctx.fillRect(10, 4, 1, 1);
    ctx.fillRect(6, 7, 2, 1);
  }
  // Mushroom biome
  if (tileType === TILE.MUSHROOM_DIRT) {
    ctx.fillStyle = '#7B5EA7';
    ctx.fillRect(3, 4, 2, 1);
    ctx.fillRect(9, 9, 3, 1);
    ctx.fillRect(1, 13, 2, 1);
  }
  // Crystal biome
  if (tileType === TILE.CRYSTAL_ROCK) {
    ctx.fillStyle = '#6A1B9A';
    ctx.fillRect(2, 3, 1, 3);
    ctx.fillRect(8, 1, 1, 4);
    ctx.fillRect(12, 7, 1, 3);
    ctx.fillRect(5, 11, 1, 3);
  }
  // Frozen biome
  if (tileType === TILE.FROZEN_ICE) {
    ctx.fillStyle = '#E1F5FE';
    ctx.fillRect(1, 2, 3, 1);
    ctx.fillRect(7, 5, 4, 1);
    ctx.fillRect(3, 10, 5, 1);
    ctx.fillRect(10, 13, 3, 1);
  }
  // Ancient biome
  if (tileType === TILE.ANCIENT_BRICK) {
    // Brick pattern
    ctx.fillStyle = '#4E342E';
    ctx.fillRect(0, 7, S, 1);
    ctx.fillRect(7, 0, 1, 7);
    ctx.fillRect(3, 8, 1, 8);
    ctx.fillRect(11, 8, 1, 8);
  }

  // Crumbling tile
  if (tileType === TILE.CRUMBLE) {
    // Cracked surface pattern
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(2, 3, 5, 1);
    ctx.fillRect(7, 3, 1, 4);
    ctx.fillRect(7, 7, 4, 1);
    ctx.fillRect(3, 9, 4, 1);
    ctx.fillRect(10, 11, 3, 1);
    // Lighter crack edges
    ctx.fillStyle = '#BCAAA4';
    ctx.fillRect(3, 2, 3, 1);
    ctx.fillRect(8, 6, 3, 1);
    ctx.fillRect(4, 8, 2, 1);
    ctx.fillRect(11, 10, 2, 1);
    // Crumble dots (debris)
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(1, 14, 1, 1);
    ctx.fillRect(5, 13, 1, 1);
    ctx.fillRect(9, 14, 1, 1);
    ctx.fillRect(13, 13, 1, 1);
  }

  // Resource gem overlay
  if (colors.gem) {
    ctx.fillStyle = colors.gem;
    // Draw small gem shape in center
    ctx.fillRect(6, 5, 4, 4);
    ctx.fillRect(7, 4, 2, 1);
    ctx.fillRect(7, 9, 2, 1);
    // Sparkle
    ctx.fillStyle = '#FFF';
    ctx.fillRect(7, 5, 1, 1);
  }

  return c;
}

// Generate dog sprite from sprite-data.js pixel arrays (or custom overrides)
function genDogSprite(breedId, animState, frameIndex) {
  const breed = DOG_BREEDS[breedId] || DOG_BREEDS[0];
  const breedKey = breed.name.toLowerCase();
  const breedData = customSprites[breedKey] || DOG_SPRITES[breedKey];
  if (!breedData) return null;

  const frames = breedData[animState] || breedData.idle;
  const pixelData = frames[frameIndex % frames.length];

  // Resolve palette: indices 1-3 become breed-specific hex colors
  const palette = customPalette || SPRITE_PALETTE;
  const resolved = palette.map(entry => {
    if (entry === 'body') return breed.colors.body;
    if (entry === 'dark') return breed.colors.dark;
    if (entry === 'light') return breed.colors.light;
    return entry;
  });

  const c = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 16; y++) {
    const row = pixelData[y];
    for (let x = 0; x < 16; x++) {
      const idx = parseInt(row[x], 16);
      if (idx === 0) continue;
      if (resolved[idx]) {
        ctx.fillStyle = resolved[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

// Generate decoration sprite from pixel data
function genDecorationSprite(decId) {
  const pixels = activeDecorationSprites[decId];
  const palette = activeDecorationPalettes[decId];
  if (!pixels || !palette) return null;
  const h = pixels.length;
  const w = pixels[0].length;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = parseInt(pixels[y][x], 16);
      if (idx === 0) continue;
      if (palette[idx]) {
        ctx.fillStyle = palette[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

// Shop machine sprites (2 tiles wide x 2 tiles tall, drawn on surface)
function genShopMachineSprite(shopType) {
  const pixels = activeShopSprites[shopType];
  const palette = activeShopPalettes[shopType];
  if (!pixels || !palette) return null;
  const h = pixels.length;
  const w = pixels[0].length;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = parseInt(pixels[y][x], 16);
      if (idx === 0) continue;
      if (palette[idx]) {
        ctx.fillStyle = palette[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

// Sky gradient (cached)
let skyGradientCanvas = null;

export function getSkyGradient(width, skyHeight) {
  if (skyGradientCanvas && skyGradientCanvas.width === width && skyGradientCanvas.height === skyHeight) {
    return skyGradientCanvas;
  }
  skyGradientCanvas = createCanvas(width, skyHeight);
  const ctx = skyGradientCanvas.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, skyHeight);
  grd.addColorStop(0, '#87CEEB');
  grd.addColorStop(0.7, '#B3E5FC');
  grd.addColorStop(1, '#E1F5FE');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, skyHeight);
  return skyGradientCanvas;
}

// Underground background gradient
let undergroundCanvas = null;

export function getUndergroundBg(width, height) {
  if (undergroundCanvas && undergroundCanvas.width === width && undergroundCanvas.height === height) {
    return undergroundCanvas;
  }
  undergroundCanvas = createCanvas(width, height);
  const ctx = undergroundCanvas.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, height);
  grd.addColorStop(0, '#3E2723');
  grd.addColorStop(0.5, '#1B0000');
  grd.addColorStop(1, '#000');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);
  return undergroundCanvas;
}

// Public API
export function getTileSprite(tileType) {
  const key = 'tile_' + tileType;
  if (!spriteCache.has(key)) {
    spriteCache.set(key, genTileSprite(tileType));
  }
  return spriteCache.get(key);
}

export function getDogSprite(breedId, animState, frameIndex) {
  const key = `dog_${breedId}_${animState}_${frameIndex}`;
  if (!spriteCache.has(key)) {
    spriteCache.set(key, genDogSprite(breedId, animState, frameIndex));
  }
  return spriteCache.get(key);
}

export function getShopMachineSprite(shopType) {
  const key = 'shop_' + shopType;
  if (!spriteCache.has(key)) {
    spriteCache.set(key, genShopMachineSprite(shopType));
  }
  return spriteCache.get(key);
}

export function getBankSprite() {
  return getShopMachineSprite('stash');
}

export function getFrameCount(breedId, animState) {
  const breed = DOG_BREEDS[breedId] || DOG_BREEDS[0];
  const breedKey = breed.name.toLowerCase();
  const breedData = customSprites[breedKey] || DOG_SPRITES[breedKey];
  if (!breedData) return 1;
  const frames = breedData[animState] || breedData.idle;
  return frames ? frames.length : 1;
}

export function getDecorationSprite(decId) {
  const key = 'dec_' + decId;
  if (!spriteCache.has(key)) {
    spriteCache.set(key, genDecorationSprite(decId));
  }
  return spriteCache.get(key);
}
