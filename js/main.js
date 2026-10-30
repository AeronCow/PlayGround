import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { clamp } from './utils.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new Input();
const audio = new SoundEngine();
const game = new Game(canvas, input, audio, renderer);
input.attach();

const ui = {
  hud: document.getElementById('hud'),
  masks: document.getElementById('masks'),
  soulFill: document.getElementById('soul-fill'),
  soulCount: document.getElementById('soul-count'),
  bossFill: document.getElementById('boss-fill'),
  bossLag: document.getElementById('boss-lag'),
  bossHpText: document.getElementById('boss-hp-text'),
  bossPhase: document.getElementById('boss-phase'),
  bossHud: document.querySelector('.boss-hud'),
  banner: document.getElementById('boss-banner'),
  toast: document.getElementById('toast'),
  hint: document.getElementById('hint'),
  menu: document.getElementById('menu'),
  pause: document.getElementById('pause-screen'),
  end: document.getElementById('end-screen'),
  endPanel: document.querySelector('.end-panel'),
  endKicker: document.getElementById('end-kicker'),
  endTitle: document.getElementById('end-title'),
  endCopy: document.getElementById('end-copy'),
  statTime: document.getElementById('stat-time'),
  statHits: document.getElementById('stat-hits'),
  statBoss: document.getElementById('stat-boss'),
  btnStart: document.getElementById('btn-start'),
  btnTilt: document.getElementById('btn-tilt'),
  btnMenuSound: document.getElementById('btn-menu-sound'),
  btnPauseTilt: document.getElementById('btn-pause-tilt'),
  btnPauseSound: document.getElementById('btn-pause-sound'),
  btnSound: document.getElementById('btn-sound'),
  btnPause: document.getElementById('btn-pause'),
  btnResume: document.getElementById('btn-resume'),
  btnPauseRestart: document.getElementById('btn-pause-restart'),
  btnPauseMenu: document.getElementById('btn-pause-menu'),
  btnAgain: document.getElementById('btn-again'),
  btnEndMenu: document.getElementById('btn-end-menu')
};

const maskElements = [];
for (let i = 0; i < game.player.maxHp; i++) {
  const mask = document.createElement('span');
  mask.className = 'mask';
  mask.setAttribute('aria-hidden', 'true');
  ui.masks.appendChild(mask);
  maskElements.push(mask);
}

let lastHp = game.player.maxHp;
let lastSoul = -1;
let lastBossHp = -1;
let lastBossPhase = 1;
let toastTimer = null;
let bannerTimer = null;
let hintTimer = null;
let tiltWanted = false;
try { tiltWanted = localStorage.getItem('hollow-warden-tilt') === 'on'; } catch {}

function playUi() { audio.init(); audio.play('ui'); }

function setScreens({ menu = false, pause = false, end = false, hud = true } = {}) {
  ui.menu.classList.toggle('is-hidden', !menu);
  ui.pause.classList.toggle('is-hidden', !pause);
  ui.end.classList.toggle('is-hidden', !end);
  ui.hud.classList.toggle('is-hidden', !hud);
}

function showToast(text, duration = 2800) {
  clearTimeout(toastTimer);
  ui.toast.textContent = text;
  ui.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), duration);
}

function showBanner(kicker, title, sub, duration = 2600) {
  clearTimeout(bannerTimer);
  const kickerEl = ui.banner.querySelector('.banner-kicker');
  const titleEl = ui.banner.querySelector('strong');
  const subEl = ui.banner.querySelector('.banner-sub');
  kickerEl.textContent = kicker;
  titleEl.textContent = title;
  subEl.textContent = sub;
  ui.banner.classList.add('is-visible');
  bannerTimer = setTimeout(() => ui.banner.classList.remove('is-visible'), duration);
}

function hideBanner() {
  clearTimeout(bannerTimer);
  ui.banner.classList.remove('is-visible');
}

function resetHudCache() {
  lastHp = -1;
  lastSoul = -1;
  lastBossHp = -1;
  lastBossPhase = -1;
}

function updateMaskHud(hp) {
  if (hp === lastHp) return;
  const prev = lastHp;
  for (let i = 0; i < maskElements.length; i++) {
    const lost = i >= hp;
    maskElements[i].classList.toggle('is-lost', lost);
    if (prev >= 0 && i >= prev && !lost) {
      maskElements[i].classList.remove('is-gaining');
      void maskElements[i].offsetWidth;
      maskElements[i].classList.add('is-gaining');
      setTimeout(() => maskElements[i]?.classList.remove('is-gaining'), 480);
    }
  }
  lastHp = hp;
}

