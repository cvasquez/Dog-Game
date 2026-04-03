import { DECORATIONS, EMOTES, UPGRADES, ACHIEVEMENTS } from '../../shared/constants.js';

// Resource icon map for visual cost display
const RESOURCE_ICONS = {
  bones: '🦴', gems: '💎', fossils: '🦕', gold: '🥇', diamonds: '💠',
  artifacts: '🏺', mushrooms: '🍄', crystals: '🔮', frozen_gems: '❄️', relics: '📜',
};

// Upgrade category display info
const UPGRADE_CATEGORIES = {
  collar: { name: 'Collars', desc: 'Stamina & Regen', icon: '🔵' },
  hat:    { name: 'Hats', desc: 'Speed & Jump', icon: '🧢' },
  bandana:{ name: 'Bandanas', desc: 'Dig Power', icon: '🟥' },
  boots:  { name: 'Boots', desc: 'Climb Efficiency', icon: '🥾' },
  paws:   { name: 'Paws', desc: 'Dig & Stamina', icon: '🐾' },
};

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
    this.lockedCategory = null;
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
        if (this.lockedCategory) return;
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
      this.lockedCategory = category;
      this.currentTab = category;
      this.tabsContainer.style.display = 'none';
      const names = { decorations: 'Decorations Shop', emotes: 'Emotes Shop', upgrades: 'Upgrades Shop' };
      this.titleEl.textContent = names[category] || 'Shop';
    } else {
      this.lockedCategory = null;
      this.tabsContainer.style.display = '';
      this.titleEl.textContent = 'Shop';
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

    if (this.currentTab === 'decorations') this.renderDecorations();
    else if (this.currentTab === 'emotes') this.renderEmotes();
    else if (this.currentTab === 'upgrades') this.renderUpgrades();
    else if (this.currentTab === 'achievements') this.renderAchievements();
  }

  // ── Decorations ──────────────────────────────────────────────

  renderDecorations() {
    const available = DECORATIONS.filter(d => !d.requiresBlueprint || this.discoveredBlueprints.includes(d.id));
    const locked = DECORATIONS.filter(d => d.requiresBlueprint && !this.discoveredBlueprints.includes(d.id));

    if (available.length > 0) {
      this.addSectionHeader('Available', `${available.length} items`);
      for (const dec of available) {
        this.addDecorationItem(dec);
      }
    }

    if (locked.length > 0) {
      this.addSectionHeader('Blueprint Required', `Find blueprints underground`);
      for (const dec of locked) {
        this.addLockedDecorationItem(dec);
      }
    }
  }

  addDecorationItem(dec) {
    const canAfford = this.checkAfford(dec.cost);
    const el = document.createElement('div');
    el.className = 'shop-item' + (canAfford ? ' shop-item--buyable' : ' shop-item--unaffordable');

    el.innerHTML = `
      <div class="shop-item-icon" style="background:${escapeHtml(dec.color)}"></div>
      <div class="shop-item-info">
        <div class="shop-item-name">${escapeHtml(dec.name)}</div>
        <div class="shop-item-effect">${escapeHtml(dec.desc || '')}</div>
        ${dec.generates ? `<div class="shop-item-tag tag-passive">Generates ${escapeHtml(dec.generates.resource)}</div>` : ''}
        <div class="shop-item-cost">${this.formatCost(dec.cost)}</div>
      </div>
      <button class="shop-item-buy" ${canAfford ? '' : 'disabled'}>Place</button>
    `;
    el.querySelector('.shop-item-buy').addEventListener('click', () => {
      if (this.onBuyDecoration) this.onBuyDecoration(dec.id);
    });
    this.itemsContainer.appendChild(el);
  }

  addLockedDecorationItem(dec) {
    const el = document.createElement('div');
    el.className = 'shop-item shop-item--locked';
    el.innerHTML = `
      <div class="shop-item-icon shop-item-icon--locked">🔒</div>
      <div class="shop-item-info">
        <div class="shop-item-name shop-item-name--locked">???</div>
        <div class="shop-item-effect shop-item-effect--locked">Find the blueprint underground!</div>
      </div>
    `;
    this.itemsContainer.appendChild(el);
  }

  // ── Emotes ───────────────────────────────────────────────────

  renderEmotes() {
    const owned = EMOTES.filter(e => this.unlockedEmotes.includes(e.id));
    const buyable = EMOTES.filter(e => !this.unlockedEmotes.includes(e.id) && e.cost);
    const free = EMOTES.filter(e => !this.unlockedEmotes.includes(e.id) && !e.cost);

    if (buyable.length > 0 || free.length > 0) {
      this.addSectionHeader('Available', `${buyable.length + free.length} to unlock`);
      for (const emote of [...free, ...buyable]) {
        this.addEmoteItem(emote, false);
      }
    }

    if (owned.length > 0) {
      this.addSectionHeader('Owned', `${owned.length} unlocked`);
      for (const emote of owned) {
        this.addEmoteItem(emote, true);
      }
    }
  }

  addEmoteItem(emote, owned) {
    const canAfford = emote.cost ? this.checkAfford(emote.cost) : false;
    const el = document.createElement('div');

    let stateClass = 'shop-item--owned';
    if (!owned && emote.cost) stateClass = canAfford ? 'shop-item--buyable' : 'shop-item--unaffordable';
    else if (!owned && !emote.cost) stateClass = 'shop-item--locked'; // free but breed-locked

    el.className = 'shop-item ' + stateClass;

    let btnHtml;
    if (owned) {
      btnHtml = `<div class="shop-item-owned-badge">✓</div>`;
    } else if (!emote.cost) {
      btnHtml = `<div class="shop-item-owned-badge" style="color:var(--text-dim)">—</div>`;
    } else {
      btnHtml = `<button class="shop-item-buy" ${canAfford ? '' : 'disabled'}>Buy</button>`;
    }

    el.innerHTML = `
      <div class="shop-item-icon" style="background:rgba(255,255,255,0.08);font-size:22px">${escapeHtml(emote.symbol)}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${escapeHtml(emote.name)}</div>
        ${emote.buffDesc ? `<div class="shop-item-effect">${escapeHtml(emote.buffDesc)}</div>` : ''}
        <div class="shop-item-meta">
          ${emote.duration ? `<span class="shop-item-tag tag-duration">${escapeHtml(String(emote.duration))}s</span>` : ''}
          ${emote.cooldown ? `<span class="shop-item-tag tag-cooldown">${escapeHtml(String(emote.cooldown))}s cd</span>` : ''}
        </div>
        ${!owned ? `<div class="shop-item-cost">${emote.cost ? this.formatCost(emote.cost) : 'Free (breed-specific)'}</div>` : ''}
      </div>
      ${btnHtml}
    `;

    if (!owned && emote.cost) {
      el.querySelector('.shop-item-buy').addEventListener('click', () => {
        if (this.onBuyEmote) this.onBuyEmote(emote.id);
      });
    }
    this.itemsContainer.appendChild(el);
  }

  // ── Upgrades ─────────────────────────────────────────────────

  renderUpgrades() {
    // Group upgrades by category and render as visual chains
    const categories = [...new Set(UPGRADES.map(u => u.category))];

    for (const cat of categories) {
      const catInfo = UPGRADE_CATEGORIES[cat] || { name: cat, desc: '', icon: '⚙️' };
      const catUpgrades = UPGRADES.filter(u => u.category === cat);

      // Build the chain: sort by dependency (root first)
      const chain = this.buildChain(catUpgrades);

      this.addUpgradeCategoryHeader(catInfo, chain);

      for (let i = 0; i < chain.length; i++) {
        const upgrade = chain[i];
        const isLast = i === chain.length - 1;
        this.addUpgradeItem(upgrade, i, isLast);
      }
    }

    // Prestige section
    this.addPrestigeSection();
  }

  buildChain(catUpgrades) {
    // Sort so that root (no requires) comes first, then followers
    const result = [];
    const remaining = [...catUpgrades];

    // Find root (no requires or requires outside this category)
    const catIds = new Set(catUpgrades.map(u => u.id));
    let next = remaining.find(u => u.requires == null || !catIds.has(u.requires));
    while (next) {
      result.push(next);
      remaining.splice(remaining.indexOf(next), 1);
      next = remaining.find(u => u.requires === result[result.length - 1].id);
    }
    // Add any that didn't chain (shouldn't happen with good data)
    result.push(...remaining);
    return result;
  }

  addUpgradeCategoryHeader(catInfo, chain) {
    const ownedCount = chain.filter(u => this.ownedUpgrades.includes(u.id)).length;
    const el = document.createElement('div');
    el.className = 'shop-upgrade-header';
    el.innerHTML = `
      <div class="shop-upgrade-header-icon">${escapeHtml(catInfo.icon)}</div>
      <div class="shop-upgrade-header-info">
        <div class="shop-upgrade-header-name">${escapeHtml(catInfo.name)}</div>
        <div class="shop-upgrade-header-desc">${escapeHtml(catInfo.desc)}</div>
      </div>
      <div class="shop-upgrade-header-progress">
        <div class="shop-upgrade-pips">
          ${chain.map((u, i) => `<div class="shop-upgrade-pip ${this.ownedUpgrades.includes(u.id) ? 'pip-filled' : ''}"></div>`).join('')}
        </div>
        <div class="shop-upgrade-header-count">${ownedCount}/${chain.length}</div>
      </div>
    `;
    this.itemsContainer.appendChild(el);
  }

  addUpgradeItem(upgrade, chainIndex, isLast) {
    const owned = this.ownedUpgrades.includes(upgrade.id);
    const canAfford = this.checkAfford(upgrade.cost);
    const locked = upgrade.requires != null && !this.ownedUpgrades.includes(upgrade.requires);
    const prereq = locked ? UPGRADES.find(u => u.id === upgrade.requires) : null;

    let stateClass;
    if (owned) stateClass = 'shop-item--owned';
    else if (locked) stateClass = 'shop-item--locked';
    else if (canAfford) stateClass = 'shop-item--buyable';
    else stateClass = 'shop-item--unaffordable';

    const el = document.createElement('div');
    el.className = `shop-item shop-item--upgrade ${stateClass}`;

    // Chain connector
    const connector = isLast ? 'chain-end' : 'chain-mid';

    let btnHtml;
    if (owned) {
      btnHtml = `<div class="shop-item-owned-badge">✓</div>`;
    } else if (locked) {
      btnHtml = `<div class="shop-item-lock-badge">🔒</div>`;
    } else {
      btnHtml = `<button class="shop-item-buy" ${canAfford ? '' : 'disabled'}>Buy</button>`;
    }

    let costHtml;
    if (locked) {
      costHtml = `<div class="shop-item-requires">Requires <strong>${escapeHtml(prereq.name)}</strong></div>`;
    } else if (!owned) {
      costHtml = `<div class="shop-item-cost">${this.formatCost(upgrade.cost)}</div>`;
    } else {
      costHtml = '';
    }

    el.innerHTML = `
      <div class="shop-chain-line ${connector}"></div>
      <div class="shop-item-icon" style="background:rgba(255,255,255,0.08);font-size:20px">${escapeHtml(upgrade.icon)}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${escapeHtml(upgrade.name)}</div>
        <div class="shop-item-effect">${escapeHtml(upgrade.desc)}</div>
        ${costHtml}
      </div>
      ${btnHtml}
    `;

    if (!owned && !locked) {
      el.querySelector('.shop-item-buy').addEventListener('click', () => {
        if (this.onBuyUpgrade) this.onBuyUpgrade(upgrade.id);
      });
    }
    this.itemsContainer.appendChild(el);
  }

  addPrestigeSection() {
    const pLevel = this.prestigeLevel;
    const pBonus = pLevel * 8;
    const nextBonus = (pLevel + 1) * 8;
    const allOwned = this.ownedUpgrades.length >= UPGRADES.length;

    const el = document.createElement('div');
    el.className = 'shop-prestige';

    el.innerHTML = `
      <div class="shop-prestige-header">
        <span class="shop-prestige-icon">🔄</span>
        <span class="shop-prestige-title">Prestige${pLevel > 0 ? ` Level ${escapeHtml(String(pLevel))}` : ''}</span>
        ${pLevel > 0 ? `<span class="shop-prestige-bonus">+${escapeHtml(String(pBonus))}% all stats</span>` : ''}
      </div>
      <div class="shop-prestige-body">
        <p>Reset world, resources &amp; upgrades. Keep blueprints.</p>
        <p class="shop-prestige-reward">Next level: <strong>+${escapeHtml(String(nextBonus))}% all stats</strong> permanently</p>
        ${!allOwned ? '<p class="shop-prestige-lock">Buy all upgrades to unlock prestige</p>' : ''}
      </div>
      <button class="shop-prestige-btn" ${allOwned ? '' : 'disabled'}>${allOwned ? 'Prestige!' : `${this.ownedUpgrades.length}/${UPGRADES.length} upgrades`}</button>
    `;

    if (allOwned) {
      el.querySelector('.shop-prestige-btn').addEventListener('click', () => {
        if (this.onPrestige) {
          this.onPrestige();
          this.hide();
        }
      });
    }
    this.itemsContainer.appendChild(el);
  }

  // ── Achievements ─────────────────────────────────────────────

  renderAchievements() {
    const categories = ['exploration', 'collection', 'progression', 'prestige', 'survival'];
    const categoryNames = {
      exploration: '🗺️ Exploration',
      collection: '💰 Collection',
      progression: '📈 Progression',
      prestige: '⚡ Prestige',
      survival: '💀 Survival',
    };

    const totalUnlocked = ACHIEVEMENTS.filter(a => this.achievements.has(a.id)).length;
    this.addSectionHeader('Achievements', `${totalUnlocked} / ${ACHIEVEMENTS.length} unlocked`);

    for (const cat of categories) {
      const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
      if (catAchievements.length === 0) continue;

      const catUnlocked = catAchievements.filter(a => this.achievements.has(a.id)).length;
      const header = document.createElement('div');
      header.className = 'shop-ach-category';
      header.innerHTML = `
        <span class="shop-ach-category-name">${escapeHtml(categoryNames[cat] || cat)}</span>
        <span class="shop-ach-category-count">${catUnlocked}/${catAchievements.length}</span>
      `;
      this.itemsContainer.appendChild(header);

      for (const ach of catAchievements) {
        const unlocked = this.achievements.has(ach.id);
        const el = document.createElement('div');
        el.className = 'shop-ach-item' + (unlocked ? ' shop-ach-item--unlocked' : '');

        // For collection achievements, show progress
        let progressHtml = '';
        if (ach.category === 'collection' && !unlocked) {
          const prog = this.getAchievementProgress(ach.id);
          if (prog) {
            const pct = Math.min(100, (prog.current / prog.target) * 100);
            progressHtml = `
              <div class="shop-ach-progress">
                <div class="shop-ach-progress-bar" style="width:${pct}%"></div>
                <span class="shop-ach-progress-text">${prog.current}/${prog.target}</span>
              </div>
            `;
          }
        }

        el.innerHTML = `
          <div class="shop-ach-icon">${unlocked ? escapeHtml(ach.icon) : '?'}</div>
          <div class="shop-ach-info">
            <div class="shop-ach-name">${escapeHtml(ach.name)}</div>
            <div class="shop-ach-desc">${escapeHtml(ach.desc)}</div>
            ${progressHtml}
          </div>
          <div class="shop-ach-check">${unlocked ? '✓' : ''}</div>
        `;
        this.itemsContainer.appendChild(el);
      }
    }

    // Stats footer
    const s = this.stats;
    const statsEl = document.createElement('div');
    statsEl.className = 'shop-stats';
    statsEl.innerHTML = `
      <div class="shop-stats-title">Session Stats</div>
      <div class="shop-stats-grid">
        <div class="shop-stats-item"><span class="shop-stats-value">${escapeHtml(String(s.maxDepth || 0))}m</span><span class="shop-stats-label">Max Depth</span></div>
        <div class="shop-stats-item"><span class="shop-stats-value">${escapeHtml(String(s.tilesDigged || 0))}</span><span class="shop-stats-label">Tiles Dug</span></div>
        <div class="shop-stats-item"><span class="shop-stats-value">${escapeHtml(String(this.prestigeLevel))}</span><span class="shop-stats-label">Prestige</span></div>
        <div class="shop-stats-item"><span class="shop-stats-value">${totalUnlocked}</span><span class="shop-stats-label">Achievements</span></div>
      </div>
    `;
    this.itemsContainer.appendChild(statsEl);
  }

  getAchievementProgress(id) {
    const s = this.stats;
    const map = {
      collect_100_bones: { current: s.totalBones || 0, target: 100 },
      collect_50_gems: { current: s.totalGems || 0, target: 50 },
      collect_25_gold: { current: s.totalGold || 0, target: 25 },
      collect_10_diamonds: { current: s.totalDiamonds || 0, target: 10 },
      collect_5_artifacts: { current: s.totalArtifacts || 0, target: 5 },
    };
    return map[id] || null;
  }

  // ── Shared helpers ───────────────────────────────────────────

  addSectionHeader(title, subtitle) {
    const el = document.createElement('div');
    el.className = 'shop-section-header';
    el.innerHTML = `
      <span class="shop-section-title">${escapeHtml(title)}</span>
      <span class="shop-section-subtitle">${escapeHtml(subtitle)}</span>
    `;
    this.itemsContainer.appendChild(el);
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
        const icon = RESOURCE_ICONS[key] || '';
        const affordable = have >= amount;
        return `<span class="cost-chip ${affordable ? 'cost-chip--ok' : 'cost-chip--short'}">${icon}<span class="cost-chip-amount">${escapeHtml(String(amount))}</span></span>`;
      })
      .join('');
  }
}
