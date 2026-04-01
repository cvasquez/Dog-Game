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
    this.radius = 130;
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

    const innerR = 30;

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

      // Draw slice (ring shape with inner cutout)
      ctx.beginPath();
      ctx.arc(cx, cy, this.radius, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();

      if (onCooldown) {
        ctx.fillStyle = 'rgba(60, 30, 30, 0.7)';
      } else if (isSelected) {
        ctx.fillStyle = 'rgba(79, 195, 247, 0.35)';
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw cooldown sweep overlay
      if (onCooldown) {
        const cdTotal = Math.round((emote.cooldown || 30) * 60);
        const cdFrac = cdRemaining / cdTotal;
        const sweepEnd = startAngle + sliceAngle * cdFrac;
        ctx.beginPath();
        ctx.arc(cx, cy, this.radius, startAngle, sweepEnd);
        ctx.arc(cx, cy, innerR, sweepEnd, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(200, 50, 50, 0.3)';
        ctx.fill();
      }

      // --- Draw text along the slice ---
      // Position emote symbol toward inner part of the ring
      const symbolDist = innerR + (this.radius - innerR) * 0.32;
      const sx = cx + Math.cos(midAngle) * symbolDist;
      const sy = cy + Math.sin(midAngle) * symbolDist;

      ctx.save();
      ctx.fillStyle = onCooldown ? '#888' : '#FFF';
      ctx.font = isSelected ? 'bold 22px sans-serif' : '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emote.symbol, sx, sy);
      ctx.restore();

      // Buff description text — rotated to follow the slice angle
      if (emote.buffDesc) {
        const textDist = innerR + (this.radius - innerR) * 0.68;
        const tx = cx + Math.cos(midAngle) * textDist;
        const ty = cy + Math.sin(midAngle) * textDist;

        ctx.save();
        ctx.translate(tx, ty);
        // Rotate text to follow the radial direction, keep it readable
        let textAngle = midAngle;
        // Flip text that would render upside-down
        if (midAngle > Math.PI / 2 || midAngle < -Math.PI / 2) {
          textAngle += Math.PI;
        }
        ctx.rotate(textAngle);

        const fontSize = isSelected ? 10 : 9;
        ctx.font = (isSelected ? 'bold ' : '') + fontSize + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (onCooldown) {
          const secs = Math.ceil(cdRemaining / 60);
          ctx.fillStyle = '#FF6B6B';
          ctx.fillText('CD ' + secs + 's', 0, 0);
        } else {
          ctx.fillStyle = isSelected ? '#4FC3F7' : 'rgba(200, 200, 200, 0.8)';
          ctx.fillText(emote.buffDesc, 0, 0);
        }
        ctx.restore();
      }
    }

    // Center circle with selected emote name
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Show selected emote name in center
    if (this.selectedIndex >= 0 && this.selectedIndex < n) {
      const selEmote = EMOTES[this.unlockedEmotes[this.selectedIndex]];
      if (selEmote) {
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(selEmote.name, cx, cy);
      }
    }
  }
}