function syncHud() {
  const p = game.player;
  const b = game.boss;
  updateMaskHud(clamp(p.hp, 0, p.maxHp));
  const soul = Math.floor(p.soul);
  if (soul !== lastSoul) {
    ui.soulFill.style.height = `${(p.soul / 99) * 100}%`;
    ui.soulCount.textContent = String(soul);
    lastSoul = soul;
  }
  if (b.hp !== lastBossHp) {
    const pct = clamp(b.hp / b.maxHp, 0, 1) * 100;
    ui.bossFill.style.width = `${pct}%`;
    ui.bossLag.style.width = `${pct}%`;
    ui.bossHpText.textContent = String(Math.max(0, Math.ceil(b.hp)));
    lastBossHp = b.hp;
  }
  if (b.phase !== lastBossPhase) {
    const phase2 = b.phase === 2;
    ui.bossHud.classList.toggle('is-phase-2', phase2);
    ui.bossPhase.textContent = phase2 ? 'THE MASK CRACKS — PHASE II' : 'KEEPER OF THE DROWNED CHAPEL';
    lastBossPhase = b.phase;
  }
  if (game.maskGained) {
    game.maskGained = false;
  }
}

function tiltLabel() {
  if (input.tilt.status === 'requesting') return 'Tilt Controls: Requesting…';
  if (input.tilt.status === 'denied') return 'Tilt Controls: Blocked';
  if (input.tilt.status === 'unsupported') return 'Tilt Controls: Unavailable';
  return `Tilt Controls: ${input.tilt.enabled ? 'On' : 'Off'}`;
}

function syncTiltUi() {
  [ui.btnTilt, ui.btnPauseTilt].forEach((btn) => {
    btn.setAttribute('aria-pressed', String(input.tilt.enabled));
    const span = btn.querySelector('span');
    if (span) span.textContent = tiltLabel();
  });
}

function syncSoundUi() {
  const on = !audio.muted;
  [ui.btnMenuSound, ui.btnPauseSound].forEach((btn) => {
    btn.setAttribute('aria-pressed', String(on));
    const span = btn.querySelector('span');
    if (span) span.textContent = `Sound: ${on ? 'On' : 'Off'}`;
  });
  ui.btnSound.classList.toggle('is-muted', !on);
  ui.btnSound.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
  ui.btnSound.setAttribute('title', on ? 'Mute sound' : 'Unmute sound');
}

async function toggleSound() {
  audio.init();
  audio.setMuted(!audio.muted);
  syncSoundUi();
  if (!audio.muted) audio.play('ui');
}

async function toggleTilt() {
  audio.init();
  audio.play('ui');
  if (input.tilt.enabled) {
    input.tilt.disable();
    tiltWanted = false;
    try { localStorage.setItem('hollow-warden-tilt', 'off'); } catch {}
    syncTiltUi();
    showToast('Tilt controls off');
    return;
  }
  syncTiltUi();
  const result = await input.tilt.enable();
  syncTiltUi();
  if (result.ok) {
    tiltWanted = true;
    try { localStorage.setItem('hollow-warden-tilt', 'on'); } catch {}
    showToast('Tilt enabled — hold your device level to calibrate', 3200);
  } else if (result.status === 'denied') {
    tiltWanted = false;
    showToast('Motion access was not granted. Touch controls still work.', 3600);
  } else if (result.status === 'unsupported') {
    tiltWanted = false;
    showToast('This device does not report motion data.', 3200);
  }
  syncTiltUi();
}

function showMenu() {
  game.returnToMenu();
  hideBanner();
  resetHudCache();
  setScreens({ menu: true, hud: false });
  syncTiltUi();
  syncSoundUi();
}

function beginGame() {
  audio.init();
  hideBanner();
  setScreens({ menu: false, pause: false, end: false, hud: true });
  resetHudCache();
  game.start();
  syncTiltUi();
  syncSoundUi();
  ui.hint.classList.add('is-visible');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => ui.hint.classList.remove('is-visible'), 6500);
}

function openPause() {
  if (game.state !== 'playing') return;
  game.pause();
  setScreens({ menu: false, pause: true, end: false, hud: true });
  syncTiltUi();
  syncSoundUi();
}

