// Glimmerhold — all drawing: the glade, entities, HUD and every screen.
// One job: what the player sees.
import { VIEW, ARENA, COLORS, TOTAL_WAVES } from './config.js';
import { UPGRADES } from './upgrades.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * VIEW.w, y: Math.random() * VIEW.h,
        r: 0.5 + Math.random() * 1.4, tw: Math.random() * Math.PI * 2,
      });
    }
    this.trees = [];
    for (let i = 0; i < 26; i++) {
      this.trees.push({
        x: 30 + Math.random() * (VIEW.w - 60),
        y: 100 + Math.random() * (VIEW.h - 130),
        s: 0.7 + Math.random() * 0.9,
      });
    }
  }

  draw(game, input, time) {
    const ctx = this.ctx;
    ctx.save();
    if (game.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }
    this.drawBackground(ctx, game, time);
    if (game.state !== 'title') {
      this.drawFlame(ctx, game, time);
      this.drawTraps(ctx, game);
      this.drawPickups(ctx, game, time);
      this.drawEnemies(ctx, game, time);
      this.drawBullets(ctx, game);
      this.drawPlayer(ctx, game, input, time);
      game.particles.draw(ctx);
      this.drawHUD(ctx, game);
    }
    ctx.restore();
    if (game.state === 'title') this.drawTitle(ctx, game, time);
    else if (game.state === 'upgrade') this.drawUpgrade(ctx, game);
    else if (game.state === 'paused') this.drawPaused(ctx, game);
    else if (game.state === 'victory') this.drawEnd(ctx, game, true);
    else if (game.state === 'gameover') this.drawEnd(ctx, game, false);
    else if (game.banner) this.drawBanner(ctx, game);
  }

  drawBackground(ctx, game, time) {
    // Night sky gradient.
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
    g.addColorStop(0, '#0a0e1a');
    g.addColorStop(0.55, '#101830');
    g.addColorStop(1, '#0c1226');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // Stars.
    for (const s of this.stars) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 1.3 + s.tw);
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Moon.
    const mg = ctx.createRadialGradient(1120, 70, 8, 1120, 70, 90);
    mg.addColorStop(0, 'rgba(255,244,200,0.9)');
    mg.addColorStop(0.25, 'rgba(255,244,200,0.25)');
    mg.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(1010, -40, 220, 220);
    ctx.fillStyle = '#fff4c8';
    ctx.beginPath(); ctx.arc(1120, 70, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d9a0';
    ctx.beginPath(); ctx.arc(1112, 64, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1130, 78, 4, 0, Math.PI * 2); ctx.fill();
    // Ground.
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, ARENA.y - 14, VIEW.w, VIEW.h - ARENA.y + 14);
    // Grass tufts / stones.
    ctx.fillStyle = 'rgba(94,230,168,0.10)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 137.5) % VIEW.w, y = ARENA.y + ((i * 89.3) % (VIEW.h - ARENA.y));
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Trees (dark silhouettes outside the play line, drawn faintly behind).
    for (const t of this.trees) {
      if (t.x > ARENA.x - 10 && t.x < ARENA.x + ARENA.w + 10 && t.y > ARENA.y - 10 && t.y < ARENA.y + ARENA.h + 10) continue;
      ctx.fillStyle = 'rgba(16,32,24,0.9)';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 18 * t.s, 16 * t.s, 0, Math.PI * 2);
      ctx.arc(t.x - 10 * t.s, t.y - 6 * t.s, 11 * t.s, 0, Math.PI * 2);
      ctx.arc(t.x + 10 * t.s, t.y - 6 * t.s, 11 * t.s, 0, Math.PI * 2);
      ctx.fill();
    }
    // Arena wall.
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    ctx.strokeStyle = 'rgba(42,58,95,0.5)';
    ctx.lineWidth = 8;
    ctx.strokeRect(ARENA.x - 5, ARENA.y - 5, ARENA.w + 10, ARENA.h + 10);
    // Darkness vignette + light around flame and player.
    const fx = game.flamePos.x, fy = game.flamePos.y;
    const glow = ctx.createRadialGradient(fx, fy, 20, fx, fy, 260);
    glow.addColorStop(0, 'rgba(255,159,28,0.14)');
    glow.addColorStop(1, 'rgba(255,159,28,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(fx - 260, fy - 260, 520, 520);
    if (game.state !== 'title') {
      const p = game.player;
      const pg = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 190);
      pg.addColorStop(0, 'rgba(255,215,102,0.13)');
      pg.addColorStop(1, 'rgba(255,215,102,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(p.x - 190, p.y - 190, 380, 380);
    }
  }

  drawFlame(ctx, game, time) {
    const f = game.flamePos;
    const level = game.flame / game.stats.maxFlame;
    const flick = 1 + Math.sin(time * 9) * 0.06 + Math.sin(time * 23) * 0.04;
    // Brazier.
    ctx.fillStyle = '#3a2c1a';
    ctx.beginPath(); ctx.arc(f.x, f.y + 10, 30, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#241a10';
    ctx.fillRect(f.x - 4, f.y + 10, 8, 18);
    ctx.fillStyle = '#5a4630';
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 10, 32, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Flame glow.
    const glowR = 60 + level * 70;
    const g = ctx.createRadialGradient(f.x, f.y - 6, 4, f.x, f.y - 6, glowR);
    g.addColorStop(0, 'rgba(255,200,80,0.55)');
    g.addColorStop(0.5, 'rgba(255,140,30,0.22)');
    g.addColorStop(1, 'rgba(255,140,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y - 6, glowR, 0, Math.PI * 2); ctx.fill();
    // Flame body: layered teardrops.
    const h = (26 + level * 34) * flick;
    ctx.fillStyle = '#ff6b1a';
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - 8 - h);
    ctx.bezierCurveTo(f.x + 14, f.y - h * 0.4, f.x + 12, f.y + 6, f.x, f.y + 6);
    ctx.bezierCurveTo(f.x - 12, f.y + 6, f.x - 14, f.y - h * 0.4, f.x, f.y - 8 - h);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - 4 - h * 0.55);
    ctx.bezierCurveTo(f.x + 7, f.y - h * 0.2, f.x + 6, f.y + 4, f.x, f.y + 4);
    ctx.bezierCurveTo(f.x - 6, f.y + 4, f.x - 7, f.y - h * 0.2, f.x, f.y - 4 - h * 0.55);
    ctx.fill();
    // Flame level ring.
    ctx.strokeStyle = level < 0.25 ? '#ff5d5d' : 'rgba(255,209,102,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(f.x, f.y + 10, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * level); ctx.stroke();
  }

  drawTraps(ctx, game) {
    for (const t of game.traps) {
      ctx.save();
      ctx.globalAlpha = t.arm > 0 ? 0.45 : 0.95;
      ctx.strokeStyle = '#e07be0';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e07be0';
      ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.moveTo(t.x + Math.cos(a) * 8, t.y + Math.sin(a) * 8);
        ctx.lineTo(t.x + Math.cos(a) * 14, t.y + Math.sin(a) * 14);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPickups(ctx, game, time) {
    for (const pk of game.pickups) {
      const bob = Math.sin(time * 5 + pk.x) * 2;
      const blink = pk.life < 3 ? (Math.sin(time * 12) > 0 ? 1 : 0.25) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      if (pk.kind === 'shard') {
        ctx.fillStyle = '#7dfcd6';
        ctx.shadowColor = '#2fd6a3'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(pk.x, pk.y - 8 + bob);
        ctx.lineTo(pk.x + 5, pk.y + bob);
        ctx.lineTo(pk.x, pk.y + 8 + bob);
        ctx.lineTo(pk.x - 5, pk.y + bob);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = '#c77dff';
        ctx.shadowColor = '#9d4edd'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawEnemies(ctx, game, time) {
    for (const e of game.enemies) {
      ctx.save();
      const spawning = e.spawnT > 0;
      ctx.globalAlpha = spawning ? 0.35 + 0.3 * Math.sin(time * 20) : (e.type === 'phantom' ? 0.75 : 1);
      // Glow.
      const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.radius + 18);
      g.addColorStop(0, e.glow + '55');
      g.addColorStop(1, e.glow + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 18, 0, Math.PI * 2); ctx.fill();
      // Body by kind.
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
      ctx.strokeStyle = e.elite ? '#ffd166' : 'rgba(0,0,0,0.35)';
      ctx.lineWidth = e.elite ? 3 : 1.5;
      if (e.type === 'wisp') {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - e.radius);
        ctx.quadraticCurveTo(e.x + e.radius, e.y, e.x, e.y + e.radius);
        ctx.quadraticCurveTo(e.x - e.radius, e.y, e.x, e.y - e.radius);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(e.x - 3, e.y - 2, 2, 0, Math.PI * 2); ctx.arc(e.x + 3, e.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'crawler') {
        const wob = Math.sin(time * 8 + e.wobble) * 2;
        ctx.beginPath(); ctx.arc(e.x, e.y + wob, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a1030';
        ctx.beginPath(); ctx.arc(e.x - 5, e.y - 3 + wob, 2.5, 0, Math.PI * 2); ctx.arc(e.x + 5, e.y - 3 + wob, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(e.x - 6, e.y + 6 + wob); ctx.lineTo(e.x + 6, e.y + 6 + wob); ctx.stroke();
      } else if (e.type === 'splitter' || e.type === 'mote') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + time * 0.8;
          const px = e.x + Math.cos(a) * e.radius, py = e.y + Math.sin(a) * e.radius;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0c2b1a';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 0.35, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'brute') {
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3d0a0a';
        ctx.beginPath(); ctx.arc(e.x - 8, e.y - 6, 4, 0, Math.PI * 2); ctx.arc(e.x + 8, e.y - 6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb703';
        ctx.beginPath(); ctx.arc(e.x - 8, e.y - 6, 1.8, 0, Math.PI * 2); ctx.arc(e.x + 8, e.y - 6, 1.8, 0, Math.PI * 2); ctx.fill();
        // Horns.
        ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(e.x - 14, e.y - 16); ctx.lineTo(e.x - 22, e.y - 28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e.x + 14, e.y - 16); ctx.lineTo(e.x + 22, e.y - 28); ctx.stroke();
      } else if (e.type === 'spitter') {
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2b0a2e';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(e.x - 4, e.y - 3, 2, 0, Math.PI * 2); ctx.arc(e.x + 4, e.y - 3, 2, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'phantom') {
        ctx.beginPath();
        ctx.moveTo(e.x - e.radius, e.y + e.radius * 0.8);
        ctx.lineTo(e.x - e.radius, e.y - e.radius * 0.3);
        ctx.quadraticCurveTo(e.x, e.y - e.radius * 1.4, e.x + e.radius, e.y - e.radius * 0.3);
        ctx.lineTo(e.x + e.radius, e.y + e.radius * 0.8);
        ctx.lineTo(e.x + e.radius * 0.4, e.y + e.radius * 0.4);
        ctx.lineTo(e.x, e.y + e.radius * 0.9);
        ctx.lineTo(e.x - e.radius * 0.4, e.y + e.radius * 0.4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#101736';
        ctx.beginPath(); ctx.arc(e.x - 4, e.y - 2, 3, 0, Math.PI * 2); ctx.arc(e.x + 4, e.y - 2, 3, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'matriarch' || e.type === 'king') {
        // Boss: big crowned shade.
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = e.type === 'king' ? '#ffb703' : '#ff8fd1';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(e.x + i * 12 - 6, e.y - e.radius + 6);
          ctx.lineTo(e.x + i * 12, e.y - e.radius - 14);
          ctx.lineTo(e.x + i * 12 + 6, e.y - e.radius + 6);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#1a1030';
        ctx.beginPath(); ctx.arc(e.x - 11, e.y - 6, 5, 0, Math.PI * 2); ctx.arc(e.x + 11, e.y - 6, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = e.type === 'king' ? '#ff5d00' : '#fff';
        ctx.beginPath(); ctx.arc(e.x - 11, e.y - 6, 2.4, 0, Math.PI * 2); ctx.arc(e.x + 11, e.y - 6, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // HP bar for hurt / elite / boss enemies.
      if ((e.hp < e.maxHp || e.elite || e.kind === 'boss') && !spawning) {
        const w = e.kind === 'boss' ? 90 : e.radius * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
        ctx.fillStyle = e.elite ? '#ffd166' : '#ff5d5d';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
      }
      if (e.elite) {
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 11px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('ELITE', e.x, e.y - e.radius - 18);
      }
    }
    // Enemy projectiles.
    for (const b of game.enemyBullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawBullets(ctx, game) {
    for (const b of game.bullets) {
      ctx.fillStyle = b.wisp ? '#7dfcd6' : COLORS.bolt;
      ctx.shadowColor = b.wisp ? '#2fd6a3' : '#ffb703';
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.boltCore;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawPlayer(ctx, game, input, time) {
    const p = game.player;
    if (game.state === 'gameover') return;
    ctx.save();
    if (p.invuln > 0 && Math.sin(time * 30) > 0) ctx.globalAlpha = 0.45;
    // Dash trail glow.
    if (p.dashT > 0) {
      ctx.fillStyle = 'rgba(184,199,255,0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2); ctx.fill();
    }
    // Companion wisps orbit.
    for (let i = 0; i < game.stats.wisps; i++) {
      const a = p.wispAngle + i * 2.1;
      const wx = p.x + Math.cos(a) * 34, wy = p.y + Math.sin(a) * 34;
      ctx.fillStyle = '#7dfcd6';
      ctx.shadowColor = '#2fd6a3'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(wx, wy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Aim line (faint).
    ctx.strokeStyle = 'rgba(255,209,102,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aim) * 22, p.y + Math.sin(p.aim) * 22);
    ctx.lineTo(p.x + Math.cos(p.aim) * 46, p.y + Math.sin(p.aim) * 46);
    ctx.stroke();
    // Cloak body.
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.radius + 12);
    g.addColorStop(0, 'rgba(255,233,168,0.5)');
    g.addColorStop(1, 'rgba(255,233,168,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.hurtFlash > 0 ? '#ff8a8a' : '#3b4a7a';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - p.radius - 4);
    ctx.quadraticCurveTo(p.x + p.radius, p.y, p.x + p.radius * 0.8, p.y + p.radius);
    ctx.quadraticCurveTo(p.x, p.y + p.radius * 0.6, p.x - p.radius * 0.8, p.y + p.radius);
    ctx.quadraticCurveTo(p.x - p.radius, p.y, p.x, p.y - p.radius - 4);
    ctx.fill();
    // Hood + face.
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(p.x, p.y - 3, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a2340';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.aim) * 2.5, p.y - 3 + Math.sin(p.aim) * 2.5, 3.4, 0, Math.PI * 2); ctx.fill();
    // Lantern.
    const lx = p.x + Math.cos(p.aim) * 20, ly = p.y + Math.sin(p.aim) * 20;
    ctx.fillStyle = '#8a6d2f';
    ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffb703'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // Dash cooldown pip.
    if (p.dashCd > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(p.x, p.y + p.radius + 12, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c77dff';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.radius + 12);
      ctx.arc(p.x, p.y + p.radius + 12, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCd / game.stats.dashCooldown));
      ctx.closePath(); ctx.fill();
    }
  }

  drawHUD(ctx, game) {
    const p = game.player;
    ctx.save();
    ctx.textAlign = 'left';
    // Top bar.
    ctx.fillStyle = 'rgba(8,12,26,0.75)';
    ctx.fillRect(0, 0, VIEW.w, 62);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('GLIMMERHOLD', 20, 30);
    ctx.font = '14px Georgia, serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('Last Light of the Hollow', 20, 50);
    // Wave.
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText(`Wave ${Math.min(game.wave, TOTAL_WAVES)} / ${TOTAL_WAVES}`, VIEW.w / 2, 28);
    const remaining = game.spawnQueue.length + game.enemies.length;
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(game.waveActive ? `${remaining} shades remain` : 'Choose a blessing', VIEW.w / 2, 48);
    // Score + resources.
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText(`Score ${game.score.toLocaleString()}`, VIEW.w - 20, 28);
    ctx.font = '15px Georgia, serif';
    ctx.fillStyle = '#7dfcd6';
    ctx.fillText(`◆ ${game.shards} shards`, VIEW.w - 20, 50);
    ctx.fillStyle = '#c77dff';
    ctx.fillText(`✦ ${game.aether} aether`, VIEW.w - 150, 50);
    // Bottom-left: HP + flame bars.
    const bx = 20, by = VIEW.h - 56;
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`HP ${Math.ceil(p.hp)} / ${game.stats.maxHp}`, bx, by - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(ctx, bx, by, 220, 14, 7); ctx.fill();
    ctx.fillStyle = p.hp < 30 ? '#ff5d5d' : '#5ee6a8';
    rr(ctx, bx, by, 220 * Math.max(0, p.hp / game.stats.maxHp), 14, 7); ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Ember ${Math.ceil(game.flame)} / ${game.stats.maxFlame}`, bx, by + 32);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(ctx, bx, by + 38, 220, 14, 7); ctx.fill();
    const fl = Math.max(0, game.flame / game.stats.maxFlame);
    ctx.fillStyle = fl < 0.25 ? '#ff5d5d' : '#ff9f1c';
    rr(ctx, bx, by + 38, 220 * fl, 14, 7); ctx.fill();
    // Bottom-right: combo + traps + dash.
    ctx.textAlign = 'right';
    if (game.combo > 1) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 22px Georgia, serif';
      ctx.fillText(`COMBO x${game.comboMult}  (${game.combo})`, VIEW.w - 20, VIEW.h - 62);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(VIEW.w - 140, VIEW.h - 54, 120, 6);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(VIEW.w - 140, VIEW.h - 54, 120 * (game.comboTimer / game.stats.comboWindow), 6);
    }
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px Georgia, serif';
    ctx.fillText(`Traps ${game.traps.length}/${game.stats.trapSlots}  [E] 10 shards each`, VIEW.w - 20, VIEW.h - 34);
    ctx.fillText('Dash [Shift]   Pause [P]   Mute [M]', VIEW.w - 20, VIEW.h - 16);
    // Boss bar.
    const boss = game.enemies.find((e) => e.kind === 'boss');
    if (boss) {
      const bw = 420;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb703';
      ctx.font = 'bold 16px Georgia, serif';
      ctx.fillText(boss.type === 'king' ? 'THE HOLLOW KING' : 'THE HOLLOW MATRIARCH', VIEW.w / 2, 82);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      rr(ctx, VIEW.w / 2 - bw / 2, 90, bw, 12, 6); ctx.fill();
      ctx.fillStyle = '#ff5d5d';
      rr(ctx, VIEW.w / 2 - bw / 2, 90, bw * Math.max(0, boss.hp / boss.maxHp), 12, 6); ctx.fill();
    }
    ctx.restore();
  }

  drawBanner(ctx, game) {
    const b = game.banner;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.t);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.shadowColor = '#ffb703'; ctx.shadowBlur = 18;
    ctx.fillText(b.text, VIEW.w / 2, 300);
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = '18px Georgia, serif';
      ctx.fillText(b.sub, VIEW.w / 2, 332);
    }
    ctx.restore();
  }

  overlay(ctx) {
    ctx.fillStyle = 'rgba(6,9,20,0.72)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  drawTitle(ctx, game, time) {
    this.overlay(ctx);
    ctx.save();
    ctx.textAlign = 'center';
    const bob = Math.sin(time * 1.5) * 4;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.shadowColor = '#ffb703'; ctx.shadowBlur = 26;
    ctx.fillText('GLIMMERHOLD', VIEW.w / 2, 190 + bob);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff9f1c';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('— Last Light of the Hollow —', VIEW.w / 2, 228 + bob);
    ctx.fillStyle = COLORS.text;
    ctx.font = '17px Georgia, serif';
    ctx.fillText('You are the Warden of the Last Ember. Shades crawl out of the dark to snuff its flame.', VIEW.w / 2, 292);
    ctx.fillText('Hold the line for 10 waves. If you fall — or the Ember dies — the Hollow wins.', VIEW.w / 2, 318);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '15px Georgia, serif';
    const lines = [
      'WASD / Arrows — move      Mouse — aim      Hold Click / Space — fire ember bolts',
      'Shift — dash (brief invulnerability)      E / Right-click — place a spark trap (10 shards)',
      'Slain shades drop shards: they feed the Ember. Elites drop aether: reroll your blessings.',
      'Clear a wave to choose 1 of 3 blessings. Survive all 10 waves — and slay the Hollow King.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, VIEW.w / 2, 372 + i * 26));
    // Start button.
    const pulse = 1 + Math.sin(time * 3) * 0.04;
    ctx.save();
    ctx.translate(VIEW.w / 2, 540);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffb703';
    rr(ctx, -130, -26, 260, 52, 10); ctx.fill();
    ctx.fillStyle = '#241a10';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('KINDLE THE LIGHT', 0, 8);
    ctx.restore();
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px Georgia, serif';
    ctx.fillText('Click the button or press Enter to begin  •  M mutes  •  Best played with sound on', VIEW.w / 2, 606);
    ctx.restore();
  }

  drawUpgrade(ctx, game) {
    this.overlay(ctx);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(`Wave ${game.wave} cleared!`, VIEW.w / 2, 130);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '16px Georgia, serif';
    ctx.fillText('The Ember burns brighter. Choose one blessing — press 1, 2 or 3, or click a card.', VIEW.w / 2, 162);
    const cards = game.offer;
    const cw = 300, ch = 240, gap = 30;
    const x0 = VIEW.w / 2 - (cards.length * cw + (cards.length - 1) * gap) / 2;
    cards.forEach((u, i) => {
      const x = x0 + i * (cw + gap), y = 210;
      ctx.fillStyle = 'rgba(20,28,51,0.95)';
      rr(ctx, x, y, cw, ch, 12); ctx.fill();
      ctx.strokeStyle = u.color; ctx.lineWidth = 2;
      rr(ctx, x, y, cw, ch, 12); ctx.stroke();
      ctx.fillStyle = u.color;
      ctx.font = '44px Georgia, serif';
      ctx.fillText(u.icon, x + cw / 2, y + 66);
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillText(u.name, x + cw / 2, y + 108);
      ctx.fillStyle = COLORS.dim;
      ctx.font = '14px Georgia, serif';
      this.wrapText(ctx, u.desc, x + 22, y + 138, cw - 44, 20);
      const owned = game.owned[u.id] || 0;
      ctx.fillStyle = u.color;
      ctx.font = '13px Georgia, serif';
      ctx.fillText(owned > 0 ? `Owned x${owned}  •  max ${u.max}` : `New blessing  •  max ${u.max}`, x + cw / 2, y + ch - 18);
      ctx.fillStyle = COLORS.dim;
      ctx.font = 'bold 15px Georgia, serif';
      ctx.fillText(`[${i + 1}]`, x + cw / 2, y + ch - 40);
    });
    ctx.fillStyle = game.aether >= 1 ? '#c77dff' : COLORS.dim;
    ctx.font = '15px Georgia, serif';
    ctx.fillText(`Reroll [R] — costs 1 aether (you have ${game.aether})`, VIEW.w / 2, 500);
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`Score ${game.score.toLocaleString()}   •   Shards ${game.shards}   •   Ember ${Math.ceil(game.flame)}/${game.stats.maxFlame}`, VIEW.w / 2, 530);
    ctx.restore();
  }

  wrapText(ctx, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x + maxW / 2, yy);
        line = w;
        yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x + maxW / 2, yy);
  }

  drawPaused(ctx, game) {
    this.overlay(ctx);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('PAUSED', VIEW.w / 2, 300);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '17px Georgia, serif';
    ctx.fillText('The shades wait in the dark. Press P or Esc to return to the fight.', VIEW.w / 2, 340);
    ctx.fillText(`Wave ${game.wave}  •  Score ${game.score.toLocaleString()}  •  Ember ${Math.ceil(game.flame)}`, VIEW.w / 2, 372);
    ctx.restore();
  }

  drawEnd(ctx, game, won) {
    this.overlay(ctx);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#ffd166' : '#ff5d5d';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.shadowColor = won ? '#ffb703' : '#c1121f';
    ctx.shadowBlur = 22;
    ctx.fillText(won ? 'THE LIGHT ENDURES' : 'THE LIGHT GOES OUT', VIEW.w / 2, 220);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px Georgia, serif';
    ctx.fillText(
      won ? 'Ten waves. The Hollow King is ash. Dawn breaks over Glimmerhold.'
        : (game.loseReason || 'The Hollow claims another warden.'),
      VIEW.w / 2, 262);
    const acc = game.statsRun.shots > 0 ? Math.round((game.statsRun.hits / game.statsRun.shots) * 100) : 0;
    ctx.fillStyle = COLORS.dim;
    ctx.font = '16px Georgia, serif';
    const rows = [
      `Final score: ${game.score.toLocaleString()}`,
      `Waves cleared: ${won ? TOTAL_WAVES : game.wave - 1} / ${TOTAL_WAVES}    •    Shades slain: ${game.kills}`,
      `Best combo: ${game.bestCombo}    •    Bolt accuracy: ${acc}%    •    Dashes: ${game.statsRun.dashes}    •    Traps sprung: ${game.statsRun.trapsUsed}`,
      `Shards gathered: ${game.shards}    •    Aether gathered: ${game.aether}`,
    ];
    rows.forEach((r, i) => ctx.fillText(r, VIEW.w / 2, 310 + i * 28));
    ctx.fillStyle = '#ffb703';
    rr(ctx, VIEW.w / 2 - 130, 452, 260, 52, 10); ctx.fill();
    ctx.fillStyle = '#241a10';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('PLAY AGAIN', VIEW.w / 2, 486);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px Georgia, serif';
    ctx.fillText('Click the button or press Enter to start a new run', VIEW.w / 2, 540);
    ctx.restore();
  }
}
