const RESOURCE_ICONS = {
  bones: '🦴', gems: '💎', fossils: '🦕', gold: '🥇', diamonds: '💠',
  artifacts: '🏺', mushrooms: '🍄', crystals: '🔮', frozen_gems: '❄️', relics: '📜',
};

export class Bank {
  constructor() {
    this.overlay = document.getElementById('bankOverlay');
    this.itemsContainer = document.getElementById('bankItems');
    this.closeBtn = document.getElementById('bankClose');
    this.depositAllBtn = document.getElementById('bankDepositAll');
    this.withdrawAllBtn = document.getElementById('bankWithdrawAll');
    this.visible = false;
    this.playerResources = null;
    this.bankedResources = null;
    this.onDeposit = null;   // (resourceKey, amount) => void
    this.onWithdraw = null;  // (resourceKey, amount) => void

    this.closeBtn.addEventListener('click', () => this.hide());
    this.depositAllBtn.addEventListener('click', () => {
      if (!this.playerResources) return;
      for (const key of Object.keys(this.playerResources)) {
        const amount = this.playerResources[key];
        if (amount > 0 && this.onDeposit) this.onDeposit(key, amount);
      }
      this.render();
    });
    this.withdrawAllBtn.addEventListener('click', () => {
      if (!this.bankedResources) return;
      for (const key of Object.keys(this.bankedResources)) {
        const amount = this.bankedResources[key];
        if (amount > 0 && this.onWithdraw) this.onWithdraw(key, amount);
      }
      this.render();
    });
  }

  show(playerResources, bankedResources) {
    this.playerResources = playerResources;
    this.bankedResources = bankedResources;
    this.visible = true;
    this.overlay.style.display = 'flex';
    this.render();
  }

  hide() {
    this.visible = false;
    this.overlay.style.display = 'none';
  }

  render() {
    const container = this.itemsContainer;
    container.innerHTML = '';

    // Header row
    const header = document.createElement('div');
    header.className = 'bank-row';
    header.style.borderBottom = '1px solid #8D6E63';
    header.style.marginBottom = '8px';
    header.innerHTML = `
      <span class="bank-row-label" style="color:#D4A574;font-size:7px">Resource</span>
      <span class="bank-row-carried" style="color:#D4A574;font-size:7px">Carried</span>
      <span class="bank-row-banked" style="color:#D4A574;font-size:7px">Stashed</span>
      <span style="min-width:72px"></span>
    `;
    container.appendChild(header);

    for (const key of Object.keys(this.playerResources)) {
      const carried = this.playerResources[key] || 0;
      const banked = this.bankedResources[key] || 0;
      if (carried === 0 && banked === 0) continue;

      const row = document.createElement('div');
      row.className = 'bank-row';

      const icon = RESOURCE_ICONS[key] || '';
      const label = key.replace('_', ' ');

      row.innerHTML = `
        <span class="bank-row-label">${icon} ${label}</span>
        <span class="bank-row-carried">${carried}</span>
        <span class="bank-row-banked">${banked}</span>
        <span class="bank-row-buttons">
          <button data-action="deposit" data-key="${key}">Stash</button>
          <button data-action="withdraw" data-key="${key}">Take</button>
        </span>
      `;
      container.appendChild(row);
    }

    // If nothing to show
    if (container.children.length <= 1) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;color:#8D6E63;font-size:7px;padding:16px';
      empty.textContent = 'No resources to manage. Go dig!';
      container.appendChild(empty);
    }

    // Bind row buttons
    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const action = btn.dataset.action;
        if (action === 'deposit') {
          const amount = this.playerResources[key] || 0;
          if (amount > 0 && this.onDeposit) this.onDeposit(key, amount);
        } else {
          const amount = this.bankedResources[key] || 0;
          if (amount > 0 && this.onWithdraw) this.onWithdraw(key, amount);
        }
        this.render();
      });
    });
  }
}
