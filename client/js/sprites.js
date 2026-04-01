import { TILE, TILE_COLORS, DOG_COLORS, TILE_SIZE, DOG_BREEDS, SHOP_LOCATIONS } from '../../shared/constants.js';
import { DOG_SPRITES, SPRITE_PALETTE } from '../../shared/sprite-data.js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js';

const spriteCache = new Map();

// Custom sprite overrides loaded from Supabase (breed_key -> sprite_data)
const customSprites = {};
let customPalette = null;

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
        customSprites[row.breed_key] = row.sprite_data;
        if (!customPalette && row.palette) customPalette = row.palette;
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
      const idx = row.charCodeAt(x) - 48; // '0' = 48
      if (idx === 0) continue;
      ctx.fillStyle = resolved[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// Generate decoration sprite
function genDecorationSprite(decId) {
  const decs = {
    0: drawFireHydrant,
    1: drawDogHouse,
    2: drawTennisBall,
    3: drawFlowerBed,
    4: drawFountain,
    5: drawFossilDisplay,
    6: drawGoldStatue,
    7: drawDiamondKennel,
    8: drawShrine,
    9: drawMushroomGarden,
    10: drawCrystalDisplay,
  };
  const fn = decs[decId];
  if (!fn) return null;
  return fn();
}

function drawFireHydrant() {
  const c = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = c.getContext('2d');
  drawRect(ctx, 5, 2, 6, 12, '#F44336');
  drawRect(ctx, 3, 4, 10, 2, '#D32F2F');
  drawRect(ctx, 6, 1, 4, 2, '#E53935');
  drawRect(ctx, 4, 13, 8, 2, '#B71C1C');
  return c;
}

function drawDogHouse() {
  const c = createCanvas(TILE_SIZE * 2, TILE_SIZE * 2);
  const ctx = c.getContext('2d');
  // Roof
  ctx.fillStyle = '#D32F2F';
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(16, 0);
  ctx.lineTo(32, 12);
  ctx.fill();
  // Body
  drawRect(ctx, 2, 12, 28, 18, '#8D6E63');
  // Door
  drawRect(ctx, 11, 16, 10, 14, '#5D4037');
  // Sign
  drawRect(ctx, 12, 13, 8, 3, '#FFF');
  return c;
}

function drawTennisBall() {
  const c = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#CDDC39';
  ctx.beginPath();
  ctx.arc(8, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#F0F4C3';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(8, 8, 4, -0.5, 1);
  ctx.stroke();
  return c;
}

function drawFlowerBed() {
  const c = createCanvas(TILE_SIZE * 2, TILE_SIZE);
  const ctx = c.getContext('2d');
  drawRect(ctx, 0, 10, 32, 6, '#5D4037');
  drawRect(ctx, 1, 8, 30, 3, '#388E3C');
  const colors = ['#E91E63', '#FF9800', '#9C27B0', '#F44336', '#FFEB3B'];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(4 + i * 6, 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function drawFountain() {
  const c = createCanvas(TILE_SIZE * 2, TILE_SIZE * 2);
  const ctx = c.getContext('2d');
  drawRect(ctx, 4, 20, 24, 10, '#78909C');
  drawRect(ctx, 8, 12, 16, 10, '#90A4AE');
  drawRect(ctx, 13, 4, 6, 10, '#B0BEC5');
  ctx.fillStyle = '#42A5F5';
  ctx.beginPath();
  ctx.arc(16, 3, 4, 0, Math.PI * 2);
  ctx.fill();
  // Water drops
  ctx.fillStyle = '#64B5F6';
  ctx.fillRect(10, 8, 2, 3);
  ctx.fillRect(20, 8, 2, 3);
  return c;
}

function drawFossilDisplay() {
  const c = createCanvas(TILE_SIZE, TILE_SIZE * 2);
  const ctx = c.getContext('2d');
  drawRect(ctx, 2, 16, 12, 14, '#5D4037');
  drawRect(ctx, 1, 0, 14, 18, '#EFEBE9');
  drawRect(ctx, 2, 1, 12, 16, '#D7CCC8');
  // Fossil bone
  ctx.fillStyle = '#A1887F';
  ctx.fillRect(4, 4, 8, 2);
  ctx.fillRect(4, 8, 2, 6);
  ctx.fillRect(10, 8, 2, 6);
  ctx.fillRect(3, 3, 3, 2);
  ctx.fillRect(10, 3, 3, 2);
  return c;
}

function drawGoldStatue() {
  const c = createCanvas(TILE_SIZE, TILE_SIZE * 2);
  const ctx = c.getContext('2d');
  // Pedestal
  drawRect(ctx, 2, 24, 12, 6, '#757575');
  drawRect(ctx, 3, 22, 10, 3, '#9E9E9E');
  // Dog statue
  drawRect(ctx, 4, 10, 8, 6, '#FFC107');
  drawRect(ctx, 3, 16, 2, 6, '#FFA000');
  drawRect(ctx, 7, 16, 2, 6, '#FFA000');
  drawRect(ctx, 11, 16, 2, 6, '#FFA000');
  // Head
  drawRect(ctx, 8, 5, 5, 5, '#FFC107');
  drawRect(ctx, 9, 3, 2, 3, '#FFD54F');
  return c;
}

function drawDiamondKennel() {
  const c = createCanvas(TILE_SIZE * 2, TILE_SIZE * 2);
  const ctx = c.getContext('2d');
  drawRect(ctx, 2, 10, 28, 20, '#00BCD4');
  drawRect(ctx, 0, 8, 32, 3, '#0097A7');
  ctx.fillStyle = '#00838F';
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(16, 0);
  ctx.lineTo(32, 8);
  ctx.fill();
  drawRect(ctx, 11, 16, 10, 14, '#004D40');
  // Diamond accents
  ctx.fillStyle = '#84FFFF';
  ctx.fillRect(4, 14, 3, 3);
  ctx.fillRect(25, 14, 3, 3);
  return c;
}

function drawShrine() {
  const c = createCanvas(TILE_SIZE * 2, TILE_SIZE * 3);
  const ctx = c.getContext('2d');
  // Base
  drawRect(ctx, 0, 36, 32, 12, '#5D4037');
  // Pillars
  drawRect(ctx, 2, 10, 4, 28, '#8D6E63');
  drawRect(ctx, 26, 10, 4, 28, '#8D6E63');
  // Top
  drawRect(ctx, 0, 6, 32, 6, '#6D4C41');
  // Artifact glow
  ctx.fillStyle = '#FF6D00';
  ctx.beginPath();
  ctx.arc(16, 26, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFAB40';
  ctx.beginPath();
  ctx.arc(16, 26, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function drawMushroomGarden() {
  const c = createCanvas(TILE_SIZE * 2, TILE_SIZE);
  const ctx = c.getContext('2d');
  drawRect(ctx, 0, 10, 32, 6, '#4A3670');
  // Mushrooms
  ctx.fillStyle = '#76FF03';
  ctx.beginPath(); ctx.arc(6, 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, 4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(26, 6, 4, 0, Math.PI * 2); ctx.fill();
  // Stems
  ctx.fillStyle = '#AED581';
  ctx.fillRect(5, 8, 2, 4);
  ctx.fillRect(15, 7, 2, 5);
  ctx.fillRect(25, 8, 2, 4);
  return c;
}

function drawCrystalDisplay() {
  const c = createCanvas(TILE_SIZE, TILE_SIZE * 2);
  const ctx = c.getContext('2d');
  drawRect(ctx, 2, 20, 12, 10, '#38006B');
  // Crystal formation
  ctx.fillStyle = '#EA80FC';
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(4, 18);
  ctx.lineTo(12, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#CE93D8';
  ctx.beginPath();
  ctx.moveTo(5, 8);
  ctx.lineTo(2, 18);
  ctx.lineTo(8, 18);
  ctx.closePath();
  ctx.fill();
  return c;
}

// Shop machine sprites (2 tiles wide x 2 tiles tall, drawn on surface)
function genShopMachineSprite(shopType) {
  const W = TILE_SIZE * 2;
  const H = TILE_SIZE * 2;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  if (shopType === 'decorations') {
    // Wooden stand with paint palette theme
    // Main body
    drawRect(ctx, 4, 8, 24, 22, '#6D4C41');
    drawRect(ctx, 2, 6, 28, 3, '#8D6E63');
    // Roof
    drawRect(ctx, 0, 3, 32, 4, '#5D4037');
    drawRect(ctx, 2, 1, 28, 3, '#795548');
    // Counter
    drawRect(ctx, 3, 8, 26, 2, '#A1887F');
    // Paint swatches
    ctx.fillStyle = '#F44336'; ctx.fillRect(6, 12, 4, 4);
    ctx.fillStyle = '#4CAF50'; ctx.fillRect(12, 12, 4, 4);
    ctx.fillStyle = '#2196F3'; ctx.fillRect(18, 12, 4, 4);
    ctx.fillStyle = '#FFC107'; ctx.fillRect(24, 12, 4, 4);
    // Awning stripes
    ctx.fillStyle = '#4E342E';
    ctx.fillRect(0, 4, 4, 2);
    ctx.fillRect(8, 4, 4, 2);
    ctx.fillRect(16, 4, 4, 2);
    ctx.fillRect(24, 4, 4, 2);
    // Base
    drawRect(ctx, 4, 28, 24, 4, '#4E342E');
  } else if (shopType === 'emotes') {
    // Teal booth with speech bubble
    // Main body
    drawRect(ctx, 4, 8, 24, 22, '#00695C');
    drawRect(ctx, 2, 6, 28, 3, '#00897B');
    // Roof
    drawRect(ctx, 0, 3, 32, 4, '#004D40');
    drawRect(ctx, 2, 1, 28, 3, '#00796B');
    // Speech bubble icon
    ctx.fillStyle = '#E0F2F1';
    ctx.fillRect(9, 11, 14, 10);
    ctx.fillRect(8, 12, 1, 8);
    ctx.fillRect(23, 12, 1, 8);
    ctx.fillRect(10, 10, 12, 1);
    ctx.fillRect(10, 21, 4, 1);
    ctx.fillRect(11, 22, 3, 1);
    ctx.fillRect(12, 23, 2, 1);
    // Dots inside bubble
    ctx.fillStyle = '#00695C';
    ctx.fillRect(12, 15, 2, 2);
    ctx.fillRect(16, 15, 2, 2);
    ctx.fillRect(20, 15, 2, 2);
    // Awning stripes
    ctx.fillStyle = '#004D40';
    ctx.fillRect(0, 4, 4, 2);
    ctx.fillRect(8, 4, 4, 2);
    ctx.fillRect(16, 4, 4, 2);
    ctx.fillRect(24, 4, 4, 2);
    // Base
    drawRect(ctx, 4, 28, 24, 4, '#004D40');
  } else if (shopType === 'upgrades') {
    // Dark metal forge/workshop
    // Main body
    drawRect(ctx, 4, 8, 24, 22, '#37474F');
    drawRect(ctx, 2, 6, 28, 3, '#455A64');
    // Roof
    drawRect(ctx, 0, 3, 32, 4, '#263238');
    drawRect(ctx, 2, 1, 28, 3, '#37474F');
    // Anvil shape
    ctx.fillStyle = '#78909C';
    ctx.fillRect(10, 18, 12, 3);
    ctx.fillRect(8, 17, 16, 2);
    ctx.fillRect(12, 21, 8, 3);
    // Hammer
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(20, 11, 2, 7);
    ctx.fillStyle = '#90A4AE';
    ctx.fillRect(18, 10, 6, 3);
    // Spark effects
    ctx.fillStyle = '#FF9800';
    ctx.fillRect(11, 14, 1, 1);
    ctx.fillRect(14, 13, 1, 1);
    ctx.fillStyle = '#FFC107';
    ctx.fillRect(9, 15, 1, 1);
    ctx.fillRect(16, 14, 1, 1);
    // Awning stripes
    ctx.fillStyle = '#263238';
    ctx.fillRect(0, 4, 4, 2);
    ctx.fillRect(8, 4, 4, 2);
    ctx.fillRect(16, 4, 4, 2);
    ctx.fillRect(24, 4, 4, 2);
    // Base
    drawRect(ctx, 4, 28, 24, 4, '#263238');
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
