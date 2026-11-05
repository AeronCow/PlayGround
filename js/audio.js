/* ============================================================
   IRON DAWN — procedural WebAudio sound design
   No external files. Everything is synthesized at runtime.
   ============================================================ */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.ready = false;
    this.drone = null;
    this.beatClock = 0;
    this.beatIndex = 0;
    this.intensity = 0;
    this.lastShot = 0;
    this._musicWanted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.62;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.2;
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.95;
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.25;
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoise(2.2);
    this.ready = true;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.82 + white * 0.18;
      data[i] = last * 0.85 + white * 0.15;
    }
    return buffer;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      const t = this.now();
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.62, t, 0.03);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  noise({ at = 0, dur = 0.1, gain = 0.2, freq = 1400, type = 'lowpass', q = 0.8, pan = 0, attack = 0.002 } = {}) {
    if (!this.ready) return;
    const t = this.now() + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.45;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src;
    src.connect(filter);
    filter.connect(env);
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      env.connect(p);
      node = p;
    } else {
      node = env;
    }
    node.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.04);
  }

  tone({ at = 0, freq = 220, endFreq = null, dur = 0.18, gain = 0.12, type = 'sine', attack = 0.002, pan = 0, bus = 'sfx' } = {}) {
    if (!this.ready) return;
    const t = this.now() + at;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    let node = env;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      env.connect(p);
      node = p;
    }
    node.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  shot(type = 'pistol', pan = 0) {
    if (!this.ready) return;
    const now = this.now();
    if (now - this.lastShot < 0.025) return;
    this.lastShot = now;
    const p = Math.max(-0.8, Math.min(0.8, pan));
    switch (type) {
      case 'pistol':
        this.noise({ dur: 0.085, gain: 0.39, freq: 2400, type: 'bandpass', q: 0.7, pan: p });
        this.noise({ dur: 0.18, gain: 0.16, freq: 760, type: 'lowpass', pan: p });
        this.tone({ freq: 165, endFreq: 54, dur: 0.13, gain: 0.22, type: 'triangle', pan: p });
        break;
      case 'smg':
        this.noise({ dur: 0.055, gain: 0.25, freq: 2900, type: 'bandpass', q: 0.75, pan: p });
        this.tone({ freq: 190, endFreq: 62, dur: 0.08, gain: 0.14, type: 'square', pan: p });
        break;
      case 'shotgun':
        this.noise({ dur: 0.23, gain: 0.48, freq: 1350, type: 'lowpass', pan: p });
        this.noise({ dur: 0.09, gain: 0.22, freq: 3600, type: 'highpass', pan: p });
        this.tone({ freq: 108, endFreq: 34, dur: 0.28, gain: 0.29, type: 'triangle', pan: p });
        break;
      case 'rifle':
        this.noise({ dur: 0.1, gain: 0.34, freq: 2200, type: 'bandpass', q: 0.55, pan: p });
        this.noise({ dur: 0.2, gain: 0.15, freq: 540, type: 'lowpass', pan: p });
        this.tone({ freq: 142, endFreq: 46, dur: 0.16, gain: 0.2, type: 'sawtooth', pan: p });
        break;
      case 'rocket':
        this.noise({ dur: 0.55, gain: 0.22, freq: 900, type: 'lowpass', pan: p });
        this.tone({ freq: 92, endFreq: 52, dur: 0.5, gain: 0.18, type: 'sawtooth', pan: p });
        break;
      case 'enemy':
        this.noise({ dur: 0.07, gain: 0.15, freq: 1800, type: 'bandpass', q: 0.8, pan: p });
        this.tone({ freq: 130, endFreq: 48, dur: 0.1, gain: 0.09, type: 'square', pan: p });
        break;
      case 'turret':
        this.noise({ dur: 0.08, gain: 0.17, freq: 1200, type: 'bandpass', q: 1.4, pan: p });
        this.tone({ freq: 250, endFreq: 75, dur: 0.09, gain: 0.08, type: 'sawtooth', pan: p });
        break;
      default:
        this.noise({ dur: 0.08, gain: 0.3, freq: 2000, type: 'bandpass', pan: p });
    }
  }

  knifeSwish() {
    this.noise({ dur: 0.14, gain: 0.14, freq: 3200, type: 'bandpass', q: 1.2, attack: 0.01 });
    this.tone({ freq: 640, endFreq: 240, dur: 0.13, gain: 0.035, type: 'triangle' });
  }

  knifeHit() {
    this.noise({ dur: 0.1, gain: 0.26, freq: 900, type: 'lowpass' });
    this.tone({ freq: 170, endFreq: 55, dur: 0.12, gain: 0.18, type: 'square' });
    this.noise({ dur: 0.18, gain: 0.1, freq: 2600, type: 'highpass' });
  }

  jump() {
    this.tone({ freq: 230, endFreq: 340, dur: 0.11, gain: 0.06, type: 'triangle' });
    this.noise({ dur: 0.1, gain: 0.05, freq: 900, type: 'highpass' });
  }

  land(strength = 1) {
    this.noise({ dur: 0.08, gain: 0.1 * strength, freq: 340, type: 'lowpass' });
    this.tone({ freq: 85, endFreq: 48, dur: 0.1, gain: 0.06 * strength, type: 'triangle' });
  }

  roll() {
    this.noise({ dur: 0.3, gain: 0.1, freq: 500, type: 'lowpass', attack: 0.02 });
  }

  reload() {
    this.noise({ at: 0, dur: 0.035, gain: 0.17, freq: 2600, type: 'highpass' });
    this.tone({ at: 0.02, freq: 820, dur: 0.04, gain: 0.03, type: 'square' });
    this.noise({ at: 0.18, dur: 0.06, gain: 0.15, freq: 1200, type: 'bandpass' });
    this.tone({ at: 0.24, freq: 380, endFreq: 190, dur: 0.07, gain: 0.04, type: 'square' });
  }

  reloadDone() {
    this.noise({ dur: 0.05, gain: 0.13, freq: 3000, type: 'highpass' });
    this.tone({ freq: 660, endFreq: 840, dur: 0.07, gain: 0.035, type: 'square' });
  }

  empty() {
    this.tone({ freq: 920, dur: 0.035, gain: 0.025, type: 'square' });
    this.noise({ dur: 0.025, gain: 0.06, freq: 3000, type: 'highpass' });
  }

  pickup(kind = 'ammo') {
    const base = kind === 'health' ? 520 : kind === 'weapon' ? 380 : 640;
    this.tone({ freq: base, endFreq: base * 1.5, dur: 0.11, gain: 0.05, type: 'triangle' });
    this.tone({ at: 0.07, freq: base * 1.5, endFreq: base * 2.1, dur: 0.13, gain: 0.04, type: 'sine' });
  }

  throwGrenade() {
    this.noise({ dur: 0.18, gain: 0.06, freq: 1400, type: 'bandpass', attack: 0.015 });
    this.tone({ freq: 300, endFreq: 180, dur: 0.16, gain: 0.035, type: 'triangle' });
  }

  explosion(big = false) {
    const g = big ? 1.45 : 1;
    this.noise({ dur: 0.55 * g, gain: 0.42 * g, freq: 430, type: 'lowpass', q: 0.8 });
    this.noise({ dur: 0.18, gain: 0.24 * g, freq: 3800, type: 'highpass' });
    this.tone({ freq: 82, endFreq: 24, dur: 0.55 * g, gain: 0.36 * g, type: 'triangle' });
    this.tone({ at: 0.02, freq: 48, endFreq: 20, dur: 0.65 * g, gain: 0.3 * g, type: 'sine' });
  }

  hitMarker(headshot = false) {
    this.tone({ freq: headshot ? 1180 : 940, endFreq: headshot ? 1560 : 1220, dur: 0.035, gain: 0.03, type: 'square' });
  }

  hurt() {
    this.noise({ dur: 0.16, gain: 0.2, freq: 320, type: 'lowpass' });
    this.tone({ freq: 160, endFreq: 62, dur: 0.22, gain: 0.1, type: 'sawtooth' });
  }

  death() {
    this.tone({ freq: 220, endFreq: 42, dur: 1.4, gain: 0.18, type: 'sawtooth' });
    this.noise({ dur: 1.2, gain: 0.16, freq: 440, type: 'lowpass' });
  }

  objective() {
    this.tone({ freq: 440, endFreq: 660, dur: 0.18, gain: 0.06, type: 'triangle' });
    this.tone({ at: 0.12, freq: 660, endFreq: 880, dur: 0.24, gain: 0.05, type: 'sine' });
    this.tone({ at: 0.26, freq: 880, endFreq: 1180, dur: 0.3, gain: 0.035, type: 'sine' });
  }

  levelClear() {
    const notes = [220, 277, 330, 440, 554];
    notes.forEach((f, i) => {
      this.tone({ at: i * 0.12, freq: f, endFreq: f * 1.01, dur: 0.55, gain: 0.075, type: 'triangle' });
      this.tone({ at: i * 0.12, freq: f * 2, dur: 0.22, gain: 0.025, type: 'sine' });
    });
    this.noise({ dur: 1.2, gain: 0.04, freq: 900, type: 'highpass', attack: 0.4 });
  }

  alarm() {
    this.tone({ freq: 720, endFreq: 420, dur: 0.24, gain: 0.075, type: 'sawtooth' });
    this.tone({ at: 0.25, freq: 720, endFreq: 420, dur: 0.24, gain: 0.055, type: 'sawtooth' });
  }

  bossRoar() {
    this.tone({ freq: 58, endFreq: 34, dur: 1.4, gain: 0.28, type: 'sawtooth' });
    this.tone({ freq: 87, endFreq: 44, dur: 1.1, gain: 0.16, type: 'square' });
    this.noise({ dur: 1.3, gain: 0.14, freq: 300, type: 'lowpass' });
  }

  startMusic() {
    if (!this.ready || this.drone) return;
    this._musicWanted = true;
    const t = this.now();
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.11, t + 2.4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.Q.value = 1.5;
    out.connect(filter);
    filter.connect(this.musicBus);

    const oscA = this.ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 43.65;
    const oscB = this.ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 65.41;
    oscB.detune.value = -7;
    const oscC = this.ctx.createOscillator();
    oscC.type = 'sine';
    oscC.frequency.value = 87.31;
    const gainB = this.ctx.createGain();
    gainB.gain.value = 0.2;
    const gainC = this.ctx.createGain();
    gainC.gain.value = 0.06;
    oscA.connect(out);
    oscB.connect(gainB);
    gainB.connect(out);
    oscC.connect(gainC);
    gainC.connect(out);

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.075;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    [oscA, oscB, oscC, lfo].forEach(o => o.start(t));
    this.drone = { oscA, oscB, oscC, lfo, out, filter, gainB, gainC };
    this.beatClock = 0;
    this.beatIndex = 0;
  }

  stopMusic() {
    this._musicWanted = false;
    if (!this.drone) return;
    const d = this.drone;
    const t = this.now();
    try {
      d.out.gain.cancelScheduledValues(t);
      d.out.gain.setTargetAtTime(0.0001, t, 0.18);
      [d.oscA, d.oscB, d.oscC, d.lfo].forEach(o => o.stop(t + 1.1));
    } catch (_) { /* noop */ }
    this.drone = null;
  }

  update(dt, intensity = 0) {
    this.intensity += (intensity - this.intensity) * Math.min(1, dt * 2.2);
    if (!this.drone || !this.ready) return;
    const d = this.drone;
    const target = 180 + this.intensity * 520;
    d.filter.frequency.setTargetAtTime(target, this.now(), 0.5);
    d.gainB.gain.setTargetAtTime(0.18 + this.intensity * 0.14, this.now(), 0.5);
    const tempo = 0.52 - this.intensity * 0.11;
    this.beatClock += dt;
    if (this.beatClock >= tempo) {
      this.beatClock -= tempo;
      this.beatIndex++;
      if (this.intensity > 0.13) {
        this.tone({ freq: 54, endFreq: 38, dur: 0.18, gain: 0.11 * Math.min(1, this.intensity + 0.25), type: 'sine', bus: 'music' });
        this.noise({ dur: 0.08, gain: 0.035 * Math.min(1, this.intensity + 0.2), freq: 420, type: 'lowpass' });
      }
      if (this.beatIndex % 4 === 2 && this.intensity > 0.35) {
        this.noise({ dur: 0.12, gain: 0.045, freq: 1800, type: 'bandpass' });
      }
      if (this.beatIndex % 8 === 6 && this.intensity > 0.55) {
        this.tone({ freq: 116, endFreq: 82, dur: 0.42, gain: 0.038, type: 'sawtooth', bus: 'music' });
      }
    }
  }
}
