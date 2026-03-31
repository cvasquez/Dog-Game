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
  BONE: 10,
  GEM: 11,
  FOSSIL: 12,
  GOLD: 13,
  DIAMOND: 14,
  ARTIFACT: 15,
};

// Which tiles are diggable solid
export const SOLID_TILES = new Set([
  TILE.GRASS, TILE.DIRT, TILE.CLAY, TILE.STONE, TILE.BEDROCK,
  TILE.BONE, TILE.GEM, TILE.FOSSIL, TILE.GOLD, TILE.DIAMOND, TILE.ARTIFACT,
]);

// Tile hardness (server ticks to dig)
export const HARDNESS = {
  [TILE.GRASS]: 2,
  [TILE.DIRT]: 3,
  [TILE.CLAY]: 8,
  [TILE.STONE]: 15,
  [TILE.BEDROCK]: Infinity,
  [TILE.BONE]: 3,
  [TILE.GEM]: 8,
  [TILE.FOSSIL]: 8,
  [TILE.GOLD]: 15,
  [TILE.DIAMOND]: 15,
  [TILE.ARTIFACT]: 15,
};

// Resource values (currency)
export const RESOURCE_VALUE = {
  [TILE.BONE]: 1,
  [TILE.GEM]: 5,
  [TILE.FOSSIL]: 10,
  [TILE.GOLD]: 20,
  [TILE.DIAMOND]: 50,
  [TILE.ARTIFACT]: 100,
};

// Resource names
export const RESOURCE_NAMES = {
  [TILE.BONE]: 'bones',
  [TILE.GEM]: 'gems',
  [TILE.FOSSIL]: 'fossils',
  [TILE.GOLD]: 'gold',
  [TILE.DIAMOND]: 'diamonds',
  [TILE.ARTIFACT]: 'artifacts',
};

// Physics constants
export const GRAVITY = 0.6;
export const MOVE_SPEED = 3.0;
export const JUMP_FORCE = -8.0;
export const FRICTION = 0.8;
export const MAX_FALL_SPEED = 12.0;
export const PLAYER_WIDTH = 0.75;
export const PLAYER_HEIGHT = 0.75;

// Dog colors
export const DOG_COLORS = [
  { name: 'Brown', body: '#8B5E3C', dark: '#6B3F1F', light: '#C49A6C' },
  { name: 'Golden', body: '#DAA520', dark: '#B8860B', light: '#FFD700' },
  { name: 'Gray', body: '#808080', dark: '#5A5A5A', light: '#B0B0B0' },
  { name: 'White', body: '#E8E0D0', dark: '#C0B8A8', light: '#FFFFFF' },
];

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
};

// Decoration definitions
export const DECORATIONS = [
  { id: 0, name: 'Fire Hydrant', cost: { bones: 5 }, w: 1, h: 1, color: '#F44336' },
  { id: 1, name: 'Dog House', cost: { bones: 10 }, w: 2, h: 2, color: '#8D6E63' },
  { id: 2, name: 'Tennis Ball', cost: { bones: 3 }, w: 1, h: 1, color: '#CDDC39' },
  { id: 3, name: 'Flower Bed', cost: { bones: 8, gems: 1 }, w: 2, h: 1, color: '#E91E63' },
  { id: 4, name: 'Fountain', cost: { gems: 5 }, w: 2, h: 2, color: '#42A5F5' },
  { id: 5, name: 'Fossil Display', cost: { fossils: 3 }, w: 1, h: 2, color: '#A1887F' },
  { id: 6, name: 'Gold Statue', cost: { gold: 2 }, w: 1, h: 2, color: '#FFC107' },
  { id: 7, name: 'Diamond Kennel', cost: { diamonds: 1 }, w: 2, h: 2, color: '#00BCD4' },
  { id: 8, name: 'Ancient Shrine', cost: { artifacts: 1 }, w: 2, h: 3, color: '#FF5722' },
];

// Emote definitions
export const EMOTES = [
  { id: 0, name: 'Bark!', symbol: '!', cost: null },
  { id: 1, name: 'Wag', symbol: '~', cost: null },
  { id: 2, name: 'Heart', symbol: '\u2764', cost: { bones: 3 } },
  { id: 3, name: 'Dig Here!', symbol: '\u2B07', cost: { bones: 5 } },
  { id: 4, name: 'Celebrate', symbol: '\u2B50', cost: { gems: 2 } },
  { id: 5, name: 'Howl', symbol: '\uD83C\uDF19', cost: { fossils: 1 } },
  { id: 6, name: 'Rich Dog', symbol: '\uD83D\uDCB0', cost: { gold: 1 } },
  { id: 7, name: 'Diva', symbol: '\uD83D\uDC51', cost: { diamonds: 1 } },
];

// Network message types
export const MSG = {
  // Client -> Server
  JOIN: 'join',
  INPUT: 'input',
  PLACE_DECORATION: 'place_decoration',
  EMOTE: 'emote',
  SAVE: 'save',
  BUY_EMOTE: 'buy_emote',
  BUY_DECORATION: 'buy_decoration',
  LOAD_WORLD: 'load_world',
  // Server -> Client
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

// Server tick rate
export const SERVER_TICK_MS = 50; // 20Hz
