import { EMOTES } from '../../shared/constants.js';

export class HUD {
  constructor() {
    this.resourceBar = document.getElementById('resourceBar');
    this.depthMeter = document.getElementById('depthMeter');
    this.roomCodeEl = document.getElementById('roomCode');
    this.playerListEl = document.getElementById('playerList');

    // Create stamina bar
    this.staminaBar = document.createElement('div');
    this.staminaBar.id = 'staminaBar';
    this.staminaBar.innerHTML = `
      <div class="stamina-label">Stamina</div>
      <div class="stamina-track"><div class="stamina-fill"></div></div>
    `;
    document.getElementById('hud').appendChild(this.staminaBar);
    this.staminaFill = this.staminaBar.querySelector('.stamina-fill');

    // Create buff indicator
    this.buffIndicator = document.createElement('div');
    this.buffIndicator.id = 'buffIndicator';
    this.buffIndicator.style.cssText = `
      position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
      display: none; padding: 3px 10px; border-radius: 4px;
      background: rgba(0,0,0,0.7); border: 1px solid #4FC3F7;
      color: #4FC3F7; font-size: 11px; font-family: 'Press Start 2P', monospace;
      pointer-events: none; z-index: 100; white-space: nowrap;
      text-shadow: 0 0 4px rgba(79,195,247,0.5);
    `;
    document.body.appendChild(this.buffIndicator);
  }

  updateResources(resources) {
    const items = [
      { icon: '🦴', name: 'bones', value: resources.bones || 0 },
      { icon: '💎', name: 'gems', value: resources.gems || 0 },
      { icon: '🦕', name: 'fossils', value: resources.fossils || 0 },
      { icon: '🥇', name: 'gold', value: resources.gold || 0 },
      { icon: '💠', name: 'diamonds', value: resources.diamonds || 0 },
      { icon: '🏺', name: 'artifacts', value: resources.artifacts || 0 },
      { icon: '🍄', name: 'mushrooms', value: resources.mushrooms || 0 },
      { icon: '🔮', name: 'crystals', value: resources.crystals || 0 },
      { icon: '❄️', name: 'frozen_gems', value: resources.frozen_gems || 0 },
      { icon: '📜', name: 'relics', value: resources.relics || 0 },
    ];

    this.resourceBar.innerHTML = items
      .filter(i => i.value > 0)
      .map(i => `<span class="resource-item">${i.icon} ${i.value}</span>`)
      .join('');

    if (!resources.bones && !this.resourceBar.innerHTML) {
      this.resourceBar.innerHTML = '<span class="resource-item">🦴 0</span>';
    }
  }

  updateDepth(depth) {
    if (depth > 0) {
      this.depthMeter.textContent = `Depth: ${depth}m`;
      this.depthMeter.style.display = 'block';
    } else {
      this.depthMeter.textContent = 'Surface';
      this.depthMeter.style.display = 'block';
    }
  }

  updateStamina(current, max, exhausted) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.staminaFill.style.width = pct + '%';

    // Color: green → yellow → orange → red as it drains
    if (pct > 60) this.staminaFill.style.background = '#66BB6A';
    else if (pct > 30) this.staminaFill.style.background = '#FFA726';
    else if (pct > 0) this.staminaFill.style.background = '#EF5350';

    // Visibility: show when draining or not full, fade when full
    if (pct >= 100) {
      this.staminaBar.style.opacity = '0';
    } else {
      this.staminaBar.style.opacity = '1';
    }

    // Exhaustion: flash the bar red
    if (exhausted) {
      this.staminaBar.classList.add('exhausted');
    } else {
      this.staminaBar.classList.remove('exhausted');
    }

    // Low stamina pulse
    if (pct > 0 && pct <= 20 && !exhausted) {
      this.staminaBar.classList.add('low');
    } else {
      this.staminaBar.classList.remove('low');
    }
  }

  setRoomCode(code, isSolo) {
    if (isSolo) {
      this.roomCodeEl.textContent = `World: ${code}`;
      this.roomCodeEl.style.cursor = 'default';
    } else {
      this.roomCodeEl.textContent = `Room: ${code}`;
      this.roomCodeEl.addEventListener('click', () => {
        const url = window.location.origin + '/#' + code;
        navigator.clipboard.writeText(url).then(() => {
          this.roomCodeEl.textContent = 'Copied!';
          setTimeout(() => { this.roomCodeEl.textContent = `Room: ${code}`; }, 1500);
        });
      });
    }
  }

  updateBuff(emoteBuff) {
    if (!emoteBuff) {
      this.buffIndicator.style.display = 'none';
      return;
    }
    const emote = EMOTES[emoteBuff.emoteId];
    if (!emote) { this.buffIndicator.style.display = 'none'; return; }
    const secs = Math.ceil(emoteBuff.timer / 60);
    this.buffIndicator.textContent = `${emote.symbol} ${emote.buffDesc} (${secs}s)`;
    this.buffIndicator.style.display = 'block';
  }

  updatePlayerList(players) {
    const entries = [];
    for (const [, p] of players) {
      const marker = p.isLocal ? '→ ' : '  ';
      entries.push(`<div class="player-entry">${marker}${p.name}</div>`);
    }
    this.playerListEl.innerHTML = entries.join('');
  }
}
