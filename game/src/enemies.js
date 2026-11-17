// Glimmerhold — enemies: kinds, spawning, movement, attacks, bosses.
// One job: everything that crawls out of the dark.
import { ENEMIES, ELITE, ARENA } from './config.js';
import { randRange, clamp } from './random.js';

let nextId = 1;

export function makeEnemy(type, x, y, wave, elite, rng) {
  const base = ENEMIES[type];
  const hpScale = type === 'matriarch' || type === 'king'
    ? 1 + 0.10 * (wave - 1)
    : 1 + 0.17 * (wave - 1);
  const speedScale = 1 + 0.02 * (wave - 1);
  const e = {
    id: nextId++,
    type,
    x, y,
    vx: 0, vy: 0,
    radius: base.radius * (elite ? 1.25 : 1),
    hp: base.hp * hpScale * (elite ? ELITE.hpMult : 1),
    maxHp: base.hp * hpScale * (elite ? ELITE.hpMult : 1),
    speed: base.speed * speedScale * (elite ? ELITE.speedMult : 1),
    dmg: base.dmg * (elite ? ELITE.dmgMult : 1),
    score: base.score * (elite ? ELITE.scoreMult : 1),
    shards: base.shards + (elite ? ELITE.shardBonus : 0),
    color: base.color, glow: base.glow,
    target: base.target,
    kind: base.kind,
    elite: !!elite,
    touchCd: 0,
    hitFlash: 0,
    wobble: rng() * Math.PI * 2,
    blinkCd: 2 + rng() * 2,
    shootCd: 1.5 + rng(),
    burstCd: 4,
    summonCd: 8,
    chargeCd: 6,
    charging: 0,
    spawnT: 0.55, // telegraph time before it can act
    dead: false,
  };
  return e;
}

export function edgeSpawn(rng) {
  const side = Math.floor(rng() * 4);
  const m = 30;
  if (side === 0) return { x: randRange(rng, ARENA.x + m, ARENA.x + ARENA.w - m), y: ARENA.y + m };
  if (side === 1) return { x: randRange(rng, ARENA.x + m, ARENA.x + ARENA.w - m), y: ARENA.y + ARENA.h - m };
  if (side === 2) return { x: ARENA.x + m, y: randRange(rng, ARENA.y + m, ARENA.y + ARENA.h - m) };
  return { x: ARENA.x + ARENA.w - m, y: randRange(rng, ARENA.y + m, ARENA.y + ARENA.h - m) };
}

// Build the spawn queue for a wave: shuffled types, boss first if any.
export function buildQueue(comp, rng) {
  const q = [];
  for (const entry of comp.list) {
    for (let i = 0; i < entry.count; i++) q.push(entry.type);
  }
  // Shuffle, but keep early spawns gentle: no brutes/phantoms in the first 4.
  const shuffled = [];
  const rest = q.slice();
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const gentle = rest.filter((t) => t === 'crawler' || t === 'wisp');
  const heavy = rest.filter((t) => t !== 'crawler' && t !== 'wisp');
  shuffled.push(...gentle.slice(0, 4), ...heavy, ...gentle.slice(4));
  const elites = comp.elites || 0;
  const eliteIdx = new Set();
  while (eliteIdx.size < elites && eliteIdx.size < shuffled.length) {
    eliteIdx.add(4 + Math.floor(rng() * Math.max(1, shuffled.length - 4)));
  }
  const queue = shuffled.map((type, i) => ({ type, elite: eliteIdx.has(i) }));
  if (comp.boss) queue.unshift({ type: comp.boss, elite: false, boss: true });
  return queue;
}

export function steerEnemy(e, game, dt) {
  const flame = game.flamePos;
  const p = game.player;
  let tx, ty;
  if (e.target === 'flame') { tx = flame.x; ty = flame.y; }
  else { tx = p.x; ty = p.y; }
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  let mx = dx / d, my = dy / d;

  if (e.type === 'wisp') {
    // Zigzag: perpendicular sine wobble.
    e.wobble += dt * 6;
    const px = -my * Math.sin(e.wobble) * 0.7, py = mx * Math.sin(e.wobble) * 0.7;
    mx += px; my += py;
    const n = Math.hypot(mx, my) || 1;
    mx /= n; my /= n;
  }
  if (e.type === 'spitter') {
    // Keep ~260 range from the player; drift sideways while shooting.
    const want = 260;
    const radial = d < want - 40 ? -1 : d > want + 60 ? 1 : 0;
    e.wobble += dt * 1.4;
    mx = mx * radial + -my * Math.sin(e.wobble) * 0.6;
    my = my * radial + mx * Math.sin(e.wobble) * 0.6;
    const n = Math.hypot(mx, my) || 1;
    mx /= n; my /= n;
  }
  if (e.type === 'phantom') {
    e.blinkCd -= dt;
    if (e.blinkCd <= 0 && d > 120) {
      // Blink 40% closer, with a puff.
      e.x += dx * 0.3; e.y += dy * 0.3;
      game.particles.burst(e.x, e.y, e.glow, 10, 90, 0.4, 2.5);
      e.blinkCd = 3.0 + game.rng() * 1.5;
    }
  }
  if (e.type === 'matriarch') {
    e.summonCd -= dt;
    if (e.summonCd <= 0 && game.enemies.length < 22) {
      for (let i = 0; i < 2; i++) {
        const s = edgeSpawn(game.rng);
        game.enemies.push(makeEnemy('wisp', s.x, s.y, game.wave, false, game.rng));
      }
      game.particles.ring(e.x, e.y, e.glow, 120);
      game.audio.bossRoar();
      e.summonCd = 11;
    }
  }
  if (e.type === 'king') {
    // Radial bursts + charge.
    e.burstCd -= dt;
    if (e.burstCd <= 0) {
      game.spawnEnemyBullets(e, 10);
      game.audio.bossRoar();
      e.burstCd = 4.2;
    }
    e.chargeCd -= dt;
    if (e.charging > 0) {
      e.charging -= dt;
      e.vx = Math.cos(e.chargeA) * 520;
      e.vy = Math.sin(e.chargeA) * 520;
      e.x += e.vx * dt; e.y += e.vy * dt;
      return; // charging overrides steering
    }
    if (e.chargeCd <= 0 && d > 200) {
      e.charging = 0.55;
      e.chargeA = Math.atan2(dy, dx);
      e.chargeCd = 6.5;
      game.audio.dash();
    }
  }

  const sp = e.speed;
  e.vx = mx * sp; e.vy = my * sp;
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.x = clamp(e.x, ARENA.x + e.radius, ARENA.x + ARENA.w - e.radius);
  e.y = clamp(e.y, ARENA.y + e.radius, ARENA.y + ARENA.h - e.radius);
}
