import { LocalGame } from './local-game.js';
import { loadCustomSprites, loadDecorationSprites, loadShopSprites, getDogSprite } from './sprites.js';
import { DOG_BREEDS } from '../../shared/constants.js';

let game = null;

// Load custom sprites from Supabase (non-blocking)
const spritesReady = loadCustomSprites().catch(() => {});
loadDecorationSprites().catch(() => {});
loadShopSprites().catch(() => {});

// Render animated breed preview sprites in lobby (after DB sprites load)
function renderBreedPreviews() {
  const WALK_FRAMES = 2;
  const FRAME_INTERVAL = 300; // ms per frame
  for (let i = 0; i < DOG_BREEDS.length; i++) {
    const container = document.getElementById('breedIcon' + i);
    if (!container) continue;
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    container.innerHTML = '';
    container.appendChild(canvas);

    let frame = 0;
    function drawFrame() {
      const sprite = getDogSprite(i, 'walk', frame);
      if (sprite) {
        ctx.clearRect(0, 0, 16, 16);
        ctx.drawImage(sprite, 0, 0);
      }
      frame = (frame + 1) % WALK_FRAMES;
    }
    drawFrame();
    setInterval(drawFrame, FRAME_INTERVAL);
  }
}
spritesReady.then(() => renderBreedPreviews());

// DOM elements
const lobby = document.getElementById('lobby');
const soloBtn = document.getElementById('soloBtn');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const loadBtn = document.getElementById('loadBtn');
const roomInput = document.getElementById('roomInput');
const nameInput = document.getElementById('playerName');
const breedPicker = document.getElementById('breedPicker');
const lobbyError = document.getElementById('lobbyError');
const worldList = document.getElementById('worldList');

let selectedBreed = 0;

// Breed picker
breedPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.breed-btn');
  if (!btn) return;
  selectedBreed = parseInt(btn.dataset.breed);
  breedPicker.querySelectorAll('.breed-btn').forEach(b => b.classList.remove('selected'));
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
  saves.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  for (const s of saves) {
    const el = document.createElement('div');
    el.className = 'world-item';
    const date = new Date(s.savedAt).toLocaleDateString();
    const name = s.player ? s.player.resources : {};
    const span1 = document.createElement('span');
    span1.textContent = `World: ${s.id}`;
    const span2 = document.createElement('span');
    span2.textContent = date;
    el.appendChild(span1);
    el.appendChild(span2);
    el.addEventListener('click', () => startSoloGame(s));
    worldList.appendChild(el);
  }
}

function startSoloGame(saveData) {
  lobbyError.textContent = '';
  const playerName = nameInput.value.trim() || DOG_BREEDS[selectedBreed]?.defaultName || 'Dog';

  game = new LocalGame();
  game.start(playerName, selectedBreed, saveData);
}

async function startMultiplayerGame(roomId) {
  lobbyError.textContent = '';
  const playerName = nameInput.value.trim() || DOG_BREEDS[selectedBreed]?.defaultName || 'Dog';

  try {
    createBtn.disabled = true;
    joinBtn.disabled = true;

    // Dynamic import to avoid loading network code on static hosts
    const { Game } = await import('./game.js');
    game = new Game();
    await game.start(roomId, playerName, selectedBreed);
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
