import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB, getAllDecorationSprites, getDecorationSprite, saveDecorationSprite } from './persistence.js';
import {
  createRoom, joinRoom, leaveRoom, getRoom, tryLoadRoom,
  handleMessage, createPlayer, sendTo,
} from './rooms.js';
import { MSG, DECORATIONS } from '../shared/constants.js';
import { requireAdmin } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Allowed origins for CORS and WebSocket
const ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN,
  'https://cvasquez.github.io',
].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // non-browser clients
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow localhost for development
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

// Initialize database
initDB();

// Express app
const app = express();
const server = createServer(app);

// --- CORS ---
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- Security headers ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*",
    "img-src 'self' data: blob:",
  ].join('; '));
  next();
});

// --- HTTP rate limiting for mutation endpoints ---
const httpRateLimits = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const entry = httpRateLimits.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count++;
    httpRateLimits.set(key, entry);
    if (entry.count > max) return res.status(429).json({ error: 'Rate limited' });
    next();
  };
}
// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of httpRateLimits) {
    if (now - entry.start > 120000) httpRateLimits.delete(key);
  }
}, 300000);

// Serve client files
app.use(express.static(path.join(__dirname, '..', 'client')));

// Serve shared constants for client ES module import
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

// --- Public config (Supabase credentials from env) ---
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
});

// --- Decoration sprite API ---
app.use(express.json({ limit: '1mb' }));

app.get('/api/decoration-sprites', (req, res) => {
  const data = getAllDecorationSprites();
  res.json(data);
});

app.get('/api/decoration-sprites/:id', (req, res) => {
  const decId = parseInt(req.params.id);
  const data = getDecorationSprite(decId);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.put('/api/decoration-sprites/:id', rateLimit(60000, 30), requireAdmin, (req, res) => {
  const decId = parseInt(req.params.id);
  if (!Number.isFinite(decId) || decId < 0) {
    return res.status(400).json({ error: 'Invalid decoration ID' });
  }
  const { pixels, palette } = req.body;
  if (!Array.isArray(pixels) || !Array.isArray(palette)) {
    return res.status(400).json({ error: 'pixels and palette must be arrays' });
  }
  // Limit payload size to prevent abuse
  if (pixels.length > 10000 || palette.length > 256) {
    return res.status(413).json({ error: 'Data too large' });
  }
  saveDecorationSprite(decId, pixels, palette);
  res.json({ ok: true });
});

// --- Sync sprite-data.js file endpoint ---
const SPRITE_DATA_PATH = path.join(__dirname, '..', 'shared', 'sprite-data.js');

app.post('/api/sync-sprite-file', rateLimit(60000, 10), requireAdmin, (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string' || content.length === 0) {
    return res.status(400).json({ error: 'content must be a non-empty string' });
  }
  // Sanity check: must look like a JS module with expected exports
  if (!content.includes('export const SPRITE_PALETTE') || !content.includes('export const DOG_SPRITES')) {
    return res.status(400).json({ error: 'content does not look like valid sprite-data.js' });
  }
  // Cap file size at 500KB to prevent abuse
  if (content.length > 512000) {
    return res.status(413).json({ error: 'Content too large' });
  }
  try {
    fs.writeFileSync(SPRITE_DATA_PATH, content, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write file: ' + e.message });
  }
});

// --- Health check ---
app.get('/healthz', (req, res) => res.send('ok'));

// WebSocket server (with origin validation)
const wss = new WebSocketServer({
  server,
  verifyClient: (info) => isAllowedOrigin(info.origin),
});

let nextPlayerId = 1;

// Rate limiting per connection
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 60;

wss.on('connection', (ws) => {
  let playerId = null;
  let roomId = null;

  // Rate limiter state
  let msgCount = 0;
  let windowStart = Date.now();

  ws.on('message', (raw) => {
    // Rate limiting
    const now = Date.now();
    if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
      msgCount = 0;
      windowStart = now;
    }
    msgCount++;
    if (msgCount > RATE_LIMIT_MAX_MESSAGES) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    // Reject oversized messages (prevent memory abuse)
    if (raw.length > 4096) return;

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Basic shape validation: must be a plain object with a type
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.type !== 'string') return;

    // Latency measurement — echo immediately, bypass room logic
    if (msg.type === MSG.NET_PING) {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: MSG.NET_PONG, t: msg.t }));
      return;
    }

    if (msg.type === MSG.JOIN) {
      // Prevent re-joining
      if (playerId) return;

      playerId = 'p' + (nextPlayerId++);
      // Sanitize player name: strip control chars and limit length
      const rawName = String(msg.name || 'Dog').slice(0, 20).replace(/[\x00-\x1F\x7F]/g, '').trim();
      const playerName = rawName || 'Dog';
      const breedId = Number.isInteger(msg.breedId) && msg.breedId >= 0 && msg.breedId <= 3 ? msg.breedId : 0;

      const player = createPlayer(playerId, playerName, breedId);

      let room;
      if (msg.roomId) {
        // Try to join existing room (in memory or from DB)
        room = tryLoadRoom(msg.roomId);
        if (room) {
          room = joinRoom(msg.roomId, player, ws);
          if (!room) {
            sendTo(player, { type: MSG.ERROR, message: 'Room is full (max 4 players)' });
            return;
          }
          roomId = room.id;
        } else {
          sendTo(player, { type: MSG.ERROR, message: 'Room not found' });
          return;
        }
      } else {
        // Create new room
        room = createRoom(player, ws);
        roomId = room.id;
      }

      // Send initial state to joining player
      const playersArr = [];
      for (const [, p] of room.players) {
        playersArr.push({
          id: p.id, name: p.name, color: p.color,
          x: p.x, y: p.y, resources: p.resources,
          bankedResources: p.bankedResources || {},
          unlockedEmotes: p.unlockedEmotes,
          ownedUpgrades: p.ownedUpgrades || [],
        });
      }

      sendTo(player, {
        type: MSG.ROOM_JOINED,
        roomId: room.id,
        playerId,
        world: Array.from(room.tiles),
        players: playersArr,
        decorations: room.decorations,
      });

      // Notify others
      const joinMsg = {
        type: MSG.PLAYER_JOINED,
        player: { id: playerId, name: playerName, color: breedId, x: player.x, y: player.y },
      };
      for (const [id, p] of room.players) {
        if (id !== playerId) sendTo(p, joinMsg);
      }

      return;
    }

    // All other messages require being in a room
    if (!roomId || !playerId) return;
    handleMessage(roomId, playerId, msg);
  });

  ws.on('close', () => {
    if (roomId && playerId) {
      leaveRoom(roomId, playerId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Dog Digging Game server running on http://localhost:${PORT}`);
});
