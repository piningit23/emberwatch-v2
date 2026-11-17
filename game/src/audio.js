// Glimmerhold — synthesized sound: WebAudio SFX + a small ambient music sequencer.
// No audio files, no network. One job: everything the player hears.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicOn = true;
    this.musicTimer = null;
    this.step = 0;
    this.started = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.started = true;
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
    return this.musicOn;
  }

  tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol, freq, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  shoot() { this.tone(720 + Math.random() * 120, 0.09, 'square', 0.10, 240); }
  hit() { this.tone(190, 0.06, 'triangle', 0.12, 120); }
  kill(combo) {
    const base = 320 + Math.min(combo, 5) * 60;
    this.tone(base, 0.12, 'sine', 0.16, base * 1.6);
    this.noise(0.12, 0.10, 2400);
  }
  pickup(combo) {
    const f = 520 + Math.min(combo, 8) * 45;
    this.tone(f, 0.10, 'sine', 0.12, f * 1.5);
  }
  aether() {
    this.tone(880, 0.14, 'sine', 0.14, 1320);
    this.tone(1320, 0.18, 'sine', 0.10, 1760, 0.06);
  }
  dash() { this.noise(0.18, 0.16, 1800); }
  hurt() { this.tone(140, 0.18, 'sawtooth', 0.18, 70); this.noise(0.15, 0.12, 900); }
  flameHurt() { this.tone(220, 0.15, 'sawtooth', 0.10, 110); }
  trap() { this.tone(440, 0.08, 'square', 0.10, 880); }
  boom() { this.noise(0.35, 0.28, 700); this.tone(90, 0.3, 'sine', 0.22, 40); }
  waveClear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, null, i * 0.09));
  }
  upgrade() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.13, null, i * 0.07));
  }
  bossRoar() {
    this.tone(70, 0.7, 'sawtooth', 0.25, 45);
    this.noise(0.6, 0.18, 500);
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.15, null, i * 0.16));
  }
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.15, null, i * 0.11));
  }
  click() { this.tone(600, 0.05, 'sine', 0.10, 700); }

  // Slow minor-key pad + sparse pluck melody, 8 steps a bar at 96 bpm.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const barMs = (60 / 96) * 1000 * 2; // half-note steps
    const roots = [110, 87.31, 98, 82.41]; // A2 F2 G2 E2
    const melody = [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 440, 0, 392, 0, 493.88, 0, 587.33, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this.musicOn) return;
      const bar = Math.floor(this.step / 8) % 4;
      const s = this.step % 8;
      if (s === 0) {
        const root = roots[bar];
        [1, 1.5, 2].forEach((m) => this.padTone(root * m, barMs * 4 / 1000));
      }
      const note = melody[this.step % 16];
      if (note) this.padTone(note, 0.5, 0.05, 'sine');
      this.step++;
    }, barMs);
  }

  padTone(freq, dur, vol = 0.05, type = 'triangle') {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.musicGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
}
