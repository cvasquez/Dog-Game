import { DECORATIONS, EMOTES, UPGRADES, ACHIEVEMENTS } from '../../shared/constants.js';

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
    this.onPrestige = null;
    this.prestigeLevel = 0;
    this.achievements = new Set();
    this.stats = {};

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

  show(resources, unlockedEmotes, ownedUpgrades, category, discoveredBlueprints, prestigeLevel, achievements, stats) {
    this.playerResources = resources;
    this.unlockedEmotes = unlockedEmotes;
    this.ownedUpgrades = ownedUpgrades || [];
    this.discoveredBlueprints = discoveredBlueprints || [];
    this.prestigeLevel = prestigeLevel || 0;
    this.achievements = achievements || new Set();
    this.stats = stats || {};
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

      // Prestige section at bottom of upgrades
      const prestigeEl = document.createElement('div');
      prestigeEl.className = 'shop-item prestige-section';
      const pLevel = this.prestigeLevel;
      const pBonus = pLevel * 8;
      const nextBonus = (pLevel + 1) * 8;
      const allOwned = this.ownedUpgrades.length >= UPGRADES.length;

      prestigeEl.innerHTML = `
        <div class="shop-item-icon" style="background:rgba(255,215,0,0.2);font-size:24px">🔄</div>
        <div class="shop-item-info">
          <div class="shop-item-name" style="color:#FFD700">Prestige${pLevel > 0 ? ' (Level ' + escapeHtml(String(pLevel)) + ')' : ''}</div>
          <div class="shop-item-desc" style="font-size:11px;color:#FFD700">
            ${pLevel > 0 ? 'Current: +' + escapeHtml(String(pBonus)) + '% all stats. ' : ''}
            Reset world &amp; upgrades for +${escapeHtml(String(nextBonus))}% all stats permanently
          </div>
          <div class="shop-item-cost" style="color:#aaa">${allOwned ? 'Ready to prestige!' : 'Buy all upgrades to unlock'}</div>
        </div>
        <button class="shop-item-buy prestige-btn" ${allOwned ? '' : 'disabled'}>${allOwned ? 'Prestige!' : 'Locked'}</button>
      `;

      if (allOwned) {
        prestigeEl.querySelector('.prestige-btn').addEventListener('click', () => {
          if (this.onPrestige) {
            this.onPrestige();
            this.hide();
          }
        });
      }
      this.itemsContainer.appendChild(prestigeEl);
    } else if (this.currentTab === 'achievements') {
      // Group achievements by category
      const categories = ['exploration', 'collection', 'progression', 'prestige', 'survival'];
      const categoryNames = { exploration: 'Exploration', collection: 'Collection', progression: 'Progression', prestige: 'Prestige', survival: 'Survival' };

      for (const cat of categories) {
        const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
        if (catAchievements.length === 0) continue;

        const header = document.createElement('div');
        header.className = 'shop-item';
        header.style.cssText = 'background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);margin-top:8px';
        header.innerHTML = `<div class="shop-item-info"><div class="shop-item-name" style="color:#FFD700">${escapeHtml(categoryNames[cat] || cat)}</div></div>`;
        this.itemsContainer.appendChild(header);

        for (const ach of catAchievements) {
          const unlocked = this.achievements.has(ach.id);
          const el = document.createElement('div');
          el.className = 'shop-item' + (unlocked ? ' achievement-unlocked' : '');
          el.innerHTML = `
            <div class="shop-item-icon" style="background:${unlocked ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)'};font-size:20px;${unlocked ? '' : 'filter:grayscale(1);opacity:0.5'}">${escapeHtml(ach.icon)}</div>
            <div class="shop-item-info">
              <div class="shop-item-name" style="color:${unlocked ? '#FFD700' : '#666'}">${escapeHtml(ach.name)}</div>
              <div class="shop-item-desc" style="font-size:11px;color:${unlocked ? '#FFF3E0' : '#555'}">${escapeHtml(ach.desc)}</div>
            </div>
            <span style="font-size:14px;color:${unlocked ? '#66BB6A' : '#444'}">${unlocked ? '✓' : '○'}</span>
          `;
          this.itemsContainer.appendChild(el);
        }
      }

      // Stats summary
      const statsEl = document.createElement('div');
      statsEl.className = 'shop-item';
      statsEl.style.cssText = 'background:rgba(79,195,247,0.08);border:1px solid rgba(79,195,247,0.2);margin-top:12px;flex-direction:column;align-items:flex-start;padding:12px';
      const s = this.stats;
      statsEl.innerHTML = `
        <div class="shop-item-name" style="color:#4FC3F7;margin-bottom:6px">Stats</div>
        <div style="font-size:10px;color:#aaa;line-height:1.8">
          Max Depth: ${escapeHtml(String(s.maxDepth || 0))}m |
          Tiles Dug: ${escapeHtml(String(s.tilesDigged || 0))} |
          Prestige: ${escapeHtml(String(this.prestigeLevel))}
        </div>
      `;
      this.itemsContainer.appendChild(statsEl);
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
