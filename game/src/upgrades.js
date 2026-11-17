// Glimmerhold — the blessing pool. One job: the 15 upgrades offered between waves.
export const UPGRADES = [
  {
    id: 'rapid', name: 'Rapid Wick', icon: '»', color: '#ffd166',
    desc: '+18% fire rate. Your lantern spits embers faster.',
    max: 5, apply: (s) => { s.stats.fireRate *= 1.18; },
  },
  {
    id: 'heavy', name: 'Heavy Ember', icon: '●', color: '#ff9f1c',
    desc: '+25% bolt damage. Each ember hits like a hammer.',
    max: 5, apply: (s) => { s.stats.damage *= 1.25; },
  },
  {
    id: 'twin', name: 'Twin Flame', icon: '✦', color: '#ffe9a8',
    desc: '+1 bolt per shot. Spread the light wider.',
    max: 3, apply: (s) => { s.stats.multishot += 1; },
  },
  {
    id: 'swift', name: 'Swift Boots', icon: '➤', color: '#7dfcd6',
    desc: '+12% move speed. Outrun the dark.',
    max: 4, apply: (s) => { s.stats.speed *= 1.12; },
  },
  {
    id: 'hardy', name: 'Hardy Heart', icon: '♥', color: '#ff6b6b',
    desc: '+25 max HP and heal 25 now. A sturdier warden.',
    max: 5, apply: (s) => { s.stats.maxHp += 25; s.player.hp = Math.min(s.stats.maxHp, s.player.hp + 25); },
  },
  {
    id: 'lode', name: 'Lodestone', icon: '◎', color: '#5ee6a8',
    desc: '+40% shard pickup radius. The light draws them in.',
    max: 4, apply: (s) => { s.stats.magnet *= 1.4; },
  },
  {
    id: 'pierce', name: 'Piercing Light', icon: '→', color: '#b8c7ff',
    desc: 'Bolts pierce +1 enemy. One shot, a whole line of shades.',
    max: 3, apply: (s) => { s.stats.pierce += 1; },
  },
  {
    id: 'kindle', name: 'Kindled Flame', icon: '♨', color: '#ff9f1c',
    desc: 'Flame regrows +0.6/s and +20 max flame. Feed the fire.',
    max: 4, apply: (s) => { s.stats.flameRegen += 0.6; s.stats.maxFlame += 20; s.flame = Math.min(s.stats.maxFlame, s.flame + 20); },
  },
  {
    id: 'dash', name: 'Feather Dash', icon: '≫', color: '#c77dff',
    desc: 'Dash recharges 25% faster. Slip through the dark.',
    max: 4, apply: (s) => { s.stats.dashCooldown *= 0.75; },
  },
  {
    id: 'wisp', name: 'Wisp Ally', icon: '✧', color: '#7dfcd6',
    desc: 'Gain a companion wisp that auto-fires at shades. Again: +1 wisp.',
    max: 3, apply: (s) => { s.stats.wisps += 1; },
  },
  {
    id: 'trap', name: 'Trapwright', icon: '✚', color: '#e07be0',
    desc: '+1 spark trap slot and traps deal +30% damage.',
    max: 3, apply: (s) => { s.stats.trapSlots += 1; s.stats.trapDamage *= 1.3; },
  },
  {
    id: 'crit', name: 'Critical Spark', icon: '✹', color: '#ffd166',
    desc: '+10% critical chance. Crits deal double damage.',
    max: 4, apply: (s) => { s.stats.critChance += 0.10; },
  },
  {
    id: 'long', name: 'Long Wick', icon: '—', color: '#ffe9a8',
    desc: '+20% bolt speed and range. Strike from farther off.',
    max: 3, apply: (s) => { s.stats.bulletSpeed *= 1.2; s.stats.bulletLife *= 1.2; },
  },
  {
    id: 'guard', name: 'Flameguard', icon: '⛨', color: '#5ee6a8',
    desc: 'The Ember takes 25% less damage from shades.',
    max: 3, apply: (s) => { s.stats.flameGuard *= 0.75; },
  },
  {
    id: 'combo', name: 'Combo Keeper', icon: '∞', color: '#ff8fd1',
    desc: 'Combo lasts +1.5s longer and builds twice as fast.',
    max: 3, apply: (s) => { s.stats.comboWindow += 1.5; s.stats.comboGain *= 2; },
  },
];

export function rollUpgrades(rng, owned, count = 3) {
  const pool = UPGRADES.filter((u) => (owned[u.id] || 0) < u.max);
  const out = [];
  const bag = pool.slice();
  while (out.length < count && bag.length > 0) {
    const i = Math.floor(rng() * bag.length);
    out.push(bag.splice(i, 1)[0]);
  }
  return out;
}
