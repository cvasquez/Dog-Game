import { DOG_BREEDS, UPGRADES, EMOTES, DECORATIONS, calcDecorationBonuses } from '../../shared/constants.js';

const RESOURCE_ICONS = {
  bones: '🦴', gems: '💎', fossils: '🦕', gold: '🥇', diamonds: '💠',
  artifacts: '🏺', mushrooms: '🍄', crystals: '🔮', frozen_gems: '❄️', relics: '📜',
};

const STAT_ICONS = {
  moveSpeed: '💨', jumpForce: '⬆', digSpeed: '⛏', maxStamina: '🟢',
  staminaRegen: '♻', maxHP: '❤', lootBonus: '🍀', climbEfficiency: '🧗',
};

const STAT_LABELS = {
  moveSpeed: 'Move Speed', jumpForce: 'Jump Force', digSpeed: 'Dig Speed',
  maxStamina: 'Max Stamina', staminaRegen: 'Stam Regen', maxHP: 'Max HP',
  lootBonus: 'Loot Bonus', climbEfficiency: 'Climb Efficiency',
};

const UPGRADE_CATEGORIES = {
  collar: { name: 'Collars', icon: '🔵' },
  hat: { name: 'Hats', icon: '🧢' },
  bandana: { name: 'Bandanas', icon: '🟥' },
  boots: { name: 'Boots', icon: '🥾' },
  paws: { name: 'Paws', icon: '🐾' },
};

