import { TILE, TILE_COLORS, DOG_COLORS, TILE_SIZE } from '../../shared/constants.js';

const spriteCache = new Map();

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

// Generate dog sprite (12x12 in a 16x16 canvas)
function genDogSprite(colorIndex, frame, digging) {
  const S = TILE_SIZE;
  const c = createCanvas(S, S);
  const ctx = c.getContext('2d');
  const pal = DOG_COLORS[colorIndex] || DOG_COLORS[0];

  const ox = 2; // offset for centering
  const oy = 2;

  // Body
  drawRect(ctx, ox + 1, oy + 3, 10, 5, pal.body);
  // Head
  drawRect(ctx, ox + 7, oy + 1, 5, 5, pal.body);
  // Ears
  drawRect(ctx, ox + 8, oy, 2, 2, pal.dark);
  drawRect(ctx, ox + 11, oy, 1, 2, pal.dark);
  // Snout
  drawRect(ctx, ox + 11, oy + 3, 1, 2, pal.light);
  // Nose
  drawRect(ctx, ox + 12, oy + 3, 1, 1, '#000');
  // Eye
  drawRect(ctx, ox + 10, oy + 2, 1, 1, '#FFF');
  drawRect(ctx, ox + 10, oy + 2, 1, 1, '#222');
  // Eye white with pupil
  drawRect(ctx, ox + 9, oy + 2, 2, 1, '#FFF');
  drawRect(ctx, ox + 10, oy + 2, 1, 1, '#111');

  // Tail
  drawRect(ctx, ox, oy + 3, 1, 2, pal.dark);

  // Legs
  const legColor = pal.dark;
  if (digging) {
    // Digging animation - alternating paw positions
    const d = frame % 2;
    drawRect(ctx, ox + 2, oy + 8, 2, 3 + d, legColor);
    drawRect(ctx, ox + 5, oy + 8, 2, 4 - d, legColor);
    drawRect(ctx, ox + 8, oy + 8, 2, 3 + d, legColor);
  } else {
    // Walk animation
    const step = frame % 2;
    drawRect(ctx, ox + 2, oy + 8, 2, 3 + step, legColor);
    drawRect(ctx, ox + 5, oy + 8, 2, 4 - step, legColor);
    drawRect(ctx, ox + 8, oy + 8, 2, 3, legColor);
  }

  // Belly highlight
  drawRect(ctx, ox + 3, oy + 6, 6, 1, pal.light);

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

export function getDogSprite(colorIndex, frame, digging, facing) {
  const key = `dog_${colorIndex}_${frame}_${digging ? 1 : 0}`;
  if (!spriteCache.has(key)) {
    spriteCache.set(key, genDogSprite(colorIndex, frame, digging));
  }
  return spriteCache.get(key);
}

export function getDecorationSprite(decId) {
  const key = 'dec_' + decId;
  if (!spriteCache.has(key)) {
    spriteCache.set(key, genDecorationSprite(decId));
  }
  return spriteCache.get(key);
}
