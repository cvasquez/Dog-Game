import { EMOTES, BIOMES, SURFACE_Y } from '../../shared/constants.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export class HUD {
  constructor() {
    this.resourceBar = document.getElementById('resourceBar');
    this.depthMeter = document.getElementById('depthMeter');
    this.roomCodeEl = document.getElementById('roomCode');
    this.playerListEl = document.getElementById('playerList');

    // Create HP bar
    this.hpBar = document.createElement('div');
    this.hpBar.id = 'hpBar';
    this.hpBar.innerHTML = `
      <div class="hp-label">HP</div>
      <div class="hp-track"><div class="hp-fill"></div></div>
    `;
    document.getElementById('hud').appendChild(this.hpBar);
    this.hpFill = this.hpBar.querySelector('.hp-fill');

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

    // Stamina drain label
    this.staminaDrainLabel = document.createElement('div');
    this.staminaDrainLabel.className = 'stamina-drain-label';
    this.staminaDrainLabel.style.cssText = `
      position: absolute; right: -60px; top: 50%; transform: translateY(-50%);
      font-size: 8px; font-family: 'Press Start 2P', monospace;
      color: #FFA726; white-space: nowrap; display: none;
    `;
    this.staminaBar.style.position = 'relative';
    this.staminaBar.appendChild(this.staminaDrainLabel);

    // Shared tooltip element
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'game-tooltip';
    document.body.appendChild(this.tooltip);

    // HP/Stamina bar hover tooltips
    this._currentHP = 0;
    this._maxHP = 0;
    this._currentStamina = 0;
    this._maxStamina = 0;
    this._setupBarTooltip(this.hpBar, () =>
      `<div class="tooltip-title">Health</div>` +
      `<div class="tooltip-desc">${Math.round(this._currentHP)} / ${Math.round(this._maxHP)}</div>` +
      `<div class="tooltip-desc">Lava and hazards drain HP.</div>` +
      `<div class="tooltip-desc">Death drops all carried resources</div>` +
      `<div class="tooltip-desc">and respawns you at the surface.</div>` +
      `<div class="tooltip-desc">Bank resources to keep them safe!</div>`
    );
    this._setupBarTooltip(this.staminaBar, () =>
      `<div class="tooltip-title">Stamina</div>` +
      `<div class="tooltip-desc">${Math.round(this._currentStamina)} / ${Math.round(this._maxStamina)}</div>` +
      `<div class="tooltip-desc">Used by digging, climbing,</div>` +
      `<div class="tooltip-desc">clinging to walls, and sprinting.</div>` +
      `<div class="tooltip-desc">Regens when resting on ground.</div>` +
      `<div class="tooltip-desc">Empty = exhausted (brief lockout).</div>`
    );

    // Contextual hints system
    try {
      const raw = JSON.parse(localStorage.getItem('doggame_hints') || '{}');
      this.shownHints = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch {
      this.shownHints = {};
    }
    this.hintEl = document.createElement('div');
    this.hintEl.id = 'contextHint';
    this.hintEl.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      display: none; padding: 4px 12px; border-radius: 4px;
      background: rgba(0,0,0,0.8); border: 1px solid #8D6E63;
      color: #FFF3E0; font-size: 9px; font-family: 'Press Start 2P', monospace;
      pointer-events: none; z-index: 100; white-space: nowrap;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(this.hintEl);
    this.activeHint = null;
    this.hintTimer = 0;
  }

  _setupBarTooltip(el, contentFn) {
    el.addEventListener('mouseenter', (e) => {
      this.tooltip.innerHTML = contentFn();
      this.tooltip.style.display = 'block';
      this._positionTooltip(e);
    });
    el.addEventListener('mousemove', (e) => {
      this._positionTooltip(e);
    });
    el.addEventListener('mouseleave', () => {
      this.tooltip.style.display = 'none';
    });
  }

  _positionTooltip(e) {
    this.tooltip.style.left = (e.clientX + 12) + 'px';
    this.tooltip.style.top = (e.clientY + 12) + 'px';
  }

  showTooltip(html, e) {
    this.tooltip.innerHTML = html;
    this.tooltip.style.display = 'block';
    this._positionTooltip(e);
  }

  moveTooltip(e) {
    this._positionTooltip(e);
  }

  hideTooltip() {
    this.tooltip.style.display = 'none';
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
      // Check if player is in a biome depth range
      let biomeName = '';
      let biomeColor = '';
      for (const biome of BIOMES) {
        if (depth >= biome.minDepth && depth <= biome.maxDepth) {
          biomeName = biome.name;
          // Map biome id to color
          const biomeColors = { mushroom: '#76FF03', crystal: '#EA80FC', frozen: '#81D4FA', ancient: '#FFD54F' };
          biomeColor = biomeColors[biome.id] || '#FFF';
          break;
        }
      }
      if (biomeName) {
        this.depthMeter.innerHTML = `Depth: ${depth}m <span style="color:${escapeHtml(biomeColor)};font-size:9px"> ${escapeHtml(biomeName)}</span>`;
      } else {
        this.depthMeter.textContent = `Depth: ${depth}m`;
      }
      this.depthMeter.style.display = 'block';
    } else {
      this.depthMeter.textContent = 'Surface';
      this.depthMeter.style.display = 'block';
    }
  }

  updateHP(current, max) {
    this._currentHP = current;
    this._maxHP = max;
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.hpFill.style.width = pct + '%';

    // Color: green → yellow → orange → red
    if (pct > 60) this.hpFill.style.background = '#EF5350';
    else if (pct > 30) this.hpFill.style.background = '#FF7043';
    else this.hpFill.style.background = '#D32F2F';

    // Always show HP bar (unlike stamina which hides when full)
    if (pct >= 100) {
      this.hpBar.style.opacity = '0.3';
    } else {
      this.hpBar.style.opacity = '1';
    }

    // Low HP pulse
    if (pct > 0 && pct <= 25) {
      this.hpBar.classList.add('low');
    } else {
      this.hpBar.classList.remove('low');
    }
  }

  updateStamina(current, max, exhausted, drainSource) {
    this._currentStamina = current;
    this._maxStamina = max;
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.staminaFill.style.width = pct + '%';

    // Color: green → yellow → orange → red as it drains
    if (pct > 60) this.staminaFill.style.background = '#66BB6A';
    else if (pct > 30) this.staminaFill.style.background = '#FFA726';
    else if (pct > 0) this.staminaFill.style.background = '#EF5350';

    // Visibility: dim when full, bright when draining
    if (pct >= 100) {
      this.staminaBar.style.opacity = '0.3';
    } else {
      this.staminaBar.style.opacity = '1';
    }

    // Exhaustion: flash the bar red
    if (exhausted) {
      this.staminaBar.classList.add('exhausted');
      this.staminaDrainLabel.textContent = 'EXHAUSTED';
      this.staminaDrainLabel.style.display = 'block';
      this.staminaDrainLabel.style.color = '#EF5350';
    } else {
      this.staminaBar.classList.remove('exhausted');
      // Show drain source
      if (drainSource && pct < 100) {
        this.staminaDrainLabel.textContent = drainSource;
        this.staminaDrainLabel.style.display = 'block';
        this.staminaDrainLabel.style.color = '#FFA726';
      } else {
        this.staminaDrainLabel.style.display = 'none';
      }
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

  showHint(id, text) {
    if (this.shownHints[id]) return;
    this.activeHint = id;
    this.hintEl.textContent = text;
    this.hintEl.style.display = 'block';
    this.hintEl.style.opacity = '1';
    this.hintTimer = 300; // ~5 seconds
  }

  updateHints() {
    if (this.hintTimer > 0) {
      this.hintTimer--;
      if (this.hintTimer <= 60) {
        this.hintEl.style.opacity = String(this.hintTimer / 60);
      }
      if (this.hintTimer <= 0) {
        this.hintEl.style.display = 'none';
        if (this.activeHint) {
          this.shownHints[this.activeHint] = true;
          localStorage.setItem('doggame_hints', JSON.stringify(this.shownHints));
          this.activeHint = null;
        }
      }
    }
  }

  updatePlayerList(players) {
    this.playerListEl.innerHTML = '';
    for (const [, p] of players) {
      const entry = document.createElement('div');
      entry.className = 'player-entry';
      entry.textContent = (p.isLocal ? '→ ' : '  ') + p.name;
      this.playerListEl.appendChild(entry);
    }
  }
}