export class CharacterSheet {
  constructor(actionBar) {
    this.overlay = document.getElementById('charSheetOverlay');
    this.closeBtn = document.getElementById('charSheetClose');
    this.visible = false;
    this.actionBar = actionBar;
    this.playerRef = null;
    this.decorations = [];

    // Drag-and-drop state for action bar rearranging
    this.dragSource = null;

    this.closeBtn.addEventListener('click', () => this.hide());

    // Tab switching
    this.currentTab = 'stats';
    this.overlay.querySelectorAll('.cs-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentTab = tab.dataset.tab;
        this.overlay.querySelectorAll('.cs-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.render();
      });
    });
  }

  show(player, decorations) {
    this.playerRef = player;
    this.decorations = decorations || [];
    this.visible = true;
    this.overlay.style.display = 'flex';
    this.render();
  }

  hide() {
    this.visible = false;
    this.overlay.style.display = 'none';
  }

  toggle(player, decorations) {
    if (this.visible) this.hide();
    else this.show(player, decorations);
  }

  render() {
    const content = document.getElementById('charSheetContent');
    if (!this.playerRef) return;

    if (this.currentTab === 'stats') this.renderStats(content);
    else if (this.currentTab === 'abilities') this.renderAbilities(content);
  }

  renderStats(container) {
    const p = this.playerRef;
    const breed = DOG_BREEDS[p.breedId] || DOG_BREEDS[0];

    // Calculate breakdown for each stat
    const breakdown = this._calcStatBreakdown(p);

    let html = '';

    // Character header
    html += `<div class="cs-header">`;
    html += `<div class="cs-breed-badge" style="background:${breed.colors.body};border-color:${breed.colors.dark}"></div>`;
    html += `<div class="cs-header-info">`;
    html += `<div class="cs-name">${this._esc(p.name)}</div>`;
    html += `<div class="cs-breed-name">${breed.name}`;
    if (p.prestigeLevel > 0) html += ` <span class="cs-prestige">★${p.prestigeLevel}</span>`;
    html += `</div>`;
    html += `</div>`;
    html += `</div>`;

    // Vital bars
    html += `<div class="cs-vitals">`;
    html += this._renderVitalBar('HP', p.hp, p.maxHP, '#EF5350', '#B71C1C');
    html += this._renderVitalBar('STA', p.stamina, p.maxStamina, '#66BB6A', '#2E7D32');
    html += `</div>`;

    // Core stats with breakdown
    html += `<div class="cs-section-title">Core Stats</div>`;
    html += `<div class="cs-stats-grid">`;
    for (const key of ['moveSpeed', 'jumpForce', 'digSpeed', 'maxStamina', 'staminaRegen', 'maxHP', 'lootBonus', 'climbEfficiency']) {
      const bd = breakdown[key];
      html += this._renderStatRow(key, bd);
    }
    html += `</div>`;

    // Equipped upgrades
    html += `<div class="cs-section-title">Equipped Upgrades</div>`;
    if (p.ownedUpgrades.length === 0) {
      html += `<div class="cs-empty">No upgrades equipped yet</div>`;
    } else {
      html += `<div class="cs-upgrades-list">`;
      // Group by category
      const cats = {};
      for (const id of p.ownedUpgrades) {
        const u = UPGRADES.find(u => u.id === id);
        if (!u) continue;
        if (!cats[u.category]) cats[u.category] = [];
        cats[u.category].push(u);
      }
      for (const [cat, ups] of Object.entries(cats)) {
        const ci = UPGRADE_CATEGORIES[cat] || { name: cat, icon: '?' };
        html += `<div class="cs-upgrade-cat">${ci.icon} ${ci.name}</div>`;
        for (const u of ups) {
          html += `<div class="cs-upgrade-item">`;
          html += `<span class="cs-upgrade-icon">${u.icon}</span>`;
          html += `<span class="cs-upgrade-name">${u.name}</span>`;
          html += `<span class="cs-upgrade-desc">${u.desc}</span>`;
          html += `</div>`;
        }
      }
      html += `</div>`;
    }

    // Active decoration bonuses
    const db = this.decorations.length > 0 ? calcDecorationBonuses(this.decorations) : {};
    const hasDecBonus = Object.values(db).some(v => v > 0);
    if (hasDecBonus) {
      html += `<div class="cs-section-title">Park Bonuses</div>`;
      html += `<div class="cs-deco-bonuses">`;
      for (const [key, val] of Object.entries(db)) {
        if (val > 0 && STAT_LABELS[key]) {
          html += `<div class="cs-deco-bonus">${STAT_ICONS[key] || ''} ${STAT_LABELS[key]}: <span class="cs-bonus-val">+${Math.round(val * 100)}%</span></div>`;
        }
      }
      html += `</div>`;
    }

    container.innerHTML = html;
  }

  renderAbilities(container) {
    const p = this.playerRef;

    let html = '';
    html += `<div class="cs-section-title">Action Bar</div>`;
    html += `<div class="cs-section-hint">Drag abilities to rearrange your action bar</div>`;

    // Render current action bar slots
    html += `<div class="cs-actionbar">`;
    for (let i = 0; i < 8; i++) {
      const emoteId = p.unlockedEmotes[i];
      const emote = emoteId != null ? EMOTES[emoteId] : null;
      const cd = p.emoteCooldowns[emoteId] || 0;
      html += `<div class="cs-ab-slot${emote ? '' : ' cs-ab-empty'}" draggable="${emote ? 'true' : 'false'}" data-slot="${i}">`;
      html += `<span class="cs-ab-key">${i + 1}</span>`;
      if (emote) {
        html += `<span class="cs-ab-icon">${emote.symbol}</span>`;
        html += `<span class="cs-ab-name">${emote.name}</span>`;
      } else {
        html += `<span class="cs-ab-icon cs-ab-icon-empty">-</span>`;
        html += `<span class="cs-ab-name">Empty</span>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    // All unlocked abilities detail list
    html += `<div class="cs-section-title">Unlocked Abilities</div>`;
    if (p.unlockedEmotes.length === 0) {
      html += `<div class="cs-empty">No abilities unlocked yet</div>`;
    } else {
      html += `<div class="cs-abilities-list">`;
      for (const emoteId of p.unlockedEmotes) {
        const emote = EMOTES[emoteId];
        if (!emote) continue;
        const cd = p.emoteCooldowns[emoteId] || 0;
        const cdSec = Math.ceil(cd / 60);
        html += `<div class="cs-ability-item${cd > 0 ? ' cs-ability-cd' : ''}">`;
        html += `<div class="cs-ability-icon">${emote.symbol}</div>`;
        html += `<div class="cs-ability-info">`;
        html += `<div class="cs-ability-name">${emote.name}</div>`;
        html += `<div class="cs-ability-desc">${emote.buffDesc || ''}</div>`;
        html += `<div class="cs-ability-meta">`;
        if (emote.duration) html += `<span class="cs-tag cs-tag-dur">${emote.duration}s</span>`;
        if (emote.cooldown) html += `<span class="cs-tag cs-tag-cd">${emote.cooldown}s CD</span>`;
        if (cd > 0) html += `<span class="cs-tag cs-tag-active">${cdSec}s left</span>`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    container.innerHTML = html;

    // Wire up drag-and-drop on the action bar slots
    this._initDragDrop();
  }

  _initDragDrop() {
    const slots = this.overlay.querySelectorAll('.cs-ab-slot[draggable="true"]');
    const allSlots = this.overlay.querySelectorAll('.cs-ab-slot');

    slots.forEach(slot => {
      slot.addEventListener('dragstart', (e) => {
        this.dragSource = parseInt(slot.dataset.slot);
        slot.classList.add('cs-ab-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', slot.dataset.slot);
      });

      slot.addEventListener('dragend', () => {
        slot.classList.remove('cs-ab-dragging');
        allSlots.forEach(s => s.classList.remove('cs-ab-dragover'));
        this.dragSource = null;
      });
    });

    allSlots.forEach(slot => {
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        slot.classList.add('cs-ab-dragover');
      });

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('cs-ab-dragover');
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('cs-ab-dragover');
        const targetIdx = parseInt(slot.dataset.slot);
        if (this.dragSource != null && this.dragSource !== targetIdx) {
          this._swapSlots(this.dragSource, targetIdx);
        }
        this.dragSource = null;
      });
    });
  }

  _swapSlots(a, b) {
    const emotes = this.playerRef.unlockedEmotes;
    const tmp = emotes[a];
    emotes[a] = emotes[b];
    emotes[b] = tmp;
    // Re-render and update the in-game action bar
    this.render();
    if (this.actionBar) {
      this.actionBar.update(emotes, this.playerRef.emoteCooldowns);
    }
  }

  _calcStatBreakdown(p) {
    const breed = DOG_BREEDS[p.breedId] || DOG_BREEDS[0];
    const s = breed.stats;

    // We need the base constants to show true base values
    // Import values are already baked into player base stats, so we work from those
    const result = {};
    const statKeys = ['moveSpeed', 'jumpForce', 'digSpeed', 'maxStamina', 'staminaRegen', 'maxHP', 'lootBonus', 'climbEfficiency'];
    const baseKeys = { moveSpeed: 'baseMoveSpeed', jumpForce: 'baseJumpForce', digSpeed: 'baseDigSpeed',
      maxStamina: 'baseMaxStamina', staminaRegen: 'baseStaminaRegen', maxHP: 'baseMaxHP',
      lootBonus: 'baseLootBonus', climbEfficiency: 'baseClimbEfficiency' };
    const activeKeys = { moveSpeed: 'moveSpeed', jumpForce: 'jumpForce', digSpeed: 'digSpeed',
      maxStamina: 'maxStamina', staminaRegen: 'staminaRegenRate', maxHP: 'maxHP',
      lootBonus: 'lootBonus', climbEfficiency: 'climbEfficiency' };

    for (const key of statKeys) {
      const base = p[baseKeys[key]] || 0;
      const active = p[activeKeys[key]] || 0;
      const bonus = active - base;
      const pct = base > 0 ? (bonus / base) * 100 : (key === 'lootBonus' ? active * 100 : 0);

      // Breakdown sources
      const sources = [];

      // Prestige
      if (p.prestigeLevel > 0) {
        const pBonus = p.prestigeLevel * 0.08;
        if (key !== 'lootBonus' && key !== 'climbEfficiency') {
          sources.push({ label: `Prestige ★${p.prestigeLevel}`, val: `+${Math.round(pBonus * 100)}%` });
        }
      }

      // Upgrades
      for (const id of p.ownedUpgrades) {
        const u = UPGRADES.find(u => u.id === id);
        if (!u) continue;
        const e = u.effect;
        const effectKey = key === 'staminaRegen' ? 'staminaRegen' : key;
        if (e[effectKey]) {
          sources.push({ label: u.name, val: `+${Math.round(e[effectKey] * 100)}%` });
        }
      }

      // Decoration bonuses
      if (this.decorations.length > 0) {
        const db = calcDecorationBonuses(this.decorations);
        const effectKey = key === 'staminaRegen' ? 'staminaRegen' : key;
        if (db[effectKey]) {
          sources.push({ label: 'Park Bonuses', val: `+${Math.round(db[effectKey] * 100)}%` });
        }
      }

      // Active buff
      if (p.emoteBuff) {
        const e = p.emoteBuff.effect;
        const effectKey = key === 'staminaRegen' ? 'staminaRegen' : key;
        if (e[effectKey]) {
          sources.push({ label: 'Active Buff', val: `+${Math.round(e[effectKey] * 100)}%` });
        }
      }

      result[key] = { base, active, bonus, pct, sources };
    }

    return result;
  }

  _renderVitalBar(label, current, max, color, darkColor) {
    const pct = max > 0 ? Math.round((current / max) * 100) : 0;
    return `<div class="cs-vital">
      <div class="cs-vital-label">${label}</div>
      <div class="cs-vital-track">
        <div class="cs-vital-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="cs-vital-text">${Math.round(current)}/${Math.round(max)}</div>
    </div>`;
  }

  _renderStatRow(key, bd) {
    const icon = STAT_ICONS[key] || '';
    const label = STAT_LABELS[key] || key;
    let valDisplay;
    if (key === 'lootBonus') {
      valDisplay = `${Math.round(bd.active * 100)}%`;
    } else if (key === 'climbEfficiency') {
      valDisplay = `${Math.round(bd.active * 100)}%`;
    } else {
      valDisplay = bd.active.toFixed(1);
    }
    const hasBonus = bd.bonus > 0.001 || bd.bonus < -0.001;
    const bonusClass = bd.bonus > 0 ? 'cs-stat-up' : bd.bonus < 0 ? 'cs-stat-down' : '';

    let html = `<div class="cs-stat-row">`;
    html += `<div class="cs-stat-icon">${icon}</div>`;
    html += `<div class="cs-stat-label">${label}</div>`;
    html += `<div class="cs-stat-value ${bonusClass}">${valDisplay}`;
    if (hasBonus) {
      const sign = bd.bonus > 0 ? '+' : '';
      html += `<span class="cs-stat-bonus">(${sign}${Math.round(bd.pct)}%)</span>`;
    }
    html += `</div>`;

    // Tooltip breakdown for sources
    if (bd.sources.length > 0) {
      html += `<div class="cs-stat-sources">`;
      for (const src of bd.sources) {
        html += `<div class="cs-stat-source">${src.label}: <span>${src.val}</span></div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}
