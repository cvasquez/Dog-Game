import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'doggame.db');

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

  // Migration: add owned_upgrades column if missing
  try {
    db.exec(`ALTER TABLE players ADD COLUMN owned_upgrades TEXT DEFAULT '[]'`);
  } catch {
    // Column already exists
  }

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

export function loadWorld(roomId) {
  const row = db.prepare('SELECT * FROM worlds WHERE room_id = ?').get(roomId);
  if (!row) return null;
  return {
    roomId: row.room_id,
    seed: row.seed,
    tiles: new Uint8Array(row.tiles),
    decorations: JSON.parse(row.decorations),
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
  return {
    resources: JSON.parse(row.resources),
    unlockedEmotes: JSON.parse(row.unlocked_emotes),
    ownedUpgrades: JSON.parse(row.owned_upgrades || '[]'),
  };
}

export function deleteWorld(roomId) {
  db.prepare('DELETE FROM worlds WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM players WHERE room_id = ?').run(roomId);
}
