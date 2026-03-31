import { LocalGame } from './local-game.js';

let game = null;

// DOM elements
const lobby = document.getElementById('lobby');
const soloBtn = document.getElementById('soloBtn');
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

// Solo play (no server needed)
soloBtn.addEventListener('click', () => {
  startSoloGame(null);
});

// Load saved worlds (localStorage)
loadBtn.addEventListener('click', () => {
  const saves = LocalGame.getSaves();
  showWorldList(saves);
});

// Create multiplayer room
createBtn.addEventListener('click', () => startMultiplayerGame(null));

// Join multiplayer room
joinBtn.addEventListener('click', () => {
  const code = roomInput.value.trim().toUpperCase();
  if (!code) {
    lobbyError.textContent = 'Enter a room code';
    return;
  }
  startMultiplayerGame(code);
});

roomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

function showWorldList(saves) {
  worldList.style.display = 'block';
  worldList.innerHTML = '';
  if (saves.length === 0) {
    worldList.innerHTML = '<div style="padding:8px;color:rgba(255,255,255,0.5)">No saved worlds yet</div>';
    return;
  }
  for (const s of saves) {
    const el = document.createElement('div');
    el.className = 'world-item';
    const date = new Date(s.savedAt).toLocaleDateString();
    const name = s.player ? s.player.resources : {};
    el.innerHTML = `<span>World: ${s.id}</span><span>${date}</span>`;
    el.addEventListener('click', () => startSoloGame(s));
    worldList.appendChild(el);
  }
}

function startSoloGame(saveData) {
  lobbyError.textContent = '';
  const playerName = nameInput.value.trim() || 'Dog';

  game = new LocalGame();
  game.start(playerName, selectedColor, saveData);
}

async function startMultiplayerGame(roomId) {
  lobbyError.textContent = '';
  const playerName = nameInput.value.trim() || 'Dog';

  try {
    createBtn.disabled = true;
    joinBtn.disabled = true;

    // Dynamic import to avoid loading network code on static hosts
    const { Game } = await import('./game.js');
    game = new Game();
    await game.start(roomId, playerName, selectedColor);
    window.location.hash = game.roomId;
  } catch (err) {
    lobbyError.textContent = err.message || 'Failed to connect to server';
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
