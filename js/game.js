import { AudioEngine } from './audio.js';
import { WEAPONS, WEAPON_ORDER, createLevels } from './levels.js';
import { Renderer } from './renderer.js';
import {
  TAU, clamp, lerp, rand, randInt, choice, rectsOverlap, pointInRect,
  circleRect, padScore, formatTime, mulberry32
} from './utils.js';

const FIXED = 1 / 60;
const GRAVITY = 2080;
const MAX_FALL = 1180;
const PLAYER_SPEED = 310;
const PLAYER_ACCEL = 2750;
const PLAYER_JUMP = 705;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.13;
const PLAYER_W = 30;
const PLAYER_H = 62;

const ENEMY_STATS = {
  grunt: {
    w: 30, h: 56, hp: 58, speed: 76, aggro: 760, fireRange: 650,
    burst: 3, burstInterval: 0.12, cooldown: 1.65, pellets: 1,
    damage: 9, spread: 0.035, bulletSpeed: 620, score: 100, name: 'GRUNT'
  },
  heavy: {
    w: 40, h: 66, hp: 160, speed: 54, aggro: 800, fireRange: 610,
    burst: 2, burstInterval: 0.2, cooldown: 2.2, pellets: 4,
    damage: 7, spread: 0.13, bulletSpeed: 580, score: 250, name: 'HEAVY'
  },
  drone: {
    w: 38, h: 32, hp: 50, speed: 108, aggro: 840, fireRange: 640,
    burst: 2, burstInterval: 0.15, cooldown: 1.55, pellets: 1,
    damage: 7, spread: 0.045, bulletSpeed: 560, score: 150, name: 'DRONE'
  },
  turret: {
    w: 42, h: 44, hp: 120, speed: 0, aggro: 800, fireRange: 720,
    burst: 4, burstInterval: 0.09, cooldown: 2.15, pellets: 1,
    damage: 6, spread: 0.025, bulletSpeed: 700, score: 200, name: 'TURRET'
  }
};

const ENEMY_ART = {
  grunt: { body: '#343a32', accent: '#7e2d26' },
  heavy: { body: '#2b302e', accent: '#8e2c24' },
  drone: { body: '#22302f', accent: '#d24934' },
  turret: { body: '#2c3532', accent: '#d24934' }
};

