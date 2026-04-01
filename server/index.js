import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './persistence.js';
import {
  createRoom, joinRoom, leaveRoom, getRoom, tryLoadRoom,
  handleMessage, createPlayer, sendTo,
} from './rooms.js';
import { MSG } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Initialize database
initDB();

// Express app
const app = express();
const server = createServer(app);

// Serve client files
app.use(express.static(path.join(__dirname, '..', 'client')));

// Serve shared constants for client ES module import
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

// WebSocket server
const wss = new WebSocketServer({ server });

let nextPlayerId = 1;

wss.on('connection', (ws) => {
  let playerId = null;
  let roomId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === MSG.JOIN) {
      playerId = 'p' + (nextPlayerId++);
      const playerName = (msg.name || 'Dog').slice(0, 20);
      const breedId = Math.max(0, Math.min(3, msg.breedId || 0));

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
