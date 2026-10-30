/* ZONE MORTE — a small top-down zombie survival shooter.
   Vanilla canvas 2D, no build step, tuned for touch. */

const TAU = Math.PI * 2;
const WORLD = { w: 2600, h: 1800 };
const STORAGE_BEST = "zone-morte.best";
const STORAGE_MUTED = "zone-morte.muted";

const clamp = (value, min, max) => value < min ? min : value > max ? max : value;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[(Math.random() * items.length) | 0];
const angleWrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const angleLerp = (from, to, amount) => from + angleWrap(to - from) * amount;
const padScore = (value) => String(Math.max(0, Math.floor(value))).padStart(6, "0");
const DEBUG = new URLSearchParams(location.search);

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

const $ = (selector) => document.querySelector(selector);

const ui = {
  canvas: $("#game"),
  hud: $("#hud"),
  menu: $("#menu"),
  pause: $("#pause"),
  gameover: $("#gameover"),
  waveNum: $("#waveNum"),
  scoreNum: $("#scoreNum"),
  combo: $("#combo"),
  comboMult: $("#comboMult"),
  comboCount: $("#comboCount"),
  comboBar: $("#comboBar"),
  hpText: $("#hpText"),
  hpFill: $("#hpFill"),
  ammoText: $("#ammoText"),
  ammoFill: $("#ammoFill"),
  reloadFill: $("#reloadFill"),
  ammoLabel: $("#ammoLabel"),
  reloadBtn: $("#reloadBtn"),
  reloadText: $("#reloadText"),
  waveBanner: $("#waveBanner"),
  bannerKicker: $("#bannerKicker"),
  bannerTitle: $("#bannerTitle"),
  bannerSub: $("#bannerSub"),
  tiltBadge: $("#tiltBadge"),
  startBtn: $("#startBtn"),
  restartBtn: $("#restartBtn"),
  resumeBtn: $("#resumeBtn"),
  pauseRestartBtn: $("#pauseRestartBtn"),
  pauseMenuBtn: $("#pauseMenuBtn"),
  backMenuBtn: $("#backMenuBtn"),
  pauseBtn: $("#pauseBtn"),
  soundBtn: $("#soundBtn"),
  menuSoundBtn: $("#menuSoundBtn"),
  motionBtn: $("#motionBtn"),
  motionLabel: $("#motionLabel"),
  motionHint: $("#motionHint"),
  calibrateBtn: $("#calibrateBtn"),
  bestScore: $("#bestScore"),
  finalScore: $("#finalScore"),
  finalWave: $("#finalWave"),
  finalKills: $("#finalKills"),
  newBest: $("#newBest"),
  deathLine: $("#deathLine"),
  desktopHint: $("#desktopHint"),
  toast: $("#toast"),
  moveStick: $("#moveStick"),
  aimStick: $("#aimStick")
};

const ctx = ui.canvas.getContext("2d", { alpha: false, desynchronized: true });

const view = { w: 0, h: 0, dpr: 1, scale: 1 };
const camera = { x: WORLD.w / 2, y: WORLD.h / 2 };

let best = Number(readStorage(STORAGE_BEST, 0)) || 0;
let muted = readStorage(STORAGE_MUTED, "0") === "1";
let isTouchMode = false;

const game = {
  mode: "menu",
  time: 0,
  wave: 0,
  score: 0,
  kills: 0,
  combo: 0,
  comboT: 0,
  shake: 0,
  hitFlash: 0,
  dying: 0,
  spawnClock: 0,
  waveBreak: 0,
  waveState: "idle",
  spawnQueue: []
};

const player = {
  x: WORLD.w / 2,
  y: WORLD.h / 2,
  aim: -Math.PI / 2,
  r: 15,
  hp: 100,
  maxHp: 100,
  speed: 226,
  ammo: 14,
  mag: 14,
  fireCd: 0,
  reloading: false,
  reloadT: 0,
  reloadDur: 1.05,
  invuln: 0,
  flash: 0,
  recoil: 0,
  walk: 0,
  alive: true
};

const attractPlayer = { x: WORLD.w / 2, y: WORLD.h / 2, aim: -Math.PI / 2, walk: 0 };

let enemies = [];
let bullets = [];
let particles = [];
let pickups = [];
let texts = [];
let shells = [];
let decals = [];
let fog = [];
let attractZombies = [];
let fogSprite = null;
let worldCanvas = null;
let vignetteSprite = null;
let redVignetteSprite = null;
let lightSprite = null;

const ENEMY_TYPES = {
  walker: { hp: 36, r: 15, speed: 55, dmg: 8, score: 10, body: "#35452f", skin: "#7c8d61", eye: "#ff6a42" },
  runner: { hp: 23, r: 12, speed: 101, dmg: 6, score: 16, body: "#4b3a2b", skin: "#a18c65", eye: "#ffd15a" },
  brute: { hp: 165, r: 27, speed: 39, dmg: 21, score: 60, body: "#45312c", skin: "#93705e", eye: "#ff2d2d" }
};

/* ----------------------------------------------------------------------- */
/* Audio                                                                   */
/* ----------------------------------------------------------------------- */

const sound = (() => {
  let audio = null;
  let master = null;
  let noise = null;

  function ensure() {
    if (audio) {
      if (audio.state === "suspended") audio.resume().catch(() => {});
      return true;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      audio = new AudioCtx();
      master = audio.createGain();
      master.gain.value = muted ? 0 : 0.32;
      master.connect(audio.destination);
      return true;
    } catch {
      return false;
    }
  }

  function getNoise() {
    if (!audio) return null;
    if (noise) return noise;
    const length = Math.floor(audio.sampleRate * 0.5);
    noise = audio.createBuffer(1, length, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  function burst(duration = 0.08, volume = 0.12, frequency = 1200, type = "highpass", delay = 0) {
    if (!audio || muted) return;
    const buffer = getNoise();
    if (!buffer) return;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    const start = audio.currentTime + delay;
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function tone(startFreq, endFreq, duration, type = "sawtooth", volume = 0.08, delay = 0) {
    if (!audio || muted) return;
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, startFreq), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  return {
    unlock() {
      if (!ensure()) return;
      if (audio.state === "suspended") audio.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.32;
    },
    shoot() {
      if (!ensure()) return;
      const pitch = rand(190, 235);
      burst(0.055, 0.16, 850);
      tone(pitch, 66, 0.075, "square", 0.045);
    },
    hit() {
      if (!ensure()) return;
      burst(0.035, 0.08, 1900, "bandpass");
      tone(135, 70, 0.05, "triangle", 0.035);
    },
    kill() {
      if (!ensure()) return;
      burst(0.16, 0.09, 420, "lowpass");
      tone(96, 38, 0.24, "sawtooth", 0.05);
    },
    hurt() {
      if (!ensure()) return;
      burst(0.16, 0.13, 260, "lowpass");
      tone(72, 33, 0.24, "sine", 0.12);
    },
    reloadStart() {
      if (!ensure()) return;
      burst(0.025, 0.06, 1500, "bandpass");
      burst(0.04, 0.05, 700, "bandpass", 0.22);
    },
    reloadEnd() {
      if (!ensure()) return;
      burst(0.025, 0.07, 2200, "bandpass");
    },
    pickup() {
      if (!ensure()) return;
      tone(620, 940, 0.09, "triangle", 0.07);
      tone(940, 1240, 0.1, "triangle", 0.045, 0.08);
    },
    wave() {
      if (!ensure()) return;
      tone(150, 150, 0.28, "sawtooth", 0.045);
      tone(225, 225, 0.34, "sawtooth", 0.035, 0.16);
    },
    over() {
      if (!ensure()) return;
      tone(210, 52, 0.9, "sawtooth", 0.09);
      tone(105, 44, 1.2, "sine", 0.1, 0.16);
      burst(0.5, 0.08, 220, "lowpass", 0.1);
    },
    click() {
      if (!ensure()) return;
      tone(420, 620, 0.045, "triangle", 0.035);
    }
  };
})();

/* ----------------------------------------------------------------------- */
/* Input                                                                   */
/* ----------------------------------------------------------------------- */

const input = {
  keys: new Set(),
  move: { x: 0, y: 0, mag: 0 },
  aimStick: { x: 0, y: 0, mag: 0 },
  mouse: { x: 0, y: 0, down: false, active: false },
  tilt: { enabled: false, ready: false, active: false, angle: -Math.PI / 2, base: null, seen: false }
};

function stickVector(dx, dy, radius) {
  let nx = dx / radius;
  let ny = dy / radius;
  let magnitude = Math.hypot(nx, ny);
  if (magnitude < 0.13) return { x: 0, y: 0, mag: 0 };
  if (magnitude > 1) {
    nx /= magnitude;
    ny /= magnitude;
    magnitude = 1;
  }
  const normalized = clamp((magnitude - 0.13) / 0.87, 0, 1);
  return { x: nx * normalized, y: ny * normalized, mag: normalized };
}

function setupStick(element, onMove, onEnd) {
  let pointerId = null;
  let centerX = 0;
  let centerY = 0;
  let radius = 1;
  const knob = element.querySelector(".stick-knob");

  function apply(event) {
    if (event.pointerId !== pointerId) return;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      dx = dx / distance * radius;
      dy = dy / distance * radius;
    }
    const vector = stickVector(dx, dy, radius);
    knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    onMove(vector, Math.atan2(dy, dx));
  }

  element.addEventListener("pointerdown", (event) => {
    if (pointerId !== null) return;
    event.preventDefault();
    sound.unlock();
    pointerId = event.pointerId;
    const rect = element.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    radius = rect.width * 0.31;
    element.classList.add("active");
    element.setPointerCapture?.(pointerId);
    apply(event);
  });

  element.addEventListener("pointermove", (event) => {
    if (pointerId === null) return;
    event.preventDefault();
    apply(event);
  });

  function release(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    element.classList.remove("active");
    knob.style.transform = "translate(0px, 0px)";
    onEnd();
  }

  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("lostpointercapture", () => {
    if (pointerId === null) return;
    pointerId = null;
    element.classList.remove("active");
    knob.style.transform = "translate(0px, 0px)";
    onEnd();
  });
}

setupStick(ui.moveStick, (vector) => {
  input.move.x = vector.x;
  input.move.y = vector.y;
  input.move.mag = vector.mag;
}, () => {
  input.move.x = 0;
  input.move.y = 0;
  input.move.mag = 0;
});

setupStick(ui.aimStick, (vector) => {
  input.aimStick.x = vector.x;
  input.aimStick.y = vector.y;
  input.aimStick.mag = vector.mag;
}, () => {
  input.aimStick.x = 0;
  input.aimStick.y = 0;
  input.aimStick.mag = 0;
});

const keyMap = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right"
};

window.addEventListener("keydown", (event) => {
  if (keyMap[event.code]) {
    event.preventDefault();
    input.keys.add(keyMap[event.code]);
  }
  if (event.code === "Space") {
    event.preventDefault();
    input.keys.add("fire");
  }
  if (event.code === "KeyR") startReload();
  if (event.code === "Escape" || event.code === "KeyP") {
    if (game.mode === "playing") pauseGame();
    else if (game.mode === "paused") resumeGame();
  }
  sound.unlock();
});

window.addEventListener("keyup", (event) => {
  if (keyMap[event.code]) input.keys.delete(keyMap[event.code]);
  if (event.code === "Space") input.keys.delete("fire");
});

ui.canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse") return;
  sound.unlock();
  input.mouse.x = event.clientX;
  input.mouse.y = event.clientY;
  input.mouse.active = true;
  input.mouse.down = true;
});

