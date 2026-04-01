// World dimensions
export const WORLD_WIDTH = 64;
export const WORLD_HEIGHT = 256;
export const TILE_SIZE = 16;

// Surface level (where players spawn)
export const SURFACE_Y = 7;
// Dog park zone
export const PARK_TOP = 3;
export const PARK_BOTTOM = 6;

// Tile types
export const TILE = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  CLAY: 3,
  STONE: 4,
  BEDROCK: 5,
  // Resources
  BONE: 10,
  GEM: 11,
  FOSSIL: 12,
  GOLD: 13,
  DIAMOND: 14,
  ARTIFACT: 15,
  // Obstacles
  LAVA: 20,
  GRANITE: 21,       // undiggable rock formations
  // Biome tiles
  MUSHROOM_DIRT: 30,  // mushroom cavern soil
  MUSHROOM: 31,       // glowing mushroom (resource)
  CRYSTAL_ROCK: 32,   // crystal cavern walls
  CRYSTAL: 33,        // harvestable crystal (resource)
  FROZEN_ICE: 34,     // frozen cavern walls (slippery)
  FROZEN_GEM: 35,     // frozen gem (resource)
  ANCIENT_BRICK: 36,  // ancient ruins walls
  ANCIENT_RELIC: 37,  // ancient relic (resource)
};

// Which tiles are solid (block movement)
export const SOLID_TILES = new Set([
  TILE.GRASS, TILE.DIRT, TILE.CLAY, TILE.STONE, TILE.BEDROCK,
  TILE.BONE, TILE.GEM, TILE.FOSSIL, TILE.GOLD, TILE.DIAMOND, TILE.ARTIFACT,
  TILE.GRANITE,
  TILE.MUSHROOM_DIRT, TILE.MUSHROOM,
  TILE.CRYSTAL_ROCK, TILE.CRYSTAL,
  TILE.FROZEN_ICE, TILE.FROZEN_GEM,
  TILE.ANCIENT_BRICK, TILE.ANCIENT_RELIC,
]);

// Hazard tiles (damage/kill the player)
export const HAZARD_TILES = new Set([TILE.LAVA]);

// Tile hardness (frames to dig, Infinity = undiggable)
export const HARDNESS = {
  [TILE.GRASS]: 30,
  [TILE.DIRT]: 45,
  [TILE.CLAY]: 90,
  [TILE.STONE]: 150,
  [TILE.BEDROCK]: Infinity,
  [TILE.GRANITE]: Infinity,
  [TILE.BONE]: 40,
  [TILE.GEM]: 80,
  [TILE.FOSSIL]: 80,
  [TILE.GOLD]: 120,
  [TILE.DIAMOND]: 150,
  [TILE.ARTIFACT]: 150,
  // Biome tiles
  [TILE.MUSHROOM_DIRT]: 50,
  [TILE.MUSHROOM]: 60,
  [TILE.CRYSTAL_ROCK]: 100,
  [TILE.CRYSTAL]: 80,
  [TILE.FROZEN_ICE]: 70,
  [TILE.FROZEN_GEM]: 80,
  [TILE.ANCIENT_BRICK]: 180,
  [TILE.ANCIENT_RELIC]: 120,
};

// Resource values (currency)
export const RESOURCE_VALUE = {
  [TILE.BONE]: 1,
  [TILE.GEM]: 5,
  [TILE.FOSSIL]: 10,
  [TILE.GOLD]: 20,
  [TILE.DIAMOND]: 50,
  [TILE.ARTIFACT]: 100,
  [TILE.MUSHROOM]: 8,
  [TILE.CRYSTAL]: 15,
  [TILE.FROZEN_GEM]: 25,
  [TILE.ANCIENT_RELIC]: 60,
};

