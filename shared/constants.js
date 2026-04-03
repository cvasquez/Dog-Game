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
  SHOP_FLOOR: 22,    // undiggable shop platform
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
  TILE.GRANITE, TILE.SHOP_FLOOR,
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
  [TILE.SHOP_FLOOR]: Infinity,
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
    name: 'Pitty',
    defaultName: 'Scrappy',
    desc: 'Speed demon. Lightning fast, sky-high jumps, weak digger.',
    colors: { body: '#C49A6C', dark: '#8B6914', light: '#E8D5A3' },
    stats: {
      moveSpeed: 1.4,    // very fast
      jumpForce: 1.35,   // sky-high jumps
      digSpeed: 0.6,     // low dig speed
      maxStamina: 1.0,   // mid stamina
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
    defaultName: 'Diglet',
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
    defaultName: 'Tank',
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
    defaultName: 'Diglet',
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
  {
    id: 4,
    name: 'Shorkie',
    defaultName: 'Munchie',
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
  [TILE.SHOP_FLOOR]: { top: '#607D8B', main: '#546E7A', accent: '#455A64' },
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
    desc: '+5% dig speed', effect: { digSpeed: 0.05 }, requiresBlueprint: true,
    generates: { resource: 'fossils', intervalMs: 360000 } },  // 1 fossil per 6 min
  { id: 6, name: 'Gold Statue', cost: { gold: 2 }, w: 1, h: 2, color: '#FFC107',
    desc: '+5% speed, +5% jump', effect: { moveSpeed: 0.05, jumpForce: 0.05 }, requiresBlueprint: true },
  { id: 7, name: 'Diamond Kennel', cost: { diamonds: 1 }, w: 2, h: 2, color: '#00BCD4',
    desc: '+8% stamina, +5% regen', effect: { maxStamina: 0.08, staminaRegen: 0.05 }, requiresBlueprint: true },
  { id: 8, name: 'Ancient Shrine', cost: { artifacts: 1 }, w: 2, h: 3, color: '#FF5722',
    desc: '+5% all stats', effect: { moveSpeed: 0.05, jumpForce: 0.05, digSpeed: 0.05, maxStamina: 0.05, staminaRegen: 0.05 }, requiresBlueprint: true },
  { id: 9, name: 'Mushroom Garden', cost: { mushrooms: 3 }, w: 2, h: 1, color: '#76FF03',
    desc: '+5% climb efficiency', effect: { climbEfficiency: 0.05 }, requiresBlueprint: true,
    generates: { resource: 'mushrooms', intervalMs: 300000 } },  // 1 mushroom per 5 min
  { id: 10, name: 'Crystal Display', cost: { crystals: 2 }, w: 1, h: 2, color: '#EA80FC',
    desc: '+3% all stats, +5% loot', effect: { moveSpeed: 0.03, jumpForce: 0.03, digSpeed: 0.03, maxStamina: 0.03, staminaRegen: 0.03, lootBonus: 0.05 }, requiresBlueprint: true,
    generates: { resource: 'crystals', intervalMs: 480000 } },  // 1 crystal per 8 min
  { id: 11, name: 'Recall Beacon', cost: { gems: 2, gold: 1 }, w: 1, h: 2, color: '#64FFDA',
    desc: 'Recall point. Reduces recall penalty to 25%', effect: {},
    isRecallBeacon: true, canPlaceAnywhere: true },
  { id: 12, name: 'Bone Pile', cost: { bones: 8 }, w: 1, h: 1, color: '#E0D5C0',
    desc: '+4% dig speed', effect: { digSpeed: 0.04 } },
  { id: 13, name: 'Mining Cart', cost: { bones: 15, fossils: 2 }, w: 2, h: 1, color: '#78909C',
    desc: '+7% dig speed, +3% loot', effect: { digSpeed: 0.07, lootBonus: 0.03 } },
];