ui.canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse") return;
  input.mouse.x = event.clientX;
  input.mouse.y = event.clientY;
  input.mouse.active = true;
});

window.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse") input.mouse.down = false;
});

window.addEventListener("pointercancel", () => {
  input.mouse.down = false;
});

window.addEventListener("blur", () => {
  input.keys.clear();
  input.mouse.down = false;
});

window.addEventListener("contextmenu", (event) => event.preventDefault());

/* ----------------------------------------------------------------------- */
/* Motion / tilt                                                           */
/* ----------------------------------------------------------------------- */

let motionWatchdog = null;

function orientationAngle() {
  if (screen.orientation && typeof screen.orientation.angle === "number") return screen.orientation.angle;
  return typeof window.orientation === "number" ? window.orientation : 0;
}

function handleOrientation(event) {
  if (event.beta == null && event.gamma == null) return;
  const beta = event.beta || 0;
  const gamma = event.gamma || 0;
  input.tilt.seen = true;
  if (!input.tilt.ready) {
    input.tilt.ready = true;
    input.tilt.base = { beta, gamma };
    updateMotionUI();
    return;
  }
  if (!input.tilt.base) input.tilt.base = { beta, gamma };

  let dx = gamma - input.tilt.base.gamma;
  let dy = beta - input.tilt.base.beta;
  const radians = orientationAngle() * Math.PI / 180;
  if (radians) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const rotatedX = dx * cos + dy * sin;
    const rotatedY = -dx * sin + dy * cos;
    dx = rotatedX;
    dy = rotatedY;
  }

  if (Math.hypot(dx, dy) > 3.6) {
    input.tilt.angle = Math.atan2(dy, dx);
    input.tilt.active = true;
  } else {
    input.tilt.active = false;
  }
}

function disableMotion(keepToast = false) {
  if (!input.tilt.enabled) return;
  input.tilt.enabled = false;
  input.tilt.ready = false;
  input.tilt.active = false;
  input.tilt.base = null;
  window.removeEventListener("deviceorientation", handleOrientation, true);
  if (motionWatchdog) clearTimeout(motionWatchdog);
  motionWatchdog = null;
  updateMotionUI();
  if (!keepToast) toast("Inclinaison désactivée. Joysticks uniquement.");
}

async function toggleMotion() {
  sound.unlock();
  if (input.tilt.enabled) {
    disableMotion();
    return;
  }
  if (!("DeviceOrientationEvent" in window)) {
    toast("Cet appareil ne fournit pas de capteur d'orientation.");
    return;
  }
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        toast("Autorisation de mouvement refusée. Les joysticks restent actifs.");
        return;
      }
    } catch {
      toast("Impossible de demander l'accès au mouvement.");
      return;
    }
  }

  input.tilt.enabled = true;
  input.tilt.ready = false;
  input.tilt.active = false;
  input.tilt.base = null;
  input.tilt.seen = false;
  window.addEventListener("deviceorientation", handleOrientation, true);
  updateMotionUI();
  toast("Inclinez l'appareil pour viser. Le tir est automatique.");

  if (motionWatchdog) clearTimeout(motionWatchdog);
  motionWatchdog = setTimeout(() => {
    motionWatchdog = null;
    if (!input.tilt.enabled || input.tilt.seen) return;
    disableMotion(true);
    toast("Aucun capteur détecté. Les joysticks restent disponibles.");
  }, 2200);
}

function calibrateMotion() {
  if (!input.tilt.enabled) return;
  input.tilt.base = null;
  toast("Inclinaison recalibrée. Gardez la position naturelle.");
  sound.click();
}

function updateMotionUI() {
  const enabled = input.tilt.enabled;
  ui.motionBtn.setAttribute("aria-pressed", String(enabled));
  ui.motionLabel.textContent = enabled ? "INCLINAISON : ON" : "INCLINAISON : OFF";
  ui.calibrateBtn.classList.toggle("hidden", !enabled);
  ui.tiltBadge.classList.toggle("hidden", !enabled || game.mode !== "playing");
  if (enabled) {
    ui.motionHint.textContent = input.tilt.seen
      ? "Inclinez pour viser — le tir automatique reste actif. Recalibrez si besoin."
      : "Connexion au capteur de mouvement…";
  } else {
    ui.motionHint.textContent = "Optionnel — inclinez l'appareil pour viser, le tir devient automatique.";
  }
}

screen.orientation?.addEventListener?.("change", () => {
  if (input.tilt.enabled) input.tilt.base = null;
});

/* ----------------------------------------------------------------------- */
/* World art                                                               */
/* ----------------------------------------------------------------------- */

function paintGround(c) {
  const random = mulberry32(8841);
  c.fillStyle = "#151b13";
  c.fillRect(0, 0, WORLD.w, WORLD.h);

  const wash = c.createLinearGradient(0, 0, WORLD.w, WORLD.h);
  wash.addColorStop(0, "rgba(36, 52, 32, 0.35)");
  wash.addColorStop(0.42, "rgba(18, 26, 16, 0.1)");
  wash.addColorStop(0.7, "rgba(44, 58, 35, 0.22)");
  wash.addColorStop(1, "rgba(9, 14, 9, 0.42)");
  c.fillStyle = wash;
  c.fillRect(0, 0, WORLD.w, WORLD.h);

  for (let i = 0; i < 34; i += 1) {
    const x = random() * WORLD.w;
    const y = random() * WORLD.h;
    const radius = 110 + random() * 430;
    const moss = c.createRadialGradient(x, y, 0, x, y, radius);
    const green = 40 + Math.floor(random() * 26);
    moss.addColorStop(0, `rgba(${green - 10}, ${green + 16}, ${green - 12}, ${0.07 + random() * 0.09})`);
    moss.addColorStop(0.65, `rgba(${green - 16}, ${green + 4}, ${green - 14}, ${0.03 + random() * 0.05})`);
    moss.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = moss;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  for (let i = 0; i < 26000; i += 1) {
    const value = 20 + Math.floor(random() * 38);
    c.fillStyle = `rgba(${value}, ${value + 8}, ${Math.max(12, value - 3)}, ${0.1 + random() * 0.22})`;
    const s = random() < 0.88 ? 1 : 2;
    c.fillRect(random() * WORLD.w, random() * WORLD.h, s, s);
  }

  for (let i = 0; i < 210; i += 1) {
    c.strokeStyle = `rgba(5, 8, 5, ${0.16 + random() * 0.26})`;
    c.lineWidth = 0.8 + random() * 1.3;
    let x = random() * WORLD.w;
    let y = random() * WORLD.h;
    c.beginPath();
    c.moveTo(x, y);
    const segments = 2 + Math.floor(random() * 5);
    for (let j = 0; j < segments; j += 1) {
      x += (random() - 0.5) * 64;
      y += (random() - 0.5) * 64;
      c.lineTo(x, y);
    }
    c.stroke();
  }

  for (let i = 0; i < 850; i += 1) {
    const x = random() * WORLD.w;
    const y = random() * WORLD.h;
    c.fillStyle = `rgba(${48 + random() * 40}, ${50 + random() * 38}, ${42 + random() * 26}, ${0.18 + random() * 0.25})`;
    c.beginPath();
    c.ellipse(x, y, 1 + random() * 3.6, 1 + random() * 2, random() * TAU, 0, TAU);
    c.fill();
  }

  for (let i = 0; i < 900; i += 1) {
    const x = random() * WORLD.w;
    const y = random() * WORLD.h;
    const length = 2 + random() * 7;
    c.strokeStyle = `rgba(${40 + random() * 30}, ${58 + random() * 42}, ${32 + random() * 20}, ${0.18 + random() * 0.27})`;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (random() - 0.5) * 5, y - length);
    c.stroke();
  }
}

function makeFogSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = 256;
  sprite.height = 256;
  const c = sprite.getContext("2d");
  const gradient = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(178, 204, 188, 0.22)");
  gradient.addColorStop(0.45, "rgba(148, 178, 162, 0.11)");
  gradient.addColorStop(1, "rgba(130, 160, 148, 0)");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 256, 256);
  return sprite;
}

const props = (() => {
  const list = [];
  const random = mulberry32(22911);
  for (let i = 0; i < 420; i += 1) {
    const roll = random();
    let type = "tuft";
    if (roll > 0.78) type = "pebble";
    else if (roll > 0.66) type = "crack";
    else if (roll > 0.58) type = "scrap";
    else if (roll > 0.54) type = "bone";
    list.push({
      type,
      x: 34 + random() * (WORLD.w - 68),
      y: 34 + random() * (WORLD.h - 68),
      size: 0.55 + random() * 1.25,
      rot: random() * TAU,
      seed: random() * 100
    });
  }
  for (let i = 0; i < 10; i += 1) {
    list.push({
      type: "barrel",
      x: 90 + random() * (WORLD.w - 180),
      y: 90 + random() * (WORLD.h - 180),
      size: 0.7 + random() * 0.55,
      rot: random() * TAU,
      seed: random() * 100
    });
  }
  return list;
})();

function buildWorld() {
  fogSprite = makeFogSprite();
  fog = [];
  for (let i = 0; i < 10; i += 1) {
    fog.push({
      x: rand(0, WORLD.w),
      y: rand(0, WORLD.h),
      size: rand(260, 640),
      alpha: rand(0.1, 0.26),
      vx: rand(-5, 5),
      vy: rand(-3, 3)
    });
  }

  worldCanvas = document.createElement("canvas");
  worldCanvas.width = WORLD.w;
  worldCanvas.height = WORLD.h;
  const c = worldCanvas.getContext("2d");
  paintGround(c);
  c.strokeStyle = "rgba(0, 0, 0, 0.35)";
  c.lineWidth = 90;
  c.strokeRect(0, 0, WORLD.w, WORLD.h);
  c.strokeStyle = "rgba(183, 255, 62, 0.045)";
  c.lineWidth = 1;
  c.strokeRect(18, 18, WORLD.w - 36, WORLD.h - 36);
  drawPropsOn(c, false);
}

function resetFog() {
  for (const cloud of fog) {
    cloud.x = rand(0, WORLD.w);
    cloud.y = rand(0, WORLD.h);
  }
}

function initAttract() {
  attractZombies = [];
  const centerX = WORLD.w / 2;
  const centerY = WORLD.h / 2;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * TAU + rand(-0.25, 0.25);
    const distance = rand(190, 390);
    const type = i === 2 ? "brute" : i === 5 ? "runner" : "walker";
    attractZombies.push({
      type,
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      ox: centerX + Math.cos(angle) * distance,
      oy: centerY + Math.sin(angle) * distance,
      angle: angle + Math.PI,
      seed: rand(0, TAU),
      r: ENEMY_TYPES[type].r,
      hp: 1,
      maxHp: 1,
      hitFlash: 0
    });
  }
  attractPlayer.x = centerX;
  attractPlayer.y = centerY;
  camera.x = centerX;
  camera.y = centerY;
}

/* ----------------------------------------------------------------------- */
/* Layout and camera                                                       */
/* ----------------------------------------------------------------------- */

function resize() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.scale = clamp(Math.min(view.w / 680, view.h / 700), 0.82, 1.22);
  ui.canvas.width = Math.round(view.w * view.dpr);
  ui.canvas.height = Math.round(view.h * view.dpr);
  ui.canvas.style.width = `${view.w}px`;
  ui.canvas.style.height = `${view.h}px`;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  isTouchMode = coarse || view.w <= 900;
  document.body.classList.toggle("is-touch", isTouchMode);
  ui.desktopHint.classList.toggle("hidden", isTouchMode);
  buildScreenSprites();
  clampCamera();
  menuDirty = true;
}

function buildScreenSprites() {
  const dpr = view.dpr;
  const w = Math.max(1, Math.round(view.w * dpr));
  const h = Math.max(1, Math.round(view.h * dpr));

  vignetteSprite = document.createElement("canvas");
  vignetteSprite.width = w;
  vignetteSprite.height = h;
  let c = vignetteSprite.getContext("2d");
  const vignette = c.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.2,
    w / 2, h / 2, Math.max(w, h) * 0.76
  );
  vignette.addColorStop(0, "rgba(2, 5, 3, 0)");
  vignette.addColorStop(0.62, "rgba(2, 5, 3, 0.22)");
  vignette.addColorStop(1, "rgba(1, 3, 2, 0.82)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, w, h);

  redVignetteSprite = document.createElement("canvas");
  redVignetteSprite.width = w;
  redVignetteSprite.height = h;
  c = redVignetteSprite.getContext("2d");
  const red = c.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.28,
    w / 2, h / 2, Math.max(w, h) * 0.72
  );
  red.addColorStop(0, "rgba(120, 0, 0, 0)");
  red.addColorStop(0.55, "rgba(130, 4, 4, 0.18)");
  red.addColorStop(1, "rgba(130, 4, 4, 0.62)");
  c.fillStyle = red;
  c.fillRect(0, 0, w, h);

  lightSprite = document.createElement("canvas");
  lightSprite.width = 512;
  lightSprite.height = 512;
  c = lightSprite.getContext("2d");
  const light = c.createRadialGradient(256, 256, 10, 256, 256, 256);
  light.addColorStop(0, "rgba(255, 224, 170, 0.18)");
  light.addColorStop(0.45, "rgba(195, 224, 164, 0.06)");
  light.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.fillStyle = light;
  c.fillRect(0, 0, 512, 512);
}

function visibleHalf() {
  return {
    x: view.w / (2 * view.scale),
    y: view.h / (2 * view.scale)
  };
}

function cameraBounds() {
  const half = visibleHalf();
  return {
    minX: Math.min(half.x, WORLD.w / 2),
    maxX: Math.max(WORLD.w - half.x, WORLD.w / 2),
    minY: Math.min(half.y, WORLD.h / 2),
    maxY: Math.max(WORLD.h - half.y, WORLD.h / 2)
  };
}

function clampCamera() {
  const bounds = cameraBounds();
  camera.x = clamp(camera.x, bounds.minX, bounds.maxX);
  camera.y = clamp(camera.y, bounds.minY, bounds.maxY);
}

function screenToWorld(x, y) {
  return {
    x: (x - view.w / 2) / view.scale + camera.x,
    y: (y - view.h / 2) / view.scale + camera.y
  };
}

function updateCamera(dt) {
  const bounds = cameraBounds();
  let targetX = player.x;
  let targetY = player.y;
  if (game.mode === "menu" || game.mode === "gameover") {
    targetX = WORLD.w / 2 + Math.sin(game.time * 0.12) * 85;
    targetY = WORLD.h / 2 + Math.cos(game.time * 0.1) * 60;
  }
  targetX = clamp(targetX, bounds.minX, bounds.maxX);
  targetY = clamp(targetY, bounds.minY, bounds.maxY);
  const smoothing = 1 - Math.exp(-dt * (game.mode === "menu" ? 2 : 7));
  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;
}

/* ----------------------------------------------------------------------- */
/* Game lifecycle                                                          */
/* ----------------------------------------------------------------------- */

function resetPlayer() {
  player.x = WORLD.w / 2;
  player.y = WORLD.h / 2;
  player.aim = -Math.PI / 2;
  player.hp = player.maxHp;
  player.ammo = player.mag;
  player.fireCd = 0;
  player.reloading = false;
  player.reloadT = 0;
  player.invuln = 0;
  player.flash = 0;
  player.recoil = 0;
  player.walk = 0;
  player.alive = true;
}

function resetGame() {
  enemies = [];
  bullets = [];
  particles = [];
  pickups = [];
  texts = [];
  shells = [];
  decals = [];
  game.mode = "playing";
  game.wave = 1;
  game.score = 0;
  game.kills = 0;
  game.combo = 0;
  game.comboT = 0;
  game.shake = 0;
  game.hitFlash = 0;
  game.dying = 0;
  game.spawnClock = 0.2;
  game.waveBreak = 0;
  game.waveState = "spawning";
  game.spawnQueue = [];
  resetPlayer();
  resetFog();
  camera.x = player.x;
  camera.y = player.y;
  clampCamera();

  const count = 6;
  const interval = 0.52;
  for (let i = 0; i < count; i += 1) {
    game.spawnQueue.push({
      type: i === 0 ? "walker" : rollEnemyType(1),
      at: 1.1 + i * interval + rand(-0.08, 0.12)
    });
  }
  game.spawnQueue.sort((a, b) => a.at - b.at);

  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * TAU + rand(-0.3, 0.3);
    const distance = rand(185, 255);
    spawnZombie("walker", player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance);
  }

  banner("VAGUE 01", "SURVIE", "ILS SONT DÉJÀ LÀ");
  sound.wave();
  updateHud(true);
  updateMotionUI();
}