function approach(value, target, amount) {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

function makePlatformDetail(p) {
  const rng = mulberry32((p.x * 17 + p.y * 31 + p.w * 7) | 0);
  const bolts = [];
  for (let i = 6; i < p.w - 6; i += 18) {
    bolts.push({ x: p.x + i, y: p.y + 8 + (i % 3 === 0 ? 0 : 4) });
  }
  const cracks = [];
  for (let i = 0; i < 4; i++) {
    cracks.push({
      x: 12 + rng() * Math.max(1, p.w - 24),
      y: 8 + rng() * Math.max(1, Math.min(38, p.h - 8)),
      dx: rand(5, 17), dy: rand(6, 20)
    });
  }
  const stains = [];
  for (let i = 0; i < 3; i++) {
    stains.push({
      x: 10 + rng() * Math.max(1, p.w - 20),
      y: 22 + rng() * Math.min(45, Math.max(1, p.h - 22)),
      w: 5 + rng() * 16, h: 2 + rng() * 5, a: 0.06 + rng() * 0.09
    });
  }
  return { bolts, cracks, stains, rebar: p.kind === 'ground' && (p.x === 0 || true) };
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.audio = new AudioEngine();
    this.levels = createLevels();
    this.levelIndex = 0;
    this.level = null;
    this.runtime = null;
    this.state = 'menu';
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastKillTime = -99;
    this.levelKills = 0;
    this.levelSupply = 0;
    this.levelTime = 0;
    this.campaignTime = 0;
    this.levelStartScore = 0;
    this.levelStartKills = 0;
    this.animTime = 0;
    this.flash = 0;
    this.hitMarker = 0;
    this.crosshairSpread = 0;
    this.lightning = 0;
    this.lightningTimer = rand(3, 8);
    this.deathTimer = 0;
    this.timers = [];
    this.boss = null;
    this.checkpoint = { x: 120, y: 620 };
    this.input = {
      left: false, right: false, jumpHeld: false, firing: false, firePressed: false
    };
    this.touch = { left: false, right: false, fire: false };
    this.touchMode = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.mouse = {
      sx: window.innerWidth * 0.7, sy: window.innerHeight * 0.48,
      x: 600, y: 330, active: false, hoverEnemy: false
    };
    this.camera = { x: 0, y: 0, shake: 0 };
    this.view = { w: 1280, h: 720, scale: 1, offsetX: 0, offsetY: 0, cssW: window.innerWidth, cssH: window.innerHeight, dpr: 1 };
    this.unlocked = ['pistol'];
    this.best = this.loadBest();
    this.toastTimer = null;
    this.lastFeed = [];
    this.el = this.cacheDom();
    this.renderer = new Renderer(canvas, this);
    this.renderer.resize();
    this.bindEvents();
    this.loadLevel(0, { preview: true });
    this.state = 'menu';
    this.updateMenuUI();
    this.lastFrame = 0;
    this.acc = 0;
    this._loop = this.loop.bind(this);
    requestAnimationFrame(this._loop);
    window.__IRON_DAWN__ = this;
  }

  cacheDom() {
    const ids = [
      'menu', 'hud', 'playBtn', 'bestScore', 'healthFill', 'armorFill', 'healthText',
      'armorText', 'stanceText', 'missionNumber', 'missionName', 'objectiveText',
      'missionProgress', 'objectiveFill', 'objectiveMarker', 'scoreText', 'killsText',
      'muteBtn', 'pauseBtn', 'killFeed', 'comboBadge', 'comboText', 'toast', 'toastKicker',
      'toastText', 'prompt', 'promptText', 'bossWrap', 'bossName', 'bossTitle', 'bossFill',
      'fieldTip', 'weaponClass', 'weaponSlot', 'weaponIcon', 'weaponName', 'weaponFlavor',
      'ammoMag', 'ammoReserve', 'weaponSlots', 'grenadeText', 'reloadTrack', 'reloadFill',
      'lowHealth', 'pauseScreen', 'resumeBtn', 'restartBtn', 'quitBtn', 'clearScreen',
      'clearKicker', 'clearTitle', 'clearScore', 'clearKills', 'clearTime', 'clearSupply',
      'unlockCard', 'unlockSlot', 'unlockName', 'unlockDesc', 'nextBtn', 'deathScreen',
      'deathScore', 'deathKills', 'deathText', 'retryBtn', 'deathQuitBtn', 'victoryScreen',
      'victoryScore', 'victoryKills', 'victoryTime', 'campaignBtn', 'victoryQuitBtn',
      'damageFlash', 'rotateHint', 'touchControls', 'weaponCard'
    ];
    const out = {};
    for (const id of ids) out[id] = document.getElementById(id);
    out.weaponCard = document.querySelector('.weapon-card');
    return out;
  }

  loadBest() {
    try {
      return Number(localStorage.getItem('ironDawn.best') || 0) || 0;
    } catch (_) {
      return 0;
    }
  }

  saveBest() {
    if (this.score <= this.best) return;
    this.best = this.score;
    try { localStorage.setItem('ironDawn.best', String(this.best)); } catch (_) { /* noop */ }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.updateCamera(1);
    });

    this.el.playBtn.addEventListener('click', () => this.startCampaign());
    this.el.pauseBtn.addEventListener('click', () => this.pause());
    this.el.muteBtn.addEventListener('click', () => this.toggleMute());
    this.el.resumeBtn.addEventListener('click', () => this.resume());
    this.el.restartBtn.addEventListener('click', () => this.restartLevel());
    this.el.quitBtn.addEventListener('click', () => this.quitToMenu());
    this.el.nextBtn.addEventListener('click', () => this.nextLevel());
    this.el.retryBtn.addEventListener('click', () => this.restartLevel(true));
    this.el.deathQuitBtn.addEventListener('click', () => this.quitToMenu());
    this.el.campaignBtn.addEventListener('click', () => this.startCampaign());
    this.el.victoryQuitBtn.addEventListener('click', () => this.quitToMenu());
    if (this.el.weaponCard) {
      this.el.weaponCard.addEventListener('click', () => {
        if (this.state === 'playing' && this.touchMode) this.cycleWeapon(1);
      });
    }

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.sx = e.clientX - rect.left;
      this.mouse.sy = e.clientY - rect.top;
      this.mouse.active = true;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.state !== 'playing') return;
      this.audio.init();
      this.input.firing = true;
      this.input.firePressed = true;
      this.mouse.sx = e.offsetX;
      this.mouse.sy = e.offsetY;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.input.firing = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mouseleave', () => { this.input.firing = false; });

    window.addEventListener('blur', () => {
      this.input.firing = false;
      this.input.left = false;
      this.input.right = false;
      if (this.state === 'playing') this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    document.querySelectorAll('[data-touch]').forEach((btn) => {
      const action = btn.dataset.touch;
      const down = (e) => {
        e.preventDefault();
        this.audio.init();
        btn.classList.add('active');
        if (action === 'left') this.touch.left = true;
        else if (action === 'right') this.touch.right = true;
        else if (action === 'fire') {
          this.touch.fire = true;
          this.input.firePressed = true;
          this.mouse.sx = this.view.cssW * 0.78;
          this.mouse.sy = this.view.cssH * 0.45;
        } else if (action === 'jump') {
          this.player.jumpBuffer = JUMP_BUFFER;
          this.input.jumpHeld = true;
        } else if (action === 'knife') this.knife();
        else if (action === 'grenade') this.throwGrenade();
        else if (action === 'reload') this.startReload();
      };
      const up = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
        if (action === 'left') this.touch.left = false;
        else if (action === 'right') this.touch.right = false;
        else if (action === 'fire') this.touch.fire = false;
        else if (action === 'jump') this.input.jumpHeld = false;
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });

    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });
  }

  onKeyDown(e) {
    const code = e.code;
    const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft', 'ShiftRight', 'KeyF', 'KeyV', 'KeyG', 'KeyR', 'KeyQ', 'KeyE', 'KeyM', 'Escape', 'KeyP', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    if (this.state === 'menu' && (code === 'Enter' || code === 'Space')) {
      e.preventDefault();
      this.startCampaign();
      return;
    }
    if (this.state !== 'playing') {
      if (code === 'Escape' && this.state === 'paused') { e.preventDefault(); this.resume(); return; }
      return;
    }
    if (handled.includes(code)) e.preventDefault();
    if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = true;
    else if (code === 'ArrowRight' || code === 'KeyD') this.input.right = true;
    else if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
      if (!e.repeat) this.player.jumpBuffer = JUMP_BUFFER;
      this.input.jumpHeld = true;
    } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      if (!e.repeat) this.roll();
    } else if (code === 'KeyF' || code === 'KeyV') {
      if (!e.repeat) this.knife();
    } else if (code === 'KeyG') {
      if (!e.repeat) this.throwGrenade();
    } else if (code === 'KeyR') {
      if (!e.repeat) this.startReload();
    } else if (code === 'KeyQ') {
      if (!e.repeat) this.cycleWeapon(-1);
    } else if (code === 'KeyE') {
      if (!e.repeat) this.cycleWeapon(1);
    } else if (code === 'KeyM') {
      this.toggleMute();
    } else if (code === 'Escape' || code === 'KeyP') {
      if (!e.repeat) this.pause();
    } else if (/^Digit[1-5]$/.test(code)) {
      const idx = Number(code.slice(-1)) - 1;
      this.selectWeapon(WEAPON_ORDER[idx]);
    }
  }

  onKeyUp(e) {
    const code = e.code;
    if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = false;
    else if (code === 'ArrowRight' || code === 'KeyD') this.input.right = false;
    else if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') this.input.jumpHeld = false;
  }

  updateMenuUI() {
    this.el.bestScore.textContent = padScore(this.best);
  }

  /* ============================================================
     Campaign flow
     ============================================================ */
  startCampaign() {
    if (this.state === 'playing') return;
    this.audio.init();
    this.audio.setMuted(this.audio.muted);
    this.audio.startMusic();
    this.unlocked = ['pistol'];
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.campaignTime = 0;
    this.levelIndex = 0;
    this.state = 'playing';
    this.loadLevel(0);
    this.showScreen('game');
    this.showToast('SECTOR 01 // ASHFALL', 'PUSH TO THE EXTRACTION POINT', 3200);
    this.showKillFeed('OPERATION IRON DAWN', '', true);
  }

  loadLevel(index, { preview = false } = {}) {
    index = clamp(index, 0, this.levels.length - 1);
    this.levelIndex = index;
    this.level = this.levels[index];
    const data = this.level;
    const platforms = [...data.platforms, ...(data.cover || [])].map(p => ({
      ...p,
      detail: makePlatformDetail(p)
    }));
    this.runtime = {
      platforms,
      destructibles: (data.destructibles || []).map(d => ({
        ...d, maxHp: d.hp, hitFlash: 0, flash: 0, dead: false, seed: rand(0, 10)
      })),
      enemies: (data.enemies || []).map(e => this.createEnemy(e)),
      pickups: (data.pickups || []).map(p => this.createPickup(p.type, p.x, p.y, { initial: true })),
      checkpoints: (data.checkpoints || []).map((c) => ({ ...c, active: false, seed: rand(0, 10) })),
      hazards: (data.hazards || []).map(h => ({ ...h, damageTimer: 0, seed: rand(0, 10) })),
      bullets: [],
      grenades: [],
      particles: [],
      texts: [],
      effects: [],
      decals: [],
      gate: null
    };
    this.player = this.createPlayer(data.spawn);
    if (preview) {
      this.player.x = index === 0 ? 1280 : data.spawn.x;
      this.player.y = 620 - PLAYER_H;
      this.player.aimAngle = -0.04;
      this.camera.x = index === 0 ? 420 : clamp(data.spawn.x - 200, 0, data.width - this.view.w);
    } else {
      this.camera.x = clamp(data.spawn.x - this.view.w * 0.28, 0, Math.max(0, data.width - this.view.w));
    }
    this.camera.y = 0;
    this.camera.shake = 0;
    this.checkpoint = { x: data.spawn.x, y: 620 };
    this.boss = null;
    this.levelTime = 0;
    this.levelKills = 0;
    this.levelSupply = 0;
    this.levelStartScore = this.score;
    this.levelStartKills = this.kills;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastKillTime = -99;
    this.tipIndex = 0;
    this.tipTimer = 0;
    this.timers = [];
    this.hitMarker = 0;
    this.crosshairSpread = 0;
    this.input.firing = false;
    this.input.firePressed = false;
    this.input.left = false;
    this.input.right = false;
    this.touch.left = false;
    this.touch.right = false;
    this.touch.fire = false;
    this.renderer.prepareLevel(data);
    this.updateMissionUI();
    if (!preview) {
      this.setFieldTip(0);
      this.updateHUD();
    }
  }

  createPlayer(spawn) {
    const ammo = {};
    for (const id of this.unlocked) {
      const cfg = WEAPONS[id];
      if (cfg) ammo[id] = { mag: cfg.magSize, reserve: cfg.reserveStart };
    }
    if (!ammo.pistol) ammo.pistol = { mag: WEAPONS.pistol.magSize, reserve: WEAPONS.pistol.reserveStart };
    let weaponId = 'pistol';
    for (const id of WEAPON_ORDER) {
      if (this.unlocked.includes(id)) weaponId = id;
    }
    return {
      x: spawn.x, y: spawn.y, w: PLAYER_W, h: PLAYER_H,
      vx: 0, vy: 0, grounded: false, coyote: 0, jumpBuffer: 0,
      health: 100, maxHealth: 100, armor: 0, maxArmor: 50,
      facing: 1, aimAngle: 0, invuln: 0, rollTimer: 0, rollDuration: 0.34,
      rollCd: 0, rollDir: 1, rollFlip: 0, knifeTimer: 0, knifeCd: 0,
      fireCd: 0, muzzleTimer: 0, muzzleLen: 40, muzzleSeed: 0,
      reloading: false, reloadTimer: 0, reloadDuration: 1, reloadProgress: 0,
      weaponId, ammo, grenades: 3, runPhase: 0, triggerHeld: false,
      dead: false, landTimer: 0, crouch: 0, stepTimer: 0
    };
  }

  createEnemy(data) {
    const cfg = ENEMY_STATS[data.type] || ENEMY_STATS.grunt;
    const e = {
      type: data.type || 'grunt', x: data.x, y: data.y, w: cfg.w, h: cfg.h,
      vx: 0, vy: 0, hp: cfg.hp, maxHp: cfg.hp, grounded: false,
      facing: -1, aimAngle: Math.PI, alert: false, alertTimer: 0,
      shootCd: rand(0.7, 1.8), burstLeft: 0, burstTimer: 0,
      patrolOrigin: data.x, patrolRange: data.patrol || 60,
      patrolDir: Math.random() < 0.5 ? -1 : 1,
      seed: rand(0, 10), hitFlash: 0, dead: false, deathTimer: 0.78,
      losTimer: rand(0, 0.18), hasLOS: false, droneBaseY: data.y,
      amp: data.amp || 36, phase: rand(0, TAU), summoned: false, name: cfg.name
    };
    if (e.type === 'drone') {
      e.startX = data.x;
      e.startY = data.y;
    }
    return e;
  }

  createPickup(type, x, y, { initial = false } = {}) {
    return {
      type, x: x - 10, y: y - 10, w: 20, h: 20,
      vx: initial ? 0 : rand(-95, 95), vy: initial ? 0 : rand(-290, -150),
      grounded: initial, dead: false, seed: rand(0, 10), life: 45, age: 0
    };
  }

  showScreen(name) {
    const game = name === 'game';
    this.el.menu.classList.toggle('is-hidden', game || name === 'overlay');
    this.el.hud.classList.toggle('is-hidden', !game && name !== 'paused');
    this.el.pauseScreen.classList.add('is-hidden');
    this.el.clearScreen.classList.add('is-hidden');
    this.el.deathScreen.classList.add('is-hidden');
    this.el.victoryScreen.classList.add('is-hidden');
    document.body.classList.toggle('is-playing', game);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.firing = false;
    this.touch.fire = false;
    this.el.pauseScreen.classList.remove('is-hidden');
    this.el.hud.classList.add('is-hidden');
    document.body.classList.remove('is-playing');
    this.audio.update(0, 0);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.el.pauseScreen.classList.add('is-hidden');
    this.el.hud.classList.remove('is-hidden');
    document.body.classList.add('is-playing');
    this.lastFrame = performance.now();
    this.acc = 0;
    this.audio.startMusic();
  }

  restartLevel(fromDeath = false) {
    this.score = this.levelStartScore;
    this.kills = this.levelStartKills;
    this.combo = 0;
    this.el.pauseScreen.classList.add('is-hidden');
    this.el.deathScreen.classList.add('is-hidden');
    this.el.clearScreen.classList.add('is-hidden');
    this.state = 'playing';
    this.loadLevel(this.levelIndex);
    this.el.menu.classList.add('is-hidden');
    this.el.hud.classList.remove('is-hidden');
    document.body.classList.add('is-playing');
    this.audio.startMusic();
    this.showToast('REDEPLOYED', 'SECTOR RESTARTED — STAY SHARP', 2200);
    if (fromDeath) this.showKillFeed('SIGNAL RESTORED', '', true);
  }

  quitToMenu() {
    this.state = 'menu';
    this.input.firing = false;
    this.audio.stopMusic();
    this.loadLevel(0, { preview: true });
    this.state = 'menu';
    this.showScreen('menu');
    this.el.hud.classList.add('is-hidden');
    this.el.menu.classList.remove('is-hidden');
    this.updateMenuUI();
    document.body.classList.remove('is-playing');
    this.lastFrame = performance.now();
    this.acc = 0;
  }

  nextLevel() {
    this.el.clearScreen.classList.add('is-hidden');
    if (this.levelIndex >= this.levels.length - 1) {
      this.quitToMenu();
      return;
    }
    this.levelIndex++;
    this.state = 'playing';
    this.loadLevel(this.levelIndex);
    this.el.menu.classList.add('is-hidden');
    this.el.hud.classList.remove('is-hidden');
    document.body.classList.add('is-playing');
    this.audio.startMusic();
    this.showToast(`SECTOR 0${this.levelIndex + 1} // ${this.level.name}`, this.level.intro, 3900);
  }

  completeLevel() {
    if (this.state !== 'playing') return;
    this.state = 'levelclear';
    this.input.firing = false;
    this.audio.stopMusic();
    this.audio.levelClear();
    this.saveBest();
    const data = this.level;
    const score = Math.max(0, this.score - this.levelStartScore);
    this.el.clearKicker.textContent = `SECTOR 0${data.id + 1} CLEARED // ${data.name}`;
    this.el.clearTitle.innerHTML = 'MISSION<br><span>COMPLETE</span>';
    this.el.clearScore.textContent = padScore(this.score);
    this.el.clearKills.textContent = String(this.levelKills).padStart(2, '0');
    this.el.clearTime.textContent = formatTime(this.levelTime);
    this.el.clearSupply.textContent = String(this.levelSupply).padStart(2, '0');
    const unlock = data.unlock;
    if (unlock && WEAPONS[unlock]) {
      if (!this.unlocked.includes(unlock)) this.unlocked.push(unlock);
      const w = WEAPONS[unlock];
      this.el.unlockCard.classList.remove('is-hidden');
      this.el.unlockSlot.textContent = `SLOT 0${w.slot}`;
      this.el.unlockName.textContent = w.name;
      this.el.unlockDesc.textContent = w.unlockDesc;
      this.el.nextBtn.innerHTML = `CONTINUE OPERATION <span>→</span>`;
      this.showKillFeed('ARSENAL EXPANDED', unlock.toUpperCase(), true);
    } else {
      this.el.unlockCard.classList.add('is-hidden');
      this.el.nextBtn.innerHTML = `CONTINUE OPERATION <span>→</span>`;
    }
    this.el.nextBtn.dataset.score = String(score);
    this.el.hud.classList.add('is-hidden');
    this.el.clearScreen.classList.remove('is-hidden');
    document.body.classList.remove('is-playing');
    this.updateMenuUI();
  }

  showGameOver() {
    this.state = 'gameover';
    this.saveBest();
    this.audio.stopMusic();
    this.audio.death();
    this.updateMenuUI();
    this.el.deathScore.textContent = padScore(this.score);
    this.el.deathKills.textContent = String(this.kills);
    this.el.deathText.textContent = this.levelIndex >= 3
      ? 'The fortress is still standing. So is your chance.'
      : 'You gave them hell. Not enough of it.';
    this.el.deathScreen.classList.remove('is-hidden');
    this.el.hud.classList.add('is-hidden');
    document.body.classList.remove('is-playing');
  }

  showVictory() {
    this.state = 'victory';
    this.saveBest();
    this.audio.stopMusic();
    this.audio.levelClear();
    this.el.victoryScore.textContent = padScore(this.score);
    this.el.victoryKills.textContent = String(this.kills);
    this.el.victoryTime.textContent = formatTime(this.campaignTime);
    this.el.victoryScreen.classList.remove('is-hidden');
    this.el.hud.classList.add('is-hidden');
    document.body.classList.remove('is-playing');
    this.updateMenuUI();
  }

  toggleMute() {
    this.audio.init();
    const muted = this.audio.toggleMute();
    this.el.muteBtn.textContent = muted ? '×' : '♪';
    this.el.muteBtn.title = muted ? 'Unmute (M)' : 'Mute (M)';
    this.showToast(muted ? 'AUDIO MUTED' : 'AUDIO ONLINE', muted ? 'SILENT RUN' : 'SOUND RESTORED', 1400);
  }

  /* ============================================================
     Main loop
     ============================================================ */
  loop(timestamp) {
    if (!this.lastFrame) this.lastFrame = timestamp;
    const frame = Math.min(0.05, (timestamp - this.lastFrame) / 1000);
    this.lastFrame = timestamp;
    this.acc += frame;
    let steps = 0;
    while (this.acc >= FIXED && steps < 5) {
      this.tick(FIXED);
      this.acc -= FIXED;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    this.renderer.render();
    requestAnimationFrame(this._loop);
  }

  tick(dt) {
    if (this.state !== 'paused' && this.state !== 'gameover') {
      this.animTime += dt;
      this.flash = Math.max(0, this.flash - dt * 2.6);
      this.hitMarker = Math.max(0, this.hitMarker - dt);
      this.crosshairSpread = approach(this.crosshairSpread, 0, dt * 24);
      this.lightning = Math.max(0, this.lightning - dt * 4.2);
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = rand(4.5, 10);
        this.lightning = rand(0.6, 1);
      }
      this.updateTimers(dt);
    }
    if (this.state === 'menu') {
      this.camera.x = 420 + Math.sin(this.animTime * 0.09) * 24;
      this.updateMouseWorld();
      this.player.aimAngle = -0.03 + Math.sin(this.animTime * 0.5) * 0.02;
      this.player.muzzleTimer = 0;
    } else if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.state === 'dying') {
      this.updateDying(dt);
    } else if (this.state === 'paused') {
      this.updateCamera(dt * 0.2);
    }
  }

  updateTimers(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.time -= dt;
      if (t.time <= 0) {
        this.timers.splice(i, 1);
        try { t.fn(); } catch (err) { console.error(err); }
      }
    }
  }

  addTimer(delay, fn) {
    this.timers.push({ time: delay, fn });
  }

  updatePlaying(dt) {
    this.levelTime += dt;
    this.campaignTime += dt;
    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateGrenades(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updatePickups(dt);
    this.updateDestructibles(dt);
    this.updateHazards(dt);
    this.updateParticles(dt);
    this.updateEffects(dt);
    this.updateDecals(dt);
    this.updateTexts(dt);
    this.updateCamera(dt);
    this.updateMouseWorld();
    this.updateCombo(dt);
    this.updateFieldTips(dt);
    this.checkCheckpoints();
    this.checkExit();
    this.updateHUD();
    this.audio.update(dt, this.combatIntensity());
    if (this.player.health <= 0 && this.state === 'playing') this.beginDeath();
  }

  updateDying(dt) {
    this.deathTimer -= dt;
    this.updateParticles(dt * 0.45);
    this.updateEffects(dt * 0.45);
    this.updateTexts(dt * 0.45);
    this.updateCamera(dt * 0.3);
    this.flash = Math.max(0, this.flash - dt * 1.2);
    if (this.deathTimer <= 0) this.showGameOver();
  }

  updateMenuPreview(dt) {
    // Atmospheric idle only; the campaign is loaded fresh on Play.
    this.updateParticles(dt);
  }

  beginDeath() {
    if (this.state !== 'playing') return;
    this.player.dead = true;
    this.state = 'dying';
    this.deathTimer = 1.35;
    this.input.firing = false;
    this.touch.fire = false;
    this.audio.hurt();
    this.audio.stopMusic();
    this.camera.shake = 13;
    this.spawnBlood(this.player.x + this.player.w / 2, this.player.y + 26, 26);
    this.flash = 0.8;
    document.body.classList.remove('is-playing');
  }

  combatIntensity() {
    if (!this.player || !this.runtime) return 0;
    let near = 0;
    const cx = this.player.x;
    for (const e of this.runtime.enemies) {
      if (!e.dead && Math.abs(e.x - cx) < 900) near++;
    }
    if (this.boss && this.boss.active && !this.boss.dead) near += 4;
    return clamp(near / 7, 0, 1);
  }

  /* ============================================================
     Player movement and combat
     ============================================================ */
  updatePlayer(dt) {
    const p = this.player;
    if (!p || p.dead) return;
    p.invuln = Math.max(0, p.invuln - dt);
    p.rollCd = Math.max(0, p.rollCd - dt);
    p.knifeCd = Math.max(0, p.knifeCd - dt);
    p.knifeTimer = Math.max(0, p.knifeTimer - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.muzzleTimer = Math.max(0, p.muzzleTimer - dt);
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.landTimer = Math.max(0, p.landTimer - dt);

    this.updateMouseWorld();
    let aiming = false;
    if (this.touchMode && (this.touch.fire || this.input.firing)) {
      const target = this.findAimTarget();
      if (target) {
        const sx = p.x + p.w / 2;
        const sy = p.y + 22;
        p.aimAngle = Math.atan2(target.y - sy, target.x - sx);
        aiming = true;
      }
    }
    if (!aiming) {
      const sx = p.x + p.w / 2;
      const sy = p.y + 22;
      p.aimAngle = Math.atan2(this.mouse.y - sy, this.mouse.x - sx);
    }
    p.facing = Math.cos(p.aimAngle) >= 0 ? 1 : -1;

    const left = this.input.left || this.touch.left;
    const right = this.input.right || this.touch.right;
    const moveDir = (right ? 1 : 0) - (left ? 1 : 0);

    if (p.rollTimer > 0) {
      p.rollTimer -= dt;
      p.vx = p.rollDir * 690;
      p.vy = Math.min(p.vy + GRAVITY * 0.72 * dt, MAX_FALL);
      if (p.rollTimer <= 0) p.vx *= 0.35;
    } else {
      const targetSpeed = moveDir * PLAYER_SPEED;
      const accel = p.grounded ? PLAYER_ACCEL : PLAYER_ACCEL * 0.58;
      if (moveDir !== 0) {
        p.vx = approach(p.vx, targetSpeed, accel * dt);
      } else {
        p.vx = approach(p.vx, 0, (p.grounded ? 2500 : 520) * dt);
      }
      p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
      if (!this.input.jumpHeld && p.vy < -180) {
        p.vy += GRAVITY * 1.45 * dt;
      }
    }

    // Jump with coyote time + input buffer.
    if (p.coyote > 0) p.coyote -= dt;
    if (p.jumpBuffer > 0 && p.coyote > 0 && p.rollTimer <= 0) {
      p.vy = -PLAYER_JUMP;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      this.audio.jump();
      this.addDust(p.x + p.w / 2, p.y + p.h, 4, '#b6a07c');
    }

    const wasGrounded = p.grounded;
    const fallSpeed = p.vy;
    this.moveActor(p, dt);
    if (!wasGrounded && p.grounded && fallSpeed > 360) {
      this.audio.land(clamp(fallSpeed / 800, 0.4, 1.3));
      this.addDust(p.x + p.w / 2, p.y + p.h, 7, '#b8a37f');
      this.camera.shake = Math.max(this.camera.shake, clamp(fallSpeed / 260, 1, 4));
    }

    if (p.grounded) {
      p.coyote = COYOTE_TIME;
    }

    // Run animation + footfall dust.
    p.runPhase += Math.abs(p.vx) * dt * 0.075;
    if (p.grounded && Math.abs(p.vx) > 90) {
      p.stepTimer -= dt;
      if (p.stepTimer <= 0) {
        p.stepTimer = 0.19;
        this.addDust(p.x + p.w / 2 - p.facing * 9, p.y + p.h, 2, 'rgba(196,178,146,.5)');
        if (p.grounded && Math.random() < 0.25) this.audio.land(0.25);
      }
    } else {
      p.stepTimer = 0;
    }

    // Weapon reload.
    if (p.reloading) {
      p.reloadTimer -= dt;
      p.reloadProgress = 1 - clamp(p.reloadTimer / p.reloadDuration, 0, 1);
      if (p.reloadTimer <= 0) this.finishReload();
    }

    // Fire control. Auto weapons fire while held, semi-auto on a fresh trigger.
    const cfg = WEAPONS[p.weaponId];
    if (cfg && !p.reloading && p.fireCd <= 0) {
      const wantFire = cfg.auto ? (this.input.firing || this.touch.fire) : (this.input.firePressed || this.touch.fire);
      if (wantFire) this.fireWeapon();
    }
    this.input.firePressed = false;

    // World bounds and pits.
    p.x = clamp(p.x, 8, this.level.width - p.w - 8);
    if (p.y > 880) this.fallRespawn();
  }

  moveActor(a, dt) {
    const platforms = this.runtime.platforms;
    a.x += a.vx * dt;
    for (const plat of platforms) {
      if (!rectsOverlap(a, plat)) continue;
      if (a.vx > 0) a.x = plat.x - a.w - 0.01;
      else if (a.vx < 0) a.x = plat.x + plat.w + 0.01;
      a.vx = 0;
    }
    a.grounded = false;
    a.y += a.vy * dt;
    for (const plat of platforms) {
      if (!rectsOverlap(a, plat)) continue;
      if (a.vy > 0) {
        a.y = plat.y - a.h - 0.01;
        a.vy = 0;
        a.grounded = true;
      } else if (a.vy < 0) {
        a.y = plat.y + plat.h + 0.01;
        a.vy = 0;
      }
    }
  }

  pointSolid(x, y) {
    for (const p of this.runtime.platforms) {
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
    }
    return false;
  }

  hasSupport(x, y) {
    return this.pointSolid(x, y);
  }

  fireWeapon() {
    const p = this.player;
    if (!p || p.dead || p.reloading || p.fireCd > 0) return;
    const id = p.weaponId;
    const cfg = WEAPONS[id];
    if (!cfg) return;
    const ammo = p.ammo[id];
    if (!ammo) return;
    if (ammo.mag <= 0) {
      if (ammo.reserve > 0) {
        this.startReload();
      } else {
        this.audio.empty();
        p.fireCd = 0.22;
        this.showToast('WEAPON EMPTY', `${cfg.name} — NO AMMUNITION`, 1500);
      }
      this.input.firePressed = false;
      return;
    }

    ammo.mag--;
    p.fireCd = cfg.fireDelay;
    p.muzzleTimer = 0.058;
    p.muzzleSeed = rand(0, TAU);
    p.reloading = false;
    p.reloadProgress = 0;
    const sx = p.x + p.w / 2;
    const sy = p.y + 22;
    const baseAngle = p.aimAngle;
    const muzzleDist = id === 'rocket' ? 28 : 26;
    const spread = cfg.spread;
    const pelletCount = cfg.pellets || 1;
    for (let i = 0; i < pelletCount; i++) {
      const angle = baseAngle + rand(-spread, spread) + (pelletCount > 1 ? rand(-0.025, 0.025) : 0);
      const speed = cfg.bulletSpeed * rand(0.96, 1.04);
      this.runtime.bullets.push({
        owner: 'player',
        x: sx + Math.cos(angle) * muzzleDist,
        y: sy + Math.sin(angle) * muzzleDist,
        px: sx + Math.cos(angle) * muzzleDist,
        py: sy + Math.sin(angle) * muzzleDist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: cfg.id === 'rifle' ? 1.35 : 1.05,
        damage: cfg.damage,
        color: cfg.tracer,
        rocket: id === 'rocket',
        explosive: cfg.explosive || null,
        angle
      });
    }

    // Physical feedback.
    const recoil = cfg.recoil || 2;
    p.vx -= Math.cos(baseAngle) * recoil * 5;
    this.camera.shake = Math.max(this.camera.shake, cfg.shake || 2);
    this.crosshairSpread = Math.min(15, this.crosshairSpread + recoil * 0.9);
    this.flash = Math.max(this.flash, id === 'rocket' ? 0.42 : 0.1);
    const pan = clamp((p.x - (this.camera.x + this.view.w / 2)) / (this.view.w / 2), -0.8, 0.8);
    this.audio.shot(cfg.sound, pan);
    if (id !== 'rocket') {
      const perp = baseAngle + Math.PI / 2;
      this.addParticle({
        type: 'casing', x: sx + Math.cos(baseAngle) * 20, y: sy + Math.sin(baseAngle) * 20,
        vx: Math.cos(perp) * rand(70, 140) + rand(-20, 20),
        vy: -rand(100, 210), life: 0.9, size: 2.2, color: '#d6ad68',
        gravity: 900, angle: rand(0, TAU), spin: rand(-12, 12)
      });
      for (let i = 0; i < 2; i++) {
        this.addParticle({
          type: 'smoke', x: sx + Math.cos(baseAngle) * (20 + i * 8), y: sy + Math.sin(baseAngle) * (20 + i * 8),
          vx: Math.cos(baseAngle) * rand(20, 60) + rand(-20, 20),
          vy: Math.sin(baseAngle) * rand(20, 60) - rand(10, 30),
          life: rand(0.22, 0.4), size: rand(3, 6), color: 'rgba(170,155,130,.16)', gravity: -20
        });
      }
    }
    if (ammo.mag === 0 && ammo.reserve > 0) {
      this.addTimer(0.22, () => {
        if (this.player && this.player.weaponId === id) this.startReload();
      });
    }
    this.weaponDirty = true;
  }

  startReload() {
    const p = this.player;
    if (!p || p.dead || p.reloading) return;
    const cfg = WEAPONS[p.weaponId];
    const ammo = p.ammo[p.weaponId];
    if (!cfg || !ammo) return;
    if (ammo.mag >= cfg.magSize) return;
    if (ammo.reserve <= 0) {
      this.showToast('OUT OF AMMO', 'FIND AN AMMUNITION CACHE', 1500);
      this.audio.empty();
      return;
    }
    p.reloading = true;
    p.reloadTimer = cfg.reloadTime;
    p.reloadDuration = cfg.reloadTime;
    p.reloadProgress = 0;
    this.audio.reload();
  }

  finishReload() {
    const p = this.player;
    if (!p) return;
    const cfg = WEAPONS[p.weaponId];
    const ammo = p.ammo[p.weaponId];
    if (!cfg || !ammo) return;
    const need = cfg.magSize - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
    p.reloading = false;
    p.reloadTimer = 0;
    p.reloadProgress = 0;
    this.audio.reloadDone();
    this.weaponDirty = true;
  }

  selectWeapon(id) {
    if (!id) return;
    if (!this.unlocked.includes(id)) {
      this.showToast('WEAPON LOCKED', `CLEAR SECTOR 0${Math.max(1, WEAPONS[id].slot - 1)} TO UNLOCK`, 1500);
      return;
    }
    const p = this.player;
    if (!p || p.dead || p.weaponId === id) return;
    p.weaponId = id;
    p.reloading = false;
    p.reloadProgress = 0;
    p.fireCd = Math.max(p.fireCd, 0.12);
    this.weaponDirty = true;
    this.audio.reloadDone();
  }

  cycleWeapon(direction) {
    const available = WEAPON_ORDER.filter(id => this.unlocked.includes(id));
    if (available.length <= 1) return;
    let idx = available.indexOf(this.player.weaponId);
    idx = (idx + direction + available.length) % available.length;
    this.selectWeapon(available[idx]);
  }

  knife() {
    const p = this.player;
    if (!p || p.dead || p.knifeCd > 0 || this.state !== 'playing') return;
    p.knifeCd = 0.4;
    p.knifeTimer = 0.24;
    this.audio.knifeSwish();
    const cx = p.x + p.w / 2;
    const cy = p.y + 24;
    let hitSomething = false;
    for (const e of this.runtime.enemies) {
      if (e.dead) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const dx = ex - cx;
      const dy = ey - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > 84) continue;
      const ang = Math.atan2(dy, dx);
      let delta = (ang - p.aimAngle + Math.PI * 3) % TAU - Math.PI;
      if (Math.abs(delta) > 1.25) continue;
      const heavy = e.type === 'heavy';
      this.applyDamageEnemy(e, heavy ? 105 : 155, p.aimAngle, false, true);
      hitSomething = true;
    }
    if (this.boss && this.boss.active && !this.boss.dead) {
      const bx = this.boss.x + this.boss.w / 2;
      const by = this.boss.y + this.boss.h * 0.55;
      if (Math.hypot(bx - cx, by - cy) < 120) {
        this.damageBoss(55);
        hitSomething = true;
      }
    }
    for (const d of this.runtime.destructibles) {
      if (d.dead) continue;
      const dx = d.x + d.w / 2 - cx;
      const dy = d.y + d.h / 2 - cy;
      if (Math.hypot(dx, dy) > 80) continue;
      const ang = Math.atan2(dy, dx);
      if (Math.abs((ang - p.aimAngle + Math.PI * 3) % TAU - Math.PI) > 1.3) continue;
      this.damageDestructible(d, 200, cx, cy);
      hitSomething = true;
    }
    if (hitSomething) {
      this.audio.knifeHit();
      this.hitMarker = 0.12;
      this.camera.shake = Math.max(this.camera.shake, 3.5);
      for (let i = 0; i < 8; i++) {
        this.addParticle({
          type: 'spark', x: cx + Math.cos(p.aimAngle) * 30, y: cy + Math.sin(p.aimAngle) * 30,
          vx: Math.cos(p.aimAngle + rand(-0.7, 0.7)) * rand(80, 260),
          vy: Math.sin(p.aimAngle + rand(-0.7, 0.7)) * rand(80, 260),
          life: rand(0.15, 0.34), size: rand(1, 2.2), color: '#ffe6b3', gravity: 420
        });
      }
    }
  }

  throwGrenade() {
    const p = this.player;
    if (!p || p.dead || this.state !== 'playing') return;
    if (p.grenades <= 0) {
      this.showToast('NO GRENADES', 'SUPPLY CRATES CARRY FRAG GRENADES', 1400);
      this.audio.empty();
      return;
    }
    p.grenades--;
    this.audio.throwGrenade();
    const sx = p.x + p.w / 2;
    const sy = p.y + 24;
    this.runtime.grenades.push({
      x: sx + Math.cos(p.aimAngle) * 18, y: sy + Math.sin(p.aimAngle) * 18,
      vx: Math.cos(p.aimAngle) * 520 + p.vx * 0.35,
      vy: Math.sin(p.aimAngle) * 520 - 185,
      fuse: 1.55, rot: 0, spin: rand(-10, 10), owner: 'player',
      radius: 132, damage: 110, trail: 0
    });
    this.weaponDirty = true;
  }

  roll() {
    const p = this.player;
    if (!p || p.dead || p.rollCd > 0 || this.state !== 'playing') return;
    p.rollTimer = p.rollDuration;
    p.rollCd = 1.08;
    p.rollDir = (this.input.right || this.touch.right ? 1 : 0) - (this.input.left || this.touch.left ? 1 : 0) || p.facing;
    p.invuln = Math.max(p.invuln, 0.36);
    this.audio.roll();
    this.addDust(p.x + p.w / 2, p.y + p.h, 9, '#c4ad89');
  }

  findAimTarget() {
    const p = this.player;
    if (!p) return null;
    let best = null;
    let bestDist = 880;
    for (const e of this.runtime.enemies) {
      if (e.dead) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const dist = Math.hypot(ex - p.x, ey - p.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: ex, y: ey };
      }
    }
    if (this.boss && this.boss.active && !this.boss.dead) {
      const bx = this.boss.x + this.boss.w / 2;
      const by = this.boss.y + this.boss.h * 0.55;
      const dist = Math.hypot(bx - p.x, by - p.y);
      if (dist < bestDist) best = { x: bx, y: by };
    }
    return best;
  }

  fallRespawn() {
    const p = this.player;
    if (!p || p.dead) return;
    this.damagePlayer(30, p.x, p.y, { fall: true, ignoreInvuln: true });
    if (p.health <= 0 || this.state !== 'playing') return;
    p.x = this.checkpoint.x;
    p.y = this.checkpoint.y - PLAYER_H;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 1.4;
    this.camera.shake = 8;
    this.showToast('SIGNAL RECOVERED', 'REDEPLOYED AT LAST CHECKPOINT', 2000);
    this.audio.objective();
  }

  /* ============================================================
     World simulation
     ============================================================ */
  updateBullets(dt) {
    const bullets = this.runtime.bullets;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.px = b.x;
      b.py = b.y;
      const total = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.ceil(total / 8));
      const dx = b.vx * dt / steps;
      const dy = b.vy * dt / steps;
      let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        b.x += dx;
        b.y += dy;
        if (this.pointSolid(b.x, b.y)) {
          if (b.rocket) this.explode(b.x, b.y, b.explosive?.radius || 110, b.explosive?.damage || 100, 'player');
          else this.bulletImpact(b, 'wall');
          hit = true;
          break;
        }
        if (b.owner === 'player') {
          for (const e of this.runtime.enemies) {
            if (e.dead) continue;
            if (pointInRect(b.x, b.y, { x: e.x - 4, y: e.y - 3, w: e.w + 8, h: e.h + 6 })) {
              const headshot = b.y < e.y + e.h * 0.23;
              if (b.rocket) {
                this.explode(b.x, b.y, b.explosive?.radius || 110, b.explosive?.damage || 100, 'player');
                this.applyDamageEnemy(e, b.damage, b.angle, headshot);
              } else {
                this.applyDamageEnemy(e, b.damage * (headshot ? 1.65 : 1), b.angle, headshot);
                this.bulletImpact(b, 'flesh');
              }
              hit = true;
              break;
            }
          }
          if (hit) break;
          if (this.boss && this.boss.active && !this.boss.dead) {
            const boss = this.boss;
            if (pointInRect(b.x, b.y, { x: boss.x - 8, y: boss.y - 6, w: boss.w + 16, h: boss.h + 12 })) {
              if (b.rocket) {
                this.explode(b.x, b.y, b.explosive?.radius || 110, b.explosive?.damage || 100, 'player');
                this.damageBoss(b.damage);
              } else {
                this.damageBoss(b.damage);
                this.hitMarker = 0.12;
                this.audio.hitMarker(false);
                this.spawnSparks(b.x, b.y, '#ffb15e', 4);
              }
              hit = true;
              break;
            }
          }
          if (hit) break;
          for (const d of this.runtime.destructibles) {
            if (d.dead) continue;
            if (pointInRect(b.x, b.y, d)) {
              if (b.rocket) {
                this.explode(b.x, b.y, b.explosive?.radius || 110, b.explosive?.damage || 100, 'player');
              } else {
                this.damageDestructible(d, b.damage, b.x, b.y);
                this.bulletImpact(b, 'wood');
              }
              hit = true;
              break;
            }
          }
        } else {
          const p = this.player;
          if (!p.dead && p.invuln <= 0 && rectsOverlap({ x: b.x - 2, y: b.y - 2, w: 4, h: 4 }, p)) {
            this.damagePlayer(b.damage, b.x, b.y, { bullet: true });
            this.spawnSparks(b.x, b.y, '#ff6a4f', 5);
            hit = true;
            break;
          }
        }
      }
      b.life -= dt;
      if (hit || b.life <= 0 || b.x < -100 || b.x > this.level.width + 100 || b.y < -200 || b.y > 900) {
        bullets.splice(i, 1);
      }
    }
  }

  bulletImpact(b, kind) {
    if (b.rocket) {
      this.explode(b.x, b.y, b.explosive?.radius || 110, b.explosive?.damage || 100, 'player');
      return;
    }
    if (kind === 'flesh') {
      this.spawnBlood(b.x, b.y, 5);
    } else {
      this.spawnSparks(b.x, b.y, b.owner === 'player' ? '#ffdda0' : '#ff8a6b', 4);
      this.addDecal({ x: b.x, y: b.y, size: rand(3, 6), angle: rand(0, TAU), type: 'hole' });
      this.addParticle({
        type: 'smoke', x: b.x, y: b.y, vx: rand(-10, 10), vy: rand(-30, -8),
        life: rand(0.16, 0.3), size: rand(2, 4), color: 'rgba(170,160,140,.12)', gravity: -10
      });
    }
  }

  updateGrenades(dt) {
    const arr = this.runtime.grenades;
    for (let i = arr.length - 1; i >= 0; i--) {
      const n = arr[i];
      n.fuse -= dt;
      n.vy = Math.min(n.vy + GRAVITY * 0.85 * dt, MAX_FALL);
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.rot += n.spin * dt;
      n.trail -= dt;
      if (n.trail <= 0) {
        n.trail = 0.08;
        this.addParticle({
          type: 'smoke', x: n.x, y: n.y, vx: rand(-10, 10), vy: rand(-25, -6),
          life: rand(0.3, 0.55), size: rand(3, 7), color: 'rgba(175,172,154,.12)', gravity: -18
        });
      }
      for (const plat of this.runtime.platforms) {
        if (!rectsOverlap({ x: n.x - 4, y: n.y - 4, w: 8, h: 8 }, plat)) continue;
        if (n.vy > 0) {
          n.y = plat.y - 5;
          n.vy *= -0.42;
        } else if (n.vy < 0) {
          n.y = plat.y + plat.h + 5;
          n.vy *= 0.32;
        }
        n.vx *= 0.74;
        n.spin *= 0.7;
      }
      n.x = clamp(n.x, 10, this.level.width - 10);
      if (n.fuse <= 0) {
        this.explode(n.x, n.y, n.radius || 122, n.damage || 100, n.owner);
        arr.splice(i, 1);
      }
    }
  }

  updateEnemies(dt) {
    const arr = this.runtime.enemies;
    const p = this.player;
    for (let i = arr.length - 1; i >= 0; i--) {
      const e = arr[i];
      if (e.dead) {
        e.deathTimer -= dt;
        if (e.deathTimer <= 0) arr.splice(i, 1);
        continue;
      }
      const cfg = ENEMY_STATS[e.type] || ENEMY_STATS.grunt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.shootCd -= dt;
      e.burstTimer -= dt;
      e.losTimer -= dt;
      e.alertTimer = Math.max(0, e.alertTimer - dt);
      const px = p.x + p.w / 2;
      const py = p.y + p.h / 2;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const dx = px - ex;
      const dy = py - ey;
      const dist = Math.hypot(dx, dy);
      if (e.losTimer <= 0) {
        e.hasLOS = this.lineOfSight(ex, ey, px, py);
        e.losTimer = rand(0.1, 0.19);
      }

      if (e.type === 'drone') {
        this.updateDrone(e, cfg, dt, dx, dy, dist, px, py);
      } else if (e.type === 'turret') {
        const desired = Math.atan2(dy, dx);
        e.aimAngle = this.rotateTowards(e.aimAngle, desired, dt * 5.5);
        if (dist < cfg.aggro && e.hasLOS) e.alert = true;
      } else {
        this.updateGroundEnemy(e, cfg, dt, dx, dy, dist, px, py);
      }

      if (!e.alert && dist < cfg.aggro && (e.hasLOS || dist < 210) && e.alertTimer <= 0) {
        e.alert = true;
        e.alertTimer = 2.5;
        if (Math.random() < 0.4) this.addFloatText(ex, e.y - 14, 'CONTACT', '#e7a57f', 7, 0.7);
      }

      if (e.type !== 'drone' && e.type !== 'turret') {
        e.aimAngle = this.rotateTowards(e.aimAngle, Math.atan2(dy, dx), dt * 7);
      }

      if (e.alert && e.hasLOS && dist < cfg.fireRange) {
        if (e.burstLeft <= 0 && e.shootCd <= 0) {
          e.burstLeft = cfg.burst;
          e.burstTimer = 0;
          e.shootCd = cfg.cooldown * rand(0.85, 1.22);
        }
        if (e.burstLeft > 0 && e.burstTimer <= 0) {
          this.fireEnemyBullet(e, cfg);
          e.burstLeft--;
          e.burstTimer = cfg.burstInterval;
        }
      } else if (e.burstLeft > 0 && !e.hasLOS) {
        e.burstLeft = 0;
      }
    }
  }

  updateGroundEnemy(e, cfg, dt, dx, dy, dist, px, py) {
    e.vx = 0;
    if (e.alert) {
      e.facing = dx >= 0 ? 1 : -1;
      if (dist > 250 && e.hasLOS) {
        e.vx = e.facing * cfg.speed;
      } else if (!e.hasLOS && dist > 300) {
        e.vx = e.facing * cfg.speed * 0.45;
      }
    } else {
      if (Math.abs(e.x - e.patrolOrigin) > e.patrolRange) {
        e.patrolDir = e.x > e.patrolOrigin ? -1 : 1;
      }
      e.vx = e.patrolDir * cfg.speed * 0.48;
      e.facing = e.patrolDir;
      e.aimAngle = this.rotateTowards(e.aimAngle, e.patrolDir > 0 ? 0 : Math.PI, dt * 3);
    }
    e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
    const oldX = e.x;
    this.moveActor(e, dt);
    if (e.vx === 0 && e.grounded && e.alert && Math.abs(dx) > 250) {
      // A wall or ledge stopped the advance; hold position.
    }
    if (e.grounded && Math.abs(e.vx) > 2) {
      const frontX = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
      if (!this.hasSupport(frontX, e.y + e.h + 5)) {
        if (e.alert) e.vx = 0;
        else {
          e.patrolDir *= -1;
          e.facing = e.patrolDir;
          e.x = oldX;
        }
      }
    }
    e.x = clamp(e.x, 0, this.level.width - e.w);
  }

  updateDrone(e, cfg, dt, dx, dy, dist, px, py) {
    const t = this.animTime;
    if (dist < cfg.aggro && (e.hasLOS || dist < 320)) e.alert = true;
    e.phase += dt * 1.8;
    let targetX;
    let targetY;
    if (e.alert) {
      targetX = px - (e.startX % 2 === 0 ? 1 : -1) * 130;
      targetY = py - 112 + Math.sin(e.phase) * 15;
    } else {
      targetX = e.startX + Math.sin(e.phase * 0.4) * 75;
      targetY = e.startY + Math.sin(e.phase) * e.amp;
    }
    const dxT = targetX - (e.x + e.w / 2);
    const dyT = targetY - (e.y + e.h / 2);
    const dT = Math.hypot(dxT, dyT) || 1;
    const sp = cfg.speed;
    e.vx = (dxT / dT) * sp;
    e.vy = (dyT / dT) * sp * 0.85;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = clamp(e.x, 12, this.level.width - e.w - 12);
    e.y = clamp(e.y, 90, 555);
    e.facing = dx >= 0 ? 1 : -1;
    e.aimAngle = this.rotateTowards(e.aimAngle, Math.atan2(dy, dx), dt * 7);
    e.aimX = e.facing * 5;
  }

  rotateTowards(current, target, maxStep) {
    let delta = (target - current + Math.PI * 3) % TAU - Math.PI;
    if (Math.abs(delta) <= maxStep) return target;
    return current + Math.sign(delta) * maxStep;
  }

  fireEnemyBullet(e, cfg) {
    const pellets = cfg.pellets || 1;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h * (e.type === 'drone' ? 0.5 : 0.45);
    const base = Math.atan2(this.player.y + this.player.h / 2 - ey, this.player.x + this.player.w / 2 - ex);
    for (let i = 0; i < pellets; i++) {
      const angle = base + rand(-cfg.spread, cfg.spread);
      const speed = cfg.bulletSpeed * rand(0.94, 1.06);
      const sx = ex + Math.cos(angle) * (e.type === 'drone' ? 16 : 24);
      const sy = ey + Math.sin(angle) * (e.type === 'drone' ? 10 : 16);
      this.runtime.bullets.push({
        owner: 'enemy', x: sx, y: sy, px: sx, py: sy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1.5, damage: cfg.damage, color: '#ff6e54',
        angle, rocket: false
      });
    }
    const pan = clamp((e.x - (this.camera.x + this.view.w / 2)) / (this.view.w / 2), -0.8, 0.8);
    this.audio.shot(e.type === 'turret' ? 'turret' : 'enemy', pan);
    this.spawnSparks(ex + Math.cos(base) * 26, ey + Math.sin(base) * 16, '#ff9c62', 2);
  }

  updateBoss(dt) {
    const data = this.level;
    if (data.boss && !this.boss && this.player && this.player.x > data.bossTrigger) {
      this.spawnBoss();
    }
    const b = this.boss;
    if (!b) return;
    b.muzzleTimer = Math.max(0, (b.muzzleTimer || 0) - dt);
    b.hitFlash = Math.max(0, b.hitFlash - dt);
    if (b.dead) {
      b.deathTimer -= dt;
      if (this.runtime.gate) {
        this.runtime.gate.open = Math.min(1, this.runtime.gate.open + dt * 0.55);
        if (this.runtime.gate.open > 0.35 && !this.runtime.gate.removed) {
          this.runtime.gate.removed = true;
          this.runtime.platforms = this.runtime.platforms.filter(p => !p.isGate);
        }
      }
      if (b.deathTimer <= 0) b.removed = true;
      return;
    }
    if (!b.active) return;
    const p = this.player;
    const ex = b.x + b.w / 2;
    const ey = b.y + b.h * 0.6;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    b.aimAngle = this.rotateTowards(b.aimAngle, Math.atan2(py - ey, px - ex), dt * 3.5);
    b.facing = px >= ex ? 1 : -1;
    b.shootCd -= dt;
    b.grenadeCd -= dt;
    b.stompCd -= dt;
    b.burstTimer -= dt;
    if (b.burstLeft > 0 && b.burstTimer <= 0) {
      this.fireBossBullet(b);
      b.burstLeft--;
      b.burstTimer = b.phase === 2 ? 0.085 : 0.105;
      b.muzzleTimer = 0.06;
    }
    if (b.burstLeft <= 0 && b.shootCd <= 0) {
      b.burstLeft = b.phase === 2 ? 11 : 8;
      b.burstTimer = 0;
      b.shootCd = b.phase === 2 ? 1.55 : 2.4;
    }
    if (b.grenadeCd <= 0) {
      b.grenadeCd = b.phase === 2 ? 3.2 : 4.6;
      const dir = Math.atan2(py - ey - 50, px - ex);
      this.runtime.grenades.push({
        x: ex + Math.cos(b.aimAngle) * 60, y: ey - 5,
        vx: Math.cos(dir) * 330 + rand(-40, 40), vy: -520,
        fuse: 2.2, rot: 0, spin: rand(-8, 8), owner: 'enemy',
        radius: 108, damage: 22, trail: 0
      });
      this.audio.throwGrenade();
    }
    if (b.stompCd <= 0 && Math.abs(px - ex) < 130 && p.grounded) {
      b.stompCd = 4.4;
      this.explode(ex, 616, 120, 12, 'enemy');
      p.vx += Math.sign(px - ex || 1) * 480;
      p.vy = -330;
      this.camera.shake = 20;
    }
    if (b.phase === 1 && b.hp <= b.maxHp * 0.5) {
      b.phase = 2;
      b.shootCd = 0.6;
      this.audio.alarm();
      this.audio.bossRoar();
      this.showToast('ARMOR BREACHED', 'VOLKOV IS CALLING IN DRONES', 2400);
      this.addFloatText(ex, b.y - 20, 'ARMOR BREACHED', '#f08a61', 11, 1.4);
      for (let i = 0; i < 2; i++) {
        const drone = this.createEnemy({ type: 'drone', x: b.x + (i ? 120 : -110), y: b.y - 130, amp: 40 });
        drone.alert = true;
        drone.startX = drone.x;
        drone.startY = drone.y;
        this.runtime.enemies.push(drone);
      }
    }
    b.x = clamp(b.x, 4310, this.level.width - b.w - 30);
  }

  spawnBoss() {
    const data = this.level.boss;
    this.boss = {
      x: data.x, y: data.y, w: 88, h: 142,
      hp: data.hp, maxHp: data.hp, active: true, dead: false,
      removed: false, deathTimer: 0, phase: 1,
      aimAngle: Math.PI, facing: -1, shootCd: 1.2, grenadeCd: 3.5,
      stompCd: 2.5, burstLeft: 0, burstTimer: 0, muzzleTimer: 0, hitFlash: 0
    };
    const gate = { x: this.level.gateX, y: 210, w: 40, h: 410, kind: 'metal', isGate: true, open: 0, removed: false };
    gate.detail = makePlatformDetail(gate);
    this.runtime.gate = gate;
    if (!this.runtime.platforms.some(p => p.isGate)) this.runtime.platforms.push(gate);
    this.checkpoint = { x: 4370, y: 620 };
    this.audio.bossRoar();
    this.audio.alarm();
    this.camera.shake = 18;
    this.flash = 0.65;
    this.el.bossWrap.classList.remove('is-hidden');
    this.el.bossName.textContent = data.name;
    this.el.bossTitle.textContent = data.title;
    this.el.objectiveText.textContent = 'ELIMINATE COLONEL VOLKOV';
    this.showToast('TARGET ACQUIRED', 'COLONEL VOLKOV // THE IRON WALL', 3000);
    this.showKillFeed('BOSS ENGAGED', 'COLONEL VOLKOV', true);
    for (let i = 0; i < 10; i++) {
      this.addParticle({
        type: 'debris', x: gate.x + rand(-10, 50), y: rand(400, 600),
        vx: rand(-80, 80), vy: rand(-180, -30), life: rand(0.6, 1.2),
        size: rand(2, 5), color: '#7b715f', gravity: 500, angle: rand(0, TAU), spin: rand(-5, 5)
      });
    }
  }

  fireBossBullet(b) {
    const sx = b.x + b.w / 2;
    const sy = b.y + b.h * 0.6;
    const spread = b.phase === 2 ? 0.075 : 0.052;
    const angle = b.aimAngle + rand(-spread, spread);
    this.runtime.bullets.push({
      owner: 'enemy', x: sx + Math.cos(angle) * 68, y: sy + Math.sin(angle) * 30,
      px: sx + Math.cos(angle) * 68, py: sy + Math.sin(angle) * 30,
      vx: Math.cos(angle) * 820, vy: Math.sin(angle) * 820,
      life: 1.6, damage: 8, color: '#ff8a5c', angle, rocket: false
    });
    const pan = clamp((b.x - (this.camera.x + this.view.w / 2)) / (this.view.w / 2), -0.8, 0.8);
    this.audio.shot('turret', pan);
  }

  damageBoss(amount) {
    const b = this.boss;
    if (!b || b.dead) return;
    b.hp = Math.max(0, b.hp - amount);
    b.hitFlash = 0.08;
    this.hitMarker = 0.12;
    this.audio.hitMarker(false);
    this.spawnSparks(b.x + b.w / 2 + rand(-30, 30), b.y + b.h * 0.55 + rand(-20, 20), '#ffc27b', 3);
    if (b.hp <= 0) this.killBoss();
  }

  killBoss() {
    const b = this.boss;
    if (!b || b.dead) return;
    b.dead = true;
    b.deathTimer = 3.4;
    b.active = false;
    this.kills++;
    this.levelKills++;
    this.combo++;
    this.comboTimer = 4;
    this.score += 5000;
    this.audio.explosion(true);
    this.audio.bossRoar();
    this.camera.shake = 28;
    this.flash = 1;
    this.el.bossFill.style.width = '0%';
    this.el.objectiveText.textContent = 'SECTOR SECURED';
    this.showKillFeed('COLONEL VOLKOV DOWN', '+5000', true);
    this.addFloatText(b.x + b.w / 2, b.y, 'THE IRON WALL FALLS', '#f4d79a', 13, 2);
    for (let i = 0; i < 5; i++) {
      this.addTimer(i * 0.22, () => {
        if (!this.boss) return;
        this.explode(
          this.boss.x + this.boss.w / 2 + rand(-65, 65),
          this.boss.y + rand(20, 120),
          rand(50, 105), 0, 'player'
        );
        this.audio.explosion(i === 4);
      });
    }
    this.addTimer(3.5, () => {
      if (this.state === 'playing') this.showVictory();
    });
    const gate = this.runtime.gate;
    if (gate) gate.opening = true;
  }

  updatePickups(dt) {
    const p = this.player;
    const arr = this.runtime.pickups;
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      if (it.dead) { arr.splice(i, 1); continue; }
      it.life -= dt;
      it.age += dt;
      if (it.life <= 0) { arr.splice(i, 1); continue; }
      if (!it.grounded) {
        it.vy = Math.min(it.vy + GRAVITY * 0.8 * dt, MAX_FALL);
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        for (const plat of this.runtime.platforms) {
          if (!rectsOverlap(it, plat)) continue;
          if (it.vy > 0) {
            it.y = plat.y - it.h;
            it.vy = 0;
            it.vx *= 0.5;
            it.grounded = true;
          } else if (it.vy < 0) {
            it.y = plat.y + plat.h;
            it.vy = 0;
          }
        }
        it.x = clamp(it.x, 10, this.level.width - it.w - 10);
      } else {
        it.vx = approach(it.vx, 0, 460 * dt);
        it.x += it.vx * dt;
        const dist = Math.hypot((p.x + p.w / 2) - (it.x + it.w / 2), (p.y + p.h / 2) - (it.y + it.h / 2));
        if (dist < 115) {
          const dx = (p.x + p.w / 2) - (it.x + it.w / 2);
          const dy = (p.y + p.h / 2) - (it.y + it.h / 2);
          const dd = Math.hypot(dx, dy) || 1;
          const pull = clamp((115 - dist) / 30, 0.4, 4) * 380 * dt;
          it.x += (dx / dd) * pull;
          it.y += (dy / dd) * pull;
        }
      }
      if (!p.dead && rectsOverlap({ x: it.x - 8, y: it.y - 8, w: it.w + 16, h: it.h + 16 }, p)) {
        if (this.collectPickup(it)) {
          it.dead = true;
          arr.splice(i, 1);
        }
      }
    }
  }

  collectPickup(it) {
    const p = this.player;
    if (!p || p.dead) return false;
    this.score += 10;
    if (it.type === 'ammo') {
      const cfg = WEAPONS[p.weaponId];
      const a = p.ammo[p.weaponId];
      const add = Math.ceil(cfg.magSize * 1.5);
      a.reserve = Math.min(cfg.reserveMax, a.reserve + add);
      this.addFloatText(p.x + p.w / 2, p.y - 8, `+${add} AMMO`, '#e8c57e', 8, 0.9);
      this.showToast('AMMUNITION', `${cfg.name} RESERVE +${add}`, 1200);
      this.audio.pickup('ammo');
    } else if (it.type === 'health') {
      const heal = Math.min(30, p.maxHealth - p.health);
      p.health = Math.min(p.maxHealth, p.health + 30);
      this.addFloatText(p.x + p.w / 2, p.y - 8, heal > 0 ? `+${heal} HEALTH` : '+50 SCORE', '#8fd79a', 8, 0.9);
      this.audio.pickup('health');
    } else if (it.type === 'armor') {
      p.armor = Math.min(p.maxArmor, p.armor + 25);
      this.addFloatText(p.x + p.w / 2, p.y - 8, '+25 ARMOR', '#89c7dc', 8, 0.9);
      this.audio.pickup('health');
    } else if (it.type === 'grenade') {
      p.grenades = Math.min(7, p.grenades + 1);
      this.addFloatText(p.x + p.w / 2, p.y - 8, '+1 GRENADE', '#a9c39b', 8, 0.9);
      this.audio.pickup('ammo');
    } else if (it.type === 'weapon') {
      this.audio.pickup('weapon');
    }
    this.addParticle({
      type: 'flash', x: it.x + it.w / 2, y: it.y + it.h / 2,
      vx: 0, vy: 0, life: 0.25, size: 18, color: 'rgba(231,197,126,.45)'
    });
    this.weaponDirty = true;
    return true;
  }

  updateDestructibles(dt) {
    for (const d of this.runtime.destructibles) {
      d.flash = Math.max(0, (d.flash || 0) - dt);
      d.hitFlash = Math.max(0, (d.hitFlash || 0) - dt);
    }
  }

  updateHazards(dt) {
    const p = this.player;
    for (const h of this.runtime.hazards) {
      h.damageTimer = Math.max(0, h.damageTimer - dt);
      if (h.type === 'fire' && Math.random() < dt * 14) {
        this.addParticle({
          type: 'ember', x: h.x + rand(0, h.w), y: h.y + h.h - rand(10, 50),
          vx: rand(-15, 15), vy: rand(-90, -35), life: rand(0.4, 0.9),
          size: rand(1, 2), color: '#ff9b4d', gravity: -30
        });
      }
      if (h.type === 'electric' && Math.random() < dt * 8) {
        this.addParticle({
          type: 'spark', x: h.x + rand(0, h.w), y: h.y + h.h - 6,
          vx: rand(-100, 100), vy: rand(-150, -30), life: rand(0.12, 0.3),
          size: rand(0.8, 1.5), color: '#a8e9f6', gravity: 500
        });
      }
      if (p.dead) continue;
      if (rectsOverlap(p, { x: h.x, y: h.y, w: h.w, h: h.h }) && h.damageTimer <= 0) {
        h.damageTimer = h.interval || 0.6;
        this.damagePlayer(h.damage || 10, h.x + h.w / 2, h.y + h.h / 2, { hazard: true });
        p.vx += Math.sign(p.x + p.w / 2 - (h.x + h.w / 2) || 1) * 150;
      }
    }
  }

  /* ============================================================
     Effects and particles
     ============================================================ */
  addParticle(options) {
    if (this.runtime.particles.length > 900) this.runtime.particles.shift();
    this.runtime.particles.push({
      type: 'dot', x: 0, y: 0, vx: 0, vy: 0, life: 0.5, maxLife: 0.5,
      size: 2, color: '#fff', gravity: 0, drag: 0, angle: 0, spin: 0, ...options
    });
  }

  addDust(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'smoke', x: x + rand(-8, 8), y: y - rand(0, 5),
        vx: rand(-55, 55), vy: rand(-45, -8), life: rand(0.3, 0.65),
        size: rand(2, 6), color, gravity: -25, drag: 2
      });
    }
  }

  spawnSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'spark', x, y,
        vx: rand(-260, 260), vy: rand(-260, 80), life: rand(0.1, 0.35),
        size: rand(0.8, 2.1), color, gravity: 720, drag: 0.5
      });
    }
    this.addParticle({ type: 'flash', x, y, life: 0.08, size: 9, color: 'rgba(255,217,159,.45)' });
  }

  spawnBlood(x, y, count) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'blood', x, y, vx: rand(-140, 140), vy: rand(-180, 40),
        life: rand(0.25, 0.6), size: rand(1.4, 3.4), color: '#7d241b',
        gravity: 900, angle: rand(0, TAU), drag: 0.2
      });
    }
    if (Math.random() < 0.4) this.addDecal({ x: x + rand(-14, 14), y: y + rand(-8, 14), size: rand(4, 9), angle: rand(0, TAU), type: 'blood' });
  }

  addDecal(options) {
    if (this.runtime.decals.length > 120) this.runtime.decals.shift();
    this.runtime.decals.push({
      x: 0, y: 0, size: 5, angle: 0, type: 'hole', life: 25, maxLife: 25, ...options
    });
  }

  addFloatText(x, y, text, color = '#f0d9ac', size = 9, life = 0.8) {
    if (this.runtime.texts.length > 28) this.runtime.texts.shift();
    this.runtime.texts.push({
      x, y, text, color, size, life, maxLife: life, vy: -34
    });
  }

  explode(x, y, radius, damage, owner = 'player') {
    this.audio.explosion(radius > 120);
    this.camera.shake = Math.max(this.camera.shake, radius > 120 ? 18 : 11);
    this.flash = Math.max(this.flash, radius > 120 ? 0.72 : 0.46);
    this.runtime.effects.push({ type: 'explosion', x, y, radius, age: 0, duration: 0.52 });
    this.runtime.effects.push({ type: 'shockwave', x, y, radius: radius * 1.3, age: 0, duration: 0.46 });
    for (let i = 0; i < 16; i++) {
      this.addParticle({
        type: 'spark', x, y,
        vx: rand(-1, 1) * radius * 4.4, vy: rand(-1, 1) * radius * 4.4,
        life: rand(0.16, 0.5), size: rand(1, 2.6), color: choice(['#ffd58a', '#ff9b48', '#f26737']),
        gravity: 380, drag: 1.2
      });
    }
    for (let i = 0; i < 9; i++) {
      this.addParticle({
        type: 'smoke', x: x + rand(-radius * 0.25, radius * 0.25), y: y + rand(-radius * 0.18, radius * 0.18),
        vx: rand(-55, 55), vy: rand(-80, -12), life: rand(0.7, 1.6),
        size: rand(7, 18), color: 'rgba(41,38,33,.5)', gravity: -35, drag: 0.7
      });
    }
    for (let i = 0; i < 8; i++) {
      this.addParticle({
        type: 'debris', x, y, vx: rand(-1, 1) * radius * 3, vy: rand(-1, 0.2) * radius * 3,
        life: rand(0.45, 1.1), size: rand(2, 5), color: choice(['#66523d', '#3d3c34', '#8c5b36']),
        gravity: 900, angle: rand(0, TAU), spin: rand(-10, 10)
      });
    }
    if (damage > 0) {
      for (const e of this.runtime.enemies) {
        if (e.dead) continue;
        const ex = e.x + e.w / 2;
        const ey = e.y + e.h / 2;
        const dist = Math.hypot(ex - x, ey - y);
        if (dist < radius + e.w / 2) {
          const falloff = 1 - clamp((dist - e.w / 2) / radius, 0, 0.72);
          this.applyDamageEnemy(e, damage * falloff, Math.atan2(ey - y, ex - x), false);
        }
      }
      if (this.boss && this.boss.active && !this.boss.dead) {
        const bx = this.boss.x + this.boss.w / 2;
        const by = this.boss.y + this.boss.h / 2;
        const dist = Math.hypot(bx - x, by - y);
        if (dist < radius + 44) this.damageBoss(damage * (1 - clamp((dist - 40) / radius, 0, 0.7)));
      }
      const p = this.player;
      if (p && !p.dead) {
        const px = p.x + p.w / 2;
        const py = p.y + p.h / 2;
        const dist = Math.hypot(px - x, py - y);
        if (dist < radius + 20) {
          const scale = owner === 'player' ? 0.38 : 1;
          this.damagePlayer(damage * scale * (1 - clamp((dist - 20) / radius, 0, 0.72)), x, y, { explosion: true, ignoreInvuln: owner === 'enemy' });
        }
      }
      for (const d of this.runtime.destructibles) {
        if (d.dead) continue;
        const dx = d.x + d.w / 2;
        const dy = d.y + d.h / 2;
        if (Math.hypot(dx - x, dy - y) < radius + d.w / 2) {
          this.damageDestructible(d, 140, x, y);
        }
      }
    }
  }

  damageDestructible(d, amount, sourceX, sourceY) {
    if (!d || d.dead) return;
    d.hp -= amount;
    d.flash = 0.12;
    this.spawnSparks(d.x + d.w / 2, d.y + d.h / 2, d.type === 'barrel' ? '#ff9d54' : '#c8a264', 4);
    if (d.hp > 0) return;
    d.dead = true;
    d.hp = 0;
    this.levelSupply++;
    this.score += d.type === 'barrel' ? 50 : 30;
    this.audio.hitMarker(false);
    this.addFloatText(d.x + d.w / 2, d.y - 4, d.type === 'barrel' ? '+50 BLAST' : '+30 SUPPLY', '#e6c27f', 7, 0.8);
    this.dropLoot(d);
    if (d.type === 'barrel') {
      for (let i = 0; i < 14; i++) {
        this.addParticle({
          type: 'debris', x: d.x + d.w / 2, y: d.y + d.h / 2,
          vx: rand(-280, 280), vy: rand(-420, -40), life: rand(0.5, 1.2),
          size: rand(2, 6), color: choice(['#9b3b28', '#5b251d', '#c69b65']),
          gravity: 1000, angle: rand(0, TAU), spin: rand(-10, 10)
        });
      }
      this.addTimer(0.08, () => {
        if (this.state === 'playing') this.explode(d.x + d.w / 2, d.y + d.h / 2, 118, 92, 'barrel');
      });
    } else {
      for (let i = 0; i < 12; i++) {
        this.addParticle({
          type: 'debris', x: d.x + d.w / 2, y: d.y + d.h / 2,
          vx: rand(-210, 210), vy: rand(-300, -30), life: rand(0.4, 1),
          size: rand(1.5, 4.5), color: choice(['#7c5936', '#a57b48', '#4b3622']),
          gravity: 950, angle: rand(0, TAU), spin: rand(-12, 12)
        });
      }
    }
  }

  dropLoot(d) {
    const pool = d.type === 'barrel'
      ? [['grenade', 0.4], ['ammo', 0.32], ['health', 0.17], ['armor', 0.11]]
      : [['ammo', 0.52], ['grenade', 0.2], ['health', 0.17], ['armor', 0.11]];
    const roll = Math.random();
    let acc = 0;
    let type = 'ammo';
    for (const [t, w] of pool) {
      acc += w;
      if (roll <= acc) { type = t; break; }
    }
    this.spawnLoot(type, d.x + d.w / 2, d.y + d.h * 0.4);
    if (d.type === 'crate' && Math.random() < 0.38) {
      const second = choice(['ammo', 'ammo', 'grenade', 'health']);
      this.addTimer(0.1, () => {
        if (this.state === 'playing') this.spawnLoot(second, d.x + d.w / 2 + rand(-8, 8), d.y + d.h * 0.4);
      });
    }
  }

  spawnLoot(type, x, y) {
    this.runtime.pickups.push(this.createPickup(type, x, y));
  }

  updateParticles(dt) {
    const arr = this.runtime.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      p.vy += (p.gravity || 0) * dt;
      if (p.drag) {
        p.vx *= Math.max(0, 1 - p.drag * dt);
        p.vy *= Math.max(0, 1 - p.drag * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += (p.spin || 0) * dt;
    }
  }

  updateEffects(dt) {
    const arr = this.runtime.effects;
    for (let i = arr.length - 1; i >= 0; i--) {
      arr[i].age += dt;
      if (arr[i].age >= arr[i].duration) arr.splice(i, 1);
    }
  }

  updateDecals(dt) {
    const arr = this.runtime.decals;
    for (let i = arr.length - 1; i >= 0; i--) {
      arr[i].life -= dt;
      if (arr[i].life <= 0) arr.splice(i, 1);
    }
  }

  updateTexts(dt) {
    const arr = this.runtime.texts;
    for (let i = arr.length - 1; i >= 0; i--) {
      const t = arr[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.95;
      if (t.life <= 0) arr.splice(i, 1);
    }
  }

  /* ============================================================
     Damage, kills, checkpoints
     ============================================================ */
  applyDamageEnemy(e, damage, angle, headshot = false, melee = false) {
    if (!e || e.dead) return;
    e.hp -= damage;
    e.hitFlash = 0.1;
    e.alert = true;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    this.spawnBlood(ex, ey, melee ? 10 : 5);
    this.hitMarker = Math.max(this.hitMarker, 0.1);
    if (!melee) this.audio.hitMarker(headshot);
    if (headshot) this.addFloatText(ex, e.y - 10, 'HEADSHOT', '#f4dcaf', 7, 0.7);
    if (e.hp <= 0) {
      e.hp = 0;
      e.dead = true;
      e.deathTimer = 0.78;
      this.registerKill(e, headshot, melee);
    }
  }

  registerKill(e, headshot, melee) {
    const cfg = ENEMY_STATS[e.type] || ENEMY_STATS.grunt;
    this.kills++;
    this.levelKills++;
    this.combo = this.levelTime - (this.lastKillTime ?? -99) < 3.4 ? this.combo + 1 : 1;
    this.lastKillTime = this.levelTime;
    this.comboTimer = 3.5;
    const mult = this.comboMultiplier();
    const gained = Math.round(cfg.score * mult);
    this.score += gained;
    this.addFloatText(e.x + e.w / 2, e.y - 4, `+${gained}`, '#ecd09a', 9, 0.9);
    this.showKillFeed(`${cfg.name} DOWN${headshot ? ' // HEADSHOT' : melee ? ' // KNIFE' : ''}`, `+${gained}`, false);
    this.spawnBlood(e.x + e.w / 2, e.y + e.h * 0.4, 16);
    this.addDecal({ x: e.x + rand(-12, 12), y: e.y + e.h + 6, size: rand(5, 10), angle: rand(0, TAU), type: 'blood' });
    this.audio.hitMarker(headshot);
    if (Math.random() < 0.36) this.spawnLoot(Math.random() < 0.7 ? 'ammo' : 'health', e.x + e.w / 2, e.y + e.h / 2);
  }

  comboMultiplier() {
    if (this.combo >= 8) return 4;
    if (this.combo >= 5) return 3;
    if (this.combo >= 3) return 2;
    return 1;
  }

  updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.el.comboBadge.classList.add('is-hidden');
      }
    }
    if (this.combo >= 2) {
      this.el.comboBadge.classList.remove('is-hidden');
      this.el.comboText.textContent = `x${this.comboMultiplier()}`;
    }
  }

  damagePlayer(amount, sourceX, sourceY, opts = {}) {
    const p = this.player;
    if (!p || p.dead || this.state !== 'playing') return;
    if (!opts.ignoreInvuln && (p.invuln > 0 || p.rollTimer > 0.08)) return;
    let dmg = amount;
    if (p.armor > 0 && !opts.fall) {
      const absorbed = Math.min(p.armor, dmg * 0.55);
      p.armor -= absorbed;
      dmg -= absorbed;
    }
    p.health = Math.max(0, p.health - dmg);
    p.invuln = opts.hazard ? 0.22 : 0.48;
    this.camera.shake = Math.max(this.camera.shake, opts.explosion ? 14 : 6);
    this.flash = Math.max(this.flash, 0.25);
    this.audio.hurt();
    this.spawnBlood(p.x + p.w / 2, p.y + p.h * 0.45, 7);
    const flash = this.el.damageFlash;
    flash.classList.add('active');
    clearTimeout(this._damageTimeout);
    this._damageTimeout = setTimeout(() => flash.classList.remove('active'), 130);
    if (sourceX !== undefined && !opts.fall) {
      const dir = Math.sign(p.x + p.w / 2 - sourceX) || 1;
      p.vx += dir * (opts.explosion ? 380 : 130);
      if (opts.explosion) p.vy = Math.min(p.vy, -260);
    }
    if (p.health <= 0) {
      p.health = 0;
      this.beginDeath();
    }
  }

  checkCheckpoints() {
    const p = this.player;
    if (!p || p.dead) return;
    for (const c of this.runtime.checkpoints) {
      if (c.active) continue;
      if (p.x + p.w / 2 >= c.x) {
        c.active = true;
        this.checkpoint = { x: c.x + 24, y: c.y };
        p.health = Math.min(p.maxHealth, p.health + 20);
        p.armor = Math.min(p.maxArmor, p.armor + 10);
        this.audio.objective();
        this.showToast('CHECKPOINT SECURED', 'FIELD MEDIC +20 HEALTH // +10 ARMOR', 2000);
        this.addFloatText(c.x, c.y - 70, 'CHECKPOINT', '#9fd9a0', 9, 1.2);
        for (let i = 0; i < 12; i++) {
          this.addParticle({
            type: 'spark', x: c.x, y: c.y - 50, vx: rand(-80, 80), vy: rand(-160, -20),
            life: rand(0.3, 0.7), size: rand(1, 2.2), color: '#a9dfaa', gravity: 300
          });
        }
      }
    }
  }

  checkExit() {
    if (this.state !== 'playing' || !this.level.exit) return;
    const p = this.player;
    if (p.x + p.w / 2 > this.level.exit.x + 16) this.completeLevel();
  }

  /* ============================================================
     AI helpers, camera, mouse
     ============================================================ */
  lineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const steps = Math.ceil(dist / 20);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.pointSolid(x1 + dx * t, y1 + dy * t)) return false;
    }
    return true;
  }

  updateCamera(dt) {
    if (!this.player || !this.level) return;
    const p = this.player;
    const targetX = clamp(
      p.x + p.w / 2 - this.view.w * 0.43 + Math.cos(p.aimAngle) * 34,
      0,
      Math.max(0, this.level.width - this.view.w)
    );
    const k = 1 - Math.exp(-dt * 7.5);
    this.camera.x = lerp(this.camera.x, targetX, k);
    const yTarget = 0;
    this.camera.y = lerp(this.camera.y, yTarget, 1 - Math.exp(-dt * 4));
    this.camera.shake = Math.max(0, this.camera.shake - this.camera.shake * 10 * dt - dt * 3.4);
  }

  updateMouseWorld() {
    const vx = (this.mouse.sx - this.view.offsetX) / this.view.scale;
    const vy = (this.mouse.sy - this.view.offsetY) / this.view.scale;
    this.mouse.x = this.camera.x + vx;
    this.mouse.y = this.camera.y + vy;
    if (this.state === 'playing' && this.player) {
      let hover = false;
      for (const e of this.runtime.enemies) {
        if (!e.dead && pointInRect(this.mouse.x, this.mouse.y, { x: e.x - 10, y: e.y - 10, w: e.w + 20, h: e.h + 20 })) {
          hover = true;
          break;
        }
      }
      if (!hover && this.boss && this.boss.active && !this.boss.dead &&
          pointInRect(this.mouse.x, this.mouse.y, { x: this.boss.x - 10, y: this.boss.y - 10, w: this.boss.w + 20, h: this.boss.h + 20 })) {
        hover = true;
      }
      this.mouse.hoverEnemy = hover;
    }
  }

  updateFieldTips(dt) {
    if (!this.level.fieldTips || !this.level.fieldTips.length) return;
    this.tipTimer += dt;
    if (this.tipTimer > 10) {
      this.tipIndex = (this.tipIndex + 1) % this.level.fieldTips.length;
      this.setFieldTip(this.tipIndex);
    }
  }

  setFieldTip(index) {
    if (!this.level.fieldTips) return;
    this.tipIndex = index;
    this.tipTimer = 0;
    this.el.fieldTip.textContent = this.level.fieldTips[index] || '';
  }

  /* ============================================================
     HUD and notifications
     ============================================================ */
  setText(el, value) {
    if (!el) return;
    const text = String(value);
    if (el.textContent !== text) el.textContent = text;
  }

  updateMissionUI() {
    const data = this.level;
    if (!data) return;
    this.setText(this.el.missionNumber, `MISSION 0${data.id + 1}`);
    this.setText(this.el.missionName, data.name);
    this.setText(this.el.objectiveText, data.boss ? 'BREACH THE FORTRESS' : 'REACH THE EXTRACTION POINT');
    this.el.bossWrap.classList.add('is-hidden');
    this.el.killFeed.innerHTML = '';
    this.el.comboBadge.classList.add('is-hidden');
    this.el.prompt.classList.add('is-hidden');
    this.weaponDirty = true;
  }

  updateHUD() {
    const p = this.player;
    if (!p) return;
    const healthPct = clamp(p.health / p.maxHealth, 0, 1) * 100;
    const armorPct = clamp(p.armor / p.maxArmor, 0, 1) * 100;
    this.el.healthFill.style.width = `${healthPct}%`;
    this.el.armorFill.style.width = `${armorPct}%`;
    this.setText(this.el.healthText, Math.ceil(p.health));
    this.setText(this.el.armorText, `ARMOR ${Math.round(p.armor).toString().padStart(2, '0')}`);
    this.setText(this.el.scoreText, padScore(this.score));
    this.setText(this.el.killsText, this.kills);
    this.el.lowHealth.classList.toggle('active', p.health <= 30 && !p.dead);

    let stance = 'COMBAT READY';
    if (p.dead) stance = 'KIA';
    else if (p.reloading) stance = 'RELOADING';
    else if (p.rollTimer > 0) stance = 'EVADING';
    else if (p.health <= 30) stance = 'CRITICAL';
    else if (p.invuln > 0) stance = 'RECOVERING';
    this.setText(this.el.stanceText, stance);

    const cfg = WEAPONS[p.weaponId];
    const ammo = p.ammo[p.weaponId] || { mag: 0, reserve: 0 };
    this.setText(this.el.weaponClass, cfg.category);
    this.setText(this.el.weaponSlot, `SLOT 0${cfg.slot}`);
    this.setText(this.el.weaponName, cfg.name);
    this.setText(this.el.weaponFlavor, cfg.flavor);
    this.setText(this.el.ammoMag, ammo.mag);
    this.setText(this.el.ammoReserve, ammo.reserve);
    this.setText(this.el.grenadeText, p.grenades);
    this.el.weaponIcon.className = `weapon-icon ${cfg.id}`;
    if (this.weaponDirty) {
      this.el.weaponSlots.innerHTML = WEAPON_ORDER.map((id, i) => {
        const unlocked = this.unlocked.includes(id);
        const active = p.weaponId === id;
        return `<span class="weapon-slot${active ? ' active' : ''}${unlocked ? '' : ' locked'}">${i + 1}</span>`;
      }).join('');
      this.weaponDirty = false;
    }
    if (p.reloading) {
      this.el.reloadTrack.classList.remove('is-hidden');
      this.el.reloadFill.style.width = `${clamp(p.reloadProgress, 0, 1) * 100}%`;
    } else {
      this.el.reloadTrack.classList.add('is-hidden');
    }

    let progress;
    if (this.boss && this.boss.active && !this.boss.dead) {
      progress = 1 - this.boss.hp / this.boss.maxHp;
      this.setText(this.el.objectiveText, 'ELIMINATE COLONEL VOLKOV');
    } else if (this.level.boss) {
      if (this.boss && (this.boss.dead || this.boss.removed)) {
        progress = 1;
        this.setText(this.el.objectiveText, 'SECTOR SECURED');
      } else {
        progress = clamp((p.x - this.level.spawn.x) / (this.level.bossTrigger - this.level.spawn.x), 0, 1);
        this.setText(this.el.objectiveText, 'BREACH THE FORTRESS');
      }
    } else if (this.level.exit) {
      progress = clamp((p.x - this.level.spawn.x) / (this.level.exit.x - this.level.spawn.x), 0, 1);
    } else {
      progress = 0;
    }
    progress = clamp(progress, 0, 1);
    this.setText(this.el.missionProgress, `${Math.round(progress * 100)}%`);
    this.el.objectiveFill.style.width = `${progress * 100}%`;
    this.el.objectiveMarker.style.left = `${progress * 100}%`;

    if (this.boss && this.boss.active && !this.boss.dead) {
      this.el.bossWrap.classList.remove('is-hidden');
      this.el.bossFill.style.width = `${clamp(this.boss.hp / this.boss.maxHp, 0, 1) * 100}%`;
    } else {
      this.el.bossWrap.classList.add('is-hidden');
    }

    let near = false;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    for (const d of this.runtime.destructibles) {
      if (!d.dead && Math.hypot(d.x + d.w / 2 - cx, d.y + d.h / 2 - cy) < 88) { near = true; break; }
    }
    if (!near) {
      for (const e of this.runtime.enemies) {
        if (!e.dead && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 88) { near = true; break; }
      }
    }
    this.el.prompt.classList.toggle('is-hidden', !near || p.dead);
  }

  showToast(kicker, text, duration = 2000) {
    const toast = this.el.toast;
    if (!toast) return;
    clearTimeout(this.toastTimer);
    clearTimeout(this.toastHideTimer);
    this.setText(this.el.toastKicker, kicker);
    this.setText(this.el.toastText, text);
    toast.classList.remove('is-hidden', 'out');
    this.toastTimer = setTimeout(() => {
      toast.classList.add('out');
      this.toastHideTimer = setTimeout(() => toast.classList.add('is-hidden'), 340);
    }, duration);
  }

  showKillFeed(text, score = '', big = false) {
    const feed = this.el.killFeed;
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'feed-item';
    if (big) item.style.borderRightColor = 'rgba(216,173,101,.85)';
    item.innerHTML = `<span>${text}</span>${score ? `<b class="feed-score">${score}</b>` : ''}`;
    feed.appendChild(item);
    while (feed.children.length > 4) feed.removeChild(feed.firstChild);
    setTimeout(() => {
      item.classList.add('out');
      setTimeout(() => item.remove(), 360);
    }, 2600);
  }
}

const game = new Game(document.getElementById('game'));
window.__IRON_DAWN__ = game;