// Resource names
export const RESOURCE_NAMES = {
  [TILE.BONE]: 'bones',
  [TILE.GEM]: 'gems',
  [TILE.FOSSIL]: 'fossils',
  [TILE.GOLD]: 'gold',
  [TILE.DIAMOND]: 'diamonds',
  [TILE.ARTIFACT]: 'artifacts',
  [TILE.MUSHROOM]: 'mushrooms',
  [TILE.CRYSTAL]: 'crystals',
  [TILE.FROZEN_GEM]: 'frozen_gems',
  [TILE.ANCIENT_RELIC]: 'relics',
};

// Base physics constants (modified by breed)
export const GRAVITY = 0.6;
export const MOVE_SPEED = 2.3;
export const JUMP_FORCE = -8.0;
export const FRICTION = 0.8;
export const MAX_FALL_SPEED = 12.0;
export const PLAYER_WIDTH = 0.75;
export const PLAYER_HEIGHT = 0.75;

// Stamina
export const BASE_MAX_STAMINA = 100;
export const BASE_STAMINA_REGEN_RATE = 1.2;  // per frame on ground
export const STAMINA_REGEN_DELAY = 30;        // frames on ground before regen starts
export const STAMINA_EXHAUSTION_TIME = 45;    // frames locked out when fully drained

// Climbing
export const STAMINA_CLING_COST = 0.4;       // per frame while clinging
export const STAMINA_CLIMB_COST = 1.0;       // per frame while climbing up
export const STAMINA_CLIMB_JUMP = 20;        // flat cost per wall-jump
export const CLIMB_SPEED = 2.5;              // tiles/sec climbing up
export const CLING_SLIDE_SPEED = 0.5;        // tiles/sec sliding down while clinging
export const CLIMB_JUMP_FORCE = -9.0;        // wall-jump vertical force

// Movement feel
export const ACCEL_GROUND = 0.8;       // ground acceleration per frame
export const ACCEL_AIR = 0.5;          // air acceleration (less control)
export const DECEL_GROUND = 0.7;       // ground deceleration multiplier (no input)
export const DECEL_AIR = 0.95;         // air deceleration multiplier (preserve momentum)
export const COYOTE_TIME = 6;          // frames after leaving edge where jump still works
export const JUMP_BUFFER_TIME = 6;     // frames before landing where jump input is remembered
export const JUMP_CUT_MULTIPLIER = 0.4; // vy multiplied by this when releasing jump early
export const APEX_GRAVITY_MULT = 0.5;  // reduced gravity near jump apex for floaty feel

// Dog breeds with stats
export const DOG_BREEDS = [
  {
    id: 0,
    name: 'Labrador',
    desc: 'All-rounder. High stamina, reliable digger.',
    colors: { body: '#C49A6C', dark: '#8B6914', light: '#E8D5A3' },
    stats: {
      moveSpeed: 1.0,    // multiplier on base
      jumpForce: 1.0,
      digSpeed: 1.0,
      maxStamina: 1.2,   // 20% more stamina
      staminaRegen: 1.0,
    },
    freeEmote: 0, // Bark
    // Hitbox derived from opaque sprite bounds (rows 5-15, cols 2-13)
    hitboxWidth: 0.75,     // 12px
    hitboxHeight: 0.6875,  // 11px
  },
  {
    id: 1,
    name: 'Dachshund',
    desc: 'Born to dig. Fastest digger, tires quickly.',
    colors: { body: '#8B4513', dark: '#5C2E0A', light: '#C47D3E' },
    stats: {
      moveSpeed: 0.85,
      jumpForce: 0.8,    // short legs
      digSpeed: 1.6,     // 60% faster digging
      maxStamina: 0.7,   // less stamina
      staminaRegen: 1.1,
    },
    freeEmote: 3, // Dig Here
    // Hitbox derived from opaque sprite bounds (rows 5-14, cols 2-12)
    hitboxWidth: 0.6875,   // 11px
    hitboxHeight: 0.625,   // 10px
  },
  {
    id: 2,
    name: 'Husky',
    desc: 'Explorer. Fast runner, great climber, slow digger.',
    colors: { body: '#B0B0B0', dark: '#606060', light: '#FFFFFF' },
    stats: {
      moveSpeed: 1.3,    // fast
      jumpForce: 1.2,    // high jump
      digSpeed: 0.7,     // slow digger
      maxStamina: 1.1,
      staminaRegen: 1.3, // great stamina regen (endurance breed)
    },
    freeEmote: 5, // Howl
    // Hitbox derived from opaque sprite bounds (rows 5-14, cols 2-13)
    hitboxWidth: 0.75,     // 12px
    hitboxHeight: 0.625,   // 10px
  },
  {
    id: 3,
    name: 'Terrier',
    desc: 'Treasure hunter. Finds extra loot, fragile.',
    colors: { body: '#D2B48C', dark: '#A0785A', light: '#F5E6D0' },
    stats: {
      moveSpeed: 1.1,
      jumpForce: 1.15,   // springy
      digSpeed: 1.3,     // good digger
      maxStamina: 0.85,
      staminaRegen: 0.9,
      lootBonus: 0.15,   // 15% chance for double loot
    },
    freeEmote: 4, // Celebrate
    // Hitbox derived from opaque sprite bounds (rows 5-14, cols 2-13)
    hitboxWidth: 0.75,     // 12px
    hitboxHeight: 0.625,   // 10px
  },
];

