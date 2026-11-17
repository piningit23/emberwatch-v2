// Glimmerhold — tuning and constants. One job: every number the game balances on.
export const VIEW = { w: 1280, h: 720 };

export const ARENA = { x: 24, y: 86, w: 1232, h: 596 };

export const PLAYER = {
  radius: 15,
  hp: 120,
  speed: 235,
  fireRate: 3.2, // shots per second
  damage: 14,
  bulletSpeed: 580,
  bulletLife: 0.85, // seconds of flight
  multishot: 1,
  pierce: 0,
  magnet: 130,
  dashCooldown: 2.2,
  dashTime: 0.16,
  dashSpeed: 1150,
  critChance: 0.05,
  critMult: 2,
};

export const FLAME = {
  max: 100,
  drainBase: 0.22, // per second
  drainPerWave: 0.04,
  shardHeal: 4,
  touchDamage: 1, // not used; flame is damaged by enemy attacks
};

export const COMBO = { window: 3.0, maxMult: 5 };

// Wave table. surge = bonus wave (double shards, denser spawns).
// boss: 'matriarch' on 5, 'king' on 10.
export function waveComp(wave) {
  const c = (type, count) => ({ type, count });
  switch (wave) {
    case 1: return { surge: false, boss: null, list: [c('crawler', 6), c('wisp', 4)] };
    case 2: return { surge: false, boss: null, list: [c('crawler', 8), c('wisp', 6), c('splitter', 2)] };
    case 3: return { surge: false, boss: null, list: [c('crawler', 8), c('wisp', 8), c('splitter', 3), c('spitter', 2)], elites: 1 };
    case 4: return { surge: true, boss: null, list: [c('crawler', 12), c('wisp', 10), c('splitter', 3)], elites: 1 };
    case 5: return { surge: false, boss: 'matriarch', list: [c('crawler', 6), c('wisp', 6), c('spitter', 2)] };
    case 6: return { surge: false, boss: null, list: [c('crawler', 9), c('wisp', 8), c('splitter', 4), c('spitter', 4), c('brute', 2), c('phantom', 2)], elites: 2 };
    case 7: return { surge: false, boss: null, list: [c('crawler', 10), c('wisp', 9), c('splitter', 4), c('spitter', 4), c('brute', 3), c('phantom', 3)], elites: 2 };
    case 8: return { surge: true, boss: null, list: [c('crawler', 14), c('wisp', 12), c('splitter', 5), c('spitter', 3), c('brute', 3), c('phantom', 3)], elites: 3 };
    case 9: return { surge: false, boss: null, list: [c('crawler', 11), c('wisp', 10), c('splitter', 5), c('spitter', 5), c('brute', 4), c('phantom', 4)], elites: 3 };
    case 10: return { surge: false, boss: 'king', list: [c('crawler', 6), c('wisp', 5), c('spitter', 2), c('brute', 2)] };
    default: return { surge: false, boss: null, list: [c('crawler', 6)] };
  }
}

export const TOTAL_WAVES = 10;

// Enemy base stats. hpScale grows with the wave; speedScale grows slightly.
export const ENEMIES = {
  wisp:     { hp: 14,  speed: 152, dmg: 6,  radius: 11, score: 10, shards: 1, color: '#ffd166', glow: '#ff9f1c', target: 'player', kind: 'wisp' },
  crawler:  { hp: 26,  speed: 74,  dmg: 9,  radius: 14, score: 15, shards: 1, color: '#9b7ede', glow: '#6c4fd8', target: 'player', kind: 'crawler' },
  splitter: { hp: 42,  speed: 56,  dmg: 8,  radius: 17, score: 25, shards: 2, color: '#5ee6a8', glow: '#1fae6b', target: 'player', kind: 'splitter' },
  mote:     { hp: 8,   speed: 172, dmg: 4,  radius: 8,  score: 5,  shards: 0, color: '#7dfcd6', glow: '#2fd6a3', target: 'player', kind: 'mote' },
  brute:    { hp: 130, speed: 44,  dmg: 10, radius: 24, score: 40, shards: 3, color: '#ff6b6b', glow: '#c1121f', target: 'flame', kind: 'brute' },
  spitter:  { hp: 32,  speed: 62,  dmg: 8,  radius: 13, score: 30, shards: 2, color: '#e07be0', glow: '#a93fb0', target: 'ranged', kind: 'spitter' },
  phantom:  { hp: 38,  speed: 96,  dmg: 12, radius: 13, score: 35, shards: 2, color: '#b8c7ff', glow: '#5a6fd6', target: 'player', kind: 'phantom' },
  matriarch:{ hp: 600, speed: 42,  dmg: 16, radius: 34, score: 500, shards: 12, color: '#ff8fd1', glow: '#d63384', target: 'player', kind: 'boss' },
  king:     { hp: 1300, speed: 58, dmg: 22, radius: 42, score: 1500, shards: 25, color: '#ffb703', glow: '#fb8500', target: 'player', kind: 'boss' },
};

export const ELITE = { hpMult: 2.6, speedMult: 1.12, dmgMult: 1.3, scoreMult: 3, shardBonus: 4 };

export const COLORS = {
  bg: '#0a0e1a',
  bg2: '#101830',
  ground: '#131c33',
  wall: '#2a3a5f',
  player: '#ffe9a8',
  playerGlow: '#ffb703',
  bolt: '#ffd166',
  boltCore: '#fff3c4',
  shard: '#7dfcd6',
  aether: '#c77dff',
  flame: '#ff9f1c',
  text: '#e8ecf7',
  dim: '#93a1c0',
  danger: '#ff5d5d',
  heal: '#5ee6a8',
};
