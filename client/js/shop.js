import { DECORATIONS, EMOTES, UPGRADES } from '../../shared/constants.js';

export class Shop {
  constructor() {
    this.overlay = document.getElementById('shopOverlay');
    this.itemsContainer = document.getElementById('shopItems');
    this.closeBtn = document.getElementById('shopClose');
    this.visible = false;
    this.currentTab = 'decorations';
    this.playerResources = {};
    this.unlockedEmotes = [];
    this.ownedUpgrades = [];
    this.onBuyDecoration = null;
    this.onBuyEmote = null;
    this.onBuyUpgrade = null;

    // Tab switching
    document.querySelectorAll('.shop-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentTab = tab.dataset.tab;
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderItems();
      });
    });

    this.closeBtn.addEventListener('click', () => this.hide());
  }

  show(resources, unlockedEmotes, ownedUpgrades) {
    this.playerResources = resources;
    this.unlockedEmotes = unlockedEmotes;
    this.ownedUpgrades = ownedUpgrades || [];
    this.visible = true;
    this.overlay.style.display = 'flex';
    this.renderItems();
  }

  hide() {
    this.visible = false;
    this.overlay.style.display = 'none';
  }

  renderItems() {
    this.itemsContainer.innerHTML = '';

    if (this.currentTab === 'decorations') {
      for (const dec of DECORATIONS) {
        const canAfford = this.checkAfford(dec.cost);
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = `
          <div class="shop-item-icon" style="background:${dec.color}"></div>
          <div class="shop-item-info">
            <div class="shop-item-name">${dec.name}</div>
            <div class="shop-item-cost">${this.formatCost(dec.cost)}</div>
          </div>
          <button class="shop-item-buy" ${canAfford ? '' : 'disabled'}>Place</button>
        `;
        el.querySelector('.shop-item-buy').addEventListener('click', () => {
          if (this.onBuyDecoration) this.onBuyDecoration(dec.id);
        });
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
          <div class="shop-item-icon" style="background:rgba(255,255,255,0.1);font-size:24px">${emote.symbol}</div>
          <div class="shop-item-info">
            <div class="shop-item-name">${emote.name}</div>
            <div class="shop-item-cost">${emote.cost ? this.formatCost(emote.cost) : 'Free'}</div>
          </div>
          <button class="shop-item-buy" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
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
          <div class="shop-item-icon" style="background:rgba(255,255,255,0.1);font-size:24px">${upgrade.icon}</div>
          <div class="shop-item-info">
            <div class="shop-item-name">${upgrade.name}</div>
            <div class="shop-item-desc" style="font-size:11px;color:#aaa">${upgrade.desc}</div>
            <div class="shop-item-cost">${locked ? 'Requires: ' + prereq.name : this.formatCost(upgrade.cost)}</div>
          </div>
          <button class="shop-item-buy" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
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
      .map(([key, amount]) => `${amount} ${key}`)
      .join(', ');
  }
}