// Keep DOG_COLORS for backward compat (maps to breed colors)
export const DOG_COLORS = DOG_BREEDS.map(b => ({
  name: b.name,
  body: b.colors.body,
  dark: b.colors.dark,
  light: b.colors.light,
}));

// Tile colors for rendering
export const TILE_COLORS = {
  [TILE.AIR]: null,
  [TILE.GRASS]: { top: '#4CAF50', main: '#388E3C', accent: '#2E7D32' },
  [TILE.DIRT]: { top: '#8D6E63', main: '#795548', accent: '#6D4C41' },
  [TILE.CLAY]: { top: '#D4856A', main: '#BF6B50', accent: '#A0522D' },
  [TILE.STONE]: { top: '#9E9E9E', main: '#757575', accent: '#616161' },
  [TILE.BEDROCK]: { top: '#424242', main: '#303030', accent: '#212121' },
  [TILE.BONE]: { top: '#795548', main: '#795548', gem: '#FFFDE7' },
  [TILE.GEM]: { top: '#BF6B50', main: '#BF6B50', gem: '#E040FB' },
  [TILE.FOSSIL]: { top: '#BF6B50', main: '#BF6B50', gem: '#BCAAA4' },
  [TILE.GOLD]: { top: '#757575', main: '#757575', gem: '#FFD700' },
  [TILE.DIAMOND]: { top: '#757575', main: '#757575', gem: '#00E5FF' },
  [TILE.ARTIFACT]: { top: '#757575', main: '#757575', gem: '#FF6D00' },
  // Obstacles
  [TILE.LAVA]: { top: '#FF6F00', main: '#E65100', accent: '#BF360C', animated: true },
  [TILE.GRANITE]: { top: '#5D4037', main: '#4E342E', accent: '#3E2723' },
  // Mushroom biome
  [TILE.MUSHROOM_DIRT]: { top: '#5E4A8A', main: '#4A3670', accent: '#3B2860' },
  [TILE.MUSHROOM]: { top: '#4A3670', main: '#4A3670', gem: '#76FF03' },
  // Crystal biome
  [TILE.CRYSTAL_ROCK]: { top: '#4A148C', main: '#38006B', accent: '#2C0053' },
  [TILE.CRYSTAL]: { top: '#38006B', main: '#38006B', gem: '#EA80FC' },
  // Frozen biome
  [TILE.FROZEN_ICE]: { top: '#B3E5FC', main: '#81D4FA', accent: '#4FC3F7' },
  [TILE.FROZEN_GEM]: { top: '#81D4FA', main: '#81D4FA', gem: '#E0F7FA' },
  // Ancient biome
  [TILE.ANCIENT_BRICK]: { top: '#6D4C41', main: '#5D4037', accent: '#4E342E' },
  [TILE.ANCIENT_RELIC]: { top: '#5D4037', main: '#5D4037', gem: '#FFD54F' },
};

