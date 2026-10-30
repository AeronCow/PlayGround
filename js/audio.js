import { clamp, rand } from './utils.js';

const STORE_KEY = 'hollow-warden-sound';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.noiseBuffer = null;
    this.muted = false;
    try { this.muted = localStorage.getItem(STORE_KEY) === 'muted'; } catch {}
    this.started = false;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.58;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.3;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.noiseBuffer = this.createNoise();
    this.startAmbient();
    this.started = true;
  }

  createNoise() {
    const length = Math.floor(this.ctx.sampleRate * 2);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.84 + white * 0.16;
      data[i] = last;
    }
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(STORE_KEY, muted ? 'muted' : 'on'); } catch {}
    if (this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.58, now, 0.06);
    }
  }

  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);
    bus.gain.setTargetAtTime(0.16, now + 0.2, 1.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.Q.value = 0.8;
    filter.connect(bus);

    const notes = [55, 82.41, 110, 164.81];
    const oscillators = [];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 5;
      const gain = ctx.createGain();
      gain.gain.value = i === 0 ? 0.12 : 0.045;
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      oscillators.push(osc);
    });

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.value = 520;
    nFilter.Q.value = 0.5;
    const nGain = ctx.createGain();
    nGain.gain.value = 0.03;
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(bus);
    noise.start(now);

    const pulse = ctx.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.value = 27.5;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.0001;
    pulse.connect(pulseGain);
    pulseGain.connect(bus);
    pulse.start(now);
    const pulseTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      pulseGain.gain.cancelScheduledValues(t);
      pulseGain.gain.setValueAtTime(0.0001, t);
      pulseGain.gain.exponentialRampToValueAtTime(0.11, t + 0.12);
      pulseGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    }, 4400);

    this.ambient = { bus, filter, oscillators, lfo, noise, pulse, pulseTimer };
  }

  stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const a = this.ambient;
    const now = this.ctx.currentTime;
    clearInterval(a.pulseTimer);
    a.bus.gain.cancelScheduledValues(now);
    a.bus.gain.setTargetAtTime(0, now, 0.25);
    setTimeout(() => {
      try {
        a.oscillators.forEach(o => o.stop());
        a.lfo.stop();
        a.noise.stop();
        a.pulse.stop();
      } catch {}
    }, 900);
    this.ambient = null;
  }

  tone({ freq = 220, to = null, type = 'sine', dur = 0.2, vol = 0.15, delay = 0, attack = 0.008, filter = 0, q = 1, pan = 0 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      f.Q.value = q;
      node.connect(f);
      node = f;
    }
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node.connect(p);
      node = p;
    }
    node.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noise({ dur = 0.2, vol = 0.1, from = 900, to = 3000, q = 0.8, delay = 0, type = 'bandpass', pan = 0 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = filter;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      filter.connect(p);
      node = p;
    }
    src.connect(filter);
    node.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  play(name, x = 0) {
    if (!this.ctx || this.muted) return;
    const pan = clamp(x, -1, 1) * 0.55;
    switch (name) {
      case 'slash':
        this.noise({ dur: 0.13, vol: 0.10, from: 2600, to: 500, q: 1.4, pan });
        this.tone({ freq: 520, to: 190, type: 'triangle', dur: 0.11, vol: 0.06, pan });
        break;
      case 'hit':
        this.tone({ freq: 170, to: 46, type: 'sine', dur: 0.22, vol: 0.30, pan });
        this.noise({ dur: 0.12, vol: 0.16, from: 1700, to: 240, q: 0.6, pan });
        break;
      case 'deflect':
        this.tone({ freq: 1400, to: 720, type: 'triangle', dur: 0.14, vol: 0.10, pan });
        this.noise({ dur: 0.09, vol: 0.06, from: 5200, to: 1200, q: 2, pan });
        break;
      case 'jump':
        this.tone({ freq: 260, to: 430, type: 'triangle', dur: 0.12, vol: 0.07, pan });
        break;
      case 'double':
        this.tone({ freq: 520, to: 920, type: 'sine', dur: 0.22, vol: 0.07, pan });
        this.noise({ dur: 0.18, vol: 0.04, from: 1700, to: 4800, q: 1.4, pan });
        break;
      case 'dash':
        this.noise({ dur: 0.22, vol: 0.12, from: 340, to: 2600, q: 0.8, pan });
        this.tone({ freq: 110, to: 55, type: 'triangle', dur: 0.16, vol: 0.05, pan });
        break;
      case 'hurt':
        this.tone({ freq: 240, to: 52, type: 'sawtooth', dur: 0.42, vol: 0.17, filter: 900, pan });
        this.noise({ dur: 0.28, vol: 0.15, from: 900, to: 100, q: 0.5, pan });
        break;
      case 'heal':
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.6, vol: 0.055, delay: i * 0.07, pan }));
        break;
      case 'focus':
        this.tone({ freq: 130.81, to: 196, type: 'triangle', dur: 0.8, vol: 0.05, pan });
        this.noise({ dur: 0.6, vol: 0.03, from: 500, to: 2400, q: 2, pan });
        break;
      case 'shock':
        this.tone({ freq: 75, to: 28, type: 'sine', dur: 0.5, vol: 0.34, pan });
        this.noise({ dur: 0.4, vol: 0.18, from: 620, to: 70, q: 0.6, pan });
        break;
      case 'roar':
        this.tone({ freq: 92, to: 38, type: 'sawtooth', dur: 1.2, vol: 0.16, filter: 340, pan });
        this.tone({ freq: 138, to: 54, type: 'triangle', dur: 1.1, vol: 0.13, pan });
        this.noise({ dur: 0.9, vol: 0.12, from: 280, to: 60, q: 0.4, pan });
        break;
      case 'phase':
        this.tone({ freq: 55, to: 27.5, type: 'sawtooth', dur: 1.8, vol: 0.2, filter: 260, pan });
        this.noise({ dur: 1.5, vol: 0.16, from: 1200, to: 80, q: 0.5, pan });
        this.tone({ freq: 880, to: 1760, type: 'sine', dur: 1.2, vol: 0.04, delay: 0.4, pan });
        break;
      case 'spike':
        this.tone({ freq: 900, to: 180, type: 'triangle', dur: 0.12, vol: 0.05, pan });
        this.noise({ dur: 0.16, vol: 0.08, from: 3200, to: 500, q: 1.2, pan });
        break;
      case 'death':
        this.tone({ freq: 140, to: 31, type: 'sawtooth', dur: 2.2, vol: 0.18, filter: 500, pan });
        this.noise({ dur: 1.8, vol: 0.12, from: 600, to: 40, q: 0.4, pan });
        break;
      case 'victory':
        [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => {
          this.tone({ freq: f, type: 'sine', dur: 1.8, vol: 0.075, delay: i * 0.14, pan });
          this.tone({ freq: f * 2, type: 'triangle', dur: 1.2, vol: 0.018, delay: i * 0.14, pan });
        });
        break;
      case 'ui':
        this.tone({ freq: 700, to: 900, type: 'sine', dur: 0.07, vol: 0.04, pan });
        break;
      case 'tilt':
        this.tone({ freq: 420, to: 620, type: 'triangle', dur: 0.16, vol: 0.05, pan });
        break;
    }
  }
}
