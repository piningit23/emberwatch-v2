// Glimmerhold — bootstrap, game loop, screen clicks and the autopilot test driver.
// One job: run the game.
import { VIEW, ARENA } from './config.js';
import { makeRng, hashSeed, clamp } from './random.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Particles } from './particles.js';
import { Game } from './world.js';
import { Renderer } from './render.js';

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam ? hashSeed(seedParam) : (Math.random() * 0xffffffff) >>> 0;
const rng = makeRng(seed);
const AUTO = params.get('auto') === '1';
const SPEED = parseFloat(params.get('speed') || '1') || 1;

const canvas = document.getElementById('game');
canvas.width = VIEW.w;
canvas.height = VIEW.h;
const ctx = canvas.getContext('2d');

const audio = new AudioEngine();
const particles = new Particles();
const game = new Game(rng, audio, particles);
const input = new Input(canvas);
const renderer = new Renderer(ctx);

window.__game = game;
window.__seed = seed;

// ---- Autopilot: a simple AI that plays the game (used for regression + screenshots) ----
const autopilot = {
  enabled: AUTO,
  fireHold: false,
  update(dt) {
    if (!this.enabled) return;
    if (game.state === 'upgrade') {
      // Auto-pick upgrade: prefer damage/fire-rate/multishot, else first.
      const pref = ['heavy', 'rapid', 'twin', 'pierce', 'wisp', 'hardy', 'kindle'];
      let idx = game.offer.findIndex((o) => pref.includes(o.id));
      if (idx < 0) idx = 0;
      game.chooseUpgrade(idx);
      return;
    }
    if (game.state !== 'playing') return;
    const p = game.player;
    // Find nearest threat, prefer one close to the flame.
    let target = null, bd = Infinity;
    for (const e of game.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const flameD = Math.hypot(e.x - game.flamePos.x, e.y - game.flamePos.y);
      const score = d + (e.target === 'flame' ? -120 : 0) + (flameD < 140 ? -200 : 0);
      if (score < bd) { bd = score; target = e; }
    }
    // Movement: kite away from the nearest enemy if too close, else strafe toward the flame guard ring.
    let mx = 0, my = 0;
    if (target) {
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      const a = Math.atan2(p.y - target.y, p.x - target.x);
      if (d < 130) { mx = Math.cos(a); my = Math.sin(a); }
      else {
        // Orbit the flame at ~180px, keeping the target in range.
        const fa = Math.atan2(p.y - game.flamePos.y, p.x - game.flamePos.x);
        const wantA = fa + 0.9 * dt;
        const wx = game.flamePos.x + Math.cos(wantA) * 180;
        const wy = game.flamePos.y + Math.sin(wantA) * 180;
        const dd = Math.hypot(wx - p.x, wy - p.y);
        if (dd > 24) { mx = (wx - p.x) / dd; my = (wy - p.y) / dd; }
      }
      // Aim at the target (lead slightly).
      const lead = 0.12;
      const ax = target.x + (target.vx || 0) * lead;
      const ay = target.y + (target.vy || 0) * lead;
      input.mouseX = ax; input.mouseY = ay;
      input.mouseDown = true;
      // Dash away if something is very close.
      if (d < 80 && p.dashCd <= 0) input.pressed.add('Shift');
    } else {
      // No enemies: drift toward the nearest shard, else the flame.
      let tx = game.flamePos.x, ty = game.flamePos.y + 150;
      let bd2 = Infinity;
      for (const pk of game.pickups) {
        const d = Math.hypot(pk.x - p.x, pk.y - p.y);
        if (d < bd2) { bd2 = d; tx = pk.x; ty = pk.y; }
      }
      const dd = Math.hypot(tx - p.x, ty - p.y);
      if (dd > 20) { mx = (tx - p.x) / dd; my = (ty - p.y) / dd; }
      input.mouseDown = false;
    }
    // Feed the autopilot movement into the real input via a shim.
    input._autoMove = { x: mx, y: my };
    // Place a trap when rich in shards and enemies are near the flame.
    if (game.shards >= 30 && game.traps.length < game.stats.trapSlots && game.enemies.length > 4) {
      const near = game.enemies.find((e) => Math.hypot(e.x - game.flamePos.x, e.y - game.flamePos.y) < 200);
      if (near) game.placeTrap(near.x, near.y);
    }
  },
};

// Wrap Input.moveVector so the autopilot can steer.
const origMove = input.moveVector.bind(input);
input.moveVector = () => {
  if (autopilot.enabled && input._autoMove) return input._autoMove;
  return origMove();
};

// ---- Screen click / key routing ----
function clickButton(cx, cy, w, h) {
  return Math.abs(input.mouseX - cx) < w / 2 && Math.abs(input.mouseY - cy) < h / 2;
}

function handleClick() {
  audio.ensure();
  if (game.state === 'title') {
    if (clickButton(VIEW.w / 2, 540, 260, 52)) game.startGame();
  } else if (game.state === 'upgrade') {
    const cards = game.offer;
    const cw = 300, ch = 240, gap = 30;
    const x0 = VIEW.w / 2 - (cards.length * cw + (cards.length - 1) * gap) / 2;
    cards.forEach((u, i) => {
      const x = x0 + i * (cw + gap), y = 210;
      if (input.mouseX >= x && input.mouseX <= x + cw && input.mouseY >= y && input.mouseY <= y + ch) {
        game.chooseUpgrade(i);
      }
    });
  } else if (game.state === 'victory' || game.state === 'gameover') {
    if (clickButton(VIEW.w / 2, 478, 260, 52)) game.startGame();
  }
}

canvas.addEventListener('mousedown', () => {
  if (game.state === 'title' || game.state === 'upgrade' || game.state === 'victory' || game.state === 'gameover') {
    handleClick();
  }
});

function handleKeys() {
  if (input.wasPressed('Enter')) {
    if (game.state === 'title') { audio.ensure(); game.startGame(); }
    else if (game.state === 'victory' || game.state === 'gameover') game.startGame();
  }
  if (input.wasPressed('m')) audio.toggleMute();
  if (input.wasPressed('p') || input.wasPressed('Escape')) {
    if (game.state === 'playing' || game.state === 'paused') game.togglePause();
  }
  if (game.state === 'upgrade') {
    if (input.wasPressed('1')) game.chooseUpgrade(0);
    if (input.wasPressed('2')) game.chooseUpgrade(1);
    if (input.wasPressed('3')) game.chooseUpgrade(2);
    if (input.wasPressed('r')) game.rerollOffer();
  }
}

// ---- Main loop ----
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  dt *= SPEED;
  const simDt = Math.min(dt, 0.05 * SPEED);
  handleKeys();
  if (game.state === 'playing') {
    autopilot.update(simDt);
    game.update(simDt, input);
  } else if (game.state === 'title' || game.state === 'victory' || game.state === 'gameover') {
    autopilot.update(simDt);
    game.particles.update(simDt);
    if (game.state === 'title' && AUTO) game.startGame();
    if ((game.state === 'victory' || game.state === 'gameover') && AUTO) {
      // Autopilot restarts are handled by the QA harness, not here.
    }
  } else if (game.state === 'upgrade') {
    autopilot.update(simDt);
    game.particles.update(simDt);
  }
  renderer.draw(game, input, now / 1000);
  input.endFrame();
}
requestAnimationFrame(frame);

// Keep the canvas crisp on HiDPI without changing game coordinates.
function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.w, window.innerHeight / VIEW.h, 1);
  canvas.style.width = `${VIEW.w * scale}px`;
  canvas.style.height = `${VIEW.h * scale}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();
