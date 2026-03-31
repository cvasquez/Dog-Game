import { EMOTES } from '../../shared/constants.js';

export class EmoteWheel {
  constructor() {
    this.canvas = document.getElementById('emoteWheel');
    this.ctx = this.canvas.getContext('2d');
    this.visible = false;
    this.centerX = 0;
    this.centerY = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.unlockedEmotes = [];
    this.selectedIndex = -1;
    this.radius = 80;
  }

  show(unlockedEmotes, mouseX, mouseY) {
    this.unlockedEmotes = unlockedEmotes;
    if (!this.visible) {
      this.centerX = mouseX;
      this.centerY = mouseY;
    }
    this.mouseX = mouseX;
    this.mouseY = mouseY;
    this.visible = true;
    this.canvas.style.display = 'block';

    // Position and size the canvas
    const size = this.radius * 2 + 40;
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.left = (this.centerX - size / 2) + 'px';
    this.canvas.style.top = (this.centerY - size / 2) + 'px';

    this.updateSelection();
  }

  hide() {
    this.visible = false;
    this.canvas.style.display = 'none';
  }

  updateSelection() {
    const dx = this.mouseX - this.centerX;
    const dy = this.mouseY - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 20) {
      this.selectedIndex = -1;
      return;
    }

    const angle = Math.atan2(dy, dx);
    const n = this.unlockedEmotes.length;
    if (n === 0) { this.selectedIndex = -1; return; }

    const sliceAngle = (Math.PI * 2) / n;
    let idx = Math.floor((angle + Math.PI + sliceAngle / 2) / sliceAngle) % n;
    this.selectedIndex = idx;
  }

  getSelected() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.unlockedEmotes.length) {
      return this.unlockedEmotes[this.selectedIndex];
    }
    return null;
  }

  render() {
    if (!this.visible) return;

    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const n = this.unlockedEmotes.length;
    if (n === 0) return;

    this.updateSelection();

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const sliceAngle = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const emoteId = this.unlockedEmotes[i];
      const emote = EMOTES[emoteId];
      if (!emote) continue;

      const startAngle = -Math.PI + sliceAngle * i;
      const endAngle = startAngle + sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, this.radius, startAngle, endAngle);
      ctx.closePath();

      const isSelected = i === this.selectedIndex;
      ctx.fillStyle = isSelected ? 'rgba(79, 195, 247, 0.4)' : 'rgba(0, 0, 0, 0.6)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw emote icon
      const iconDist = this.radius * 0.6;
      const ix = cx + Math.cos(midAngle) * iconDist;
      const iy = cy + Math.sin(midAngle) * iconDist;

      ctx.fillStyle = '#FFF';
      ctx.font = isSelected ? 'bold 20px sans-serif' : '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emote.symbol, ix, iy);

      // Label for selected
      if (isSelected) {
        ctx.fillStyle = '#FFF';
        ctx.font = '11px sans-serif';
        ctx.fillText(emote.name, cx, cy);
      }
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();
  }
}
