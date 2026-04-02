export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
  }

  // Floating text for resource pickups
  emitText(x, y, text, color) {
    this.floatingTexts.push({
      x, y,
      text,
      color: color || '#FFD700',
      life: 40,
      maxLife: 40,
    });
  }

  // Emit dig dust particles
  emitDig(x, y, color) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        life: 20 + Math.random() * 15,
        maxLife: 35,
        size: 2 + Math.random() * 2,
        color: color || '#8D6E63',
      });
    }
  }

  // Emit sparkle for resource collection
  emitSparkle(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (1 + Math.random() * 2),
        vy: Math.sin(angle) * (1 + Math.random() * 2),
        life: 25 + Math.random() * 10,
        maxLife: 35,
        size: 2 + Math.random() * 2,
        color: color || '#FFD700',
      });
    }
  }

  // Emit landing dust
  emitLand(x, y) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 0.5,
        life: 10 + Math.random() * 10,
        maxLife: 20,
        size: 2 + Math.random(),
        color: '#A0A0A0',
      });
    }
  }

  // Emit wall slide dust (small, subtle)
  emitWallSlide(x, y, side) {
    this.particles.push({
      x,
      y,
      vx: -side * (0.5 + Math.random() * 0.5),
      vy: -Math.random() * 0.3,
      life: 8 + Math.random() * 6,
      maxLife: 14,
      size: 1 + Math.random(),
      color: '#9E9E9E',
    });
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 0.5;
      ft.life--;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render(ctx, camera) {
    for (const p of this.particles) {
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
    // Floating text
    for (const ft of this.floatingTexts) {
      const sx = ft.x - camera.x;
      const sy = ft.y - camera.y;
      const alpha = Math.min(1, ft.life / (ft.maxLife * 0.3));
      ctx.globalAlpha = alpha;
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(ft.text, sx + 1, sy + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }
}
