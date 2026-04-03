import { EMOTES } from '../../shared/constants.js';

export class ActionBar {
  constructor(hud) {
    this.bar = document.getElementById('actionBar');
    this.hud = hud || null;
    this.slots = [];
    this.unlockedEmotes = [];
    this.cooldowns = {};
    this.activeEmoteId = null;

    // Build slot elements
    for (let i = 0; i < 8; i++) {
      const slot = document.createElement('div');
      slot.className = 'action-slot empty';
      slot.dataset.slotIndex = i;
      slot.innerHTML = `
        <span class="slot-key">${i + 1}</span>
        <span class="slot-icon"></span>
        <div class="slot-cooldown-overlay"></div>
      `;
      slot.addEventListener('mouseenter', (e) => this._showSlotTooltip(i, e));
      slot.addEventListener('mousemove', (e) => { if (this.hud) this.hud.moveTooltip(e); });
      slot.addEventListener('mouseleave', () => { if (this.hud) this.hud.hideTooltip(); });
      this.bar.appendChild(slot);
      this.slots.push(slot);
    }
  }

  _showSlotTooltip(idx, e) {
    if (!this.hud) return;
    const emoteId = this.unlockedEmotes[idx];
    const emote = emoteId != null ? EMOTES[emoteId] : null;
    if (!emote) {
      this.hud.hideTooltip();
      return;
    }
    const key = idx + 1;
    let html = `<div class="tooltip-title">${emote.symbol} ${emote.name} [${key}]</div>`;
    if (emote.buffDesc) html += `<div class="tooltip-desc">${emote.buffDesc}</div>`;
    if (emote.cooldown) html += `<div class="tooltip-desc">Cooldown: ${emote.cooldown}s</div>`;
    this.hud.showTooltip(html, e);
  }

  /** Update which emotes are unlocked and their cooldown state */
  update(unlockedEmotes, cooldowns) {
    this.unlockedEmotes = unlockedEmotes;
    this.cooldowns = cooldowns || {};

    for (let i = 0; i < 8; i++) {
      const slot = this.slots[i];
      const emoteId = unlockedEmotes[i];
      const emote = emoteId != null ? EMOTES[emoteId] : null;

      if (!emote) {
        slot.className = 'action-slot empty';
        slot.querySelector('.slot-icon').textContent = '';
        slot.querySelector('.slot-cooldown-overlay').style.height = '0%';
        slot.title = '';
        continue;
      }

      const onCooldown = !!(this.cooldowns[emoteId]);
      const cdRemaining = this.cooldowns[emoteId] || 0;
      const cdTotal = Math.round((emote.cooldown || 30) * 60);
      const cdFrac = onCooldown ? cdRemaining / cdTotal : 0;

      slot.className = 'action-slot' +
        (onCooldown ? ' on-cooldown' : '') +
        (this.activeEmoteId === emoteId ? ' active-buff' : '');
      slot.querySelector('.slot-icon').textContent = emote.symbol;
      slot.querySelector('.slot-cooldown-overlay').style.height = Math.round(cdFrac * 100) + '%';
      slot.title = '';
    }
  }

  /** Get the emote id for a given slot (1-indexed key press) */
  getEmoteForSlot(slotNum) {
    const idx = slotNum - 1;
    if (idx < 0 || idx >= this.unlockedEmotes.length) return null;
    return this.unlockedEmotes[idx];
  }

  show() {
    this.bar.style.display = 'flex';
  }

  hide() {
    this.bar.style.display = 'none';
  }
}

// Keep old name as alias for backward compat with any stale imports
export { ActionBar as EmoteWheel };