// Biome definitions
export const BIOMES = [
  {
    id: 'mushroom',
    name: 'Mushroom Cavern',
    minDepth: 20,
    maxDepth: 80,
    baseTile: TILE.MUSHROOM_DIRT,
    resourceTile: TILE.MUSHROOM,
    resourceChance: 0.12,
    minSize: { w: 6, h: 4 },
    maxSize: { w: 12, h: 8 },
    rarity: 0.6, // relative spawn weight
  },
  {
    id: 'crystal',
    name: 'Crystal Cave',
    minDepth: 60,
    maxDepth: 150,
    baseTile: TILE.CRYSTAL_ROCK,
    resourceTile: TILE.CRYSTAL,
    resourceChance: 0.10,
    minSize: { w: 5, h: 5 },
    maxSize: { w: 10, h: 10 },
    rarity: 0.4,
  },
  {
    id: 'frozen',
    name: 'Frozen Cavern',
    minDepth: 100,
    maxDepth: 200,
    baseTile: TILE.FROZEN_ICE,
    resourceTile: TILE.FROZEN_GEM,
    resourceChance: 0.08,
    minSize: { w: 7, h: 5 },
    maxSize: { w: 14, h: 8 },
    rarity: 0.3,
  },
  {
    id: 'ancient',
    name: 'Ancient Ruins',
    minDepth: 150,
    maxDepth: 240,
    baseTile: TILE.ANCIENT_BRICK,
    resourceTile: TILE.ANCIENT_RELIC,
    resourceChance: 0.08,
    minSize: { w: 8, h: 6 },
    maxSize: { w: 16, h: 10 },
    rarity: 0.2,
  },
];

// Decoration definitions — each provides a small buff to ALL players in the room
export const DECORATIONS = [
  { id: 0, name: 'Fire Hydrant', cost: { bones: 5 }, w: 1, h: 1, color: '#F44336',
    desc: '+3% stamina regen', effect: { staminaRegen: 0.03 } },
  { id: 1, name: 'Dog House', cost: { bones: 10 }, w: 2, h: 2, color: '#8D6E63',
    desc: '+5% max stamina', effect: { maxStamina: 0.05 } },
  { id: 2, name: 'Tennis Ball', cost: { bones: 3 }, w: 1, h: 1, color: '#CDDC39',
    desc: '+3% speed', effect: { moveSpeed: 0.03 } },
  { id: 3, name: 'Flower Bed', cost: { bones: 8, gems: 1 }, w: 2, h: 1, color: '#E91E63',
    desc: '+3% regen, +2% speed', effect: { staminaRegen: 0.03, moveSpeed: 0.02 } },
  { id: 4, name: 'Fountain', cost: { gems: 5 }, w: 2, h: 2, color: '#42A5F5',
    desc: '+8% stamina regen', effect: { staminaRegen: 0.08 } },
  { id: 5, name: 'Fossil Display', cost: { fossils: 3 }, w: 1, h: 2, color: '#A1887F',
    desc: '+5% dig speed', effect: { digSpeed: 0.05 } },
  { id: 6, name: 'Gold Statue', cost: { gold: 2 }, w: 1, h: 2, color: '#FFC107',
    desc: '+5% speed, +5% jump', effect: { moveSpeed: 0.05, jumpForce: 0.05 } },
  { id: 7, name: 'Diamond Kennel', cost: { diamonds: 1 }, w: 2, h: 2, color: '#00BCD4',
    desc: '+8% stamina, +5% regen', effect: { maxStamina: 0.08, staminaRegen: 0.05 } },
  { id: 8, name: 'Ancient Shrine', cost: { artifacts: 1 }, w: 2, h: 3, color: '#FF5722',
    desc: '+5% all stats', effect: { moveSpeed: 0.05, jumpForce: 0.05, digSpeed: 0.05, maxStamina: 0.05, staminaRegen: 0.05 } },
  { id: 9, name: 'Mushroom Garden', cost: { mushrooms: 3 }, w: 2, h: 1, color: '#76FF03',
    desc: '+5% climb efficiency', effect: { climbEfficiency: 0.05 } },
  { id: 10, name: 'Crystal Display', cost: { crystals: 2 }, w: 1, h: 2, color: '#EA80FC',
    desc: '+3% all stats, +5% loot', effect: { moveSpeed: 0.03, jumpForce: 0.03, digSpeed: 0.03, maxStamina: 0.03, staminaRegen: 0.03, lootBonus: 0.05 } },
];

