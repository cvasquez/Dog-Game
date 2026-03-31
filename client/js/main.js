import { Game } from './game.js';

const game = new Game();

// DOM elements
const lobby = document.getElementById('lobby');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const loadBtn = document.getElementById('loadBtn');
const roomInput = document.getElementById('roomInput');
const nameInput = document.getElementById('playerName');
const colorPicker = document.getElementById('colorPicker');
const lobbyError = document.getElementById('lobbyError');
const worldList = document.getElementById('worldList');

let selectedColor = 0;

// Color picker
colorPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.color-btn');
  if (!btn) return;
  selectedColor = parseInt(btn.dataset.color);
  colorPicker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
});

// Create room
createBtn.addEventListener('click', () => startGame(null));

// Join room
joinBtn.addEventListener('click', () => {
  const code = roomInput.value.trim().toUpperCase();
  if (!code) {
    lobbyError.textContent = 'Enter a room code';
    return;
  }
  startGame(code);
});

// Enter key in room input
roomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// Load saved worlds
loadBtn.addEventListener('click', async () => {
  try {
    // We need a temporary connection to get the world list
    // Instead, use a REST-like approach via the lobby
    const tmpWs = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    );
    tmpWs.onopen = () => {
      tmpWs.send(JSON.stringify({ type: 'load_world' }));
    };
    tmpWs.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'world_list') {
        showWorldList(msg.worlds);
      }
      tmpWs.close();
    };
  } catch (err) {
    lobbyError.textContent = 'Could not load world list';
  }
});

function showWorldList(worlds) {
  worldList.style.display = 'block';
  worldList.innerHTML = '';
  if (worlds.length === 0) {
    worldList.innerHTML = '<div style="padding:8px;color:rgba(255,255,255,0.5)">No saved worlds</div>';
    return;
  }
  for (const w of worlds) {
    const el = document.createElement('div');
    el.className = 'world-item';
    const date = new Date(w.updated_at).toLocaleDateString();
    el.innerHTML = `<span>Room: ${w.room_id}</span><span>${date}</span>`;
    el.addEventListener('click', () => startGame(w.room_id));
    worldList.appendChild(el);
  }
}

async function startGame(roomId) {
  lobbyError.textContent = '';
  const playerName = nameInput.value.trim() || 'Dog';

  try {
    createBtn.disabled = true;
    joinBtn.disabled = true;
    await game.start(roomId, playerName, selectedColor);

    // Update URL hash
    window.location.hash = game.roomId;
  } catch (err) {
    lobbyError.textContent = err.message || 'Failed to connect';
    createBtn.disabled = false;
    joinBtn.disabled = false;
    lobby.style.display = 'flex';
  }
}

// Check URL hash for room code on load
window.addEventListener('load', () => {
  const hash = window.location.hash.slice(1).toUpperCase();
  if (hash && hash.length === 6) {
    roomInput.value = hash;
  }
});
