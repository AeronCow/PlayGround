/* ==========================================================================
   STARFALL: NEON SIEGE
   A self-contained canvas wave-defense shooter.
   ========================================================================== */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);

  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const ui = {
    hud: $('hud'), score: $('score'), hudBest: $('hudBest'),
    waveLabel: $('waveLabel'), waveName: $('waveName'),
    shields: $('shields'), bombs: $('bombs'),
    bossWrap: $('bossWrap'), bossFill: $('bossFill'), bossName: $('bossName'),
    combo: $('combo'), powerups: $('powerups'),
    toast: $('toast'), toastKicker: $('toastKicker'), toastTitle: $('toastTitle'), toastSub: $('toastSub'),
    hint: $('hint'), vignette: $('vignette'),
    muteBtn: $('muteBtn'), pauseBtn: $('pauseBtn'), bombBtn: $('bombBtn'),
    menu: $('menu'), pause: $('pause'), gameover: $('gameover'), victory: $('victory'),
    menuBest: $('menuBest'),
    goScore: $('goScore'), goWave: $('goWave'), goKills: $('goKills'), goBest: $('goBest'),
    winScore: $('winScore'), winTime: $('winTime'), winKills: $('winKills'), winBest: $('winBest'),
    startBtn: $('startBtn'), resumeBtn: $('resumeBtn'), quitBtn: $('quitBtn'),
    retryBtn: $('retryBtn'), menuBtn: $('menuBtn'), againBtn: $('againBtn'), winMenuBtn: $('winMenuBtn'),
  };

  const chips = {
    rapid: ui.powerups.querySelector('[data-power="rapid"]'),
    spread: ui.powerups.querySelector('[data-power="spread"]'),
    power: ui.powerups.querySelector('[data-power="power"]'),
  };

  /* ------------------------------------------------------------------ utils */

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };
  const angleLerp = (a, b, t) => {
    let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + d * t;
  };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  };

  const WAVE_NAMES = [
    'FIRST CONTACT', 'SWARM SIGNAL', 'CROSSFIRE', 'IRON VEIL', 'THE SENTINEL',
    'DEEP STRIKE', 'FRACTURE', 'LOCKDOWN', 'LAST LIGHT', 'VOID TYRANT',
  ];

  const PICKUPS = {
    shield: { color: '#46e8ff', glyph: '+', label: 'SHIELD +1' },
    rapid: { color: '#ffd166', glyph: '»', label: 'RAPID FIRE' },
    spread: { color: '#7cffb2', glyph: '≡', label: 'SPREAD SHOT' },
    power: { color: '#ff7ae0', glyph: '★', label: 'OVERDRIVE' },
    bomb: { color: '#ff9f43', glyph: '●', label: 'PULSE +1' },
  };

  let W = 0;
  let H = 0;
  let DPR = 1;
  let bgCanvas = null;
  let stars = [];
  let bestScore = 0;
  let overlayTimer = 0;
  try { bestScore = Number(localStorage.getItem('starfall.best')) || 0; } catch (_) { bestScore = 0; }

  /* ------------------------------------------------------------------ audio */

  const Sound = {
    ctx: null,
    master: null,
    noiseBuf: null,
    enabled: true,
    lastShoot: 0,
    lastHit: 0,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.45 : 0;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.6);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      } catch (_) {
        this.ctx = null;
      }
    },

    tone(freq, dur, type = 'sine', vol = 0.05, slide = 1, delay = 0) {
      if (!this.ctx || !this.enabled) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    },

    noise(dur, vol, cutoff = 1200, type = 'lowpass') {
      if (!this.ctx || !this.enabled || !this.noiseBuf) return;
      const t0 = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(cutoff, t0);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.0002, vol), t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    },

    shoot() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastShoot < 0.045) return;
      this.lastShoot = now;
      this.tone(760 + Math.random() * 120, 0.055, 'triangle', 0.022, 0.45);
    },
    hit() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastHit < 0.05) return;
      this.lastHit = now;
      this.tone(210, 0.04, 'square', 0.011, 0.55);
    },
    explode() {
      this.noise(0.3, 0.12, 760);
      this.tone(90, 0.24, 'sine', 0.045, 0.4);
    },
    bigExplode() {
      this.noise(0.9, 0.2, 380);
      this.tone(55, 1.0, 'sine', 0.1, 0.3);
      this.tone(120, 0.6, 'sawtooth', 0.04, 0.35);
    },
    pickup() {
      this.tone(720, 0.08, 'sine', 0.05, 1.4);
      this.tone(1080, 0.13, 'sine', 0.04, 1.5, 0.06);
    },
    playerHit() {
      this.noise(0.28, 0.16, 520);
      this.tone(150, 0.28, 'sawtooth', 0.055, 0.45);
    },
    bomb() {
      this.noise(0.7, 0.22, 320);
      this.tone(62, 0.75, 'sine', 0.09, 0.35);
    },
    wave() {
      this.tone(420, 0.12, 'triangle', 0.05, 1.3);
      this.tone(630, 0.18, 'triangle', 0.04, 1.4, 0.1);
    },
    waveClear() {
      this.tone(520, 0.1, 'triangle', 0.045, 1.2);
      this.tone(780, 0.16, 'triangle', 0.04, 1.2, 0.09);
    },
    bossWarn() {
      this.tone(72, 1.1, 'sawtooth', 0.06, 0.55);
      this.tone(144, 1.0, 'triangle', 0.035, 0.55, 0.08);
    },
    bossShot() {
      this.tone(150, 0.12, 'sawtooth', 0.02, 0.6);
    },
    gameOver() {
      this.tone(240, 0.5, 'sawtooth', 0.055, 0.4);
      this.tone(120, 0.9, 'sine', 0.07, 0.3, 0.18);
    },
    victory() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => {
        this.tone(f, 0.35, 'triangle', 0.045, 1.05, i * 0.14);
      });
      this.tone(261, 1.6, 'sine', 0.05, 1.0, 0.1);
    },
  };

  /* ------------------------------------------------------------------ state */

  const G = {
    mode: 'menu',
    score: 0,
    best: bestScore,
    bestAtRunStart: bestScore,
    wave: 0,
    kills: 0,
    shots: 0,
    streak: 0,
    combo: 1,
    comboTimer: 0,
    shields: 3,
    maxShields: 5,
    bombs: 2,
    maxBombs: 5,
    rapid: 0,
    spread: 0,
    power: 0,
    player: null,
    enemies: [],
    bullets: [],
    ebullets: [],
    particles: [],
    pickups: [],
    texts: [],
    rings: [],
    spawns: [],
    spawnTimer: 0,
    waveActive: false,
    waveEndTimer: 0,
    intermission: 0,
    pendingVictory: 0,
    boss: null,
    time: 0,
    gameTime: 0,
    shake: 0,
    flash: 0,
    flashColor: '255,255,255',
    pointer: { active: false, x: 0, y: 0 },
    hintTimer: 9,
    hudAcc: 0,
    lastFrame: 0,
  };

  /* -------------------------------------------------------------- background */

  function blob(c, x, y, r, color) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function buildBackground() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = Math.max(1, Math.round(W * DPR));
    bgCanvas.height = Math.max(1, Math.round(H * DPR));
    const c = bgCanvas.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);

    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#040711');
    sky.addColorStop(0.48, '#070b1b');
    sky.addColorStop(1, '#0b0817');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    c.globalCompositeOperation = 'lighter';
    blob(c, W * 0.16, H * 0.26, Math.max(W, H) * 0.42, 'rgba(18, 94, 190, 0.11)');
    blob(c, W * 0.82, H * 0.18, Math.max(W, H) * 0.34, 'rgba(138, 26, 118, 0.09)');
    blob(c, W * 0.58, H * 0.78, Math.max(W, H) * 0.4, 'rgba(24, 72, 138, 0.07)');
    blob(c, W * 0.05, H * 0.92, Math.max(W, H) * 0.3, 'rgba(120, 20, 90, 0.05)');

    // Distant planet, mostly below the frame.
    c.globalCompositeOperation = 'source-over';
    const pr = Math.max(W, H) * 0.62;
    const px = W * 0.87;
    const py = H * 1.22;
    const planet = c.createRadialGradient(px - pr * 0.55, py - pr * 0.7, pr * 0.05, px, py, pr);
    planet.addColorStop(0, 'rgba(64, 110, 168, 0.24)');
    planet.addColorStop(0.5, 'rgba(24, 44, 82, 0.2)');
    planet.addColorStop(1, 'rgba(3, 5, 14, 0.92)');
    c.beginPath();
    c.arc(px, py, pr, 0, TAU);
    c.fillStyle = planet;
    c.fill();
    c.strokeStyle = 'rgba(92, 206, 255, 0.10)';
    c.lineWidth = 2;
    c.stroke();

    // Sparse horizon haze.
    const haze = c.createLinearGradient(0, H * 0.7, 0, H);
    haze.addColorStop(0, 'rgba(20, 60, 110, 0)');
    haze.addColorStop(1, 'rgba(22, 52, 100, 0.12)');
    c.fillStyle = haze;
    c.fillRect(0, H * 0.7, W, H * 0.3);

    // Edge falloff.
    const vig = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.72, 'rgba(0,0,0,0.12)');
    vig.addColorStop(1, 'rgba(0,0,0,0.58)');
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);
  }

  function initStars() {
    const count = clamp(Math.round((W * H) / 8200), 90, 260);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        z: rand(0.25, 1),
        size: rand(0.6, 1.9),
        tw: rand(0.5, 2.4),
        phase: rand(0, TAU),
      });
    }
  }

  function resize() {
    W = Math.max(320, window.innerWidth);
    H = Math.max(480, window.innerHeight);
    DPR = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildBackground();
    initStars();
    if (G.player) {
      G.player.x = clamp(G.player.x, 28, W - 28);
      G.player.y = clamp(G.player.y, 96, H - 28);
    }
  }

  function updateStars(dt) {
    const speed = G.mode === 'playing' ? 26 : 8;
    for (const s of stars) {
      s.y += speed * s.z * dt;
      s.x -= (G.mode === 'playing' ? 4 : 1.2) * s.z * dt;
      if (s.y > H + 3) { s.y = -3; s.x = rand(0, W); }
      if (s.x < -3) s.x = W + 3;
    }
  }

  /* ------------------------------------------------------------------ input */

  const keys = new Set();
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    G.pointer.x = e.clientX - r.left;
    G.pointer.y = e.clientY - r.top;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (G.mode !== 'playing') return;
    G.pointer.active = true;
    pointerPos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!G.pointer.active) return;
    pointerPos(e);
  });
  const endPointer = () => { G.pointer.active = false; };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
    keys.add(code);
    if (e.repeat) return;

    if (code === 'Escape' || code === 'KeyP') {
      if (G.mode === 'playing' || G.mode === 'paused') togglePause();
      return;
    }
    if (code === 'Space' && G.mode === 'playing') { useBomb(); return; }
    if (code === 'KeyM') { toggleMute(); return; }
    if (code === 'KeyR' && (G.mode === 'gameover' || G.mode === 'victory')) { startGame(); return; }
    if (code === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      if (G.mode === 'menu' || G.mode === 'gameover' || G.mode === 'victory') startGame();
    }
  });

  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    G.pointer.active = false;
    if (G.mode === 'playing') togglePause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.mode === 'playing') togglePause();
  });

  /* ------------------------------------------------------------------ HUD */

  const shieldPips = [];
  const bombPips = [];
  for (let i = 0; i < G.maxShields; i++) {
    const el = document.createElement('span');
    el.className = 'pip';
    ui.shields.appendChild(el);
    shieldPips.push(el);
  }
  for (let i = 0; i < G.maxBombs; i++) {
    const el = document.createElement('span');
    el.className = 'bomb-pip';
    ui.bombs.appendChild(el);
    bombPips.push(el);
  }

  function updateHUD() {
    ui.score.textContent = fmt(G.score);
    ui.hudBest.textContent = fmt(G.best);
    ui.menuBest.textContent = fmt(G.best);
    ui.waveLabel.textContent = 'WAVE ' + Math.max(1, G.wave);
    ui.waveName.textContent = WAVE_NAMES[Math.max(0, G.wave - 1)] || '';

    for (let i = 0; i < shieldPips.length; i++) shieldPips[i].classList.toggle('on', i < G.shields);
    for (let i = 0; i < bombPips.length; i++) bombPips[i].classList.toggle('on', i < G.bombs);

    if (G.combo > 1) {
      ui.combo.classList.remove('is-hidden');
      ui.combo.textContent = 'x' + G.combo;
    } else {
      ui.combo.classList.add('is-hidden');
    }

    const timers = { rapid: G.rapid, spread: G.spread, power: G.power };
    for (const key of ['rapid', 'spread', 'power']) {
      const chip = chips[key];
      if (!chip) continue;
      const t = timers[key];
      chip.classList.toggle('show', t > 0);
      chip.style.setProperty('--p', Math.round(clamp(t / 10, 0, 1) * 100) + '%');
    }

    if (G.boss && !G.boss.dead) {
      ui.bossWrap.classList.remove('is-hidden');
      const pct = clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100;
      ui.bossFill.style.width = pct + '%';
      ui.bossName.textContent = G.boss.variant === 2 ? 'VOID TYRANT' : 'THE SENTINEL';
    } else {
      ui.bossWrap.classList.add('is-hidden');
    }

    ui.bombBtn.textContent = 'PULSE ' + G.bombs;
    ui.bombBtn.classList.toggle('empty', G.bombs <= 0);

    const danger = G.mode === 'playing' && G.player && G.player.alive && G.shields <= 1;
    ui.vignette.classList.toggle('danger', Boolean(danger));
  }

  function showToast(kicker, title, sub, tone = '') {
    ui.toastKicker.textContent = kicker;
    ui.toastTitle.textContent = title;
    ui.toastSub.textContent = sub;
    ui.toast.className = 'toast';
    void ui.toast.offsetWidth;
    ui.toast.className = 'toast show' + (tone ? ' ' + tone : '');
  }

  function setOverlay(name) {
    if (name === 'menu') {
      ui.menu.classList.remove('launched');
      ui.menu.removeAttribute('aria-hidden');
      ui.menu.removeAttribute('inert');
    }
    const overlays = {
      menu: ui.menu,
      pause: ui.pause,
      gameover: ui.gameover,
      victory: ui.victory,
    };
    for (const [key, el] of Object.entries(overlays)) {
      el.classList.toggle('is-hidden', key !== name);
    }
    const hideHud = name === 'menu' || name === 'gameover' || name === 'victory';
    ui.hud.classList.toggle('is-hidden', hideHud);
    ui.hud.setAttribute('aria-hidden', hideHud ? 'true' : 'false');
    ui.vignette.classList.toggle('danger', name === 'gameover');
  }

  /* ------------------------------------------------------------------ menu */

  function goMenu() {
    clearTimeout(overlayTimer);
    G.mode = 'menu';
    G.pointer.active = false;
    G.enemies = [];
    G.bullets = [];
    G.ebullets = [];
    G.pickups = [];
    G.particles = [];
    G.texts = [];
    G.rings = [];
    G.boss = null;
    G.player = null;
    G.wave = 0;
    G.score = 0;
    setOverlay('menu');
    updateHUD();
    render();
  }

  function startGame() {
    Sound.init();
    const fromMenu = !ui.menu.classList.contains('is-hidden') && !ui.menu.classList.contains('launched');
    G.mode = 'playing';
    G.score = 0;
    G.bestAtRunStart = G.best;
    G.wave = 0;
    G.kills = 0;
    G.shots = 0;
    G.streak = 0;
    G.combo = 1;
    G.comboTimer = 0;
    G.shields = 3;
    G.bombs = 2;
    G.rapid = 0;
    G.spread = 0;
    G.power = 0;
    G.gameTime = 0;
    G.shake = 0;
    G.flash = 0;
    G.pointer.active = false;
    G.hintTimer = 9;
    G.hudAcc = 0;
    G.enemies = [];
    G.bullets = [];
    G.ebullets = [];
    G.particles = [];
    G.pickups = [];
    G.texts = [];
    G.rings = [];
    G.spawns = [];
    G.spawnTimer = 0;
    G.intermission = 0;
    G.pendingVictory = 0;
    G.waveActive = false;
    G.boss = null;
    G.player = {
      x: W / 2,
      y: H * 0.8,
      vx: 0,
      vy: 0,
      r: 13,
      aim: -Math.PI / 2,
      invuln: 1.2,
      fireCd: 0.2,
      engineTimer: 0,
      bombCd: 0,
      alive: true,
    };
    ui.hint.classList.remove('fade');
    clearTimeout(overlayTimer);
    if (fromMenu) {
      // Keep the menu element in the layout until the launching click settles.
      // It is pushed behind the opaque canvas so the launch is instant, while
      // the start control stays present for the duration of the click action.
      ui.menu.classList.add('launched');
      ui.menu.setAttribute('aria-hidden', 'true');
      ui.hud.classList.remove('is-hidden');
      ui.hud.setAttribute('aria-hidden', 'false');
      overlayTimer = setTimeout(() => {
        if (G.mode === 'playing' || G.mode === 'paused') {
          setOverlay(G.mode === 'paused' ? 'pause' : null);
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        }
      }, 1500);
    } else {
      setOverlay(null);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
    updateHUD();
    beginWave(1);
  }

  /* ------------------------------------------------------------------ waves */

  function buildWave(n) {
    const list = [];
    const add = (type, count, gap, start = 0.25) => {
      for (let i = 0; i < count; i++) list.push({ type, t: start + i * gap });
    };
    switch (n) {
      case 1:
        add('drone', 6, 0.18, 0.1);
        break;
      case 2:
        add('drone', 6, 0.42, 0.2);
        add('zigzag', 2, 0.8, 1.3);
        break;
      case 3:
        add('drone', 4, 0.45, 0.2);
        add('shooter', 3, 0.7, 1.0);
        add('zigzag', 2, 0.6, 2.4);
        break;
      case 4:
        add('zigzag', 5, 0.4, 0.2);
        add('shooter', 3, 0.6, 1.2);
        add('tank', 2, 1.2, 2.1);
        break;
      case 5:
        list.push({ type: 'boss', t: 0.55, boss: 1 });
        break;
      case 6:
        add('drone', 8, 0.34, 0.2);
        add('shooter', 4, 0.6, 1.4);
        break;
      case 7:
        add('tank', 3, 1.0, 0.2);
        add('splitter', 3, 0.8, 1.2);
        add('zigzag', 4, 0.4, 2.2);
        break;
      case 8:
        add('shooter', 7, 0.44, 0.2);
        add('zigzag', 6, 0.34, 1.2);
        add('splitter', 2, 1.0, 2.5);
        break;
      case 9:
        add('tank', 5, 0.9, 0.2);
        add('splitter', 4, 0.7, 1.0);
        add('drone', 6, 0.3, 2.0);
        add('shooter', 4, 0.5, 2.5);
        break;
      case 10:
        list.push({ type: 'boss', t: 0.6, boss: 2 });
        add('tank', 2, 1.3, 3.2);
        break;
      default:
        add('drone', 5, 0.4, 0.2);
    }
    return list.sort((a, b) => a.t - b.t);
  }

  function beginWave(n) {
    G.wave = n;
    G.spawns = buildWave(n);
    G.spawnTimer = 0;
    G.waveActive = true;
    G.waveEndTimer = 0;
    G.intermission = 0;
    G.pendingVictory = 0;
    updateHUD();
    if (n === 5 || n === 10) {
      showToast('WARNING', WAVE_NAMES[n - 1], 'BOSS INBOUND', 'danger');
      Sound.bossWarn();
    } else {
      showToast('WAVE ' + n, WAVE_NAMES[n - 1], 'INCOMING', n === 9 ? 'danger' : '');
      Sound.wave();
    }
  }

  function spawnPoint() {
    const roll = Math.random();
    if (roll < 0.78) return { x: rand(70, Math.max(71, W - 70)), y: rand(132, 212) };
    if (roll < 0.9) return { x: rand(48, 88), y: rand(150, Math.max(151, H - 140)) };
    return { x: rand(Math.max(89, W - 88), W - 48), y: rand(150, Math.max(151, H - 140)) };
  }

  function makeEnemy(type, x, y, variant = 0) {
    const w = G.wave;
    const e = {
      type, x, y, vx: 0, vy: 0, r: 14, hp: 2, maxHp: 2, speed: 100, score: 100,
      color: '#ff3f9e', t: 0, spawnT: 0.55, hitT: 0, fireCd: rand(0.9, 2.0),
      phase: rand(0, TAU), angle: 0, dead: false, boss: false,
    };
    switch (type) {
      case 'drone':
        e.r = 14; e.hp = 2 + Math.floor(w * 0.32); e.speed = 88 + w * 5; e.score = 100; e.color = '#ff3f9e';
        break;
      case 'zigzag':
        e.r = 12; e.hp = 2 + Math.floor(w * 0.26); e.speed = 145 + w * 3; e.score = 130; e.color = '#ff7a5c';
        break;
      case 'shooter':
        e.r = 16; e.hp = 3 + Math.floor(w * 0.34); e.speed = 70 + w * 2; e.score = 170; e.color = '#c46bff';
        break;
      case 'tank':
        e.r = 25; e.hp = 11 + w; e.speed = 42 + w; e.score = 320; e.color = '#ff4d6d';
        break;
      case 'splitter':
        e.r = 18; e.hp = 4 + Math.floor(w * 0.5); e.speed = 92 + w * 2; e.score = 230; e.color = '#8f7bff';
        break;
      case 'mini':
        e.r = 9; e.hp = 1; e.speed = 190; e.score = 40; e.color = '#ff9f43'; e.spawnT = 0.2;
        break;
      case 'boss': {
        const final = variant === 2;
        e.r = 58;
        e.hp = final ? 380 : 220;
        e.maxHp = e.hp;
        e.speed = 70;
        e.score = final ? 9000 : 5000;
        e.color = final ? '#ff3f9e' : '#ff5c7a';
        e.spawnT = 1.1;
        e.variant = variant;
        e.boss = true;
        e.entered = false;
        e.enraged = false;
        e.radialCd = 2.2;
        e.aimedCd = 1.4;
        e.summonCd = 7;
        e.spiralCd = 0.4;
        e.spiralAngle = 0;
        break;
      }
    }
    e.maxHp = e.hp;
    e.spawnMax = e.spawnT;
    const px = G.player ? G.player.x : x;
    const py = G.player ? G.player.y : y + 100;
    e.angle = Math.atan2(py - y, px - x);
    return e;
  }

  function addEnemy(type, x, y, variant = 0) {
    const e = makeEnemy(type, x, y, variant);
    G.enemies.push(e);
    return e;
  }

  function spawnEnemy(type, variant = 0) {
    const pt = type === 'boss' ? { x: W / 2, y: -110 } : spawnPoint();
    const e = addEnemy(type, pt.x, pt.y, variant);
    if (G.wave === 1 && type !== 'boss') {
      e.spawnT = 0.18;
      e.spawnMax = 0.18;
    }
    ring(pt.x, pt.y, type === 'boss' ? 150 : 46, type === 'boss' ? '#ff3f9e' : e.color, 2, 0.65);
    if (type === 'boss') {
      G.boss = e;
      G.shake = Math.max(G.shake, 10);
      updateHUD();
    }
  }

  function nearestEnemy(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const e of G.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function enemyBullet(x, y, angle, speed, r = 5, color = '#ff4d9d') {
    if (G.ebullets.length > 420) return;
    G.ebullets.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r, life: 6, spin: rand(0, TAU), color,
    });
  }

  function shootAimed(e, speed, count = 1, spread = 0.1, color) {
    if (!G.player || !G.player.alive) return;
    const base = Math.atan2(G.player.y - e.y, G.player.x - e.x);
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread;
      enemyBullet(e.x + Math.cos(a) * e.r * 0.7, e.y + Math.sin(a) * e.r * 0.7, a, speed, 5, color || e.color);
    }
  }

  function radialBurst(x, y, count, speed, offset = 0, color = '#ff7a5c', r = 5) {
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * TAU;
      enemyBullet(x + Math.cos(a) * 22, y + Math.sin(a) * 22, a, speed, r, color);
    }
  }

  /* ---------------------------------------------------------------- enemies */

  function updateEnemies(dt) {
    const p = G.player;
    if (!p) return;

    for (const e of G.enemies) {
      if (e.dead) continue;
      e.t += dt;
      e.hitT = Math.max(0, e.hitT - dt);
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        continue;
      }
      if (e.boss) {
        updateBoss(e, dt);
        continue;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;

      if (e.type === 'shooter') {
        let tx = 0;
        let ty = 0;
        if (d > 300) { tx = nx; ty = ny; }
        else if (d < 205) { tx = -nx; ty = -ny; }
        else { tx = -ny; ty = nx; }
        e.vx += tx * e.speed * 2.4 * dt;
        e.vy += ty * e.speed * 2.4 * dt;
        const sp = Math.hypot(e.vx, e.vy) || 1;
        const max = e.speed * 1.55;
        if (sp > max) { e.vx = (e.vx / sp) * max; e.vy = (e.vy / sp) * max; }
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = Math.max(0.9, 2.15 - G.wave * 0.055);
          shootAimed(e, 235 + G.wave * 4, G.wave >= 8 ? 2 : 1, 0.13);
        }
      } else if (e.type === 'tank') {
        e.vx += nx * e.speed * 1.35 * dt;
        e.vy += ny * e.speed * 1.35 * dt;
        const sp = Math.hypot(e.vx, e.vy) || 1;
        if (sp > e.speed) { e.vx = (e.vx / sp) * e.speed; e.vy = (e.vy / sp) * e.speed; }
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = 2.9;
          radialBurst(e.x, e.y, 7, 145 + G.wave * 3, e.t, '#ff7a5c', 5);
        }
      } else if (e.type === 'zigzag') {
        const wobble = Math.sin(e.t * 3.4 + e.phase) * 115;
        const vx = nx * e.speed + -ny * wobble;
        const vy = ny * e.speed + nx * wobble;
        const k = 1 - Math.exp(-dt * 5);
        e.vx = lerp(e.vx, vx, k);
        e.vy = lerp(e.vy, vy, k);
      } else {
        const accel = e.type === 'mini' ? 4.2 : 2.8;
        e.vx += nx * e.speed * accel * dt;
        e.vy += ny * e.speed * accel * dt;
        const sp = Math.hypot(e.vx, e.vy) || 1;
        if (sp > e.speed) { e.vx = (e.vx / sp) * e.speed; e.vy = (e.vy / sp) * e.speed; }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (Math.hypot(e.vx, e.vy) > 3) e.angle = Math.atan2(e.vy, e.vx);
    }

    // Soft separation keeps the swarm readable.
    for (let i = 0; i < G.enemies.length; i++) {
      const a = G.enemies[i];
      if (a.dead || a.boss || a.spawnT > 0) continue;
      for (let j = i + 1; j < G.enemies.length; j++) {
        const b = G.enemies[j];
        if (b.dead || b.boss || b.spawnT > 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (a.r + b.r) * 0.82;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
  }

  function updateBoss(e, dt) {
    const p = G.player;
    if (!p) return;

    if (!e.entered) {
      e.y += 165 * dt;
      if (e.y >= 168) { e.y = 168; e.entered = true; }
      return;
    }

    const phase2 = e.hp < e.maxHp * 0.5;
    if (phase2 && !e.enraged) {
      e.enraged = true;
      G.shake = Math.max(G.shake, 18);
      ring(e.x, e.y, 220, '#ff3f9e', 4, 0.7);
      showToast('ENRAGED', e.variant === 2 ? 'VOID TYRANT' : 'THE SENTINEL', 'PHASE II', 'danger');
      Sound.bossWarn();
    }

    const t = e.t;
    e.x = W / 2 + Math.sin(t * 0.62) * Math.min(W * 0.31, 370);
    e.y = 168 + Math.sin(t * 1.1) * 16;
    e.angle = Math.sin(t * 0.62 + Math.PI / 2);

    e.radialCd -= dt;
    e.aimedCd -= dt;
    e.summonCd -= dt;

    if (e.radialCd <= 0) {
      e.radialCd = phase2 ? 2.0 : 2.4;
      radialBurst(e.x, e.y, phase2 ? 18 : 14, 145 + (phase2 ? 45 : 25), t, phase2 ? '#ff3f9e' : '#ff7a5c', 5);
      Sound.bossShot();
    }
    if (e.aimedCd <= 0) {
      e.aimedCd = phase2 ? 1.05 : 1.45;
      shootAimed(e, 300, 3, 0.13, '#ff5c7a');
    }
    if (phase2) {
      e.spiralCd -= dt;
      if (e.spiralCd <= 0) {
        e.spiralCd = 0.22;
        e.spiralAngle += 0.36;
        enemyBullet(e.x, e.y, e.spiralAngle, 160, 4, '#ff7ae0');
        enemyBullet(e.x, e.y, e.spiralAngle + Math.PI, 160, 4, '#ff7ae0');
      }
    }
    if (e.summonCd <= 0) {
      e.summonCd = phase2 ? 6 : 8.5;
      const count = e.variant === 2 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const type = Math.random() < 0.55 ? 'drone' : 'zigzag';
        addEnemy(type, e.x + rand(-95, 95), e.y + rand(-4, 55));
      }
      Sound.bossShot();
    }
  }

  /* --------------------------------------------------------------- effects */

  function particle(x, y, vx, vy, life, size, color, drag = 2.2, streak = false) {
    if (G.particles.length > 680) return;
    G.particles.push({
      x, y, vx, vy, life, maxLife: life, size, color, drag, streak, dead: false,
    });
  }

  function burst(x, y, color, count = 10, speed = 200, size = 3) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.25, speed);
      particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.7), rand(size * 0.5, size * 1.4), color, 2.6, Math.random() < 0.25);
    }
  }

  function ring(x, y, maxR, color, width = 2, life = 0.45) {
    G.rings.push({ x, y, maxR, color, width, life, maxLife: life, dead: false });
  }

  function floatText(x, y, text, color = '#ffffff', size = 13) {
    G.texts.push({ x, y, text, color, size, life: 0.95, maxLife: 0.95, dead: false });
  }

  function updateEffects(dt) {
    G.shake = Math.max(0, G.shake - dt * 58);
    G.flash = Math.max(0, G.flash - dt * 2.9);
    G.hintTimer -= dt;
    if (G.hintTimer <= 0) ui.hint.classList.add('fade');

    for (const p of G.particles) {
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
    }
    if (G.particles.length > 200) G.particles = G.particles.filter((p) => !p.dead);

    for (const r of G.rings) {
      r.life -= dt;
      if (r.life <= 0) r.dead = true;
    }
    if (G.rings.length > 60) G.rings = G.rings.filter((r) => !r.dead);

    for (const t of G.texts) {
      t.life -= dt;
      t.y -= 27 * dt;
      if (t.life <= 0) t.dead = true;
    }
    if (G.texts.length > 40) G.texts = G.texts.filter((t) => !t.dead);
  }

  /* ----------------------------------------------------------------- player */

  function updatePlayer(dt) {
    const p = G.player;
    if (!p || !p.alive) return;

    p.invuln = Math.max(0, p.invuln - dt);
    p.fireCd -= dt;
    p.bombCd = Math.max(0, (p.bombCd || 0) - dt);

    let dx = 0;
    let dy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

    if (G.pointer.active) {
      const tx = G.pointer.x - p.x;
      const ty = G.pointer.y - p.y;
      const d = Math.hypot(tx, ty);
      if (d > 5) { dx += tx / d; dy += ty / d; }
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }

    const speed = 372;
    const k = 1 - Math.exp(-dt * 16);
    p.vx = lerp(p.vx, dx * speed, k);
    p.vy = lerp(p.vy, dy * speed, k);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 28, W - 28);
    p.y = clamp(p.y, 96, H - 28);

    // Engine exhaust.
    p.engineTimer -= dt;
    if (p.engineTimer <= 0) {
      p.engineTimer = 0.026;
      const back = p.aim + Math.PI;
      const jitter = rand(-0.35, 0.35);
      particle(
        p.x + Math.cos(back) * 12 + rand(-3, 3),
        p.y + Math.sin(back) * 12 + rand(-3, 3),
        Math.cos(back + jitter) * rand(30, 90),
        Math.sin(back + jitter) * rand(30, 90),
        rand(0.18, 0.38), rand(1.4, 3.2), Math.random() < 0.35 ? '#ffffff' : '#46e8ff', 3.2
      );
    }

    const target = nearestEnemy(p.x, p.y);
    if (target) {
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      const lead = d / 950;
      const tx = target.x + target.vx * lead;
      const ty = target.y + target.vy * lead;
      const want = Math.atan2(ty - p.y, tx - p.x);
      p.aim = angleLerp(p.aim, want, 1 - Math.exp(-dt * 20));
      if (p.fireCd <= 0) firePlayer();
    } else {
      p.aim = angleLerp(p.aim, -Math.PI / 2, 1 - Math.exp(-dt * 4));
    }
  }

  function firePlayer() {
    const p = G.player;
    p.fireCd = G.rapid > 0 ? 0.078 : 0.145;
    const dmg = G.power > 0 ? 2 : 1;
    const angles = G.spread > 0 ? [-0.15, 0, 0.15] : [0];
    for (const off of angles) {
      const a = p.aim + off;
      G.bullets.push({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 920,
        vy: Math.sin(a) * 920,
        r: dmg > 1 ? 4.2 : 3.5,
        dmg,
        life: 1.25,
        dead: false,
      });
    }
    G.shots += angles.length;
    for (let i = 0; i < 3; i++) {
      const a = p.aim + rand(-0.4, 0.4);
      particle(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, Math.cos(a) * rand(60, 180), Math.sin(a) * rand(60, 180), rand(0.08, 0.18), rand(1, 2.5), dmg > 1 ? '#ffd166' : '#b8fbff', 3.4);
    }
    Sound.shoot();
  }

  function useBomb() {
    const p = G.player;
    if (!p || !p.alive || G.mode !== 'playing' || G.bombs <= 0 || p.bombCd > 0) return;
    G.bombs--;
    p.bombCd = 0.55;
    G.flash = 0.95;
    G.flashColor = '255,209,102';
    G.shake = 26;
    ring(p.x, p.y, Math.max(W, H) * 0.72, '#ffd166', 4, 0.7);
    ring(p.x, p.y, 180, '#ffffff', 2, 0.4);
    for (const b of G.ebullets) {
      burst(b.x, b.y, '#ffd166', 3, 90, 2);
      b.dead = true;
    }
    G.ebullets = [];
    const targets = [...G.enemies];
    for (const e of targets) {
      if (e.dead || e.spawnT > 0) continue;
      damageEnemy(e, e.boss ? 28 : 16, e.x, e.y);
    }
    floatText(p.x, p.y - 44, 'PULSE', '#ffd166', 18);
    Sound.bomb();
    updateHUD();
  }

  /* ---------------------------------------------------------------- bullets */

  function updateBullets(dt) {
    for (const b of G.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -60 || b.x > W + 60 || b.y < -60 || b.y > H + 60) b.dead = true;
    }
    G.bullets = G.bullets.filter((b) => !b.dead);
  }

  function updateEnemyBullets(dt) {
    for (const b of G.ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -90 || b.x > W + 90 || b.y < -90 || b.y > H + 90) b.dead = true;
    }
    G.ebullets = G.ebullets.filter((b) => !b.dead);
  }

  /* ---------------------------------------------------------------- pickups */

  function randomPickupType() {
    const r = Math.random();
    if (r < 0.24) return 'shield';
    if (r < 0.46) return 'rapid';
    if (r < 0.68) return 'spread';
    if (r < 0.84) return 'power';
    return 'bomb';
  }

  function spawnPickup(x, y, type) {
    G.pickups.push({
      x, y, type,
      vx: rand(-35, 35), vy: rand(-35, 35),
      t: rand(0, TAU), life: 13, dead: false,
    });
  }

  function dropLoot(e) {
    if (e.boss) {
      const types = ['shield', 'bomb', randomPickupType()];
      for (let i = 0; i < types.length; i++) {
        spawnPickup(e.x + rand(-55, 55), e.y + rand(-30, 30), types[i]);
      }
      return;
    }
    let chance = 0.09;
    if (e.type === 'tank') chance = 0.34;
    else if (e.type === 'splitter') chance = 0.2;
    else if (e.type === 'shooter') chance = 0.12;
    else if (e.type === 'mini') chance = 0.03;
    if (Math.random() < chance) spawnPickup(e.x, e.y, randomPickupType());
  }

  function collectPickup(p) {
    const meta = PICKUPS[p.type];
    let message = meta.label;
    if (p.type === 'shield') {
      if (G.shields < G.maxShields) { G.shields++; message = 'SHIELD +1'; }
      else { addScore(400, p.x, p.y); message = '+400'; }
    } else if (p.type === 'rapid') {
      G.rapid = 10;
    } else if (p.type === 'spread') {
      G.spread = 10;
    } else if (p.type === 'power') {
      G.power = 10;
    } else if (p.type === 'bomb') {
      if (G.bombs < G.maxBombs) { G.bombs++; message = 'PULSE +1'; }
      else { addScore(400, p.x, p.y); message = '+400'; }
    }
    addScore(150);
    burst(p.x, p.y, meta.color, 16, 210, 3);
    ring(p.x, p.y, 58, meta.color, 2, 0.45);
    floatText(p.x, p.y - 20, message, meta.color, 12);
    Sound.pickup();
    p.dead = true;
    updateHUD();
  }

  function updatePickups(dt) {
    const p = G.player;
    if (!p) return;
    for (const item of G.pickups) {
      item.t += dt;
      item.life -= dt;
      if (item.life <= 0) { item.dead = true; continue; }
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vx *= Math.exp(-2.2 * dt);
      item.vy *= Math.exp(-2.2 * dt);

      const dx = p.x - item.x;
      const dy = p.y - item.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 175) {
        item.vx += (dx / d) * 560 * dt;
        item.vy += (dy / d) * 560 * dt;
      }
      if (d < 30) collectPickup(item);
    }
    G.pickups = G.pickups.filter((item) => !item.dead);
  }

  /* --------------------------------------------------------------- damage */

  function addScore(n, x, y) {
    G.score += Math.round(n);
    if (G.score > G.best) G.best = G.score;
    if (x != null && y != null) floatText(x, y, '+' + fmt(n), '#d8f7ff', 13);
  }

  function damageEnemy(e, dmg, x, y) {
    if (e.dead || e.spawnT > 0) return;
    e.hp -= dmg;
    e.hitT = 0.08;
    burst(x, y, e.color, 3, 130, 2.2);
    if (e.hp <= 0) killEnemy(e);
    else Sound.hit();
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    G.kills++;
    G.streak++;
    G.comboTimer = 3;
    const nextCombo = Math.min(8, 1 + Math.floor(G.streak / 5));
    if (nextCombo > G.combo) {
      G.combo = nextCombo;
      ui.combo.classList.remove('bump');
      void ui.combo.offsetWidth;
      ui.combo.classList.add('bump');
    }
    const pts = Math.round(e.score * G.combo);
    addScore(pts, e.x, e.y - 10);

    if (e.boss) {
      G.boss = null;
      G.shake = 34;
      G.flash = 0.85;
      G.flashColor = '255,255,255';
      burst(e.x, e.y, e.color, 110, 480, 5);
      burst(e.x, e.y, '#ffffff', 45, 300, 3);
      ring(e.x, e.y, 360, '#ff3f9e', 5, 0.85);
      ring(e.x, e.y, 220, '#ffffff', 3, 0.6);
      ring(e.x, e.y, 520, '#ff7ae0', 2, 1.1);
      for (const b of G.ebullets) {
        burst(b.x, b.y, '#ff9f43', 2, 80, 2);
        b.dead = true;
      }
      G.ebullets = [];
      Sound.bigExplode();
    } else {
      burst(e.x, e.y, e.color, e.type === 'tank' ? 26 : 14, e.type === 'tank' ? 300 : 210, e.type === 'tank' ? 4 : 3);
      ring(e.x, e.y, e.type === 'tank' ? 92 : 48, e.color, 2, 0.4);
      Sound.explode();
    }

    if (e.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const m = addEnemy('mini', e.x + rand(-24, 24), e.y + rand(-24, 24));
        m.spawnT = 0.22;
      }
    }
    dropLoot(e);
  }

  function hitPlayer() {
    const p = G.player;
    if (!p || !p.alive || p.invuln > 0 || G.mode !== 'playing') return;
    p.invuln = 2.0;
    G.shields = Math.max(0, G.shields - 1);
    G.streak = 0;
    G.combo = 1;
    G.comboTimer = 0;
    G.shake = 21;
    G.flash = 0.72;
    G.flashColor = '255,60,100';
    burst(p.x, p.y, '#46e8ff', 22, 260, 3);
    burst(p.x, p.y, '#ffffff', 10, 170, 2);
    ring(p.x, p.y, 110, '#ff4d6d', 3, 0.55);
    floatText(p.x, p.y - 34, 'SHIELD -1', '#ff4d6d', 14);
    Sound.playerHit();
    updateHUD();
    if (G.shields <= 0) {
      p.alive = false;
      burst(p.x, p.y, '#46e8ff', 70, 420, 5);
      burst(p.x, p.y, '#ff4d6d', 45, 300, 4);
      ring(p.x, p.y, 260, '#46e8ff', 4, 0.8);
      endGame(false);
    } else if (G.shields === 1) {
      showToast('SHIELDS CRITICAL', 'REPAIR CELL NEEDED', 'STAY ALIVE', 'danger');
    }
  }

  /* ------------------------------------------------------------- collisions */

  function collisions() {
    const p = G.player;
    if (!p) return;

    for (const b of G.bullets) {
      if (b.dead) continue;
      for (const e of G.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          damageEnemy(e, b.dmg, b.x, b.y);
          b.dead = true;
          break;
        }
      }
    }
    G.bullets = G.bullets.filter((b) => !b.dead);

    if (!p.alive) return;

    if (p.invuln <= 0) {
      for (const b of G.ebullets) {
        const rr = p.r + b.r;
        if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
          b.dead = true;
          hitPlayer();
          break;
        }
      }
      G.ebullets = G.ebullets.filter((b) => !b.dead);
    }

    if (p.alive && p.invuln <= 0) {
      for (const e of G.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const rr = p.r + e.r;
        if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
          hitPlayer();
          if (!e.boss) damageEnemy(e, 99, e.x, e.y);
          else damageEnemy(e, 3, e.x, e.y);
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ waves */

  function updateWave(dt) {
    if (G.pendingVictory > 0) {
      G.pendingVictory -= dt;
      if (G.pendingVictory <= 0) endGame(true);
      return;
    }

    if (G.intermission > 0) {
      G.intermission -= dt;
      if (G.intermission <= 0) beginWave(G.wave + 1);
      return;
    }

    G.spawnTimer += dt;
    while (G.spawns.length && G.spawns[0].t <= G.spawnTimer) {
      const s = G.spawns.shift();
      spawnEnemy(s.type, s.boss || 0);
    }

    const alive = G.enemies.some((e) => !e.dead);
    if (G.waveActive && G.spawns.length === 0 && !alive) {
      G.waveEndTimer += dt;
      if (G.waveEndTimer > 1.1) {
        G.waveActive = false;
        const bonus = 250 * G.wave;
        addScore(bonus);
        if (G.wave >= 10) {
          addScore(5000);
          showToast('SECTOR SECURED', 'VOID TYRANT DESTROYED', 'FINAL VICTORY', 'good');
          G.pendingVictory = 2.1;
          Sound.victory();
        } else {
          showToast('WAVE CLEARED', '+' + fmt(bonus) + ' BONUS', 'REGROUP', 'good');
          G.intermission = 3.2;
          Sound.waveClear();
        }
      }
    } else {
      G.waveEndTimer = 0;
    }
  }

  /* ------------------------------------------------------------- run control */

  function updateCombo(dt) {
    if (G.comboTimer > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0) {
        G.comboTimer = 0;
        G.streak = 0;
        G.combo = 1;
      }
    }
  }

  function updatePowerups(dt) {
    if (G.rapid > 0) G.rapid = Math.max(0, G.rapid - dt);
    if (G.spread > 0) G.spread = Math.max(0, G.spread - dt);
    if (G.power > 0) G.power = Math.max(0, G.power - dt);
  }

  function endGame(won) {
    if (G.mode !== 'playing') return;
    G.mode = won ? 'victory' : 'gameover';
    G.pointer.active = false;
    const newBest = G.score > G.bestAtRunStart;
    if (G.score > G.best) G.best = G.score;
    try { localStorage.setItem('starfall.best', String(G.best)); } catch (_) {}
    ui.menuBest.textContent = fmt(G.best);
    ui.hudBest.textContent = fmt(G.best);

    if (won) {
      ui.winScore.textContent = fmt(G.score);
      ui.winTime.textContent = fmtTime(G.gameTime);
      ui.winKills.textContent = fmt(G.kills);
      ui.winBest.classList.toggle('is-hidden', !newBest);
      setOverlay('victory');
      Sound.victory();
    } else {
      ui.goScore.textContent = fmt(G.score);
      ui.goWave.textContent = String(Math.max(1, G.wave));
      ui.goKills.textContent = fmt(G.kills);
      ui.goBest.classList.toggle('is-hidden', !newBest);
      setOverlay('gameover');
      Sound.gameOver();
    }
    updateHUD();
  }

  function togglePause() {
    if (G.mode === 'playing') {
      G.mode = 'paused';
      G.pointer.active = false;
      setOverlay('pause');
    } else if (G.mode === 'paused') {
      G.mode = 'playing';
      setOverlay(null);
    }
  }

  function toggleMute() {
    Sound.enabled = !Sound.enabled;
    if (Sound.master) Sound.master.gain.value = Sound.enabled ? 0.45 : 0;
    ui.muteBtn.classList.toggle('muted', !Sound.enabled);
    ui.muteBtn.textContent = Sound.enabled ? '♪' : '✕';
    ui.muteBtn.setAttribute('aria-label', Sound.enabled ? 'Mute sound' : 'Enable sound');
  }

  /* ------------------------------------------------------------------ update */

  function updateGame(dt) {
    G.gameTime += dt;
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateEnemyBullets(dt);
    updatePickups(dt);
    collisions();
    G.enemies = G.enemies.filter((e) => !e.dead);
    updateWave(dt);
    updatePowerups(dt);
    updateCombo(dt);

    G.hudAcc += dt;
    if (G.hudAcc >= 0.08) {
      G.hudAcc = 0;
      updateHUD();
    }
  }

  /* ----------------------------------------------------------------- render */

  function drawBackground() {
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);
    else {
      ctx.fillStyle = '#050812';
      ctx.fillRect(0, 0, W, H);
    }
    for (const s of stars) {
      const twinkle = 0.72 + 0.28 * Math.sin(G.time * s.tw + s.phase);
      ctx.globalAlpha = (0.18 + s.z * 0.72) * twinkle;
      ctx.fillStyle = s.z > 0.72 ? '#e6fbff' : '#8dc8e8';
      ctx.fillRect(s.x, s.y, s.size, s.size * (1 + s.z * 0.7));
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of G.rings) {
      if (r.dead) continue;
      const t = 1 - r.life / r.maxLife;
      const radius = r.maxR * t;
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(0.6, r.width * (1 - t * 0.6));
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(1, radius), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPickups() {
    for (const item of G.pickups) {
      if (item.dead) continue;
      const meta = PICKUPS[item.type];
      const blink = item.life < 2.5 && Math.sin(item.t * 18) < 0 ? 0.25 : 1;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.globalAlpha = blink;
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 16;
      ctx.rotate(item.t * 1.8);
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(4, 12, 20, 0.82)';
      ctx.fill();
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.rotate(-item.t * 1.8);
      ctx.shadowBlur = 8;
      ctx.fillStyle = meta.color;
      ctx.font = '800 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.glyph, 0, 1);
      ctx.restore();
    }
  }

  function drawEnemies() {
    for (const e of G.enemies) {
      if (e.dead) continue;
      const maxSpawn = e.spawnMax || (e.boss ? 1.1 : 0.55);
      const progress = e.spawnT > 0 ? clamp(1 - e.spawnT / maxSpawn, 0, 1) : 1;
      if (e.spawnT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.2 + progress * 0.55;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + (1 - progress) * 42, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + (1 - progress) * 20, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      if (e.boss) {
        drawBoss(e, progress);
      } else {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle + Math.PI / 2);
        const scale = 0.45 + progress * 0.55;
        ctx.scale(scale, scale);
        ctx.globalAlpha = progress;
        drawEnemyShape(e, e.hitT > 0);
        ctx.restore();

        if (e.hp < e.maxHp && (e.type === 'tank' || e.type === 'splitter')) {
          const w = e.r * 1.8;
          const pct = clamp(e.hp / e.maxHp, 0, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * pct, 4);
        }
      }
    }
  }

  function drawEnemyShape(e, flash) {
    const r = e.r;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (e.type === 'drone' || e.type === 'mini') {
      const scale = e.type === 'mini' ? 0.65 : 1;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.08 * scale);
      ctx.lineTo(r * 0.92 * scale, r * 0.56 * scale);
      ctx.lineTo(0, r * 0.24 * scale);
      ctx.lineTo(-r * 0.92 * scale, r * 0.56 * scale);
      ctx.closePath();
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(44, 5, 28, 0.94)';
      ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : e.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, TAU);
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.fill();
      return;
    }

    if (e.type === 'zigzag') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r * 1.05, r * 0.72);
      ctx.lineTo(0, r * 0.32);
      ctx.lineTo(-r * 1.05, r * 0.72);
      ctx.closePath();
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(48, 17, 6, 0.92)';
      ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : e.color;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, r * 0.08);
      ctx.lineTo(0, -r * 0.42);
      ctx.lineTo(r * 0.42, r * 0.08);
      ctx.strokeStyle = flash ? '#ffffff' : '#ffd166';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      return;
    }

    if (e.type === 'shooter') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i / 6) * TAU;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(28, 8, 46, 0.94)';
      ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : e.color;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, TAU);
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(196, 107, 255, 0.28)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.18, 0, TAU);
      ctx.fillStyle = flash ? '#ffffff' : '#f4d9ff';
      ctx.fill();
      return;
    }

    if (e.type === 'tank') {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i / 8) * TAU;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(42, 8, 18, 0.96)';
      ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : e.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, 0, TAU);
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(255, 77, 109, 0.2)';
      ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : '#ff9a6c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.24, 0);
      ctx.lineTo(r * 0.24, 0);
      ctx.moveTo(0, -r * 0.24);
      ctx.lineTo(0, r * 0.24);
      ctx.stroke();
      return;
    }

    if (e.type === 'splitter') {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + e.t * 0.8;
        const px = Math.cos(a) * r * 0.45;
        const py = Math.sin(a) * r * 0.45;
        ctx.moveTo(px + r * 0.42, py);
        ctx.arc(px, py, r * 0.42, 0, TAU);
      }
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(30, 22, 62, 0.94)';
      ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : e.color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, TAU);
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(143, 123, 255, 0.38)';
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = e.color;
    ctx.fill();
  }

  function drawBoss(e, progress) {
    const r = e.r;
    const phase2 = e.hp < e.maxHp * 0.5;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.globalAlpha = progress;

    const aura = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.9);
    aura.addColorStop(0, phase2 ? 'rgba(255, 63, 158, 0.26)' : 'rgba(255, 92, 122, 0.18)');
    aura.addColorStop(1, 'rgba(255, 63, 158, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);

    ctx.save();
    ctx.rotate(e.t * 0.32);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.26, a, a + 0.23);
      ctx.strokeStyle = i % 3 === 0 ? '#ffd166' : (phase2 ? '#ff3f9e' : '#ff5c7a');
      ctx.lineWidth = i % 3 === 0 ? 5 : 7;
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.rotate(-e.t * 0.62);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.02, a, a + 0.2);
      ctx.strokeStyle = 'rgba(255, 122, 224, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * TAU;
      const px = Math.cos(a) * r * 0.76;
      const py = Math.sin(a) * r * 0.76;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(24, 4, 20, 0.96)';
    ctx.fill();
    ctx.strokeStyle = phase2 ? '#ff3f9e' : '#ff5c7a';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.rotate(e.t * 0.9);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i / 3) * TAU;
      const px = Math.cos(a) * r * 0.5;
      const py = Math.sin(a) * r * 0.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const core = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.42);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.25, phase2 ? '#ffd166' : '#ff9fd0');
    core.addColorStop(1, 'rgba(255, 63, 158, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, TAU);
    ctx.fillStyle = '#fff6fc';
    ctx.fill();

    if (e.hitT > 0) {
      ctx.globalAlpha = 0.35 * progress;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.08, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.bullets) {
      const color = b.dmg > 1 ? '#ffd166' : '#46e8ff';
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.7, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.85, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemyBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.ebullets) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.6, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff3fb';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.42, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = G.player;
    if (!p || !p.alive) return;

    if (p.invuln > 0) {
      const pulse = 24 + Math.sin(G.time * 16) * 3;
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 18) * 0.12;
      ctx.strokeStyle = '#46e8ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pulse, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#46e8ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, pulse, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim + Math.PI / 2);
    if (p.invuln > 0 && Math.floor(G.time * 22) % 2 === 0) ctx.globalAlpha = 0.4;

    const flick = 0.72 + 0.28 * Math.sin(G.time * 46);
    const flame = ctx.createLinearGradient(0, 8, 0, 30);
    flame.addColorStop(0, '#ffffff');
    flame.addColorStop(0.35, '#46e8ff');
    flame.addColorStop(1, 'rgba(70, 232, 255, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(0, 19 + 10 * flick);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = '#46e8ff';
    ctx.shadowBlur = 20;
    const hull = ctx.createLinearGradient(0, -22, 0, 14);
    hull.addColorStop(0, '#ffffff');
    hull.addColorStop(0.42, '#9df6ff');
    hull.addColorStop(1, '#1b6f9a');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(6, -6);
    ctx.lineTo(15, 12);
    ctx.lineTo(5, 8);
    ctx.lineTo(0, 13);
    ctx.lineTo(-5, 8);
    ctx.lineTo(-15, 12);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d6fdff';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#061a2c';
    ctx.beginPath();
    ctx.ellipse(0, -3, 3.6, 7, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = '#ff3f9e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-11, 9);
    ctx.lineTo(-4, 3);
    ctx.moveTo(11, 9);
    ctx.lineTo(4, 3);
    ctx.stroke();

    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of G.particles) {
      if (p.dead) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a * 0.92;
      if (p.streak) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * a);
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * a), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of G.texts) {
      if (t.dead) continue;
      const a = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = '800 ' + t.size + 'px ui-monospace, monospace';
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 10;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#04060e';
    ctx.fillRect(0, 0, W, H);
    drawBackground();

    const shake = G.shake;
    let sx = 0;
    let sy = 0;
    if (shake > 0.4) {
      sx = rand(-shake, shake) * 0.5;
      sy = rand(-shake, shake) * 0.5;
    }

    ctx.save();
    ctx.translate(sx, sy);
    drawRings();
    drawPickups();
    drawEnemies();
    drawBullets();
    drawEnemyBullets();
    drawPlayer();
    drawParticles();
    drawTexts();
    ctx.restore();

    if (G.flash > 0) {
      ctx.fillStyle = 'rgba(' + G.flashColor + ',' + Math.min(0.58, G.flash * 0.62).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ------------------------------------------------------------------- loop */

  function frame(now) {
    const raw = (now - G.lastFrame) / 1000;
    G.lastFrame = now;
    const dt = clamp(Number.isFinite(raw) ? raw : 0.016, 0, 0.05);
    G.time += dt;

    if (G.mode !== 'paused') updateStars(dt);
    if (G.mode === 'playing') updateGame(dt);
    if (G.mode !== 'paused') updateEffects(dt);
    if (G.mode !== 'menu') render();
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------- init */

  function bindUI() {
    ui.startBtn.addEventListener('click', startGame);
    ui.retryBtn.addEventListener('click', startGame);
    ui.againBtn.addEventListener('click', startGame);
    ui.resumeBtn.addEventListener('click', togglePause);
    ui.pauseBtn.addEventListener('click', togglePause);
    ui.quitBtn.addEventListener('click', goMenu);
    ui.menuBtn.addEventListener('click', goMenu);
    ui.winMenuBtn.addEventListener('click', goMenu);
    ui.muteBtn.addEventListener('click', toggleMute);
    ui.bombBtn.addEventListener('click', useBomb);
  }

  function init() {
    resize();
    bindUI();
    if (isTouch || W < 700) {
      ui.hint.textContent = 'DRAG TO MOVE · AUTO-FIRE · PULSE BUTTON';
    }
    ui.menuBest.textContent = fmt(bestScore);
    updateHUD();
    setOverlay('menu');
    render();
    setTimeout(() => ui.startBtn.classList.add('ready'), 900);
    G.lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  init();

  if (new URLSearchParams(location.search).has('debug')) {
    window.__starfall = { G, startGame, beginWave, endGame, spawnEnemy, addEnemy, useBomb, damageEnemy, killEnemy, updateHUD, showToast, setOverlay };
  }
})();