// Emote definitions — each grants a temporary self-buff with a cooldown (RPG ability style)
// duration/cooldown are in seconds; converted to ticks in game loops
export const EMOTES = [
  { id: 0, name: 'Bark!', symbol: '!', cost: null,
    buffDesc: '+15% speed for 5s', duration: 5, cooldown: 30, effect: { moveSpeed: 0.15 } },
  { id: 1, name: 'Wag', symbol: '~', cost: null,
    buffDesc: '+10% stamina regen for 8s', duration: 8, cooldown: 25, effect: { staminaRegen: 0.10 } },
  { id: 2, name: 'Heart', symbol: '\u2764', cost: { bones: 3 },
    buffDesc: '+8% all stats for 6s', duration: 6, cooldown: 40, effect: { moveSpeed: 0.08, jumpForce: 0.08, digSpeed: 0.08, maxStamina: 0.08, staminaRegen: 0.08 } },
  { id: 3, name: 'Dig Here!', symbol: '\u2B07', cost: { bones: 5 },
    buffDesc: '+20% dig speed for 6s', duration: 6, cooldown: 30, effect: { digSpeed: 0.20 } },
  { id: 4, name: 'Celebrate', symbol: '\u2B50', cost: { gems: 2 },
    buffDesc: '+15% jump, +10% speed for 5s', duration: 5, cooldown: 35, effect: { jumpForce: 0.15, moveSpeed: 0.10 } },
  { id: 5, name: 'Howl', symbol: '\uD83C\uDF19', cost: { fossils: 1 },
    buffDesc: '+20% max stamina for 8s', duration: 8, cooldown: 40, effect: { maxStamina: 0.20 } },
  { id: 6, name: 'Rich Dog', symbol: '\uD83D\uDCB0', cost: { gold: 1 },
    buffDesc: '+15% loot bonus for 10s', duration: 10, cooldown: 60, effect: { lootBonus: 0.15 } },
  { id: 7, name: 'Diva', symbol: '\uD83D\uDC51', cost: { diamonds: 1 },
    buffDesc: '+10% all stats for 8s', duration: 8, cooldown: 45, effect: { moveSpeed: 0.10, jumpForce: 0.10, digSpeed: 0.10, maxStamina: 0.10, staminaRegen: 0.10, climbEfficiency: 0.10 } },
];

// Digging stamina cost per frame
export const STAMINA_DIG_COST = 1.5;

// Emote bubble display duration (how long the symbol shows above player)
export const EMOTE_DISPLAY_TICKS = 40;    // server ticks (~2s at 20Hz)
export const EMOTE_DISPLAY_FRAMES = 60;   // client frames (~1s at 60fps)

// Respawn delay after death
export const RESPAWN_TICKS = 90;          // server ticks (~4.5s at 20Hz)
export const RESPAWN_FRAMES = 90;         // client frames (~1.5s at 60fps)