function startGame() {
  sound.unlock();
  resetGame();
  ui.menu.classList.add("hidden");
  ui.gameover.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  ui.newBest.classList.add("hidden");
  ui.moveStick.classList.remove("hidden");
  ui.aimStick.classList.remove("hidden");
}

function backToMenu() {
  game.mode = "menu";
  game.spawnQueue = [];
  ui.hud.classList.add("hidden");
  ui.gameover.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.menu.classList.remove("hidden");
  ui.moveStick.classList.add("hidden");
  ui.aimStick.classList.add("hidden");
  menuDirty = true;
  initAttract();
  updateBestUI();
  updateMotionUI();
  updateHud(true);
}

function pauseGame() {
  if (game.mode !== "playing") return;
  game.mode = "paused";
  ui.pause.classList.remove("hidden");
  input.mouse.down = false;
  input.keys.clear();
  sound.click();
}

function resumeGame() {
  if (game.mode !== "paused") return;
  game.mode = "playing";
  ui.pause.classList.add("hidden");
  sound.click();
}

function finishGameOver() {
  game.mode = "gameover";
  const isRecord = game.score > best;
  if (isRecord) {
    best = game.score;
    writeStorage(STORAGE_BEST, String(best));
  }
  ui.finalScore.textContent = String(game.score);
  ui.finalWave.textContent = String(game.wave);
  ui.finalKills.textContent = String(game.kills);
  ui.newBest.classList.toggle("hidden", !isRecord);
  ui.deathLine.textContent = game.wave >= 8
    ? "La horde a fini par passer. Impressionnant."
    : game.wave >= 4
      ? "La nuit a eu le dernier mot."
      : "Ils étaient plus nombreux. Reviens plus fort.";
  updateBestUI();
  ui.gameover.classList.remove("hidden");
  updateHud(true);
}

function killPlayer(attacker) {
  if (!player.alive) return;
  player.alive = false;
  player.hp = 0;
  player.reloading = false;
  game.mode = "dying";
  game.dying = 1.35;
  game.shake = 22;
  game.hitFlash = 1;
  const angle = attacker ? Math.atan2(player.y - attacker.y, player.x - attacker.x) : rand(0, TAU);
  addBloodDecal(player.x, player.y, 1.45, 9);
  bloodBurst(player.x, player.y, 26, 1.5);
  for (let i = 0; i < 6; i += 1) {
    spawnParticle({
      type: "chunk",
      x: player.x,
      y: player.y,
      vx: Math.cos(angle + rand(-0.8, 0.8)) * rand(50, 210),
      vy: Math.sin(angle + rand(-0.8, 0.8)) * rand(50, 210),
      life: rand(0.7, 1.3),
      size: rand(2, 5),
      color: "#5a0a0a"
    });
  }
  sound.over();
}

/* ----------------------------------------------------------------------- */
/* Waves                                                                   */
/* ----------------------------------------------------------------------- */

function rollEnemyType(wave) {
  const roll = Math.random();
  if (wave >= 4 && roll < Math.min(0.2, 0.06 + wave * 0.012)) return "brute";
  if (wave >= 2 && roll < 0.24 + Math.min(0.26, wave * 0.022)) return "runner";
  return "walker";
}

function startWave(wave) {
  game.wave = wave;
  game.waveState = "spawning";
  game.spawnClock = 0;
  game.spawnQueue = [];
  const count = Math.min(42, 5 + Math.round(wave * 2.35));
  const interval = Math.max(0.24, 0.54 - wave * 0.018);
  for (let i = 0; i < count; i += 1) {
    game.spawnQueue.push({
      type: rollEnemyType(wave),
      at: 0.55 + i * interval + rand(-0.08, 0.14)
    });
  }
  game.spawnQueue.sort((a, b) => a.at - b.at);
  banner(`VAGUE ${String(wave).padStart(2, "0")}`, wave >= 10 ? "ENFER" : "NOUVELLE VAGUE", `${count} HOSTILES EN APPROCHE`);
  sound.wave();
  updateHud(true);
}

function spawnEnemy(type) {
  const angle = rand(0, TAU);
  const distance = Math.max(view.w, view.h) / view.scale * 0.62 + rand(30, 130);
  const x = clamp(player.x + Math.cos(angle) * distance, 42, WORLD.w - 42);
  const y = clamp(player.y + Math.sin(angle) * distance, 42, WORLD.h - 42);
  spawnZombie(type, x, y);
}

function spawnZombie(type, x, y) {
  const base = ENEMY_TYPES[type];
  const hpScale = 1 + (game.wave - 1) * 0.075;
  const speedScale = Math.min(1.5, 1 + (game.wave - 1) * 0.026);
  enemies.push({
    type,
    x: clamp(x, 30, WORLD.w - 30),
    y: clamp(y, 30, WORLD.h - 30),
    r: base.r,
    hp: base.hp * hpScale,
    maxHp: base.hp * hpScale,
    speed: base.speed * speedScale,
    dmg: base.dmg,
    score: base.score,
    angle: rand(0, TAU),
    atkCd: rand(0, 0.4),
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    seed: rand(0, TAU),
    dead: false
  });
}

function updateWave(dt) {
  game.spawnClock += dt;
  if (game.waveState === "spawning") {
    while (
      game.spawnQueue.length > 0
      && game.spawnQueue[0].at <= game.spawnClock
      && enemies.length < 58
    ) {
      const next = game.spawnQueue.shift();
      spawnEnemy(next.type);
    }
  }

  if (game.waveState === "spawning" && game.spawnQueue.length === 0 && enemies.length === 0) {
    game.waveState = "break";
    game.waveBreak = 3.15;
    game.score += 35 * game.wave;
    player.hp = Math.min(player.maxHp, player.hp + 8);
    banner(`VAGUE ${String(game.wave).padStart(2, "0")}`, "ZONE NETTOYÉE", "+8 VITALITÉ · REPREND TON SOUFFLE");
    sound.pickup();
    if (Math.random() < 0.7) dropPickup(player.x + rand(-90, 90), player.y + rand(-90, 90), "health");
  } else if (game.waveState === "break") {
    game.waveBreak -= dt;
    if (game.waveBreak <= 0) startWave(game.wave + 1);
  }
}

/* ----------------------------------------------------------------------- */
/* Player, weapon, combat                                                  */
/* ----------------------------------------------------------------------- */

function startReload() {
  if (game.mode !== "playing" || !player.alive) return;
  if (player.reloading || player.ammo >= player.mag) return;
  player.reloading = true;
  player.reloadT = player.reloadDur;
  sound.reloadStart();
  updateHud(true);
}

function shoot() {
  player.ammo -= 1;
  player.fireCd = 0.102;
  player.recoil = Math.min(1, player.recoil + 0.34);
  player.flash = 0.06;
  const spread = 0.012 + player.recoil * 0.03;
  const angle = player.aim + rand(-spread, spread);
  const muzzleX = player.x + Math.cos(angle) * 34;
  const muzzleY = player.y + Math.sin(angle) * 34;
  bullets.push({
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(angle) * 1280,
    vy: Math.sin(angle) * 1280,
    angle,
    life: 0.8,
    dmg: 36
  });
  game.shake = Math.min(9, game.shake + 1.5);
  for (let i = 0; i < 4; i += 1) {
    spawnParticle({
      type: "spark",
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(angle + rand(-0.35, 0.35)) * rand(100, 420),
      vy: Math.sin(angle + rand(-0.35, 0.35)) * rand(100, 420),
      life: rand(0.05, 0.16),
      size: rand(1, 2.2),
      color: pick(["#fff5b8", "#ffd35a", "#ff9f2e"])
    });
  }
  spawnParticle({
    type: "smoke",
    x: muzzleX + Math.cos(angle) * 4,
    y: muzzleY + Math.sin(angle) * 4,
    vx: Math.cos(angle) * 40,
    vy: Math.sin(angle) * 40,
    life: rand(0.3, 0.6),
    size: rand(4, 8),
    color: "rgba(190, 190, 170, 0.28)"
  });
  const side = player.aim + Math.PI / 2;
  shells.push({
    x: player.x + Math.cos(player.aim) * 18 + Math.cos(side) * 4,
    y: player.y + Math.sin(player.aim) * 18 + Math.sin(side) * 4,
    vx: Math.cos(side) * rand(35, 80) - Math.cos(player.aim) * 20,
    vy: Math.sin(side) * rand(35, 80) - Math.sin(player.aim) * 20,
    rot: rand(0, TAU),
    spin: rand(-12, 12),
    life: 0.9
  });
  sound.shoot();
  if (player.ammo <= 0) startReload();
}