// Blueprint drop mapping: biome resource tiles can drop blueprints for related decorations
export const BLUEPRINT_DROPS = {
  [TILE.FOSSIL]: { decorationId: 5, chance: 0.04 },       // Fossil → Fossil Display
  [TILE.GOLD]: { decorationId: 6, chance: 0.03 },          // Gold → Gold Statue
  [TILE.DIAMOND]: { decorationId: 7, chance: 0.05 },       // Diamond → Diamond Kennel
  [TILE.ANCIENT_RELIC]: { decorationId: 8, chance: 0.05 },  // Relic → Ancient Shrine
  [TILE.MUSHROOM]: { decorationId: 9, chance: 0.05 },      // Mushroom → Mushroom Garden
  [TILE.CRYSTAL]: { decorationId: 10, chance: 0.05 },      // Crystal → Crystal Display
};

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
  { id: 8, name: 'Scratch', symbol: '\uD83D\uDC3E', cost: { bones: 8 },
    buffDesc: 'Recall to surface (no penalty)', duration: 0, cooldown: 240, effect: {}, isRecall: true, recallPenalty: 0 },
];

// Digging stamina cost per frame
export const STAMINA_DIG_COST = 0.8;

// Running & Sprint
export const STAMINA_RUN_COST = 0;           // per frame while running on ground (walking is free)
export const SPRINT_SPEED_MULT = 1.6;       // multiplier on move speed while sprinting
export const STAMINA_SPRINT_COST = 0.4;     // per frame while sprinting (halved from 0.8)

// Mantling
export const MANTLE_FRAMES = 15;            // frames to complete mantle animation (~250ms at 60fps)

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

  // Paws - dig focused
  { id: 11, name: 'Tough Paws', icon: '🐾', desc: '+10% dig speed, +5% stamina', category: 'paws',
    cost: { bones: 12, gems: 2 }, effect: { digSpeed: 0.1, maxStamina: 0.05 } },
  { id: 12, name: 'Iron Claws', icon: '⛏️', desc: '+25% dig speed, +10% stamina', category: 'paws',
    cost: { fossils: 4, gold: 1 }, effect: { digSpeed: 0.25, maxStamina: 0.1 }, requires: 11 },
];

// Cooperative digging
export const COOP_DIG_RANGE = 3;            // tiles distance for coop bonus
export const COOP_DIG_BONUS = 0.3;          // 30% dig speed boost

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
  PING: 'ping',
  PING_PLACED: 'ping_placed',
};

// Decoration synergy pairs: { ids: [a, b], bonus: { stat: value }, name: string }
export const DECORATION_SYNERGIES = [
  { ids: [4, 3], bonus: { staminaRegen: 0.03 }, name: 'Garden Oasis' },      // Fountain + Flower Bed
  { ids: [6, 5], bonus: { digSpeed: 0.05 }, name: 'Excavation Site' },        // Gold Statue + Fossil Display
  { ids: [1, 0], bonus: { maxStamina: 0.03 }, name: 'Dog Haven' },            // Dog House + Fire Hydrant
  { ids: [7, 8], bonus: { moveSpeed: 0.05, jumpForce: 0.05 }, name: 'Sacred Ground' }, // Diamond Kennel + Ancient Shrine
  { ids: [9, 10], bonus: { climbEfficiency: 0.05, lootBonus: 0.03 }, name: 'Mystic Corner' }, // Mushroom Garden + Crystal Display
  { ids: [2, 6], bonus: { moveSpeed: 0.03 }, name: 'Fetch Park' },            // Tennis Ball + Gold Statue
];

// Check if two placed decorations are adjacent (within 3 tiles of each other)
function areAdjacent(dec1, dec2) {
  const d1 = DECORATIONS.find(d => d.id === dec1.id);
  const d2 = DECORATIONS.find(d => d.id === dec2.id);
  if (!d1 || !d2) return false;
  const cx1 = dec1.x + (d1.w || 1) / 2;
  const cy1 = dec1.y + (d1.h || 1) / 2;
  const cx2 = dec2.x + (d2.w || 1) / 2;
  const cy2 = dec2.y + (d2.h || 1) / 2;
  return Math.abs(cx1 - cx2) <= 3 && Math.abs(cy1 - cy2) <= 3;
}