// Upgrades (collars, hats, etc.)
export const UPGRADES = [
  // Collars - stamina & regen
  { id: 0, name: 'Leather Collar', icon: '🔵', desc: '+10% stamina', category: 'collar',
    cost: { bones: 15 }, effect: { maxStamina: 0.1 } },
  { id: 1, name: 'Studded Collar', icon: '⚫', desc: '+20% stamina, +10% regen', category: 'collar',
    cost: { bones: 30, gems: 3 }, effect: { maxStamina: 0.2, staminaRegen: 0.1 }, requires: 0 },
  { id: 2, name: 'Golden Collar', icon: '🟡', desc: '+35% stamina, +20% regen', category: 'collar',
    cost: { gold: 3, gems: 5 }, effect: { maxStamina: 0.35, staminaRegen: 0.2 }, requires: 1 },

  // Hats - speed & jump
  { id: 3, name: 'Baseball Cap', icon: '🧢', desc: '+10% speed', category: 'hat',
    cost: { bones: 20 }, effect: { moveSpeed: 0.1 } },
  { id: 4, name: 'Hard Hat', icon: '⛑️', desc: '+15% speed, +10% jump', category: 'hat',
    cost: { bones: 25, fossils: 2 }, effect: { moveSpeed: 0.15, jumpForce: 0.1 }, requires: 3 },
  { id: 5, name: 'Crown', icon: '👑', desc: '+25% speed, +20% jump', category: 'hat',
    cost: { gold: 2, diamonds: 1 }, effect: { moveSpeed: 0.25, jumpForce: 0.2 }, requires: 4 },

  // Bandanas - dig power
  { id: 6, name: 'Red Bandana', icon: '🟥', desc: '+15% dig speed', category: 'bandana',
    cost: { bones: 10, gems: 1 }, effect: { digSpeed: 0.15 } },
  { id: 7, name: 'Camo Bandana', icon: '🟩', desc: '+30% dig speed', category: 'bandana',
    cost: { fossils: 3, gems: 5 }, effect: { digSpeed: 0.3 }, requires: 6 },
  { id: 8, name: 'Diamond Bandana', icon: '💠', desc: '+50% dig speed, +10% loot', category: 'bandana',
    cost: { diamonds: 2, crystals: 3 }, effect: { digSpeed: 0.5, lootBonus: 0.1 }, requires: 7 },

  // Boots - special
  { id: 9, name: 'Hiking Boots', icon: '🥾', desc: '+15% climb stamina efficiency', category: 'boots',
    cost: { bones: 20, mushrooms: 2 }, effect: { climbEfficiency: 0.15 } },
  { id: 10, name: 'Rocket Boots', icon: '🚀', desc: '+25% climb efficiency, +10% speed', category: 'boots',
    cost: { gold: 3, crystals: 2 }, effect: { climbEfficiency: 0.25, moveSpeed: 0.1 }, requires: 9 },
];

// Network message types
export const MSG = {
  JOIN: 'join',
  INPUT: 'input',
  PLACE_DECORATION: 'place_decoration',
  EMOTE: 'emote',
  SAVE: 'save',
  BUY_EMOTE: 'buy_emote',
  BUY_DECORATION: 'buy_decoration',
  BUY_UPGRADE: 'buy_upgrade',
  LOAD_WORLD: 'load_world',
  ROOM_JOINED: 'room_joined',
  STATE: 'state',
  TILE_UPDATE: 'tile_update',
  RESOURCE_COLLECTED: 'resource_collected',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  DECORATION_PLACED: 'decoration_placed',
  EMOTE_TRIGGERED: 'emote_triggered',
  PURCHASE_RESULT: 'purchase_result',
  SAVED: 'saved',
  ERROR: 'error',
  WORLD_LIST: 'world_list',
};

// Sums up stat bonuses from all placed decorations (applies to every player)
export function calcDecorationBonuses(decorations) {
  const bonuses = {};
  for (const dec of decorations) {
    const def = DECORATIONS.find(d => d.id === dec.id);
    if (!def || !def.effect) continue;
    for (const [stat, val] of Object.entries(def.effect)) {
      bonuses[stat] = (bonuses[stat] || 0) + val;
    }
  }
  return bonuses;
}

// Server tick rate
export const SERVER_TICK_MS = 50; // 20Hz