function updatePlayer(dt) {
  player.invuln = Math.max(0, player.invuln - dt);
  player.flash = Math.max(0, player.flash - dt);
  player.recoil = Math.max(0, player.recoil - dt * 4.8);

  let mx = 0;
  let my = 0;
  if (input.keys.has("left")) mx -= 1;
  if (input.keys.has("right")) mx += 1;
  if (input.keys.has("up")) my -= 1;
  if (input.keys.has("down")) my += 1;
  mx += input.move.x;
  my += input.move.y;
  const length = Math.hypot(mx, my);
  if (length > 1) {
    mx /= length;
    my /= length;
  }
  player.x = clamp(player.x + mx * player.speed * dt, 25, WORLD.w - 25);
  player.y = clamp(player.y + my * player.speed * dt, 25, WORLD.h - 25);
  player.walk += Math.hypot(mx, my) * dt * 9;

  const usingStick = input.aimStick.mag > 0.16;
  if (usingStick) {
    player.aim = Math.atan2(input.aimStick.y, input.aimStick.x);
  } else if (input.mouse.active && !isTouchMode) {
    const target = screenToWorld(input.mouse.x, input.mouse.y);
    player.aim = Math.atan2(target.y - player.y, target.x - player.x);
  } else if (input.tilt.enabled && input.tilt.ready) {
    player.aim = angleLerp(player.aim, input.tilt.angle, 1 - Math.exp(-dt * 14));
  }

  if ((usingStick || input.tilt.enabled) && enemies.length > 0) applyAimAssist(dt);

  const wantFire = input.mouse.down
    || input.keys.has("fire")
    || input.aimStick.mag > 0.3
    || (input.tilt.enabled && input.tilt.ready);

  player.fireCd = Math.max(0, player.fireCd - dt);

  if (player.reloading) {
    player.reloadT -= dt;
    if (player.reloadT <= 0) {
      player.reloading = false;
      player.reloadT = 0;
      player.ammo = player.mag;
      sound.reloadEnd();
      updateHud(true);
    }
  }

  if (wantFire && !player.reloading) {
    if (player.ammo <= 0) startReload();
    else if (player.fireCd <= 0) shoot();
  }
}

function applyAimAssist(dt) {
  let target = null;
  let bestScore = Infinity;
  for (const zombie of enemies) {
    if (zombie.dead) continue;
    const dx = zombie.x - player.x;
    const dy = zombie.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 34 || distance > 620) continue;
    const diff = Math.abs(angleWrap(Math.atan2(dy, dx) - player.aim));
    if (diff > 0.24) continue;
    const score = diff * 2.4 + distance / 1200;
    if (score < bestScore) {
      bestScore = score;
      target = zombie;
    }
  }
  if (!target) return;
  const wanted = Math.atan2(target.y - player.y, target.x - player.x);
  player.aim = angleLerp(player.aim, wanted, 1 - Math.exp(-dt * 4.2));
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > WORLD.w || bullet.y > WORLD.h) {
      bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const zombie of enemies) {
      if (zombie.dead) continue;
      const dx = zombie.x - bullet.x;
      const dy = zombie.y - bullet.y;
      if (dx * dx + dy * dy < (zombie.r + 3) * (zombie.r + 3)) {
        damageZombie(zombie, bullet.dmg, bullet.angle);
        hit = true;
        break;
      }
    }
    if (hit) bullets.splice(i, 1);
  }

  for (let i = shells.length - 1; i >= 0; i -= 1) {
    const shell = shells[i];
    shell.life -= dt;
    shell.x += shell.vx * dt;
    shell.y += shell.vy * dt;
    shell.vx *= Math.exp(-dt * 2.4);
    shell.vy *= Math.exp(-dt * 2.4);
    shell.rot += shell.spin * dt;
    if (shell.life <= 0) shells.splice(i, 1);
  }
}

function damageZombie(zombie, damage, angle) {
  if (zombie.dead) return;
  zombie.hp -= damage;
  zombie.hitFlash = 1;
  const force = zombie.type === "brute" ? 32 : 78;
  zombie.knockX += Math.cos(angle) * force;
  zombie.knockY += Math.sin(angle) * force;
  const headX = zombie.x + Math.cos(zombie.angle) * zombie.r * 0.35;
  const headY = zombie.y + Math.sin(zombie.angle) * zombie.r * 0.35;
  bloodBurst(headX, headY, zombie.type === "brute" ? 7 : 4, 0.9);
  sound.hit();
  if (zombie.hp <= 0) killZombie(zombie, angle);
}

function killZombie(zombie, angle) {
  if (zombie.dead) return;
  zombie.dead = true;
  game.kills += 1;
  game.combo += 1;
  game.comboT = 3;
  const multiplier = 1 + Math.min(4, Math.floor((game.combo - 1) / 4));
  const gained = zombie.score * multiplier;
  game.score += gained;
  game.shake = Math.min(12, game.shake + (zombie.type === "brute" ? 7 : 2));
  bloodBurst(zombie.x, zombie.y, zombie.type === "brute" ? 30 : 15, zombie.type === "brute" ? 1.6 : 1);
  addBloodDecal(zombie.x, zombie.y, zombie.type === "brute" ? 1.6 : zombie.type === "runner" ? 0.8 : 1.1, zombie.type === "brute" ? 10 : 6);
  addText(zombie.x, zombie.y - zombie.r - 6, `+${gained}`, multiplier > 1 ? "#b7ff3e" : "#e8f1df", multiplier > 1 ? 15 : 12);
  if (multiplier > 1) addText(zombie.x, zombie.y - zombie.r - 22, `x${multiplier}`, "#ffca57", 10);

  const dropRoll = Math.random();
  if (zombie.type === "brute" || dropRoll < 0.11) dropPickup(zombie.x, zombie.y, "health");
  else if (dropRoll < 0.2) dropPickup(zombie.x, zombie.y, "ammo");

  const direction = angle ?? rand(0, TAU);
  for (let i = 0; i < (zombie.type === "brute" ? 7 : 3); i += 1) {
    spawnParticle({
      type: "chunk",
      x: zombie.x,
      y: zombie.y,
      vx: Math.cos(direction + rand(-1.1, 1.1)) * rand(40, 200),
      vy: Math.sin(direction + rand(-1.1, 1.1)) * rand(40, 200),
      life: rand(0.5, 1.2),
      size: rand(2, 5),
      color: pick(["#4a1111", "#5f1914", "#2d1710"])
    });
  }
  sound.kill();
  updateHud(true);
}

function dropPickup(x, y, type) {
  pickups.push({
    x: clamp(x, 30, WORLD.w - 30),
    y: clamp(y, 30, WORLD.h - 30),
    type,
    life: 26,
    bob: rand(0, TAU)
  });
}

function updateZombies(dt) {
  const count = enemies.length;
  for (const zombie of enemies) {
    if (zombie.dead) continue;
    zombie.hitFlash = Math.max(0, zombie.hitFlash - dt * 4.5);
    zombie.atkCd = Math.max(0, zombie.atkCd - dt);
    zombie.knockX *= Math.exp(-dt * 7);
    zombie.knockY *= Math.exp(-dt * 7);

    const dx = player.x - zombie.x;
    const dy = player.y - zombie.y;
    const distance = Math.hypot(dx, dy) || 1;
    const targetAngle = Math.atan2(dy, dx);
    const turnSpeed = zombie.type === "runner" ? 7 : zombie.type === "brute" ? 3.2 : 4.8;
    zombie.angle = angleLerp(zombie.angle, targetAngle, 1 - Math.exp(-dt * turnSpeed));

    const wobbleAmount = zombie.type === "runner" ? 0.22 : zombie.type === "brute" ? 0.08 : 0.14;
    const wobble = Math.sin(game.time * 2.7 + zombie.seed) * wobbleAmount;
    const moveAngle = zombie.angle + wobble;
    const speed = zombie.speed;

    let vx = Math.cos(moveAngle) * speed + zombie.knockX;
    let vy = Math.sin(moveAngle) * speed + zombie.knockY;

    if (count < 45) {
      for (const other of enemies) {
        if (other === zombie || other.dead) continue;
        const ox = zombie.x - other.x;
        const oy = zombie.y - other.y;
        const minDistance = zombie.r + other.r;
        const dist2 = ox * ox + oy * oy;
        if (dist2 > 0.01 && dist2 < minDistance * minDistance) {
          const dist = Math.sqrt(dist2);
          const push = (minDistance - dist) / minDistance;
          vx += ox / dist * push * 70;
          vy += oy / dist * push * 70;
        }
      }
    }

    zombie.x = clamp(zombie.x + vx * dt, 22, WORLD.w - 22);
    zombie.y = clamp(zombie.y + vy * dt, 22, WORLD.h - 22);

    if (distance < zombie.r + player.r && zombie.atkCd <= 0 && player.invuln <= 0) {
      hurtPlayer(zombie);
      zombie.atkCd = 0.9;
    }
  }
}

function hurtPlayer(zombie) {
  if (!player.alive || player.invuln > 0) return;
  player.hp = Math.max(0, player.hp - zombie.dmg);
  player.invuln = 0.72;
  game.hitFlash = 1;
  game.shake = Math.min(18, game.shake + 12);
  sound.hurt();
  const angle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
  player.x = clamp(player.x + Math.cos(angle) * 20, 25, WORLD.w - 25);
  player.y = clamp(player.y + Math.sin(angle) * 20, 25, WORLD.h - 25);
  bloodBurst(player.x, player.y, 7, 0.8);
  addText(player.x, player.y - 28, `-${zombie.dmg}`, "#ff5a4a", 13);
  addBloodDecal(player.x, player.y, 0.55, 3);
  if (player.hp <= 0) killPlayer(zombie);
  updateHud(true);
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    pickup.life -= dt;
    pickup.bob += dt * 3;
    if (pickup.life <= 0) {
      pickups.splice(i, 1);
      continue;
    }
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    if (dx * dx + dy * dy < (player.r + 18) * (player.r + 18)) {
      if (pickup.type === "health") {
        player.hp = Math.min(player.maxHp, player.hp + 26);
        addText(player.x, player.y - 32, "+26 PV", "#78f57a", 13);
        toast("Trousse de soin récupérée.");
      } else {
        player.ammo = player.mag;
        player.reloading = false;
        player.reloadT = 0;
        addText(player.x, player.y - 32, "CHARGEUR PLEIN", "#ffca57", 12);
        toast("Chargeur récupéré.");
      }
      sound.pickup();
      particles.push({
        type: "ring",
        x: pickup.x,
        y: pickup.y,
        vx: 0,
        vy: 0,
        life: 0.45,
        maxLife: 0.45,
        size: 8,
        color: pickup.type === "health" ? "#78f57a" : "#ffca57"
      });
      pickups.splice(i, 1);
      updateHud(true);
    }
  }
}

