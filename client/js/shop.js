import { DECORATIONS, EMOTES } from '../../shared/constants.js';

export class Shop {
  constructor() {
    this.overlay = document.getElementById('shopOverlay');
    this.itemsContainer = document.getElementById('shopItems');
    this.closeBtn = document.getElementById('shopClose');
    this.visible = false;
    this.currentTab = 'decorations';
    this.playerResources = {};
    this.unlockedEmotes = [];
    this.onBuyDecoration = null;
    this.onBuyEmote = null;

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

  show(resources, unlockedEmotes) {
    this.playerResources = resources;
    this.unlockedEmotes = unlockedEmotes;
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
    } else {
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
