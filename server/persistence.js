import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { DECORATION_SPRITES, DECORATION_PALETTES } from '../shared/sprite-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'doggame.db');

let db;

export function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS worlds (
      room_id TEXT PRIMARY KEY,
      seed INTEGER NOT NULL,
      tiles BLOB NOT NULL,
      decorations TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      room_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      resources TEXT DEFAULT '{}',
      unlocked_emotes TEXT DEFAULT '[0,1]',
      owned_upgrades TEXT DEFAULT '[]',
      PRIMARY KEY (room_id, player_name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS decoration_sprites (
      dec_id INTEGER PRIMARY KEY,
      pixels TEXT NOT NULL,
      palette TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Migration: add owned_upgrades column if missing
  try {
    db.exec(`ALTER TABLE players ADD COLUMN owned_upgrades TEXT DEFAULT '[]'`);
  } catch {
    // Column already exists
  }

  // Seed decoration sprites from sprite-data.js (insert any missing entries)
  const existingIds = new Set(
    db.prepare('SELECT dec_id FROM decoration_sprites').all().map(r => r.dec_id)
  );
  const insertNew = db.prepare(
    'INSERT INTO decoration_sprites (dec_id, pixels, palette, updated_at) VALUES (?, ?, ?, ?)'
  );
  const now = Date.now();
  const seedMissing = db.transaction(() => {
    for (const [id, pixels] of Object.entries(DECORATION_SPRITES)) {
      if (existingIds.has(parseInt(id))) continue;
      const palette = DECORATION_PALETTES[id] || [null];
      insertNew.run(parseInt(id), JSON.stringify(pixels), JSON.stringify(palette), now);
    }
  });
  seedMissing();

  return db;
}

export function saveWorld(roomId, seed, tiles, decorations) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO worlds (room_id, seed, tiles, decorations, created_at, updated_at)
    VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM worlds WHERE room_id = ?), ?), ?)
  `);
  stmt.run(roomId, seed, Buffer.from(tiles), JSON.stringify(decorations), roomId, now, now);
}

function safeJsonParse(str, fallback) {
  try {
    const parsed = JSON.parse(str);
    return parsed;
  } catch {
    return fallback;
  }
}

export function loadWorld(roomId) {
  const row = db.prepare('SELECT * FROM worlds WHERE room_id = ?').get(roomId);
  if (!row) return null;
  const decorations = safeJsonParse(row.decorations, []);
  if (!Array.isArray(decorations)) return null;
  return {
    roomId: row.room_id,
    seed: row.seed,
    tiles: new Uint8Array(row.tiles),
    decorations,
  };
}

export function listWorlds() {
  return db.prepare('SELECT room_id, created_at, updated_at FROM worlds ORDER BY updated_at DESC').all();
}

export function savePlayer(roomId, playerName, resources, unlockedEmotes, ownedUpgrades) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO players (room_id, player_name, resources, unlocked_emotes, owned_upgrades)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(roomId, playerName, JSON.stringify(resources), JSON.stringify(unlockedEmotes), JSON.stringify(ownedUpgrades || []));
}

export function loadPlayer(roomId, playerName) {
  const row = db.prepare('SELECT * FROM players WHERE room_id = ? AND player_name = ?').get(roomId, playerName);
  if (!row) return null;
  const resources = safeJsonParse(row.resources, {});
  const unlockedEmotes = safeJsonParse(row.unlocked_emotes, [0, 1]);
  const ownedUpgrades = safeJsonParse(row.owned_upgrades || '[]', []);
  if (typeof resources !== 'object' || !Array.isArray(unlockedEmotes) || !Array.isArray(ownedUpgrades)) {
    return null;
  }
  return { resources, unlockedEmotes, ownedUpgrades };
}

export function deleteWorld(roomId) {
  db.prepare('DELETE FROM worlds WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM players WHERE room_id = ?').run(roomId);
}

// --- Decoration sprites ---

export function getAllDecorationSprites() {
  const rows = db.prepare('SELECT * FROM decoration_sprites ORDER BY dec_id').all();
  const sprites = {};
  const palettes = {};
  for (const row of rows) {
    sprites[row.dec_id] = JSON.parse(row.pixels);
    palettes[row.dec_id] = JSON.parse(row.palette);
  }
  return { sprites, palettes };
}

export function getDecorationSprite(decId) {
  const row = db.prepare('SELECT * FROM decoration_sprites WHERE dec_id = ?').get(decId);
  if (!row) return null;
  return { pixels: JSON.parse(row.pixels), palette: JSON.parse(row.palette) };
}

export function saveDecorationSprite(decId, pixels, palette) {
  const now = Date.now();
  db.prepare(`
    INSERT OR REPLACE INTO decoration_sprites (dec_id, pixels, palette, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(decId, JSON.stringify(pixels), JSON.stringify(palette), now);
}
