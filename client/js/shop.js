import { DECORATIONS, EMOTES, UPGRADES } from '../../shared/constants.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export class Shop {
  constructor() {
    this.overlay = document.getElementById('shopOverlay');
    this.itemsContainer = document.getElementById('shopItems');
    this.closeBtn = document.getElementById('shopClose');
    this.tabsContainer = document.querySelector('.shop-tabs');
    this.titleEl = document.querySelector('.shop-box h2');
    this.visible = false;
    this.currentTab = 'decorations';
    this.lockedCategory = null; // when set, only this tab is shown
    this.playerResources = {};
    this.unlockedEmotes = [];
    this.ownedUpgrades = [];
    this.onBuyDecoration = null;
    this.onBuyEmote = null;
    this.onBuyUpgrade = null;

    // Tab switching
    document.querySelectorAll('.shop-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (this.lockedCategory) return; // tabs disabled in single-category mode
        this.currentTab = tab.dataset.tab;
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderItems();
      });
    });

    this.closeBtn.addEventListener('click', () => this.hide());
  }

  show(resources, unlockedEmotes, ownedUpgrades, category, discoveredBlueprints) {
    this.playerResources = resources;
    this.unlockedEmotes = unlockedEmotes;
    this.ownedUpgrades = ownedUpgrades || [];
    this.discoveredBlueprints = discoveredBlueprints || [];
    this.visible = true;
    this.overlay.style.display = 'flex';

    if (category) {
      // Single-category mode — opened from a specific shop machine
      this.lockedCategory = category;
      this.currentTab = category;
      this.tabsContainer.style.display = 'none';
      const names = { decorations: 'Decorations Shop', emotes: 'Emotes Shop', upgrades: 'Upgrades Shop' };
      this.titleEl.textContent = names[category] || 'Shop';
    } else {
      // Full shop mode (legacy)
      this.lockedCategory = null;
      this.tabsContainer.style.display = '';
      this.titleEl.textContent = 'Shop';
      // Activate correct tab
      document.querySelectorAll('.shop-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === this.currentTab);
      });
    }

    this.renderItems();
  }

  hide() {
    this.visible = false;
    this.overlay.style.display = 'none';
    this.lockedCategory = null;
  }

  renderItems() {
    this.itemsContainer.innerHTML = '';

    if (this.currentTab === 'decorations') {
      for (const dec of DECORATIONS) {
        const needsBlueprint = dec.requiresBlueprint && !this.discoveredBlueprints.includes(dec.id);
        const canAfford = this.checkAfford(dec.cost);
        const el = document.createElement('div');
        el.className = 'shop-item';

        if (needsBlueprint) {
          el.innerHTML = `
            <div class="shop-item-icon" style="background:#333;opacity:0.5"></div>
            <div class="shop-item-info">
              <div class="shop-item-name" style="color:#666">???</div>
              <div class="shop-item-desc" style="font-size:10px;color:#666">Find the blueprint underground!</div>
              <div class="shop-item-cost" style="color:#666">Blueprint required</div>
            </div>
            <button class="shop-item-buy" disabled>Locked</button>
          `;
        } else {
          el.innerHTML = `
            <div class="shop-item-icon" style="background:${escapeHtml(dec.color)}"></div>
            <div class="shop-item-info">
              <div class="shop-item-name">${escapeHtml(dec.name)}</div>
              <div class="shop-item-desc" style="font-size:11px;color:#4FC3F7">${escapeHtml(dec.desc || '')} <span style="color:#aaa;font-size:10px">(all players)</span></div>
              <div class="shop-item-cost">${this.formatCost(dec.cost)}</div>
            </div>
            <button class="shop-item-buy" ${canAfford ? '' : 'disabled'}>Place</button>
          `;
          el.querySelector('.shop-item-buy').addEventListener('click', () => {
            if (this.onBuyDecoration) this.onBuyDecoration(dec.id);
          });
        }
        this.itemsContainer.appendChild(el);
      }
    } else if (this.currentTab === 'emotes') {
      for (const emote of EMOTES) {
        const owned = this.unlockedEmotes.includes(emote.id);
        const canAfford = emote.cost ? this.checkAfford(emote.cost) : false;
        const el = document.createElement('div');
        el.className = 'shop-item';

        let btnText, btnDisabled;
        if (owned) {
          btnText = 'Owned';
          btnDisabled = true;
        } else if (!emote.cost) {
          btnText = 'Free';
          btnDisabled = true;
        } else {
          btnText = 'Buy';
          btnDisabled = !canAfford;
        }

        el.innerHTML = `
          <div class="shop-item-icon" style="background:rgba(255,255,255,0.1);font-size:24px">${escapeHtml(emote.symbol)}</div>
          <div class="shop-item-info">
            <div class="shop-item-name">${escapeHtml(emote.name)}</div>
            ${emote.buffDesc ? `<div class="shop-item-desc" style="font-size:11px;color:#4FC3F7">${escapeHtml(emote.buffDesc)} <span style="color:#aaa;font-size:10px">(${escapeHtml(String(emote.cooldown))}s cd)</span></div>` : ''}
            <div class="shop-item-cost">${emote.cost ? this.formatCost(emote.cost) : 'Free'}</div>
          </div>
          <button class="shop-item-buy" ${btnDisabled ? 'disabled' : ''}>${escapeHtml(btnText)}</button>
        `;

        if (!owned && emote.cost) {
          el.querySelector('.shop-item-buy').addEventListener('click', () => {
            if (this.onBuyEmote) this.onBuyEmote(emote.id);
          });
        }
        this.itemsContainer.appendChild(el);
      }
    } else if (this.currentTab === 'upgrades') {
      for (const upgrade of UPGRADES) {
        const owned = this.ownedUpgrades.includes(upgrade.id);
        const canAfford = this.checkAfford(upgrade.cost);
        const locked = upgrade.requires != null && !this.ownedUpgrades.includes(upgrade.requires);
        const prereq = locked ? UPGRADES.find(u => u.id === upgrade.requires) : null;

        const el = document.createElement('div');
        el.className = 'shop-item';

        let btnText, btnDisabled;
        if (owned) {
          btnText = 'Owned';
          btnDisabled = true;
        } else if (locked) {
          btnText = 'Locked';
          btnDisabled = true;
        } else {
          btnText = 'Buy';
          btnDisabled = !canAfford;
        }

        el.innerHTML = `
          <div class="shop-item-icon" style="background:rgba(255,255,255,0.1);font-size:24px">${escapeHtml(upgrade.icon)}</div>
          <div class="shop-item-info">
            <div class="shop-item-name">${escapeHtml(upgrade.name)}</div>
            <div class="shop-item-desc" style="font-size:11px;color:#aaa">${escapeHtml(upgrade.desc)}</div>
            <div class="shop-item-cost">${locked ? 'Requires: ' + escapeHtml(prereq.name) : this.formatCost(upgrade.cost)}</div>
          </div>
          <button class="shop-item-buy" ${btnDisabled ? 'disabled' : ''}>${escapeHtml(btnText)}</button>
        `;

        if (!owned && !locked) {
          el.querySelector('.shop-item-buy').addEventListener('click', () => {
            if (this.onBuyUpgrade) this.onBuyUpgrade(upgrade.id);
          });
        }
        this.itemsContainer.appendChild(el);
      }
    }
  }

  checkAfford(cost) {
    for (const [key, amount] of Object.entries(cost)) {
      if ((this.playerResources[key] || 0) < amount) return false;
    }
    return true;
  }

  formatCost(cost) {
    return Object.entries(cost)
      .map(([key, amount]) => {
        const have = this.playerResources[key] || 0;
        const color = have >= amount ? '#66BB6A' : '#EF5350';
        return `<span style="color:${escapeHtml(color)}">${escapeHtml(String(amount))} ${escapeHtml(key)}</span>`;
      })
      .join(', ');
  }
}