/* ----------------------------------------------------------------------- */
/* Particles, decals and floating text                                     */
/* ----------------------------------------------------------------------- */

function spawnParticle(options) {
  if (particles.length > 460) return;
  particles.push({
    x: options.x,
    y: options.y,
    vx: options.vx || 0,
    vy: options.vy || 0,
    life: options.life || 0.5,
    maxLife: options.life || 0.5,
    size: options.size || 3,
    color: options.color || "#fff",
    type: options.type || "dot",
    drag: options.drag ?? 2.8,
    grow: options.grow || 0
  });
}

function bloodBurst(x, y, amount, scale = 1) {
  for (let i = 0; i < amount; i += 1) {
    const angle = rand(0, TAU);
    const speed = rand(25, 190) * scale;
    spawnParticle({
      type: Math.random() < 0.72 ? "dot" : "chunk",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.25, 0.8),
      size: rand(1.5, 4.5) * scale,
      color: pick(["#6b0c0c", "#861010", "#4a0808"])
    });
  }
  for (let i = 0; i < Math.ceil(amount / 4); i += 1) {
    spawnParticle({
      type: "smoke",
      x: x + rand(-8, 8),
      y: y + rand(-8, 8),
      vx: rand(-20, 20),
      vy: rand(-20, 20),
      life: rand(0.3, 0.7),
      size: rand(4, 10),
      color: "rgba(70, 12, 10, 0.28)",
      grow: 8
    });
  }
}

function addBloodDecal(x, y, scale = 1, count = 5) {
  const blobs = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, TAU);
    const distance = rand(0, 17 * scale);
    blobs.push({
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      r: rand(2, 9) * scale
    });
  }
  decals.push({ x, y, blobs, alpha: rand(0.25, 0.45) });
  if (decals.length > 86) decals.shift();
}

function addText(x, y, text, color = "#e8f1df", size = 12) {
  texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    const drag = Math.exp(-dt * particle.drag);
    particle.vx *= drag;
    particle.vy *= drag;
    if (particle.grow) particle.size += particle.grow * dt;
  }

  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const text = texts[i];
    text.life -= dt;
    text.y -= dt * 24;
    if (text.life <= 0) texts.splice(i, 1);
  }
}

function updateFog(dt) {
  for (const cloud of fog) {
    cloud.x += cloud.vx * dt;
    cloud.y += cloud.vy * dt;
    if (cloud.x < -cloud.size) cloud.x = WORLD.w + cloud.size;
    if (cloud.x > WORLD.w + cloud.size) cloud.x = -cloud.size;
    if (cloud.y < -cloud.size) cloud.y = WORLD.h + cloud.size;
    if (cloud.y > WORLD.h + cloud.size) cloud.y = -cloud.size;
  }
}

function updateAttract(dt) {
  attractPlayer.aim = -Math.PI / 2 + Math.sin(game.time * 0.38) * 0.7;
  for (const zombie of attractZombies) {
    zombie.x = zombie.ox + Math.sin(game.time * 0.32 + zombie.seed) * 22;
    zombie.y = zombie.oy + Math.cos(game.time * 0.27 + zombie.seed * 1.4) * 18;
    zombie.angle = Math.atan2(attractPlayer.y - zombie.y, attractPlayer.x - zombie.x);
  }
}

/* ----------------------------------------------------------------------- */
/* Rendering                                                               */
/* ----------------------------------------------------------------------- */

function isVisible(x, y, padding = 80) {
  const half = visibleHalf();
  return x > camera.x - half.x - padding
    && x < camera.x + half.x + padding
    && y > camera.y - half.y - padding
    && y < camera.y + half.y + padding;
}

function render() {
  const width = view.w;
  const height = view.h;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = "#070b08";
  ctx.fillRect(0, 0, width, height);

  const shake = game.shake;
  const shakeX = shake > 0 ? rand(-shake, shake) : 0;
  const shakeY = shake > 0 ? rand(-shake, shake) : 0;

  ctx.save();
  ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
  ctx.scale(view.scale, view.scale);
  ctx.translate(-camera.x, -camera.y);

  if (!DEBUG.has("noground")) drawGround();
  drawDecals();
  if (!DEBUG.has("nofog")) drawFog();
  drawPickups();
  drawShells();
  drawBullets();

  if (game.mode === "menu") {
    for (const zombie of attractZombies) drawZombie(zombie);
    drawPlayer(attractPlayer, false);
  } else {
    for (const zombie of enemies) {
      if (!zombie.dead) drawZombie(zombie);
    }
    drawPlayer(player, true);
  }

  drawParticles();
  drawTexts();
  if (game.mode === "playing" || game.mode === "dying") drawReticle();
  ctx.restore();

  if (!DEBUG.has("noeffects")) drawScreenEffects(width, height);
}

function drawGround() {
  if (!worldCanvas) return;
  const half = visibleHalf();
  const sx = clamp(camera.x - half.x - 40, 0, WORLD.w);
  const sy = clamp(camera.y - half.y - 40, 0, WORLD.h);
  const ex = clamp(camera.x + half.x + 40, 0, WORLD.w);
  const ey = clamp(camera.y + half.y + 40, 0, WORLD.h);
  const sw = Math.max(1, ex - sx);
  const sh = Math.max(1, ey - sy);
  ctx.drawImage(worldCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
}

function drawDecals() {
  for (const decal of decals) {
    if (!isVisible(decal.x, decal.y, 40)) continue;
    ctx.fillStyle = `rgba(58, 7, 7, ${decal.alpha})`;
    for (const blob of decal.blobs) {
      ctx.beginPath();
      ctx.arc(decal.x + blob.dx, decal.y + blob.dy, blob.r, 0, TAU);
      ctx.fill();
    }
  }
}

function drawPropsOn(c, cull = true) {
  for (const prop of props) {
    if (cull && !isVisible(prop.x, prop.y, 60)) continue;
    c.save();
    c.translate(prop.x, prop.y);
    c.rotate(prop.rot);
    c.scale(prop.size, prop.size);
    if (prop.type === "tuft") {
      c.strokeStyle = "rgba(57, 80, 40, 0.58)";
      c.lineWidth = 1.2;
      for (let i = 0; i < 5; i += 1) {
        const x = (i - 2) * 2.6;
        c.beginPath();
        c.moveTo(x, 2);
        c.quadraticCurveTo(x + (i - 2) * 1.8, -5, x + (i - 2) * 3.2, -9 - (i % 2) * 4);
        c.stroke();
      }
    } else if (prop.type === "pebble") {
      c.fillStyle = "rgba(63, 68, 58, 0.65)";
      c.beginPath();
      c.ellipse(0, 0, 3.4, 2.2, 0, 0, TAU);
      c.fill();
      c.fillStyle = "rgba(92, 98, 84, 0.22)";
      c.beginPath();
      c.ellipse(-1, -1, 1.8, 1.1, 0, 0, TAU);
      c.fill();
    } else if (prop.type === "crack") {
      c.strokeStyle = "rgba(5, 8, 5, 0.42)";
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(-2, -2);
      c.lineTo(3, 1);
      c.lineTo(9, -1);
      c.stroke();
    } else if (prop.type === "scrap") {
      c.fillStyle = "rgba(91, 83, 65, 0.34)";
      c.fillRect(-3, -1.2, 6, 2.4);
      c.fillStyle = "rgba(140, 124, 86, 0.14)";
      c.fillRect(-3, -1.2, 6, 0.7);
    } else if (prop.type === "bone") {
      c.strokeStyle = "rgba(152, 154, 131, 0.4)";
      c.lineWidth = 1.4;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-4, 0);
      c.lineTo(4, 0);
      c.stroke();
      c.fillStyle = "rgba(152, 154, 131, 0.4)";
      c.beginPath();
      c.arc(-4.5, -1, 1.2, 0, TAU);
      c.arc(-4.5, 1, 1.2, 0, TAU);
      c.fill();
    } else if (prop.type === "barrel") {
      c.fillStyle = "rgba(0, 0, 0, 0.28)";
      c.beginPath();
      c.ellipse(2, 5, 15, 8, 0, 0, TAU);
      c.fill();
      c.fillStyle = "#3b3326";
      c.beginPath();
      c.arc(0, 0, 13, 0, TAU);
      c.fill();
      c.strokeStyle = "rgba(155, 109, 52, 0.5)";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 10, 0, TAU);
      c.stroke();
      c.fillStyle = "rgba(20, 16, 11, 0.6)";
      c.beginPath();
      c.arc(0, 0, 7, 0, TAU);
      c.fill();
      c.strokeStyle = "rgba(169, 68, 38, 0.35)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-8, -4);
      c.lineTo(5, 6);
      c.stroke();
    }
    c.restore();
  }
}

function drawFog() {
  if (!fogSprite) return;
  ctx.save();
  for (const cloud of fog) {
    if (!isVisible(cloud.x, cloud.y, cloud.size * 0.7)) continue;
    ctx.globalAlpha = cloud.alpha * 0.34;
    ctx.drawImage(fogSprite, cloud.x - cloud.size / 2, cloud.y - cloud.size / 2, cloud.size, cloud.size);
  }
  ctx.restore();
}

