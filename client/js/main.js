import { LocalGame } from './local-game.js';
import { loadCustomSprites, loadDecorationSprites, loadShopSprites, getDogSprite } from './sprites.js';
import { DOG_BREEDS } from '../../shared/constants.js';

let game = null;

// Load custom sprites from Supabase (non-blocking)
const spritesReady = loadCustomSprites().catch(() => {});
loadDecorationSprites().catch(() => {});
loadShopSprites().catch(() => {});

// DOM elements
const lobby = document.getElementById('lobby');
const soloBtn = document.getElementById('soloBtn');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const loadBtn = document.getElementById('loadBtn');
const multiplayerBtn = document.getElementById('multiplayerBtn');
const multiplayerPanel = document.getElementById('multiplayerPanel');
const roomInput = document.getElementById('roomInput');
const breedPicker = document.getElementById('breedPicker');
const lobbyError = document.getElementById('lobbyError');
const worldList = document.getElementById('worldList');
const previewSprite = document.getElementById('previewSprite');
const previewName = document.getElementById('previewName');
const previewDesc = document.getElementById('previewDesc');
const statBars = document.getElementById('statBars');

let selectedBreed = 0;

// Stat bar config: label, stat key, CSS class, max value for scaling
const STAT_CONFIG = [
  { label: 'SPD',  key: 'moveSpeed',      cls: 'stat-fill-spd',  max: 1.6 },
  { label: 'JMP',  key: 'jumpForce',      cls: 'stat-fill-jmp',  max: 1.6 },
  { label: 'DIG',  key: 'digSpeed',       cls: 'stat-fill-dig',  max: 1.8 },
  { label: 'HP',   key: 'maxHP',          cls: 'stat-fill-hp',   max: 1.4 },
  { label: 'FALL', key: 'fallResistance', cls: 'stat-fill-fall', max: 2.8 },
];

// Generate breed buttons from DOG_BREEDS constants
for (const breed of DOG_BREEDS) {
  if (!breed) continue;
  const btn = document.createElement('button');
  btn.className = 'breed-btn' + (breed.id === 0 ? ' selected' : '');
  btn.dataset.breed = breed.id;
  btn.innerHTML = `<span class="breed-icon" id="breedIcon${breed.id}"></span>` +
    `<span class="breed-info"><strong>${breed.defaultName} the ${breed.name}</strong><br><small>${breed.desc}</small></span>`;
  breedPicker.appendChild(btn);
}

// Render animated breed preview sprites in the breed list (small icons)
function renderBreedPreviews() {
  const WALK_FRAMES = 4;
  const FRAME_INTERVAL = 200;
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

// Render large animated preview sprite in the center column
let previewInterval = null;
function renderPreviewSprite(breedId) {
  if (previewInterval) clearInterval(previewInterval);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  previewSprite.innerHTML = '';
  previewSprite.appendChild(canvas);

  let frame = 0;
  function drawFrame() {
    const sprite = getDogSprite(breedId, 'walk', frame);
    if (sprite) {
      ctx.clearRect(0, 0, 16, 16);
      ctx.drawImage(sprite, 0, -2); // shift up so feet don't clip container
    }
    frame = (frame + 1) % 4;
  }
  drawFrame();
  previewInterval = setInterval(drawFrame, 250);
}

// Update the center preview panel for the selected breed
function updatePreview(breedId) {
  const breed = DOG_BREEDS[breedId];
  if (!breed) return;

  previewName.textContent = `${breed.defaultName} the ${breed.name}`;
  previewDesc.textContent = breed.desc;
  renderPreviewSprite(breedId);

  // Build stat bars
  statBars.innerHTML = '';
  for (const stat of STAT_CONFIG) {
    const value = breed.stats[stat.key] || 0;
    const pct = Math.min(100, (value / stat.max) * 100);
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML =
      `<span class="stat-label">${stat.label}</span>` +
      `<div class="stat-track"><div class="stat-fill ${stat.cls}" style="width:${pct}%"></div></div>`;
    statBars.appendChild(row);
  }
}

// Initialize previews after sprites load
spritesReady.then(() => {
  renderBreedPreviews();
  updatePreview(selectedBreed);
});

// Breed picker
breedPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.breed-btn');
  if (!btn) return;
  selectedBreed = parseInt(btn.dataset.breed);
  breedPicker.querySelectorAll('.breed-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  updatePreview(selectedBreed);
});

// Solo play
soloBtn.addEventListener('click', () => {
  startSoloGame(null);
});

// Load saved worlds
loadBtn.addEventListener('click', () => {
  const saves = LocalGame.getSaves();
  showWorldList(saves);
});

// Multiplayer expand/collapse
multiplayerBtn.addEventListener('click', () => {
  const visible = multiplayerPanel.style.display !== 'none';
  multiplayerPanel.style.display = visible ? 'none' : 'flex';
  multiplayerBtn.innerHTML = visible ? 'Multiplayer &#9662;' : 'Multiplayer &#9652;';
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
  const playerName = DOG_BREEDS[selectedBreed]?.defaultName || 'Dog';

  game = new LocalGame();
  game.start(playerName, selectedBreed, saveData);
}

async function startMultiplayerGame(roomId) {
  lobbyError.textContent = '';
  const playerName = DOG_BREEDS[selectedBreed]?.defaultName || 'Dog';

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
