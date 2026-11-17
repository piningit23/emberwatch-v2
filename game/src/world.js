// Glimmerhold — game state, rules and the update loop. One job: the simulation.
import { PLAYER, FLAME, COMBO, TOTAL_WAVES, ARENA, waveComp, ENEMIES } from './config.js';
import { makeEnemy, buildQueue, edgeSpawn, steerEnemy } from './enemies.js';
import { rollUpgrades } from './upgrades.js';
import { clamp, dist2, randRange } from './random.js';

export class Game {
  constructor(rng, audio, particles) {
    this.rng = rng;
    this.audio = audio;
    this.particles = particles;
    this.reset();
  }

  reset() {
    this.state = 'title'; // title | playing | upgrade | paused | victory | gameover
    this.prevState = 'playing';
    this.time = 0;
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.shards = 0;
    this.aether = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboMult = 1;
    this.bestCombo = 0;
    this.flame = FLAME.max;
    this.flamePos = { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
    this.stats = {
      maxHp: PLAYER.hp, speed: PLAYER.speed, fireRate: PLAYER.fireRate,
      damage: PLAYER.damage, bulletSpeed: PLAYER.bulletSpeed, bulletLife: PLAYER.bulletLife,
      multishot: PLAYER.multishot, pierce: PLAYER.pierce, magnet: PLAYER.magnet,
      dashCooldown: PLAYER.dashCooldown, critChance: PLAYER.critChance, critMult: PLAYER.critMult,
      flameRegen: 0, maxFlame: FLAME.max, flameGuard: 1,
      wisps: 0, trapSlots: 2, trapDamage: 40, comboWindow: COMBO.window, comboGain: 1,
    };
    this.owned = {};
    this.player = {
      x: this.flamePos.x, y: this.flamePos.y + 150,
      vx: 0, vy: 0, hp: PLAYER.hp, radius: PLAYER.radius,
      aim: -Math.PI / 2, fireCd: 0, dashCd: 0, dashT: 0, dashX: 0, dashY: 0,
      invuln: 0, hurtFlash: 0, wispCd: 0, wispAngle: 0,
    };
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.pickups = [];
    this.traps = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveActive = false;
    this.waveBreakT = 0;
    this.offer = [];
    this.shake = 0;
    this.slowmo = 0;
    this.banner = null; // {text, sub, t}
    this.statsRun = { shots: 0, hits: 0, trapsUsed: 0, dashes: 0 };
  }

  startGame() {
    this.reset();
    this.state = 'playing';
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    if (this.wave > TOTAL_WAVES) { this.winGame(); return; }
    const comp = waveComp(this.wave);
    this.comp = comp;
    this.spawnQueue = buildQueue(comp, this.rng);
    this.spawnTimer = 1.2;
    this.waveActive = true;
    const label = comp.boss === 'matriarch' ? 'The Hollow Matriarch stirs…'
      : comp.boss === 'king' ? 'THE HOLLOW KING AWAKENS'
      : comp.surge ? `SURGE WAVE ${this.wave}` : `Wave ${this.wave}`;
    this.banner = { text: label, sub: comp.surge ? 'Double shards — hold the line!' : comp.boss ? 'Slay the boss to go on.' : '', t: 2.6 };
    if (comp.boss) this.audio.bossRoar();
  }

  winGame() {
    this.state = 'victory';
    this.audio.victory();
    this.particles.ring(this.flamePos.x, this.flamePos.y, '#ffd166', 260);
  }

  loseGame(reason) {
    this.state = 'gameover';
    this.loseReason = reason;
    this.audio.gameOver();
    this.particles.burst(this.player.x, this.player.y, '#ff5d5d', 40, 260, 1, 4);
  }

  addScore(n) { this.score += Math.round(n); }

  addKill(e) {
    this.kills++;
    this.combo += 1 * this.stats.comboGain;
    this.comboTimer = this.stats.comboWindow;
    this.comboMult = Math.min(COMBO.maxMult, 1 + Math.floor(this.combo / 5));
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const shardMult = this.comp && this.comp.surge ? 2 : 1;
    const n = e.shards * shardMult;
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      this.pickups.push({
        kind: 'shard', x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12,
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, t: 0, life: 14,
      });
    }
    if (e.elite || e.kind === 'boss') {
      const m = e.kind === 'boss' ? 3 : 1;
      for (let i = 0; i < m; i++) {
        const a = this.rng() * Math.PI * 2;
        this.pickups.push({
          kind: 'aether', x: e.x + Math.cos(a) * 16, y: e.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, t: 0, life: 16,
        });
      }
    }
    this.addScore(e.score * this.comboMult);
    this.audio.kill(this.combo);
    this.particles.burst(e.x, e.y, e.glow, e.elite ? 26 : 14, 220, 0.6, 3.5);
    this.particles.text(e.x, e.y - 10, `+${e.score * this.comboMult}`, '#ffe9a8', 14);
    if (e.elite) this.particles.ring(e.x, e.y, '#c77dff', 70);
    if (e.kind === 'boss') {
      this.shake = 14;
      this.particles.ring(e.x, e.y, '#ffd166', 200);
      this.audio.boom();
    }
    if (e.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const a = this.rng() * Math.PI * 2;
        const m = makeEnemy('mote', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, this.wave, false, this.rng);
        m.spawnT = 0.2;
        this.enemies.push(m);
      }
    }
  }

  damageEnemy(e, dmg, crit) {
    e.hp -= dmg;
    e.hitFlash = 0.08;
    this.particles.text(e.x + (this.rng() - 0.5) * 16, e.y - e.radius - 4, crit ? `${Math.round(dmg)}!` : `${Math.round(dmg)}`, crit ? '#ffd166' : '#e8ecf7', crit ? 18 : 13);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.addKill(e);
    } else {
      this.audio.hit();
    }
  }

  hurtPlayer(dmg, sx, sy) {
    const p = this.player;
    if (p.invuln > 0 || p.dashT > 0 || this.state !== 'playing') return;
    p.hp -= dmg;
    p.invuln = 0.7;
    p.hurtFlash = 0.25;
    this.shake = Math.max(this.shake, 7);
    this.audio.hurt();
    this.particles.burst(p.x, p.y, '#ff5d5d', 12, 180, 0.5, 3);
    // Knockback away from the source.
    const dx = p.x - sx, dy = p.y - sy;
    const d = Math.hypot(dx, dy) || 1;
    p.x = clamp(p.x + (dx / d) * 26, ARENA.x + p.radius, ARENA.x + ARENA.w - p.radius);
    p.y = clamp(p.y + (dy / d) * 26, ARENA.y + p.radius, ARENA.y + ARENA.h - p.radius);
    if (p.hp <= 0) { p.hp = 0; this.loseGame('The Warden has fallen.'); }
  }

  hurtFlame(dmg, sx, sy) {
    if (this.state !== 'playing') return;
    this.flame -= dmg * this.stats.flameGuard;
    this.audio.flameHurt();
    this.particles.burst(this.flamePos.x, this.flamePos.y, '#ff9f1c', 6, 120, 0.4, 2.5);
    if (this.flame <= 0) { this.flame = 0; this.loseGame('The Last Ember has gone out.'); }
  }

  spawnEnemyBullets(e, count) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rng() * 0.3;
      this.enemyBullets.push({
        x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
        radius: 7, dmg: 10, life: 4, color: '#ff8fd1',
      });
    }
  }

  fireBolt() {
    const p = this.player;
    const s = this.stats;
    const spread = 0.09;
    const n = s.multishot;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spread;
      const a = p.aim + off;
      this.bullets.push({
        x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * s.bulletSpeed, vy: Math.sin(a) * s.bulletSpeed,
        radius: 5, dmg: s.damage, pierce: s.pierce, life: s.bulletLife,
        crit: this.rng() < s.critChance, hitIds: new Set(),
      });
    }
    this.statsRun.shots++;
    this.audio.shoot();
    this.particles.burst(p.x + Math.cos(p.aim) * 24, p.y + Math.sin(p.aim) * 24, '#ffd166', 3, 90, 0.2, 2);
  }

  placeTrap(x, y) {
    if (this.traps.length >= this.stats.trapSlots) return false;
    if (this.shards < 10) return false;
    this.shards -= 10;
    this.traps.push({ x, y, radius: 16, arm: 0.5, dmg: this.stats.trapDamage, life: 30 });
    this.statsRun.trapsUsed++;
    this.audio.trap();
    this.particles.ring(x, y, '#e07be0', 50);
    return true;
  }

  // ---- per-frame update ----
  update(dt, input) {
    if (this.state !== 'playing') return;
    this.time += dt;
    const p = this.player;
    const s = this.stats;

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.combo = 0; this.comboMult = 1; }
    }

    // Flame drains; regen offsets it.
    this.flame -= (FLAME.drainBase + FLAME.drainPerWave * this.wave) * dt;
    this.flame += s.flameRegen * dt;
    this.flame = clamp(this.flame, 0, s.maxFlame);
    if (this.flame <= 0) { this.loseGame('The Last Ember has gone out.'); return; }

    // Ambient embers drifting off the flame.
    if (this.rng() < dt * 6) {
      this.particles.emberDrift(this.flamePos.x + (this.rng() - 0.5) * 30, this.flamePos.y + (this.rng() - 0.5) * 14, '#ff9f1c');
    }

    // --- Player movement + dash ---
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    const mv = input.moveVector();
    p.aim = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
    if (input.wasPressed('Shift') && p.dashCd <= 0 && (mv.x !== 0 || mv.y !== 0)) {
      p.dashT = PLAYER.dashTime;
      p.dashX = mv.x; p.dashY = mv.y;
      p.dashCd = s.dashCooldown;
      this.statsRun.dashes++;
      this.audio.dash();
      this.particles.burst(p.x, p.y, '#c77dff', 10, 160, 0.35, 2.5);
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashX * PLAYER.dashSpeed * dt;
      p.y += p.dashY * PLAYER.dashSpeed * dt;
      this.particles.burst(p.x, p.y, '#b8c7ff', 2, 40, 0.3, 2);
    } else {
      p.x += mv.x * s.speed * dt;
      p.y += mv.y * s.speed * dt;
    }
    p.x = clamp(p.x, ARENA.x + p.radius, ARENA.x + ARENA.w - p.radius);
    p.y = clamp(p.y, ARENA.y + p.radius, ARENA.y + ARENA.h - p.radius);

    // --- Firing ---
    p.fireCd -= dt;
    if (input.firing() && p.fireCd <= 0) {
      this.fireBolt();
      p.fireCd = 1 / s.fireRate;
    }

    // --- Trap placement (E or right click) ---
    if ((input.wasPressed('e') || input.wasPressed('mouse2')) && this.shards >= 10) {
      this.placeTrap(input.mouseX, input.mouseY);
    }

    // --- Companion wisps ---
    p.wispAngle += dt * 1.8;
    p.wispCd -= dt;
    if (s.wisps > 0 && p.wispCd <= 0 && this.enemies.length > 0) {
      const target = this.nearestEnemy(p.x, p.y);
      if (target) {
        for (let i = 0; i < s.wisps; i++) {
          const a = Math.atan2(target.y - p.y, target.x - p.x);
          this.bullets.push({
            x: p.x + Math.cos(p.wispAngle + i * 2.1) * 34,
            y: p.y + Math.sin(p.wispAngle + i * 2.1) * 34,
            vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
            radius: 4, dmg: s.damage * 0.6, pierce: 0, life: 0.7,
            crit: false, hitIds: new Set(), wisp: true,
          });
        }
        p.wispCd = 0.85;
        this.audio.shoot();
      }
    }

    // --- Spawning ---
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      const alive = this.enemies.filter((e) => !e.dead).length;
      if (this.spawnTimer <= 0 && alive < 24) {
        const next = this.spawnQueue.shift();
        const pos = edgeSpawn(this.rng);
        const e = makeEnemy(next.type, pos.x, pos.y, this.wave, next.elite, this.rng);
        this.enemies.push(e);
        this.particles.ring(pos.x, pos.y, e.glow, 46);
        this.spawnTimer = Math.max(0.28, 0.85 - this.wave * 0.05);
      }
    }

    // --- Bullets ---
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || b.hitIds.has(e.id)) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (b.radius + e.radius) ** 2) {
          b.hitIds.add(e.id);
          this.statsRun.hits++;
          const dmg = b.dmg * (b.crit ? s.critMult : 1);
          this.damageEnemy(e, dmg, b.crit);
          this.particles.burst(b.x, b.y, '#ffd166', 4, 120, 0.25, 2);
          if (b.pierce > 0) { b.pierce--; } else { b.life = 0; }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < 1280 && b.y > 0 && b.y < 720);

    // --- Enemy bullets ---
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (dist2(b.x, b.y, p.x, p.y) < (b.radius + p.radius) ** 2) {
        this.hurtPlayer(b.dmg, b.x, b.y);
        b.life = 0;
      }
      if (dist2(b.x, b.y, this.flamePos.x, this.flamePos.y) < (b.radius + 26) ** 2) {
        this.hurtFlame(b.dmg * 0.5, b.x, b.y);
        b.life = 0;
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.life > 0);

    // --- Enemies ---
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.touchCd = Math.max(0, e.touchCd - dt);
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      steerEnemy(e, this, dt);
      // Spitter ranged attack.
      if (e.type === 'spitter') {
        e.shootCd -= dt;
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (e.shootCd <= 0 && d < 420) {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          this.enemyBullets.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210,
            radius: 6, dmg: e.dmg, life: 3.5, color: '#e07be0',
          });
          e.shootCd = 2.4;
          this.audio.tone(300, 0.08, 'square', 0.06, 180);
        }
      }
      // Matriarch ranged attack.
      if (e.type === 'matriarch') {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          const baseA = Math.atan2(p.y - e.y, p.x - e.x);
          for (let k = -1; k <= 1; k++) {
            this.enemyBullets.push({
              x: e.x, y: e.y, vx: Math.cos(baseA + k * 0.28) * 190, vy: Math.sin(baseA + k * 0.28) * 190,
              radius: 7, dmg: 12, life: 4, color: '#ff8fd1',
            });
          }
          e.shootCd = 2.8;
        }
      }
      // Contact with player.
      const dp = dist2(e.x, e.y, p.x, p.y);
      if (dp < (e.radius + p.radius) ** 2 && e.touchCd <= 0) {
        this.hurtPlayer(e.dmg, e.x, e.y);
        e.touchCd = 0.9;
      }
      // Contact with the flame.
      const df = dist2(e.x, e.y, this.flamePos.x, this.flamePos.y);
      if (df < (e.radius + 26) ** 2 && e.touchCd <= 0) {
        this.hurtFlame(e.dmg, e.x, e.y);
        e.touchCd = 1.0;
        // Bounce off the flame so it does not sit on it.
        const a = Math.atan2(e.y - this.flamePos.y, e.x - this.flamePos.x);
        e.x = this.flamePos.x + Math.cos(a) * (e.radius + 30);
        e.y = this.flamePos.y + Math.sin(a) * (e.radius + 30);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // --- Traps ---
    for (const t of this.traps) {
      t.arm = Math.max(0, t.arm - dt);
      t.life -= dt;
      if (t.arm <= 0) {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (dist2(t.x, t.y, e.x, e.y) < (t.radius + e.radius + 14) ** 2) {
            // Detonate: AoE damage + slow.
            this.particles.burst(t.x, t.y, '#e07be0', 22, 260, 0.6, 3.5);
            this.particles.ring(t.x, t.y, '#e07be0', 110);
            this.audio.boom();
            this.shake = Math.max(this.shake, 5);
            for (const e2 of this.enemies) {
              if (e2.dead) continue;
              if (dist2(t.x, t.y, e2.x, e2.y) < 120 ** 2) {
                this.damageEnemy(e2, t.dmg, false);
                e2.speed *= 0.55; // slow lingers via reduced speed until it recovers
                setTimeout(() => { e2.speed /= 0.55; }, 1200);
              }
            }
            t.life = 0;
            break;
          }
        }
      }
    }
    this.traps = this.traps.filter((t) => t.life > 0);

    // --- Pickups ---
    for (const pk of this.pickups) {
      pk.t += dt; pk.life -= dt;
      const d = Math.hypot(p.x - pk.x, p.y - pk.y);
      if (d < s.magnet) {
        const pull = 420 * (1 - d / (s.magnet + 1)) + 160;
        pk.x += ((p.x - pk.x) / (d || 1)) * pull * dt;
        pk.y += ((p.y - pk.y) / (d || 1)) * pull * dt;
      } else {
        pk.x += pk.vx * dt; pk.y += pk.vy * dt;
        pk.vx *= 0.9; pk.vy *= 0.9;
      }
      if (d < p.radius + 12) {
        pk.life = 0;
        if (pk.kind === 'shard') {
          this.shards++;
          this.flame = clamp(this.flame + FLAME.shardHeal, 0, s.maxFlame);
          this.addScore(10 * this.comboMult);
          this.audio.pickup(this.combo);
        } else {
          this.aether++;
          this.addScore(50);
          this.audio.aether();
          this.particles.text(pk.x, pk.y - 12, '+1 AETHER', '#c77dff', 15);
        }
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);

    // --- Wave clear check ---
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      this.enemyBullets = [];
      if (this.wave >= TOTAL_WAVES) { this.winGame(); return; }
      this.offer = rollUpgrades(this.rng, this.owned, 3);
      this.state = 'upgrade';
      this.audio.waveClear();
      this.addScore(100 * this.wave);
    }

    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    this.shake = Math.max(0, this.shake - dt * 26);
    this.particles.update(dt);
  }

  nearestEnemy(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  chooseUpgrade(idx) {
    const u = this.offer[idx];
    if (!u || this.state !== 'upgrade') return false;
    u.apply(this);
    this.owned[u.id] = (this.owned[u.id] || 0) + 1;
    this.audio.upgrade();
    this.particles.ring(this.player.x, this.player.y, u.color, 90);
    this.state = 'playing';
    this.nextWave();
    return true;
  }

  rerollOffer() {
    if (this.state !== 'upgrade' || this.aether < 1) return false;
    this.aether -= 1;
    const taken = new Set(this.offer.map((o) => o.id));
    const pool = rollUpgrades(this.rng, this.owned, 6).filter((o) => !taken.has(o.id));
    this.offer = pool.slice(0, 3);
    this.audio.click();
    return true;
  }

  togglePause() {
    if (this.state === 'playing') { this.prevState = 'playing'; this.state = 'paused'; }
    else if (this.state === 'paused') { this.state = 'playing'; }
  }

  // Sanity: every position finite (used by the regression run).
  allFinite() {
    const pts = [this.player, this.flamePos, ...this.enemies, ...this.bullets, ...this.pickups];
    return pts.every((o) => Number.isFinite(o.x) && Number.isFinite(o.y));
  }
}