function drawPickups() {
  for (const pickup of pickups) {
    if (!isVisible(pickup.x, pickup.y, 30)) continue;
    const bob = Math.sin(pickup.bob) * 3;
    const color = pickup.type === "health" ? "#78f57a" : "#ffca57";
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.globalAlpha = pickup.life < 4 ? 0.4 + Math.abs(Math.sin(pickup.life * 7)) * 0.6 : 1;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 11, 13, 5, 0, 0, TAU);
    ctx.fill();
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    glow.addColorStop(0, pickup.type === "health" ? "rgba(120,245,122,0.28)" : "rgba(255,202,87,0.28)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(8, 14, 10, 0.92)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-11, -9, 22, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    if (pickup.type === "health") {
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillRect(-6, -5, 4, 10);
      ctx.fillRect(-1, -5, 4, 10);
      ctx.fillRect(4, -5, 3, 10);
    }
    ctx.restore();
  }
}

function drawShells() {
  ctx.save();
  for (const shell of shells) {
    if (!isVisible(shell.x, shell.y, 30)) continue;
    ctx.globalAlpha = Math.min(1, shell.life * 2);
    ctx.fillStyle = "#d4a33f";
    ctx.save();
    ctx.translate(shell.x, shell.y);
    ctx.rotate(shell.rot);
    ctx.fillRect(-2.6, -1, 5.2, 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawBullets() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const bullet of bullets) {
    if (!isVisible(bullet.x, bullet.y, 30)) continue;
    const tailX = bullet.x - bullet.vx * 0.018;
    const tailY = bullet.y - bullet.vy * 0.018;
    ctx.strokeStyle = "rgba(255, 240, 165, 0.95)";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 165, 40, 0.28)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawZombie(zombie) {
  if (!isVisible(zombie.x, zombie.y, 50)) return;
  const type = ENEMY_TYPES[zombie.type] || ENEMY_TYPES.walker;
  const bob = Math.sin(game.time * 3.4 + zombie.seed) * 1.5;
  const flash = zombie.hitFlash || 0;

  ctx.save();
  ctx.translate(zombie.x, zombie.y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(0, zombie.r * 0.5, zombie.r * 1.08, zombie.r * 0.56, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(zombie.angle);

  const r = zombie.r;
  const armSwing = Math.sin(game.time * 5.5 + zombie.seed) * 2.2;

  ctx.strokeStyle = type.skin;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2.5, r * 0.2);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.42);
  ctx.lineTo(r * 0.82, -r * 0.55 + armSwing);
  ctx.lineTo(r * 1.18, -r * 0.4 + armSwing);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.42);
  ctx.lineTo(r * 0.93, r * 0.55 - armSwing);
  ctx.lineTo(r * 1.25, r * 0.36 - armSwing);
  ctx.stroke();

  ctx.fillStyle = type.skin;
  ctx.beginPath();
  ctx.arc(r * 1.2, -r * 0.4 + armSwing, r * 0.16, 0, TAU);
  ctx.arc(r * 1.27, r * 0.36 - armSwing, r * 0.16, 0, TAU);
  ctx.fill();

  ctx.fillStyle = type.body;
  ctx.beginPath();
  ctx.ellipse(-r * 0.12, bob * 0.15, r * 0.86, r * 0.68, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "rgba(145, 170, 105, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.35);
  ctx.lineTo(r * 0.2, r * 0.48);
  ctx.moveTo(-r * 0.2, -r * 0.52);
  ctx.lineTo(r * 0.32, r * 0.3);
  ctx.stroke();

  ctx.fillStyle = type.skin;
  ctx.beginPath();
  ctx.arc(r * 0.46, 0, r * 0.46, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(22, 27, 18, 0.6)";
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 0.06, r * 0.3, 0, TAU);
  ctx.fill();

  const eyeX = r * 0.72;
  ctx.fillStyle = type.eye;
  ctx.beginPath();
  ctx.arc(eyeX, -r * 0.16, r * 0.075, 0, TAU);
  ctx.arc(eyeX, r * 0.16, r * 0.075, 0, TAU);
  ctx.fill();

  if (zombie.type === "brute") {
    ctx.strokeStyle = "rgba(40, 25, 22, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-r * 0.1, 0, r * 0.76, 0.4, 2.7);
    ctx.stroke();
  }

  if (flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 245, 220, ${flash * 0.34})`;
    ctx.beginPath();
    ctx.ellipse(-r * 0.08, 0, r * 0.92, r * 0.74, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.46, 0, r * 0.5, 0, TAU);
    ctx.fill();
  }

  if (zombie.type === "brute" && zombie.hp < zombie.maxHp) {
    const ratio = clamp(zombie.hp / zombie.maxHp, 0, 1);
    ctx.rotate(-zombie.angle);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(-r, -r - 12, r * 2, 3);
    ctx.fillStyle = "#c7342b";
    ctx.fillRect(-r, -r - 12, r * 2 * ratio, 3);
  }
  ctx.restore();
}

function drawPlayer(entity, isReal) {
  const dead = isReal && !player.alive;
  const bob = isReal ? Math.sin(entity.walk) * 1.4 : 0;

  ctx.save();
  ctx.translate(entity.x, entity.y);
  if (dead) {
    ctx.rotate(entity.aim + 0.8);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 22, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#26332a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#4a5b4b";
    ctx.beginPath();
    ctx.arc(9, -2, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(90, 8, 8, 0.65)";
    ctx.beginPath();
    ctx.ellipse(2, 7, 22, 7, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 5, 18, 10, 0, 0, TAU);
  ctx.fill();
  if (isReal) {
    ctx.strokeStyle = "rgba(183, 255, 62, 0.28)";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(game.time * 2.4) * 1.4, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(183, 255, 62, 0.05)";
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, TAU);
    ctx.fill();
  }
  ctx.rotate(entity.aim);

  if (isReal && player.invuln > 0) {
    ctx.globalAlpha = 0.65 + Math.sin(game.time * 38) * 0.2;
  }

  const recoil = isReal ? player.recoil * 3 : 0;
  ctx.strokeStyle = "#1d2922";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const step = Math.sin(entity.walk) * 3;
  ctx.beginPath();
  ctx.moveTo(-6, -5);
  ctx.lineTo(-6 + step, -10);
  ctx.moveTo(-6, 5);
  ctx.lineTo(-6 - step, 10);
  ctx.stroke();
  ctx.strokeStyle = "#38473a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(-4 + step, -9);
  ctx.moveTo(-4, 5);
  ctx.lineTo(-4 - step, 9);
  ctx.stroke();

  ctx.fillStyle = "#26342b";
  ctx.beginPath();
  ctx.roundRect(-14, -8, 12, 16, 4);
  ctx.fill();
  ctx.fillStyle = "#33443a";
  ctx.beginPath();
  ctx.roundRect(-16, -5, 7, 10, 3);
  ctx.fill();

  const bodyY = bob * 0.25;
  ctx.fillStyle = "#394b3f";
  ctx.beginPath();
  ctx.ellipse(0, bodyY, 12, 10.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#4d6354";
  ctx.beginPath();
  ctx.ellipse(1, bodyY - 2, 7.5, 6.5, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#2b3a30";
  ctx.beginPath();
  ctx.ellipse(-2, -8, 5.5, 4, 0, 0, TAU);
  ctx.ellipse(-2, 8, 5.5, 4, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "#4f6455";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(3, -6);
  ctx.lineTo(15 - recoil, -4);
  ctx.moveTo(3, 6);
  ctx.lineTo(15 - recoil, 4);
  ctx.stroke();

  ctx.fillStyle = "#1a2420";
  ctx.fillRect(4 - recoil, -2.3, 26, 4.6);
  ctx.fillStyle = "#2e4140";
  ctx.fillRect(13 - recoil, -3.9, 10, 7.8);
  ctx.fillStyle = "#0e1512";
  ctx.fillRect(27 - recoil, -1.5, 8, 3);
  ctx.fillStyle = "#6b7c65";
  ctx.fillRect(9 - recoil, 2, 4, 3.5);

  ctx.fillStyle = "#61705c";
  ctx.beginPath();
  ctx.arc(4, 0, 6.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#84957b";
  ctx.beginPath();
  ctx.arc(4, -1.3, 4.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(10, 16, 12, 0.75)";
  ctx.fillRect(4.5, -0.8, 4.5, 1.6);

  if (isReal && player.flash > 0) {
    const fx = 35 - recoil;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(fx, 0, 0, fx, 0, 20);
    glow.addColorStop(0, "rgba(255, 250, 190, 0.95)");
    glow.addColorStop(0.35, "rgba(255, 190, 60, 0.55)");
    glow.addColorStop(1, "rgba(255, 120, 20, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, 0, 20, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff7ca";
    ctx.beginPath();
    ctx.moveTo(fx + 12, 0);
    ctx.lineTo(fx, -4.5);
    ctx.lineTo(fx + 2, 0);
    ctx.lineTo(fx, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawParticles() {
  ctx.save();
  for (const particle of particles) {
    if (!isVisible(particle.x, particle.y, 30)) continue;
    const opacity = clamp(particle.life / particle.maxLife, 0, 1);
    if (particle.type === "spark") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = particle.size;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - particle.vx * 0.02, particle.y - particle.vy * 0.02);
      ctx.stroke();
    } else if (particle.type === "smoke") {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = opacity * 0.6;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    } else if (particle.type === "ring") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = opacity * 0.7;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size + (1 - opacity) * 34, 0, TAU);
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTexts() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const text of texts) {
    const opacity = clamp(text.life / text.maxLife, 0, 1);
    ctx.globalAlpha = opacity;
    ctx.font = `800 ${text.size}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillText(text.text, text.x + 1, text.y + 1);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.restore();
}

function reticleWorld() {
  if (input.mouse.active && !isTouchMode) return screenToWorld(input.mouse.x, input.mouse.y);
  return {
    x: player.x + Math.cos(player.aim) * 112,
    y: player.y + Math.sin(player.aim) * 112
  };
}

function drawReticle() {
  if (game.mode === "dying") return;
  const target = reticleWorld();
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distance = Math.hypot(dx, dy) || 1;
  ctx.save();
  ctx.strokeStyle = "rgba(183, 255, 62, 0.12)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 9]);
  ctx.beginPath();
  ctx.moveTo(player.x + dx / distance * 38, player.y + dy / distance * 38);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const pulse = 1 + Math.sin(game.time * 4.5) * 0.06;
  ctx.translate(target.x, target.y);
  ctx.rotate(game.time * 0.35);
  ctx.strokeStyle = "rgba(183, 255, 62, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 9 * pulse, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const angle = i * Math.PI / 2;
    ctx.moveTo(Math.cos(angle) * 13, Math.sin(angle) * 13);
    ctx.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(183, 255, 62, 0.95)";
  ctx.beginPath();
  ctx.arc(0, 0, 1.7, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawScreenEffects(width, height) {
  const centerX = (player.x - camera.x) * view.scale + width / 2;
  const centerY = (player.y - camera.y) * view.scale + height / 2;

  if (lightSprite && !DEBUG.has("nolight")) {
    const radius = Math.min(Math.max(width, height) * 0.38, 460);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(lightSprite, centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  if (vignetteSprite && !DEBUG.has("novignette")) ctx.drawImage(vignetteSprite, 0, 0, width, height);

  if (game.mode === "playing" && player.hp < 35 && redVignetteSprite) {
    const intensity = (35 - player.hp) / 35;
    ctx.save();
    ctx.globalAlpha = clamp(0.28 + intensity * 0.46 + Math.sin(game.time * 5) * 0.06, 0, 0.9);
    ctx.drawImage(redVignetteSprite, 0, 0, width, height);
    ctx.restore();
  }

  if (game.hitFlash > 0) {
    ctx.fillStyle = `rgba(135, 8, 5, ${game.hitFlash * 0.18})`;
    ctx.fillRect(0, 0, width, height);
    if (redVignetteSprite) {
      ctx.save();
      ctx.globalAlpha = game.hitFlash * 0.75;
      ctx.drawImage(redVignetteSprite, 0, 0, width, height);
      ctx.restore();
    }
  }
}

/* ----------------------------------------------------------------------- */
/* HUD                                                                     */
/* ----------------------------------------------------------------------- */

function banner(title, kicker, sub) {
  ui.bannerKicker.textContent = kicker || "";
  ui.bannerTitle.textContent = title;
  ui.bannerSub.textContent = sub || "";
  ui.waveBanner.classList.remove("show");
  void ui.waveBanner.offsetWidth;
  ui.waveBanner.classList.add("show");
}

const hudCache = { wave: null, score: null, hp: null, ammo: null, combo: null };

function updateHud(force = false) {
  const waveValue = String(Math.max(1, game.wave)).padStart(2, "0");
  if (force || hudCache.wave !== waveValue) {
    ui.waveNum.textContent = waveValue;
    hudCache.wave = waveValue;
  }
  const score = padScore(game.score);
  if (force || hudCache.score !== score) {
    ui.scoreNum.textContent = score;
    hudCache.score = score;
  }

  const hp = Math.ceil(player.hp);
  if (force || hudCache.hp !== hp) {
    ui.hpText.textContent = String(hp);
    ui.hpFill.style.transform = `scaleX(${clamp(player.hp / player.maxHp, 0, 1)})`;
    ui.hpFill.classList.toggle("warn", player.hp <= 55 && player.hp > 30);
    ui.hpFill.classList.toggle("danger", player.hp <= 30);
    hudCache.hp = hp;
  }

  const ammoKey = `${player.ammo}/${player.mag}/${player.reloading}/${player.reloadT.toFixed(1)}`;
  if (force || hudCache.ammo !== ammoKey) {
    ui.ammoText.textContent = player.reloading ? "RECHARGE" : `${player.ammo} / ${player.mag}`;
    ui.ammoFill.style.transform = `scaleX(${clamp(player.ammo / player.mag, 0, 1)})`;
    ui.reloadFill.style.transform = `scaleX(${player.reloading ? clamp(1 - player.reloadT / player.reloadDur, 0, 1) : 0})`;
    ui.reloadBtn.classList.toggle("reloading", player.reloading);
    ui.reloadBtn.classList.toggle("ready", !player.reloading && player.ammo === 0);
    ui.reloadText.textContent = player.reloading ? "RECHARGE" : "RECHARGER";
    ui.ammoLabel.textContent = player.reloading ? "RECHARGE EN COURS" : "CHARGEUR";
    hudCache.ammo = ammoKey;
  }

  const comboVisible = game.combo > 1 && game.comboT > 0;
  const multiplier = 1 + Math.min(4, Math.floor((game.combo - 1) / 4));
  const comboKey = `${game.combo}/${multiplier}`;
  if (force || hudCache.combo !== comboKey || comboVisible) {
    ui.combo.classList.toggle("hidden", !comboVisible);
    ui.comboMult.textContent = `x${multiplier}`;
    ui.comboCount.textContent = `${game.combo} COMBO`;
    ui.comboBar.style.transform = `scaleX(${clamp(game.comboT / 3, 0, 1)})`;
    hudCache.combo = comboKey;
  }

  ui.tiltBadge.classList.toggle("hidden", !input.tilt.enabled || game.mode !== "playing");
}

function updateBestUI() {
  ui.bestScore.textContent = padScore(best);
}

function updateSoundUI() {
  ui.soundBtn.setAttribute("aria-pressed", String(muted));
  ui.soundBtn.setAttribute("aria-label", muted ? "Activer le son" : "Couper le son");
  ui.menuSoundBtn.setAttribute("aria-pressed", String(muted));
  ui.menuSoundBtn.setAttribute("aria-label", muted ? "Activer le son" : "Couper le son");
  ui.menuSoundBtn.textContent = muted ? "SON OFF" : "SON ON";
}

let toastTimer = null;
function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast.classList.remove("show");
    toastTimer = null;
  }, 2300);
}

/* ----------------------------------------------------------------------- */
/* Loop and boot                                                           */
/* ----------------------------------------------------------------------- */

let lastFrame = performance.now();
let menuDirty = true;

function update(dt) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 34);
  game.hitFlash = Math.max(0, game.hitFlash - dt * 2.8);
  updateParticles(dt);
  updateFog(dt);
  updateCamera(dt);

  if (game.mode === "menu") {
    updateAttract(dt);
    return;
  }

  if (game.mode === "paused" || game.mode === "gameover") return;

  if (game.mode === "dying") {
    game.dying -= dt;
    if (game.dying <= 0) finishGameOver();
    return;
  }

  updatePlayer(dt);
  updateBullets(dt);
  updateZombies(dt);
  updatePickups(dt);
  updateWave(dt);

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    if (enemies[i].dead) enemies.splice(i, 1);
  }

  if (game.comboT > 0) {
    game.comboT = Math.max(0, game.comboT - dt);
    if (game.comboT === 0) game.combo = 0;
  }
  updateHud();
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (game.mode === "menu") {
    menuDirty = false;
    requestAnimationFrame(frame);
    return;
  }
  if (game.mode !== "paused") update(dt);
  render();
  requestAnimationFrame(frame);
}

