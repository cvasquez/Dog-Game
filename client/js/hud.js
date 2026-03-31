export class HUD {
  constructor() {
    this.resourceBar = document.getElementById('resourceBar');
    this.depthMeter = document.getElementById('depthMeter');
    this.roomCodeEl = document.getElementById('roomCode');
    this.playerListEl = document.getElementById('playerList');
  }

  updateResources(resources) {
    const items = [
      { icon: '🦴', name: 'bones', value: resources.bones || 0 },
      { icon: '💎', name: 'gems', value: resources.gems || 0 },
      { icon: '🦕', name: 'fossils', value: resources.fossils || 0 },
      { icon: '🥇', name: 'gold', value: resources.gold || 0 },
      { icon: '💠', name: 'diamonds', value: resources.diamonds || 0 },
      { icon: '🏺', name: 'artifacts', value: resources.artifacts || 0 },
    ];

    this.resourceBar.innerHTML = items
      .filter(i => i.value > 0)
      .map(i => `<span class="resource-item">${i.icon} ${i.value}</span>`)
      .join('');

    // Always show bones even if 0
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

  updatePlayerList(players) {
    const entries = [];
    for (const [, p] of players) {
      const marker = p.isLocal ? '→ ' : '  ';
      entries.push(`<div class="player-entry">${marker}${p.name}</div>`);
    }
    this.playerListEl.innerHTML = entries.join('');
  }
}
