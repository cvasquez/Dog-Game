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
    this.cooldowns = {};
    this.selectedIndex = -1;
    this.radius = 80;
  }

  show(unlockedEmotes, mouseX, mouseY, cooldowns) {
    this.unlockedEmotes = unlockedEmotes;
    this.cooldowns = cooldowns || {};
    if (!this.visible) {
      this.centerX = mouseX;
      this.centerY = mouseY;
    }
    this.mouseX = mouseX;
    this.mouseY = mouseY;
    this.visible = true;
    this.canvas.style.display = 'block';

    // Size the canvas with padding for labels
    const pad = 40;
    const size = this.radius * 2 + pad;
    this.canvas.width = size;
    this.canvas.height = size;

    // Clamp position so the wheel stays fully on screen
    const half = size / 2;
    const clampedX = Math.max(half, Math.min(window.innerWidth - half, this.centerX));
    const clampedY = Math.max(half, Math.min(window.innerHeight - half, this.centerY));
    this.canvas.style.left = (clampedX - half) + 'px';
    this.canvas.style.top = (clampedY - half) + 'px';

    // Offset center for selection math if clamped
    this._drawOffsetX = clampedX - this.centerX;
    this._drawOffsetY = clampedY - this.centerY;

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

    if (dist < 15) {
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
      const isSelected = i === this.selectedIndex;
      const onCooldown = !!(this.cooldowns[emoteId]);
      const cdRemaining = this.cooldowns[emoteId] || 0;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, this.radius, startAngle, endAngle);
      ctx.closePath();

      if (onCooldown) {
        ctx.fillStyle = 'rgba(60, 30, 30, 0.7)';
      } else if (isSelected) {
        ctx.fillStyle = 'rgba(79, 195, 247, 0.4)';
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw cooldown sweep overlay
      if (onCooldown) {
        const cdTotal = Math.round((emote.cooldown || 30) * 60);
        const cdFrac = cdRemaining / cdTotal;
        const sweepEnd = startAngle + sliceAngle * cdFrac;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, this.radius, startAngle, sweepEnd);
        ctx.closePath();
        ctx.fillStyle = 'rgba(200, 50, 50, 0.3)';
        ctx.fill();
      }

      // Draw emote icon
      const iconDist = this.radius * 0.6;
      const ix = cx + Math.cos(midAngle) * iconDist;
      const iy = cy + Math.sin(midAngle) * iconDist;

      ctx.fillStyle = onCooldown ? '#888' : '#FFF';
      ctx.font = isSelected ? 'bold 20px sans-serif' : '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emote.symbol, ix, iy);

      // Cooldown seconds text below icon
      if (onCooldown) {
        const secs = Math.ceil(cdRemaining / 60);
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(secs + 's', ix, iy + 12);
      }
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Show selected emote info in center
    if (this.selectedIndex >= 0 && this.selectedIndex < n) {
      const emoteId = this.unlockedEmotes[this.selectedIndex];
      const selEmote = EMOTES[emoteId];
      const onCooldown = !!(this.cooldowns[emoteId]);
      if (selEmote) {
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(selEmote.name, cx, cy - 5);
        if (selEmote.buffDesc) {
          ctx.fillStyle = onCooldown ? '#FF6B6B' : '#4FC3F7';
          ctx.font = '7px sans-serif';
          const label = onCooldown ? 'CD ' + Math.ceil((this.cooldowns[emoteId] || 0) / 60) + 's' : selEmote.buffDesc;
          ctx.fillText(label, cx, cy + 5);
        }
      }
    }
  }
}