function togglePause() {
  if (game.mode === "playing") pauseGame();
  else if (game.mode === "paused") resumeGame();
}

function toggleSound() {
  muted = !muted;
  writeStorage(STORAGE_MUTED, muted ? "1" : "0");
  sound.setMuted(muted);
  updateSoundUI();
  if (!muted) {
    sound.unlock();
    sound.click();
  }
}

ui.startBtn.addEventListener("click", () => {
  sound.unlock();
  startGame();
});

ui.restartBtn.addEventListener("click", () => {
  sound.unlock();
  startGame();
});

ui.resumeBtn.addEventListener("click", resumeGame);
ui.pauseBtn.addEventListener("click", () => {
  if (game.mode === "playing") pauseGame();
});

ui.pauseRestartBtn.addEventListener("click", () => {
  ui.pause.classList.add("hidden");
  startGame();
});

ui.pauseMenuBtn.addEventListener("click", () => {
  ui.pause.classList.add("hidden");
  backToMenu();
});

ui.backMenuBtn.addEventListener("click", backToMenu);
ui.reloadBtn.addEventListener("click", startReload);
ui.motionBtn.addEventListener("click", toggleMotion);
ui.calibrateBtn.addEventListener("click", calibrateMotion);
ui.soundBtn.addEventListener("click", toggleSound);
ui.menuSoundBtn.addEventListener("click", toggleSound);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.mode === "playing") pauseGame();
});

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => {
  setTimeout(resize, 160);
});
window.addEventListener("gesturestart", (event) => event.preventDefault());

function boot() {
  buildWorld();
  resize();
  initAttract();
  updateBestUI();
  updateSoundUI();
  updateMotionUI();
  updateHud(true);
  requestAnimationFrame(frame);
}

boot();