// Sums up stat bonuses from all placed decorations (applies to every player)
// Includes synergy bonuses for adjacent complementary decorations
export function calcDecorationBonuses(decorations) {
  const bonuses = {};
  for (const dec of decorations) {
    const def = DECORATIONS.find(d => d.id === dec.id);
    if (!def || !def.effect) continue;
    for (const [stat, val] of Object.entries(def.effect)) {
      bonuses[stat] = (bonuses[stat] || 0) + val;
    }
  }

  // Check synergy pairs
  for (const synergy of DECORATION_SYNERGIES) {
    const decs0 = decorations.filter(d => d.id === synergy.ids[0]);
    const decs1 = decorations.filter(d => d.id === synergy.ids[1]);
    let synergyApplied = false;
    for (const d0 of decs0) {
      for (const d1 of decs1) {
        if (areAdjacent(d0, d1)) {
          synergyApplied = true;
          break;
        }
      }
      if (synergyApplied) break;
    }
    if (synergyApplied) {
      for (const [stat, val] of Object.entries(synergy.bonus)) {
        bonuses[stat] = (bonuses[stat] || 0) + val;
      }
    }
  }

  return bonuses;
}

// Surface shop locations — three separate machines for each shop category
export const SHOP_LOCATIONS = [
  { x: 20, width: 2, type: 'decorations', name: 'Decorations', symbol: '\uD83C\uDFA8' },
  { x: 32, width: 2, type: 'emotes', name: 'Emotes', symbol: '\uD83D\uDCAC' },
  { x: 44, width: 2, type: 'upgrades', name: 'Upgrades', symbol: '\u2692\uFE0F' },
];

// Shop floor padding — extra undiggable tiles on each side of shop machine
export const SHOP_FLOOR_PADDING = 1;

// Returns the shop the player is near, or null
export function getNearbyShop(playerX, playerY) {
  if (playerY > SURFACE_Y + 1) return null; // must be at surface level
  for (const shop of SHOP_LOCATIONS) {
    const shopCenterX = shop.x + shop.width / 2;
    const dist = Math.abs(playerX - shopCenterX);
    if (dist < 2.5) return shop;
  }
  return null;
}

// Places shop floor tiles in a world tile array (call after world gen or on load)
export function placeShopFloors(tiles) {
  for (const shop of SHOP_LOCATIONS) {
    const startX = shop.x - SHOP_FLOOR_PADDING;
    const endX = shop.x + shop.width + SHOP_FLOOR_PADDING;
    for (let x = startX; x < endX; x++) {
      if (x > 0 && x < WORLD_WIDTH - 1) {
        // Surface level and one below
        tiles[SURFACE_Y * WORLD_WIDTH + x] = TILE.SHOP_FLOOR;
        tiles[(SURFACE_Y + 1) * WORLD_WIDTH + x] = TILE.SHOP_FLOOR;
      }
    }
  }
}

// Fall damage
export const FALL_DAMAGE_THRESHOLD = 9;     // vy above which fall damage applies
export const FALL_DAMAGE_MULTIPLIER = 10;   // stamina lost per unit of vy above threshold
export const FALL_DAMAGE_STUN_FRAMES = 15;  // brief stun on hard landing

// Biome tile physics properties
export const BOUNCY_TILES = new Set([TILE.MUSHROOM_DIRT, TILE.MUSHROOM]);
export const BOUNCY_FORCE = 0.6;            // multiplier of jump force on bounce
export const ICY_TILES = new Set([TILE.FROZEN_ICE, TILE.FROZEN_GEM]);
export const SLIPPERY_TILES = new Set([TILE.CRYSTAL_ROCK, TILE.CRYSTAL]);

// Idle camera zoom
export const IDLE_ZOOM_SCALE = 1.3;          // how much to zoom in (1.0 = no zoom)
export const IDLE_ZOOM_IN_SPEED = 0.008;     // zoom-in lerp speed per frame (slow)
export const IDLE_ZOOM_OUT_SPEED = 0.04;     // zoom-out lerp speed per frame (faster)
export const IDLE_SIT_DELAY = 180;           // frames before idle triggers sit (~3s at 60fps)

// Server tick rate
export const SERVER_TICK_MS = 50; // 20Hz
