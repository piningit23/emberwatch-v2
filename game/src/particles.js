// Glimmerhold — particles, shockwaves and floating text. One job: juice.
export class Particles {
  constructor() {
    this.list = [];
    this.texts = [];
    this.rings = [];
  }

  burst(x, y, color, n, speed, life = 0.6, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.list.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: life * (0.6 + Math.random() * 0.7), maxLife: life,
        size: size * (0.6 + Math.random() * 0.8), color,
        drag: 0.92, grav: 0,
      });
    }
  }

  emberDrift(x, y, color) {
    this.list.push({
      x, y, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 22,
      life: 1.2 + Math.random(), maxLife: 1.6, size: 1.5 + Math.random() * 1.5,
      color, drag: 0.995, grav: 0, flicker: true,
    });
  }

  ring(x, y, color, maxR = 90) {
    this.rings.push({ x, y, r: 6, maxR, color, life: 0.45, maxLife: 0.45 });
  }

  text(x, y, str, color = '#fff', size = 15) {
    this.texts.push({ x, y, str, color, size, life: 0.9, maxLife: 0.9 });
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.vy += p.grav * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 34 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.r = 6 + (1 - r.life / r.maxLife) * (r.maxR - 6);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = p.flicker ? a * (0.6 + Math.random() * 0.4) : a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * a + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `bold ${t.size}px Georgia, serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