function closePause() {
  ui.pause.classList.add('is-hidden');
  game.resume();
}

function showEnd() {
  const stats = game.endStats;
  if (!stats) return;
  hideBanner();
  const won = stats.won;
  ui.endPanel.classList.toggle('is-victory', won);
  ui.endPanel.classList.toggle('is-defeat', !won);
  ui.endKicker.textContent = won ? 'THE CHAPEL FALLS SILENT' : 'THE DARK CLAIMS ANOTHER';
  ui.endTitle.textContent = won ? 'THE WARDEN FALLS' : 'YOU HAVE FALLEN';
  ui.endCopy.textContent = won
    ? 'The mask breaks. The bell is still. For a moment, the drowned chapel remembers the light.'
    : 'Your mask fractures in the dark. The warden resumes its endless vigil, waiting for the next knight.';
  ui.statTime.textContent = stats.time;
  ui.statHits.textContent = String(stats.hits);
  ui.statBoss.textContent = `${Math.max(0, Math.ceil(stats.bossHp))} / ${stats.bossMax}`;
  setScreens({ menu: false, pause: false, end: true, hud: false });
  syncTiltUi();
  syncSoundUi();
}

game.events.start = () => {
  setScreens({ menu: false, pause: false, end: false, hud: true });
  showBanner('THE CHAPEL STIRS', 'THE HOLLOW WARDEN', 'Keeper of the Drowned Chapel', 2700);
};

game.events.phaseTwo = () => {
  showBanner('THE MASK CRACKS', 'PHASE II', 'The warden remembers fury', 1900);
  showToast('The Warden is enraged. Its attacks quicken.', 3400);
};

game.events.victory = () => showEnd();
game.events.defeat = () => showEnd();

input.tilt.onStatus = (status) => {
  syncTiltUi();
  if (status === 'no-events') {
    showToast('No motion data detected. Tilt may be unavailable here.', 3200);
    input.tilt.disable();
    tiltWanted = false;
    try { localStorage.setItem('hollow-warden-tilt', 'off'); } catch {}
    syncTiltUi();
  }
};

ui.btnStart.addEventListener('click', async () => {
  playUi();
  if (tiltWanted && !input.tilt.enabled) {
    await input.tilt.enable();
    syncTiltUi();
    if (!input.tilt.enabled) {
      tiltWanted = false;
      try { localStorage.setItem('hollow-warden-tilt', 'off'); } catch {}
    }
  }
  beginGame();
});

ui.btnTilt.addEventListener('click', toggleTilt);
ui.btnPauseTilt.addEventListener('click', toggleTilt);
ui.btnMenuSound.addEventListener('click', toggleSound);
ui.btnPauseSound.addEventListener('click', toggleSound);
ui.btnSound.addEventListener('click', toggleSound);
ui.btnPause.addEventListener('click', () => { playUi(); openPause(); });
ui.btnResume.addEventListener('click', () => { playUi(); closePause(); });
ui.btnPauseRestart.addEventListener('click', () => {
  playUi();
  ui.pause.classList.add('is-hidden');
  beginGame();
});
ui.btnPauseMenu.addEventListener('click', () => { playUi(); showMenu(); });
ui.btnAgain.addEventListener('click', () => { playUi(); beginGame(); });
ui.btnEndMenu.addEventListener('click', () => { playUi(); showMenu(); });

let resizeRaf = 0;
function requestResize() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    const w = window.innerWidth;
    const h = window.innerHeight;
    game.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
  });
}
window.addEventListener('resize', requestResize);
window.addEventListener('orientationchange', () => setTimeout(requestResize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', requestResize);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') openPause();
});

input.onFirstInput = () => { audio.init(); };


syncTiltUi();
syncSoundUi();
setScreens({ menu: true, hud: false });
resetHudCache();

let last = performance.now();
let running = true;

function frame(now) {
  const rawDt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (input.wasPressed('pause')) {
    if (game.state === 'playing') openPause();
    else if (game.state === 'paused') { closePause(); }
  }
  if (input.wasPressed('mute')) toggleSound();

  game.update(rawDt);
  renderer.render(game);

  if (!ui.hud.classList.contains('is-hidden')) syncHud();

  if (game.state === 'paused' && ui.pause.classList.contains('is-hidden')) {
    setScreens({ menu: false, pause: true, end: false, hud: true });
  }

  input.endFrame();
  if (running) requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

window.addEventListener('pagehide', () => { running = false; });
