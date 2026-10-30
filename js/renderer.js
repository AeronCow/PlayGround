import { clamp, lerp, rand, rgba, mulberry32, TAU, easeOutCubic } from './utils.js';

const PALETTE = {
  ink: '#03090c',
  deep: '#06131a',
  wall: '#0a1d23',
  wallLit: '#153c42',
  teal: '#86e3d5',
  pale: '#dcf6ee',
  bone: '#cedfd7',
  gold: '#e8ca8e',
  ember: '#ff9a70',
  red: '#f0745d'
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.bg = null;
    this.noise = null;
    this.noisePattern = null;
    this.stars = [];
    this.farDust = [];
  }

  resize(w, h, dpr, game) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.buildBackground(game);
    this.buildNoise();
    this.makeStars(game);
  }

  buildNoise() {
    if (!this.noise) {
      const size = 160;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d');
      const rng = mulberry32(91);
      const img = g.createImageData(size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 110 + Math.floor(rng() * 80);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = Math.floor(rng() * 60);
      }
      g.putImageData(img, 0, 0);
      this.noise = c;
      this.noisePattern = this.ctx.createPattern(c, 'repeat');
    }
  }

  makeStars(game) {
    const rng = mulberry32(1337);
    this.stars.length = 0;
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: rng() * this.w,
        y: game.h * 0.08 + rng() * (game.floor - game.h * 0.1),
        r: 0.4 + rng() * 1.8,
        a: 0.12 + rng() * 0.5,
        p: rng() * TAU
      });
    }
    this.farDust.length = 0;
    for (let i = 0; i < 22; i++) {
      this.farDust.push({
        x: rng() * this.w,
        y: game.h * 0.12 + rng() * (game.floor - game.h * 0.06),
        r: 0.5 + rng() * 1.3,
        a: 0.05 + rng() * 0.16,
        vy: 3 + rng() * 10,
        p: rng() * TAU
      });
    }
  }

  buildBackground(game) {
    const w = this.w;
    const h = this.h;
    const dpr = this.dpr;
    const floor = game.floor;
    const left = game.left;
    const right = game.right;
    const rng = mulberry32(Math.round(w * 7 + h * 13 + 51));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);

    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#071820');
    sky.addColorStop(0.34, '#081820');
    sky.addColorStop(0.64, '#06131a');
    sky.addColorStop(0.82, '#040d12');
    sky.addColorStop(1, '#010406');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    const glow = g.createRadialGradient(w * 0.5, floor - h * 0.34, 10, w * 0.5, floor - h * 0.34, Math.max(w, h) * 0.52);
    glow.addColorStop(0, 'rgba(56, 139, 142, 0.20)');
    glow.addColorStop(0.32, 'rgba(29, 85, 91, 0.12)');
    glow.addColorStop(0.68, 'rgba(13, 41, 48, 0.04)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    const archTop = h * 0.045;
    const archBase = floor + 8;
    const outerX = w * 0.035;
    const outerX2 = w * 0.965;

    g.save();
    g.beginPath();
    g.moveTo(outerX, archBase);
    g.lineTo(outerX, h * 0.34);
    g.bezierCurveTo(w * 0.07, h * 0.16, w * 0.32, archTop, w * 0.5, archTop);
    g.bezierCurveTo(w * 0.68, archTop, w * 0.93, h * 0.16, outerX2, h * 0.34);
    g.lineTo(outerX2, archBase);
    g.closePath();
    const wallFill = g.createLinearGradient(0, archTop, 0, floor);
    wallFill.addColorStop(0, '#0a2027');
    wallFill.addColorStop(0.55, '#08171d');
    wallFill.addColorStop(1, '#030b0f');
    g.fillStyle = wallFill;
    g.fill();
    g.strokeStyle = 'rgba(133, 208, 196, 0.12)';
    g.lineWidth = 2;
    g.stroke();

    g.beginPath();
    g.moveTo(w * 0.09, floor + 8);
    g.lineTo(w * 0.09, h * 0.35);
    g.bezierCurveTo(w * 0.12, h * 0.20, w * 0.34, h * 0.10, w * 0.5, h * 0.10);
    g.bezierCurveTo(w * 0.66, h * 0.10, w * 0.88, h * 0.20, w * 0.91, h * 0.35);
    g.lineTo(w * 0.91, floor + 8);
    g.strokeStyle = 'rgba(165, 231, 218, 0.055)';
    g.lineWidth = 1.2;
    g.stroke();
    g.restore();

    const mullion = (x, top, bottom, thick = 1) => {
      g.save();
      g.strokeStyle = 'rgba(94, 152, 148, 0.09)';
      g.lineWidth = thick;
      g.beginPath();
      g.moveTo(x, bottom);
      g.lineTo(x, top);
      g.stroke();
      g.strokeStyle = 'rgba(204, 242, 231, 0.04)';
      g.lineWidth = thick * 0.4;
      g.beginPath();
      g.moveTo(x + thick * 0.8, bottom);
      g.lineTo(x + thick * 0.8, top);
      g.stroke();
      g.restore();
    };
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = lerp(w * 0.24, w * 0.76, t);
      mullion(x, h * (0.13 + Math.abs(t - 0.5) * 0.12), floor - 2, 1.4);
    }
    for (let i = 1; i < 4; i++) {
      const y = h * 0.16 + i * h * 0.11;
      g.strokeStyle = 'rgba(101, 161, 157, 0.055)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(w * 0.2, y);
      g.quadraticCurveTo(w * 0.5, y + h * 0.045, w * 0.8, y);
      g.stroke();
    }

    const oculusX = w * 0.5;
    const oculusY = h * 0.225;
    const oculusR = Math.min(w, h) * 0.095;
    const oculus = g.createRadialGradient(oculusX, oculusY, oculusR * 0.2, oculusX, oculusY, oculusR);
    oculus.addColorStop(0, 'rgba(125, 214, 205, 0.11)');
    oculus.addColorStop(0.65, 'rgba(61, 129, 132, 0.045)');
    oculus.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = oculus;
    g.beginPath();
    g.arc(oculusX, oculusY, oculusR, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(159, 228, 215, 0.12)';
    g.lineWidth = 1.3;
    g.beginPath();
    g.arc(oculusX, oculusY, oculusR * 0.94, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(159, 228, 215, 0.075)';
    g.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      g.beginPath();
      g.moveTo(oculusX + Math.cos(a) * oculusR * 0.28, oculusY + Math.sin(a) * oculusR * 0.28);
      g.lineTo(oculusX + Math.cos(a) * oculusR * 0.93, oculusY + Math.sin(a) * oculusR * 0.93);
      g.stroke();
    }

    const column = (x, wdt, top) => {
      g.save();
      const grad = g.createLinearGradient(x - wdt / 2, 0, x + wdt / 2, 0);
      grad.addColorStop(0, '#02070a');
      grad.addColorStop(0.45, '#08161b');
      grad.addColorStop(0.62, '#0c2127');
      grad.addColorStop(1, '#020608');
      g.fillStyle = grad;
      g.fillRect(x - wdt / 2, top, wdt, floor - top);
      g.fillStyle = 'rgba(202, 241, 231, 0.06)';
      g.fillRect(x - wdt * 0.34, top, wdt * 0.06, floor - top);
      for (let y = top + 24; y < floor; y += 44) {
        g.fillStyle = 'rgba(220, 249, 240, 0.035)';
        g.fillRect(x - wdt * 0.62, y, wdt * 1.24, 2);
      }
      g.fillStyle = '#061319';
      g.fillRect(x - wdt * 0.76, top + 10, wdt * 1.52, 20);
      g.fillRect(x - wdt * 0.9, top + 2, wdt * 1.8, 9);
      g.fillRect(x - wdt * 0.78, floor - 22, wdt * 1.56, 22);
      g.restore();
    };
    column(w * 0.115, w * 0.052, h * 0.22);
    column(w * 0.885, w * 0.052, h * 0.22);

    const sideArch = (x, dir) => {
      g.save();
      g.strokeStyle = 'rgba(98, 159, 154, 0.075)';
      g.lineWidth = w * 0.012;
      g.beginPath();
      g.moveTo(x, floor);
      g.bezierCurveTo(x + dir * w * 0.05, floor - h * 0.28, x - dir * w * 0.16, floor - h * 0.4, x - dir * w * 0.06, h * 0.03);
      g.stroke();
      g.restore();
    };
    sideArch(w * 0.16, 1);
    sideArch(w * 0.84, -1);

    const chain = (x, y1, y2, sway = 0) => {
      g.save();
      g.strokeStyle = 'rgba(152, 194, 187, 0.15)';
      g.lineWidth = 1.2;
      const len = y2 - y1;
      const links = Math.floor(len / 17);
      for (let i = 0; i < links; i++) {
        const y = y1 + i * 17 + 6;
        const ox = Math.sin(i * 0.6 + sway) * 2;
        g.beginPath();
        g.ellipse(x + ox, y, 3.2, 6.2, 0, 0, TAU);
        g.stroke();
      }
      g.strokeStyle = 'rgba(206, 241, 231, 0.07)';
      g.beginPath();
      g.moveTo(x, y1);
      g.lineTo(x, y2);
      g.stroke();
      g.restore();
    };
    chain(w * 0.34, h * 0.045, floor - h * 0.44, 0.3);
    chain(w * 0.66, h * 0.035, floor - h * 0.51, 1.4);
    chain(w * 0.305, h * 0.09, floor - h * 0.56, 2.1);
    chain(w * 0.705, h * 0.10, floor - h * 0.43, 0.8);

    const stalactite = (x, y, len, wdt) => {
      g.beginPath();
      g.moveTo(x - wdt / 2, y);
      g.lineTo(x, y + len);
      g.lineTo(x + wdt / 2, y);
      g.closePath();
      const grad = g.createLinearGradient(0, y, 0, y + len);
      grad.addColorStop(0, '#040e13');
      grad.addColorStop(1, '#02080b');
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(126, 194, 185, 0.055)';
      g.lineWidth = 0.8;
      g.stroke();
    };
    for (let i = 0; i < 19; i++) {
      const x = rng() * w;
      const len = h * (0.015 + rng() * 0.075);
      const wdt = w * (0.003 + rng() * 0.012);
      stalactite(x, -2, len, wdt);
    }

    const root = (x, y, len, dir, phase) => {
      g.save();
      g.strokeStyle = 'rgba(2, 8, 10, 0.92)';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + dir * len * 0.1, y + len * 0.3, x - dir * len * 0.1 + Math.sin(phase) * 8, y + len * 0.68, x + dir * len * 0.16, y + len);
      g.stroke();
      g.strokeStyle = 'rgba(88, 150, 144, 0.08)';
      g.lineWidth = 0.8;
      g.stroke();
      g.restore();
    };
    root(w * 0.06, h * 0.02, h * 0.42, 1, 0.2);
    root(w * 0.11, h * 0.01, h * 0.29, 1, 1.1);
    root(w * 0.93, h * 0.02, h * 0.38, -1, 0.6);
    root(w * 0.87, -4, h * 0.23, -1, 2.2);

    const beam = (x1, x2, alpha) => {
      const grad = g.createLinearGradient(x1, 0, x2, floor);
      grad.addColorStop(0, `rgba(169, 236, 224, ${alpha})`);
      grad.addColorStop(1, 'rgba(73, 158, 151, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x1 - w * 0.025, 0);
      g.lineTo(x1 + w * 0.025, 0);
      g.lineTo(x2 + w * 0.13, floor);
      g.lineTo(x2 - w * 0.13, floor);
      g.closePath();
      g.fill();
    };
    g.save();
    g.globalCompositeOperation = 'screen';
    beam(w * 0.33, w * 0.42, 0.028);
    beam(w * 0.52, w * 0.54, 0.020);
    beam(w * 0.69, w * 0.61, 0.018);
    g.restore();

    for (let i = 0; i < 64; i++) {
      const x = rng() * w;
      const y = h * 0.1 + rng() * (floor - h * 0.12);
      const len = 4 + rng() * 26;
      g.strokeStyle = `rgba(164, 213, 204, ${0.02 + rng() * 0.05})`;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 14, y + len);
      g.stroke();
    }

    const moss = (x, y, sz) => {
      g.fillStyle = 'rgba(45, 93, 83, 0.35)';
      g.beginPath();
      for (let i = 0; i < 7; i++) {
        const ox = (rng() - 0.5) * sz;
        const oy = rng() * 4;
        g.moveTo(x + ox, y);
        g.arc(x + ox, y - oy, 1 + rng() * 3.5, Math.PI, TAU);
      }
      g.fill();
    };

    const floorPath = () => {
      g.beginPath();
      g.moveTo(0, floor + 5);
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const x = (w / steps) * i;
        g.lineTo(x, floor + Math.sin(i * 1.8) * 2 + (i % 3 === 0 ? 2 : 0));
      }
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.closePath();
    };
    floorPath();
    const floorGrad = g.createLinearGradient(0, floor, 0, h);
    floorGrad.addColorStop(0, '#0b1c21');
    floorGrad.addColorStop(0.07, '#071317');
    floorGrad.addColorStop(0.45, '#030a0d');
    floorGrad.addColorStop(1, '#010304');
    g.fillStyle = floorGrad;
    g.fill();

    g.strokeStyle = 'rgba(197, 237, 226, 0.34)';
    g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const x = (w / 80) * i;
      const y = floor + Math.sin(i * 0.9) * 1.2;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.strokeStyle = 'rgba(132, 207, 194, 0.10)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, floor + 5);
    g.lineTo(w, floor + 5);
    g.stroke();

    for (let i = 0; i < 34; i++) {
      const x = rng() * w;
      const y = floor + 8 + rng() * h * 0.2;
      const len = 8 + rng() * 36;
      g.strokeStyle = `rgba(104, 169, 161, ${0.035 + rng() * 0.055})`;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 16, y + len);
      g.stroke();
    }

    for (let i = 0; i < 18; i++) {
      const x = rng() * w;
      moss(x, floor + 2, 10 + rng() * 18);
    }

    const rubble = (x, dir, sz) => {
      g.save();
      g.fillStyle = '#030a0d';
      g.beginPath();
      g.moveTo(x, floor + 8);
      g.lineTo(x + dir * sz * 0.2, floor - sz * 0.22);
      g.lineTo(x + dir * sz * 0.44, floor - sz * 0.13);
      g.lineTo(x + dir * sz * 0.62, floor - sz * 0.31);
      g.lineTo(x + dir * sz * 0.82, floor + 4);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(129, 201, 190, 0.12)';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    };
    rubble(w * 0.02, 1, Math.min(w, h) * 0.13);
    rubble(w * 0.98, -1, Math.min(w, h) * 0.11);

    const pillar = (x, sz, dir) => {
      g.save();
      g.translate(x, floor + 3);
      g.scale(dir, 1);
      g.fillStyle = '#030a0d';
      g.beginPath();
      g.moveTo(-sz * 0.24, 0);
      g.lineTo(-sz * 0.2, -sz * 0.72);
      g.lineTo(-sz * 0.55, -sz * 0.72);
      g.lineTo(-sz * 0.68, -sz * 0.8);
      g.lineTo(-sz * 0.68, -sz * 0.93);
      g.lineTo(-sz * 0.42, -sz * 0.86);
      g.lineTo(-sz * 0.3, -sz * 1.18);
      g.lineTo(-sz * 0.08, -sz * 0.9);
      g.lineTo(0, -sz * 1.0);
      g.lineTo(sz * 0.14, -sz * 0.82);
      g.lineTo(sz * 0.36, -sz * 0.88);
      g.lineTo(sz * 0.34, 0);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(149, 211, 199, 0.09)';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    };
    pillar(w * 0.06, Math.min(w, h) * 0.30, 1);
    pillar(w * 0.94, Math.min(w, h) * 0.26, -1);

    for (let i = 0; i < 120; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const a = 0.02 + rng() * 0.16;
      const r = 0.3 + rng() * 1.5;
      g.fillStyle = `rgba(177, 233, 224, ${a})`;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }

    g.save();
    const vignette = g.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.72, 'rgba(0,0,0,0.12)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.58)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, w, h);
    g.restore();

    this.bg = canvas;
    this.left = left;
    this.right = right;
    this.floor = floor;
  }

  render(game) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const t = game.time;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(game.shakeX, game.shakeY);

    if (this.bg) ctx.drawImage(this.bg, 0, 0, w, h);

    this.drawAtmosphere(ctx, game, t);
    this.drawStars(ctx, game, t);
    this.drawTelegraphs(ctx, game, t);
    this.drawAfterimages(ctx, game);
    this.drawShadows(ctx, game);
    this.drawArenaDust(ctx, game, t);
    this.drawBoss(ctx, game, t);
    this.drawPlayer(ctx, game, t);
    this.drawShockwaves(ctx, game);
    this.drawSpikes(ctx, game);
    this.drawProjectiles(ctx, game, t);
    this.drawRings(ctx, game);
    this.drawParticles(ctx, game);
    this.drawForeground(ctx, game, t);
    this.drawScreenEffects(ctx, game, t);
    ctx.restore();
  }

  drawAtmosphere(ctx, game, t) {
    const w = this.w;
    const h = this.h;
    const floor = game.floor;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < 3; i++) {
      const x = w * (0.34 + i * 0.17) + Math.sin(t * 0.08 + i * 2.1) * w * 0.028;
      const grad = ctx.createLinearGradient(x, 0, x + w * 0.09, floor);
      grad.addColorStop(0, `rgba(147, 232, 218, ${0.018 + i * 0.004})`);
      grad.addColorStop(0.5, `rgba(102, 207, 191, ${0.010 + i * 0.003})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.02, 0);
      ctx.lineTo(x + w * 0.028, 0);
      ctx.lineTo(x + w * 0.15 + Math.sin(t * 0.1 + i) * w * 0.02, floor);
      ctx.lineTo(x - w * 0.10 + Math.sin(t * 0.1 + i) * w * 0.02, floor);
      ctx.closePath();
      ctx.fill();
    }

    const pulse = 0.12 + Math.sin(t * 0.7) * 0.025 + (game.boss.phase === 2 ? 0.05 : 0);
    const gx = game.boss.x;
    const gy = game.boss.chestY;
    const aura = ctx.createRadialGradient(gx, gy, 10, gx, gy, 250 * game.s);
    aura.addColorStop(0, game.boss.phase === 2 ? `rgba(226, 103, 77, ${pulse * 0.65})` : `rgba(90, 195, 181, ${pulse * 0.46})`);
    aura.addColorStop(0.55, game.boss.phase === 2 ? 'rgba(146, 55, 48, 0.035)' : 'rgba(46, 122, 121, 0.03)');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(gx - 260 * game.s, gy - 260 * game.s, 520 * game.s, 520 * game.s);
    ctx.restore();

    const fogY = floor - h * 0.06;
    for (let i = 0; i < 3; i++) {
      const dir = i % 2 ? 1 : -1;
      const x = (t * (8 + i * 4) * dir + w * (0.1 + i * 0.4)) % (w * 1.4) - w * 0.2;
      const grad = ctx.createRadialGradient(x, fogY - i * 18, 10, x, fogY - i * 18, w * 0.4);
      const color = i === 1 ? '75, 143, 140' : '116, 184, 175';
      grad.addColorStop(0, `rgba(${color}, ${0.035 - i * 0.006})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, fogY - h * 0.14, w, h * 0.24);
    }
  }

  drawStars(ctx, game, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      const a = s.a * (0.55 + Math.sin(t * 0.5 + s.p) * 0.45);
      ctx.fillStyle = `rgba(179, 241, 230, ${a * 0.5})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    for (const d of this.farDust) {
      const y = ((d.y - t * d.vy) % (game.floor - 20) + (game.floor - 20)) % (game.floor - 20);
      ctx.fillStyle = `rgba(170, 232, 222, ${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x + Math.sin(t * 0.2 + d.p) * 6, y, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawArenaDust(ctx, game, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of game.ambientDust) {
      const x = d.x * this.w + Math.sin(t * 0.25 + d.p) * 14 * d.z;
      const y = d.y * this.h;
      if (y > game.floor) continue;
      const a = (0.08 + d.z * 0.12) * (0.5 + Math.sin(t * 0.8 + d.p) * 0.5);
      ctx.fillStyle = `rgba(165, 240, 227, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, d.s * d.z, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawShadows(ctx, game) {
    const p = game.player;
    const b = game.boss;
    const s = game.s;
    ctx.save();
    const pAlpha = p.dead ? Math.max(0, 0.3 - p.deathTimer * 0.2) : 0.32;
    ctx.fillStyle = `rgba(0, 0, 0, ${pAlpha})`;
    ctx.beginPath();
    ctx.ellipse(p.x, game.floor + 2, 25 * s, 6 * s, 0, 0, TAU);
    ctx.fill();
    const bAlpha = b.state === 'dead' ? Math.max(0, 0.42 - b.deathTimer * 0.25) : 0.48;
    const bw = b.state === 'leap' ? 40 * s : 80 * s;
    ctx.fillStyle = `rgba(0, 0, 0, ${bAlpha})`;
    ctx.beginPath();
    ctx.ellipse(b.x, game.floor + 3, bw, 10 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawTelegraphs(ctx, game, t) {
    const s = game.s;
    for (const tel of game.telegraphs) {
      const fade = clamp(tel.life / tel.maxLife, 0, 1);
      const pulse = 0.55 + Math.sin(t * 13) * 0.25;
      if (tel.type === 'rain') {
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, 0, game.floor);
        grad.addColorStop(0, 'rgba(255, 139, 103, 0)');
        grad.addColorStop(0.7, `rgba(255, 145, 108, ${0.055 * pulse * fade})`);
        grad.addColorStop(1, `rgba(255, 177, 139, ${0.13 * pulse * fade})`);
        ctx.fillStyle = grad;
        ctx.fillRect(tel.x - 9 * s, 0, 18 * s, game.floor);
        ctx.strokeStyle = `rgba(255, 187, 153, ${0.22 * pulse * fade})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tel.x, 20 * s);
        ctx.lineTo(tel.x, game.floor - 8 * s);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(tel.x, game.floor + 1);
        ctx.scale(1, 0.25);
        ctx.strokeStyle = `rgba(255, 185, 125, ${0.30 * pulse * fade})`;
        ctx.lineWidth = 2 / 0.25 * 0.4 / s;
        ctx.beginPath();
        ctx.arc(0, 0, 34 * s, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([4 * s, 7 * s]);
        ctx.strokeStyle = `rgba(189, 244, 232, ${0.34 * fade})`;
        ctx.beginPath();
        ctx.arc(0, 0, 23 * s + Math.sin(t * 6) * 2 * s, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  drawAfterimages(ctx, game) {
    for (const a of game.afterimages) {
      const alpha = (a.life / a.maxLife) * a.alpha;
      if (a.kind === 'player') {
        this.drawPlayerSilhouette(ctx, game, a.x, a.y, a.facing, alpha, 1);
      } else {
        this.drawBossSilhouette(ctx, game, a.x, a.y, a.facing, alpha);
      }
    }
  }

  drawPlayerSilhouette(ctx, game, x, y, facing, alpha, scale = 1) {
    const s = game.s * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.fillStyle = `rgba(176, 249, 236, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(-10 * s, -30 * s);
    ctx.quadraticCurveTo(-18 * s, -12 * s, -14 * s, -2 * s);
    ctx.lineTo(-7 * s, -5 * s);
    ctx.lineTo(-2 * s, 0);
    ctx.lineTo(4 * s, -4 * s);
    ctx.lineTo(12 * s, -2 * s);
    ctx.quadraticCurveTo(17 * s, -15 * s, 10 * s, -32 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -46 * s, 9 * s, 11 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6 * s, -53 * s);
    ctx.quadraticCurveTo(-12 * s, -63 * s, -9 * s, -68 * s);
    ctx.lineTo(-3 * s, -56 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6 * s, -53 * s);
    ctx.quadraticCurveTo(12 * s, -63 * s, 9 * s, -68 * s);
    ctx.lineTo(3 * s, -56 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawBossSilhouette(ctx, game, x, y, facing, alpha) {
    const s = game.s;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.fillStyle = `rgba(255, 228, 197, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(-42 * s, -20 * s);
    ctx.quadraticCurveTo(-54 * s, -110 * s, -22 * s, -158 * s);
    ctx.quadraticCurveTo(-10 * s, -144 * s, 0, -158 * s);
    ctx.quadraticCurveTo(13 * s, -143 * s, 25 * s, -160 * s);
    ctx.quadraticCurveTo(54 * s, -106 * s, 44 * s, -18 * s);
    ctx.lineTo(20 * s, -5 * s);
    ctx.lineTo(-15 * s, -6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -190 * s, 27 * s, 30 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-18 * s, -210 * s);
    ctx.quadraticCurveTo(-32 * s, -240 * s, -46 * s, -256 * s);
    ctx.lineTo(-17 * s, -224 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18 * s, -210 * s);
    ctx.quadraticCurveTo(35 * s, -242 * s, 47 * s, -258 * s);
    ctx.lineTo(17 * s, -224 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, game, t) {
    const p = game.player;
    const s = game.s;
    if (p.dead && game.state !== 'dying' && game.state !== 'defeat') return;
    let alpha = 1;
    if (p.invuln > 0 && Math.floor(t * 26) % 2 === 0 && p.hurtFlash <= 0) alpha = 0.38;
    if (p.dead) alpha = clamp(1 - p.deathTimer / 1.1, 0, 1);
    if (alpha <= 0.01) return;

    const bob = p.onGround ? Math.sin(t * 4.3) * 1.2 * s : 0;
    const squash = 1 - p.landSquash * 0.13;
    const stretch = 1 + p.landSquash * 0.08;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y + bob);
    ctx.scale(p.facing, 1);
    if (p.focusing) {
      const f = clamp(p.focusTime / 0.82, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const aura = ctx.createRadialGradient(0, -26 * s, 2, 0, -26 * s, (48 + f * 38) * s);
      aura.addColorStop(0, `rgba(207, 255, 246, ${0.14 + f * 0.18})`);
      aura.addColorStop(0.55, `rgba(109, 235, 216, ${0.06 + f * 0.08})`);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(-100 * s, -120 * s, 200 * s, 200 * s);
      ctx.strokeStyle = `rgba(192, 255, 244, ${0.14 + f * 0.28})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, -26 * s, (22 + i * 10 + f * 14) * s, (9 + i * 5 + f * 6) * s, t * (0.8 + i * 0.3), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    const trailing = clamp(-p.vx / (300 * s), -1, 1);
    ctx.save();
    ctx.scale(1, squash);
    ctx.translate(0, 0);
    this.drawCloakRibbons(ctx, s, t, trailing, p);
    this.drawKnightBody(ctx, s, t, p, false);
    ctx.restore();

    this.drawNail(ctx, s, t, p);
    ctx.restore();
  }

  drawCloakRibbons(ctx, s, t, trailing, p) {
    const flutter = Math.sin(t * 7.3) * 3 + Math.sin(t * 13.1) * 1.2;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 11, 15, 0.92)';
    ctx.strokeStyle = 'rgba(123, 219, 205, 0.16)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const y = -24 * s + i * 8 * s;
      const len = (14 + i * 5) * s;
      const dir = -1;
      ctx.beginPath();
      ctx.moveTo(-8 * s, y);
      ctx.quadraticCurveTo(
        (-8 + dir * (6 + i * 5) + trailing * 4) * s,
        y + 8 * s + flutter,
        (-9 + dir * (12 + i * 6) + trailing * 10) * s,
        y + len + flutter * 1.2
      );
      ctx.lineTo((-4 + dir * (8 + i * 4) + trailing * 7) * s, y + len - 3 * s + flutter);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawKnightBody(ctx, s, t, p, ghost) {
    const breathe = Math.sin(t * 3.1) * 0.5;
    ctx.save();
    ctx.translate(0, breathe);

    ctx.strokeStyle = ghost ? 'rgba(220,255,248,0.25)' : 'rgba(2, 9, 12, 1)';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5 * s, -13 * s);
    ctx.lineTo(-6 * s, -3 * s);
    ctx.lineTo(-9 * s, 0);
    ctx.moveTo(5 * s, -13 * s);
    ctx.lineTo(7 * s, -3 * s);
    ctx.lineTo(10 * s, 0);
    ctx.stroke();

    const body = ctx.createLinearGradient(-14 * s, -30 * s, 14 * s, -8 * s);
    body.addColorStop(0, '#071016');
    body.addColorStop(0.55, '#0a171c');
    body.addColorStop(1, '#03090c');
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(115, 209, 196, 0.27)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9 * s, -35 * s);
    ctx.quadraticCurveTo(-16 * s, -24 * s, -14 * s, -7 * s);
    ctx.lineTo(-10 * s, -10 * s);
    ctx.lineTo(-7 * s, -3 * s);
    ctx.lineTo(-2 * s, -8 * s);
    ctx.lineTo(2 * s, -3 * s);
    ctx.lineTo(7 * s, -9 * s);
    ctx.lineTo(11 * s, -4 * s);
    ctx.lineTo(14 * s, -8 * s);
    ctx.quadraticCurveTo(16 * s, -25 * s, 9 * s, -35 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(153, 231, 217, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -29 * s);
    ctx.quadraticCurveTo(-10 * s, -16 * s, -7 * s, -8 * s);
    ctx.stroke();

    ctx.fillStyle = '#071116';
    ctx.beginPath();
    ctx.ellipse(-2 * s, -37 * s, 12 * s, 8 * s, -0.12, 0, TAU);
    ctx.fill();

    const mask = ctx.createLinearGradient(-9 * s, -54 * s, 10 * s, -36 * s);
    mask.addColorStop(0, '#f2fbf3');
    mask.addColorStop(0.46, '#dcebe2');
    mask.addColorStop(1, '#9fb9b2');
    ctx.fillStyle = mask;
    ctx.strokeStyle = 'rgba(239, 255, 248, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -34 * s);
    ctx.quadraticCurveTo(-10 * s, -38 * s, -9.5 * s, -49 * s);
    ctx.quadraticCurveTo(-8 * s, -57 * s, 0, -58 * s);
    ctx.quadraticCurveTo(8 * s, -57 * s, 9.5 * s, -49 * s);
    ctx.quadraticCurveTo(10 * s, -38 * s, 0, -34 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#d7ebe2';
    ctx.lineWidth = 2.4 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7 * s, -53 * s);
    ctx.quadraticCurveTo(-14 * s, -63 * s, -11 * s, -72 * s);
    ctx.moveTo(7 * s, -53 * s);
    ctx.quadraticCurveTo(14 * s, -63 * s, 11 * s, -72 * s);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(123, 190, 181, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7 * s, -53 * s);
    ctx.quadraticCurveTo(-12 * s, -61 * s, -10 * s, -68 * s);
    ctx.moveTo(7 * s, -53 * s);
    ctx.quadraticCurveTo(12 * s, -61 * s, 10 * s, -68 * s);
    ctx.stroke();

    ctx.fillStyle = '#071014';
    ctx.beginPath();
    ctx.ellipse(-3.4 * s, -47 * s, 2 * s, 3.2 * s, -0.18, 0, TAU);
    ctx.ellipse(3.4 * s, -47 * s, 2 * s, 3.2 * s, 0.18, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 22, 26, 0.72)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -42 * s);
    ctx.lineTo(-1 * s, -38 * s);
    ctx.stroke();

    ctx.fillStyle = 'rgba(224, 248, 240, 0.12)';
    ctx.beginPath();
    ctx.ellipse(-5 * s, -51 * s, 3 * s, 1.2 * s, -0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawNail(ctx, s, t, p) {
    const atk = p.attackTimer > 0;
    const progress = atk ? 1 - p.attackTimer / 0.24 : 0;
    let x1 = 8 * s, y1 = -27 * s;
    let x2 = 27 * s, y2 = -35 * s;
    let width = 1.7 * s;
    if (atk) {
      width = 2.1 * s;
      if (p.attackDir === 'up') {
        x1 = 1 * s; y1 = -54 * s;
        x2 = 2 * s; y2 = (-54 - 61 * Math.sin(progress * Math.PI * 0.75 + 0.4)) * s;
      } else if (p.attackDir === 'down') {
        x1 = 1 * s; y1 = -20 * s;
        x2 = 4 * s; y2 = (-20 + 64 * Math.sin(progress * Math.PI * 0.7 + 0.3)) * s;
      } else {
        x1 = 8 * s; y1 = -27 * s;
        x2 = (24 + 58 * Math.sin(progress * Math.PI * 0.75 + 0.3)) * s;
        y2 = (-32 - 6 * Math.sin(progress * Math.PI)) * s;
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(190, 255, 243, 0.75)';
    ctx.shadowBlur = atk ? 10 : 4;
    ctx.strokeStyle = 'rgba(56, 82, 80, 0.9)';
    ctx.lineWidth = width + 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, '#98aaa5');
    grad.addColorStop(0.7, '#e1f4ec');
    grad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(235, 255, 250, 0.92)';
    ctx.beginPath();
    ctx.arc(x2, y2, width * 0.9, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawBoss(ctx, game, t) {
    const b = game.boss;
    const s = game.s;
    if (b.state === 'dead' && b.deathTimer > 1.5) return;
    let alpha = 1;
    if (b.state === 'dead') alpha = clamp(1 - Math.max(0, b.deathTimer - 0.5) / 1.1, 0, 1);
    if (alpha <= 0.01) return;

    const phase2 = b.phase === 2;
    let crouch = 0;
    let lean = 0;
    let hover = 0;
    if (b.state === 'lungeWind' || b.state === 'leapWind') crouch = 1;
    if (b.state === 'slam' || b.state === 'stagger') crouch = 0.9;
    if (b.state === 'lunge') lean = 0.22;
    if (b.state === 'leap') hover = 1;
    if (b.state === 'volleyWind' || b.state === 'rainWind') hover = 0.7;
    if (b.state === 'phase') hover = 0.9;
    if (b.state === 'awaken') lean = -0.08;
    const bob = Math.sin(t * 1.8) * 2.2 * s + b.hover;
    const easeCrouch = crouch * 13 * s;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, b.y + bob + easeCrouch);
    ctx.scale(b.facing, 1);

    const glowSize = phase2 ? 240 : 180;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(0, -110 * s, 12, 0, -110 * s, glowSize * s);
    aura.addColorStop(0, phase2 ? 'rgba(255, 119, 86, 0.11)' : 'rgba(103, 211, 196, 0.08)');
    aura.addColorStop(0.55, phase2 ? 'rgba(162, 55, 44, 0.035)' : 'rgba(60, 143, 139, 0.025)');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(-glowSize * s, -110 * s - glowSize * s, glowSize * 2 * s, glowSize * 2 * s);
    ctx.restore();

    ctx.save();
    ctx.rotate(lean);
    this.drawBossCape(ctx, s, t, b, phase2);
    this.drawBossLegs(ctx, s, t, b, crouch);
    this.drawBossTorso(ctx, s, t, b, phase2, crouch);
    this.drawBossHead(ctx, s, t, b, phase2, crouch);
    this.drawBossArms(ctx, s, t, b, phase2, crouch);
    ctx.restore();

    if (b.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(b.hitFlash * 4.5, 0, 0.72);
      ctx.fillStyle = phase2 ? '#ffd2c0' : '#f4fff9';
      ctx.beginPath();
      ctx.moveTo(-42 * s, -20 * s);
      ctx.quadraticCurveTo(-56 * s, -112 * s, -24 * s, -160 * s);
      ctx.quadraticCurveTo(-10 * s, -145 * s, 0, -160 * s);
      ctx.quadraticCurveTo(13 * s, -143 * s, 26 * s, -161 * s);
      ctx.quadraticCurveTo(55 * s, -108 * s, 44 * s, -18 * s);
      ctx.lineTo(20 * s, -5 * s);
      ctx.lineTo(-15 * s, -6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -188 * s, 28 * s, 31 * s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    if (b.state === 'phase' || phase2) this.drawPhaseAura(ctx, game, b, t);
  }

  drawBossCape(ctx, s, t, b, phase2) {
    const flutter = Math.sin(t * 4.6) * 5 + Math.sin(t * 9.1) * 2;
    const rush = b.state === 'lunge' ? 16 : 0;
    ctx.save();
    ctx.fillStyle = phase2 ? 'rgba(8, 5, 7, 0.98)' : 'rgba(3, 9, 12, 0.98)';
    ctx.strokeStyle = phase2 ? 'rgba(185, 73, 55, 0.30)' : 'rgba(82, 167, 157, 0.24)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-26 * s, -154 * s);
    ctx.bezierCurveTo((-76 - rush) * s, -126 * s, (-70 + flutter) * s, -73 * s, (-54 + flutter + rush) * s, -8 * s);
    ctx.lineTo((-45 + flutter * 0.35) * s, -34 * s);
    ctx.lineTo((-32 + flutter * 0.25) * s, -2 * s);
    ctx.lineTo((-17 + flutter * 0.2) * s, -36 * s);
    ctx.lineTo((-3 + flutter * 0.25) * s, -5 * s);
    ctx.lineTo((13 + flutter * 0.2) * s, -35 * s);
    ctx.lineTo((27 + flutter * 0.3) * s, -3 * s);
    ctx.lineTo((40 + flutter * 0.35) * s, -38 * s);
    ctx.lineTo((57 + flutter * 0.4) * s, -6 * s);
    ctx.lineTo((66 + flutter * 0.6) * s, -27 * s);
    ctx.bezierCurveTo((75 + flutter) * s, -82 * s, (62 - rush) * s, -126 * s, 32 * s, -154 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = phase2 ? 'rgba(20, 9, 11, 0.8)' : 'rgba(9, 23, 27, 0.72)';
    ctx.beginPath();
    ctx.moveTo(-22 * s, -150 * s);
    ctx.quadraticCurveTo(-52 * s, -112 * s, (-38 + flutter * 0.4) * s, -24 * s);
    ctx.lineTo((-27 + flutter * 0.2) * s, -43 * s);
    ctx.lineTo((-15 + flutter * 0.15) * s, -18 * s);
    ctx.lineTo((0 + flutter * 0.15) * s, -46 * s);
    ctx.lineTo((16 + flutter * 0.2) * s, -17 * s);
    ctx.lineTo((31 + flutter * 0.25) * s, -42 * s);
    ctx.lineTo((44 + flutter * 0.3) * s, -20 * s);
    ctx.quadraticCurveTo((57 + flutter * 0.4) * s, -99 * s, 27 * s, -150 * s);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = phase2 ? 'rgba(195, 88, 62, 0.2)' : 'rgba(118, 199, 185, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x = (-50 + i * 24 + flutter * 0.15) * s;
      ctx.beginPath();
      ctx.moveTo(x, -138 * s);
      ctx.quadraticCurveTo(x + Math.sin(t * 2 + i) * 6 * s, -72 * s, x + Math.sin(t * 1.5 + i) * 9 * s, -26 * s);
      ctx.stroke();
    }

    const tendril = (x, len, sway) => {
      ctx.beginPath();
      ctx.moveTo(x * s, -15 * s);
      ctx.bezierCurveTo((x + sway) * s, -2 * s, (x + sway * 2 + 8) * s, (len - 26) * s, (x + sway * 3 - 8) * s, len * s);
      ctx.strokeStyle = phase2 ? 'rgba(145, 56, 43, 0.35)' : 'rgba(79, 163, 153, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };
    tendril(-50, 18, 5);
    tendril(-61, 11, -2);
    tendril(50, 16, -4);
    tendril(61, 9, 3);

    ctx.fillStyle = phase2 ? 'rgba(132, 48, 39, 0.5)' : 'rgba(91, 169, 158, 0.34)';
    for (let i = 0; i < 3; i++) {
      const ang = t * (0.28 + i * 0.1) + i * 2.1;
      const x = Math.cos(ang) * (75 + i * 8) * s;
      const y = -112 * s + Math.sin(ang) * 32 * s;
      ctx.beginPath();
      ctx.arc(x, y, (1 + i * 0.3) * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBossLegs(ctx, s, t, b, crouch) {
    const step = Math.sin(t * 2.4) * 2;
    ctx.save();
    ctx.strokeStyle = '#03090c';
    ctx.lineWidth = 7 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16 * s, -80 * s);
    ctx.quadraticCurveTo(-30 * s, -44 * s - crouch * 4 * s, -32 * s, -8 * s);
    ctx.lineTo(-40 * s, -2 * s);
    ctx.moveTo(16 * s, -80 * s);
    ctx.quadraticCurveTo(30 * s, -44 * s - crouch * 4 * s, 32 * s, -8 * s);
    ctx.lineTo(40 * s, -2 * s);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(135, 210, 198, 0.13)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-20 * s, -66 * s);
    ctx.quadraticCurveTo(-31 * s, -36 * s, -33 * s, -9 * s);
    ctx.moveTo(20 * s, -66 * s);
    ctx.quadraticCurveTo(31 * s, -36 * s, 33 * s, -9 * s);
    ctx.stroke();
    ctx.fillStyle = '#03090c';
    ctx.beginPath();
    ctx.ellipse(-38 * s, -1 * s, 12 * s, 4 * s, -0.1, 0, TAU);
    ctx.ellipse(38 * s, -1 * s, 12 * s, 4 * s, 0.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawBossTorso(ctx, s, t, b, phase2, crouch) {
    const breathe = Math.sin(t * 1.9) * 1.6;
    ctx.save();
    ctx.translate(0, breathe);

    const body = ctx.createLinearGradient(-42 * s, -156 * s, 44 * s, -28 * s);
    body.addColorStop(0, phase2 ? '#1a0b0d' : '#071317');
    body.addColorStop(0.42, phase2 ? '#0b0608' : '#061014');
    body.addColorStop(0.7, phase2 ? '#0c080a' : '#07161a');
    body.addColorStop(1, '#020609');
    ctx.fillStyle = body;
    ctx.strokeStyle = phase2 ? 'rgba(215, 105, 78, 0.32)' : 'rgba(102, 195, 181, 0.27)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-27 * s, -158 * s);
    ctx.quadraticCurveTo(-47 * s, -130 * s, -40 * s, -91 * s);
    ctx.quadraticCurveTo(-35 * s, -60 * s, -25 * s, -39 * s);
    ctx.lineTo(-13 * s, -49 * s);
    ctx.lineTo(-3 * s, -33 * s);
    ctx.lineTo(8 * s, -50 * s);
    ctx.lineTo(22 * s, -36 * s);
    ctx.quadraticCurveTo(37 * s, -65 * s, 41 * s, -102 * s);
    ctx.quadraticCurveTo(44 * s, -136 * s, 28 * s, -158 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = phase2 ? 'rgba(24, 11, 12, 0.95)' : 'rgba(6, 17, 21, 0.96)';
    ctx.strokeStyle = phase2 ? 'rgba(226, 126, 97, 0.28)' : 'rgba(137, 221, 207, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-33 * s, -154 * s);
    for (let i = 0; i < 9; i++) {
      const t0 = i / 8;
      const x = lerp(-33, 35, t0) * s;
      const y = (-154 - Math.sin(t0 * Math.PI) * 16 - (i % 2 ? 10 : 2)) * s;
      ctx.lineTo(x - 2 * s, y + 10 * s);
      ctx.lineTo(x + 1.5 * s, (-148 - Math.sin(t0 * Math.PI) * 5) * s);
    }
    ctx.lineTo(33 * s, -154 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = phase2 ? 'rgba(255, 151, 118, 0.26)' : 'rgba(168, 242, 228, 0.22)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 4; i++) {
      const y = (-132 + i * 15) * s;
      ctx.beginPath();
      ctx.moveTo((-23 + i * 2.4) * s, y);
      ctx.quadraticCurveTo(0, (y + 13 * s), (27 - i * 3.1) * s, y - 3 * s);
      ctx.stroke();
      ctx.strokeStyle = phase2 ? 'rgba(255, 151, 118, 0.11)' : 'rgba(168, 242, 228, 0.08)';
      ctx.beginPath();
      ctx.moveTo((-18 + i) * s, y + 5 * s);
      ctx.quadraticCurveTo(0, y + 17 * s, (21 - i) * s, y + 3 * s);
      ctx.stroke();
      ctx.strokeStyle = phase2 ? 'rgba(255, 151, 118, 0.26)' : 'rgba(168, 242, 228, 0.22)';
    }

    const crack = ctx.createLinearGradient(0, -140 * s, 0, -68 * s);
    crack.addColorStop(0, phase2 ? 'rgba(255, 129, 91, 0.0)' : 'rgba(155, 255, 237, 0.0)');
    crack.addColorStop(0.5, phase2 ? 'rgba(255, 129, 91, 0.7)' : 'rgba(155, 255, 237, 0.55)');
    crack.addColorStop(1, phase2 ? 'rgba(255, 129, 91, 0.0)' : 'rgba(155, 255, 237, 0.0)');
    ctx.strokeStyle = crack;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(2 * s, -139 * s);
    ctx.lineTo(-3 * s, -124 * s);
    ctx.lineTo(4 * s, -109 * s);
    ctx.lineTo(-1 * s, -94 * s);
    ctx.lineTo(3 * s, -78 * s);
    ctx.stroke();
    ctx.strokeStyle = phase2 ? 'rgba(255, 178, 144, 0.85)' : 'rgba(205, 255, 245, 0.72)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(2 * s, -139 * s);
    ctx.lineTo(-3 * s, -124 * s);
    ctx.lineTo(4 * s, -109 * s);
    ctx.lineTo(-1 * s, -94 * s);
    ctx.lineTo(3 * s, -78 * s);
    ctx.stroke();

    const shoulder = (side) => {
      ctx.save();
      ctx.scale(side, 1);
      const plate = ctx.createLinearGradient(22 * s, -162 * s, 49 * s, -132 * s);
      plate.addColorStop(0, phase2 ? '#5a2924' : '#334d4c');
      plate.addColorStop(0.6, phase2 ? '#2a1214' : '#173034');
      plate.addColorStop(1, '#050d10');
      ctx.fillStyle = plate;
      ctx.strokeStyle = phase2 ? 'rgba(231, 122, 92, 0.36)' : 'rgba(152, 225, 213, 0.3)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(17 * s, -158 * s);
      ctx.quadraticCurveTo(34 * s, -169 * s, 49 * s, -149 * s);
      ctx.lineTo(55 * s, -134 * s);
      ctx.lineTo(42 * s, -129 * s);
      ctx.lineTo(41 * s, -145 * s);
      ctx.lineTo(28 * s, -138 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = phase2 ? 'rgba(255, 167, 132, 0.36)' : 'rgba(201, 255, 244, 0.32)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(23 * s, -157 * s);
      ctx.quadraticCurveTo(36 * s, -163 * s, 48 * s, -148 * s);
      ctx.stroke();
      ctx.restore();
    };
    shoulder(-1);
    shoulder(1);

    ctx.fillStyle = 'rgba(5, 13, 16, 0.95)';
    ctx.beginPath();
    ctx.ellipse(1 * s, -86 * s, 17 * s, 21 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = phase2 ? 'rgba(229, 114, 85, 0.34)' : 'rgba(152, 233, 218, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = phase2 ? 'rgba(91, 27, 25, 0.8)' : 'rgba(16, 50, 52, 0.75)';
    ctx.beginPath();
    ctx.ellipse(1 * s, -86 * s, 8 * s, 12 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = phase2 ? 'rgba(255, 164, 127, 0.48)' : 'rgba(179, 255, 240, 0.32)';
    ctx.beginPath();
    ctx.ellipse(1 * s, -86 * s, 8 * s, 12 * s, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawBossHead(ctx, s, t, b, phase2, crouch) {
    const tilt = b.state === 'stagger' ? 0.32 : (b.state === 'lunge' ? 0.1 : Math.sin(t * 1.6) * 0.025);
    const drop = b.state === 'stagger' ? 17 * s : (crouch ? 7 * s : 0);
    ctx.save();
    ctx.translate(0, drop);
    ctx.rotate(tilt);

    const horn = (side, big) => {
      ctx.save();
      ctx.scale(side, 1);
      const grad = ctx.createLinearGradient(18 * s, -210 * s, 64 * s, (big ? -270 : -250) * s);
      grad.addColorStop(0, phase2 ? '#3b1c19' : '#1e3436');
      grad.addColorStop(0.5, phase2 ? '#95604f' : '#8ba49d');
      grad.addColorStop(1, phase2 ? '#edb198' : '#d8e7df');
      ctx.fillStyle = grad;
      ctx.strokeStyle = phase2 ? 'rgba(255, 176, 143, 0.45)' : 'rgba(221, 248, 240, 0.42)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (big) {
        ctx.moveTo(12 * s, -211 * s);
        ctx.bezierCurveTo(3 * s, -238 * s, 26 * s, -262 * s, 57 * s, (side > 0 ? -267 : -262) * s);
        ctx.quadraticCurveTo(66 * s, -263 * s, 64 * s, -255 * s);
        ctx.bezierCurveTo(44 * s, -240 * s, 30 * s, -226 * s, 26 * s, -211 * s);
      } else {
        ctx.moveTo(20 * s, -218 * s);
        ctx.bezierCurveTo(25 * s, -228 * s, 35 * s, -232 * s, 47 * s, -232 * s);
        ctx.lineTo(42 * s, -227 * s);
        ctx.lineTo(49 * s, -224 * s);
        ctx.bezierCurveTo(38 * s, -222 * s, 30 * s, -220 * s, 28 * s, -215 * s);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = phase2 ? 'rgba(84, 32, 27, 0.7)' : 'rgba(49, 74, 70, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (big) {
        ctx.moveTo(20 * s, -215 * s);
        ctx.bezierCurveTo(16 * s, -237 * s, 34 * s, -251 * s, 57 * s, -257 * s);
      } else {
        ctx.moveTo(25 * s, -219 * s);
        ctx.bezierCurveTo(29 * s, -225 * s, 36 * s, -227 * s, 45 * s, -227 * s);
      }
      ctx.stroke();
      ctx.restore();
    };
    horn(-1, true);
    horn(1, true);
    horn(-1, false);
    horn(1, false);

    ctx.fillStyle = phase2 ? '#b8806c' : '#a9c1b8';
    ctx.strokeStyle = phase2 ? 'rgba(255, 185, 150, 0.4)' : 'rgba(219, 248, 239, 0.36)';
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      const x = i * 7.4 * s;
      const hgt = (14 - Math.abs(i) * 2.2) * s;
      ctx.beginPath();
      ctx.moveTo(x - 2.2 * s, -228 * s);
      ctx.lineTo(x + i * 0.8 * s, -228 * s - hgt);
      ctx.lineTo(x + 2.2 * s, -228 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.strokeStyle = phase2 ? 'rgba(158, 82, 63, 0.8)' : 'rgba(74, 121, 113, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-23 * s, -224 * s);
    ctx.lineTo(-28 * s, -237 * s);
    ctx.lineTo(-23 * s, -246 * s);
    ctx.moveTo(23 * s, -224 * s);
    ctx.lineTo(28 * s, -237 * s);
    ctx.lineTo(23 * s, -246 * s);
    ctx.stroke();

    ctx.save();
    ctx.scale(0.86, 1);
    ctx.fillStyle = '#061014';
    ctx.beginPath();
    ctx.ellipse(0, -187 * s, 33 * s, 36 * s, 0.02, 0, TAU);
    ctx.fill();

    const mask = ctx.createLinearGradient(-28 * s, -228 * s, 29 * s, -154 * s);
    mask.addColorStop(0, '#f4f8ee');
    mask.addColorStop(0.34, '#dde9e0');
    mask.addColorStop(0.68, '#afc2ba');
    mask.addColorStop(1, '#617571');
    ctx.fillStyle = mask;
    ctx.strokeStyle = 'rgba(247, 255, 250, 0.48)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -150 * s);
    ctx.bezierCurveTo(-19 * s, -158 * s, -30 * s, -181 * s, -30 * s, -199 * s);
    ctx.quadraticCurveTo(-29 * s, -216 * s, -20 * s, -226 * s);
    ctx.quadraticCurveTo(-10 * s, -234 * s, 0, -234 * s);
    ctx.quadraticCurveTo(10 * s, -234 * s, 20 * s, -226 * s);
    ctx.quadraticCurveTo(29 * s, -216 * s, 30 * s, -199 * s);
    ctx.bezierCurveTo(30 * s, -181 * s, 19 * s, -158 * s, 0, -150 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(111, 137, 131, 0.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-19 * s, -222 * s);
    ctx.quadraticCurveTo(-24 * s, -200 * s, -19 * s, -177 * s);
    ctx.moveTo(19 * s, -222 * s);
    ctx.quadraticCurveTo(24 * s, -200 * s, 19 * s, -177 * s);
    ctx.stroke();

    const eye = (x, y, rot, scale) => {
      ctx.save();
      ctx.translate(x * s, y * s);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(9, 16, 19, 0.96)';
      ctx.beginPath();
      ctx.moveTo(-7 * s, 0);
      ctx.quadraticCurveTo(-2 * s, -6 * s, 7 * s, -1 * s);
      ctx.quadraticCurveTo(2 * s, 5 * s, -7 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    eye(-12, -194, -0.10, 1);
    eye(12, -194, 0.10, 1);
    eye(-19, -207, -0.22, 0.58);
    eye(19, -207, 0.22, 0.58);

    const eyePulse = b.state === 'phase' ? 1 : (0.72 + Math.sin(t * 7) * 0.18);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const eyeColor = phase2 ? '255, 128, 86' : '255, 192, 111';
    const eyeGlow = ctx.createRadialGradient(0, -197 * s, 2, 0, -197 * s, 38 * s);
    eyeGlow.addColorStop(0, `rgba(${eyeColor}, ${0.34 * eyePulse})`);
    eyeGlow.addColorStop(0.55, `rgba(${eyeColor}, ${0.08 * eyePulse})`);
    eyeGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eyeGlow;
    ctx.fillRect(-52 * s, -235 * s, 104 * s, 86 * s);
    ctx.fillStyle = `rgba(${eyeColor}, ${0.98 * eyePulse})`;
    ctx.beginPath();
    ctx.ellipse(-12 * s, -194.4 * s, 2.1 * s, 3.7 * s, -0.1, 0, TAU);
    ctx.ellipse(12 * s, -194.4 * s, 2.1 * s, 3.7 * s, 0.1, 0, TAU);
    ctx.ellipse(-19 * s, -207 * s, 1.1 * s, 2.1 * s, -0.22, 0, TAU);
    ctx.ellipse(19 * s, -207 * s, 1.1 * s, 2.1 * s, 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(71, 93, 90, 0.72)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-17 * s, -180 * s);
    ctx.lineTo(-5 * s, -175 * s);
    ctx.lineTo(0, -181 * s);
    ctx.lineTo(5 * s, -175 * s);
    ctx.lineTo(17 * s, -180 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -170 * s);
    ctx.lineTo(-1.5 * s, -160 * s);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(98, 126, 121, 0.58)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-11 * s, -220 * s);
    ctx.lineTo(-7 * s, -214 * s);
    ctx.moveTo(12 * s, -222 * s);
    ctx.lineTo(8 * s, -216 * s);
    ctx.stroke();

    if (phase2) {
      ctx.strokeStyle = 'rgba(97, 32, 29, 0.9)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-8 * s, -231 * s);
      ctx.lineTo(-13 * s, -218 * s);
      ctx.lineTo(-10 * s, -207 * s);
      ctx.lineTo(-14 * s, -196 * s);
      ctx.moveTo(16 * s, -226 * s);
      ctx.lineTo(11 * s, -213 * s);
      ctx.lineTo(17 * s, -202 * s);
      ctx.moveTo(-2 * s, -153 * s);
      ctx.lineTo(0, -168 * s);
      ctx.lineTo(3 * s, -181 * s);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  drawBossArms(ctx, s, t, b, phase2, crouch) {
    const state = b.state;

    ctx.save();
    ctx.strokeStyle = '#030a0d';
    ctx.lineWidth = 5.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30 * s, -147 * s);
    ctx.quadraticCurveTo(-45 * s, -123 * s, -51 * s, -93 * s);
    ctx.quadraticCurveTo(-54 * s, -77 * s, -48 * s, -66 * s);
    ctx.stroke();
    ctx.strokeStyle = phase2 ? 'rgba(212, 101, 75, 0.32)' : 'rgba(93, 178, 166, 0.23)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-31 * s, -147 * s);
    ctx.quadraticCurveTo(-43 * s, -123 * s, -48 * s, -92 * s);
    ctx.stroke();
    const clawX = state === 'volleyWind' || state === 'rainWind' ? -58 * s : -49 * s;
    const clawY = state === 'volleyWind' || state === 'rainWind' ? -121 * s : -65 * s;
    ctx.strokeStyle = phase2 ? '#f3b39b' : '#c6ded6';
    ctx.lineWidth = 1.6 * s;
    for (let i = 0; i < 3; i++) {
      const a = -0.45 + i * 0.3;
      ctx.beginPath();
      ctx.moveTo(clawX, clawY);
      ctx.lineTo(clawX + Math.cos(a + Math.PI * 0.8) * 17 * s, clawY + Math.sin(a + Math.PI * 0.8) * 17 * s);
      ctx.stroke();
    }
    ctx.restore();

    let handX = 27 * s;
    let handY = -112 * s;
    let elbowX = 42 * s;
    let elbowY = -128 * s;
    if (state === 'lungeWind') { handX = 10 * s; handY = -106 * s; elbowX = 27 * s; elbowY = -136 * s; }
    if (state === 'lunge') { handX = 57 * s; handY = -120 * s; elbowX = 58 * s; elbowY = -137 * s; }
    if (state === 'leapWind') { handX = -19 * s; handY = -88 * s; elbowX = -39 * s; elbowY = -110 * s; }
    if (state === 'leap') { handX = -29 * s; handY = -133 * s; elbowX = -49 * s; elbowY = -143 * s; }
    if (state === 'volleyWind' || state === 'rainWind') { handX = 2 * s; handY = -181 * s; elbowX = 32 * s; elbowY = -158 * s; }
    if (state === 'spikeWind') { handX = 5 * s; handY = -228 * s; elbowX = 33 * s; elbowY = -180 * s; }
    if (state === 'stagger') { handX = 22 * s; handY = -58 * s; elbowX = 39 * s; elbowY = -101 * s; }

    ctx.save();
    ctx.strokeStyle = '#040b0e';
    ctx.lineWidth = 8.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(32 * s, -145 * s);
    ctx.quadraticCurveTo(elbowX, elbowY, handX, handY);
    ctx.stroke();
    ctx.strokeStyle = phase2 ? 'rgba(208, 96, 70, 0.35)' : 'rgba(91, 173, 162, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(34 * s, -148 * s);
    ctx.quadraticCurveTo(elbowX + 2 * s, elbowY, handX, handY);
    ctx.stroke();

    ctx.fillStyle = '#081417';
    ctx.beginPath();
    ctx.arc(handX, handY, 7 * s, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = phase2 ? 'rgba(255, 152, 119, 0.55)' : 'rgba(158, 237, 223, 0.4)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    let nx1 = handX;
    let ny1 = handY;
    let nx2 = 146 * s;
    let ny2 = -30 * s;
    if (state === 'lungeWind') { nx2 = -84 * s; ny2 = -82 * s; }
    if (state === 'lunge') { nx2 = 220 * s; ny2 = -86 * s; }
    if (state === 'leapWind') { nx2 = -84 * s; ny2 = -35 * s; }
    if (state === 'leap') { nx2 = -100 * s; ny2 = -150 * s; }
    if (state === 'volleyWind' || state === 'rainWind') { nx2 = 49 * s; ny2 = -276 * s; }
    if (state === 'spikeWind') { nx2 = 19 * s; ny2 = -314 * s; }
    if (state === 'stagger') { nx2 = 86 * s; ny2 = -13 * s; }
    if (state === 'phase') { nx2 = 164 * s; ny2 = -152 * s; }
    if (state === 'slam') { nx2 = 174 * s; ny2 = -31 * s; }

    const ang = Math.atan2(ny2 - ny1, nx2 - nx1);
    const len = Math.hypot(nx2 - nx1, ny2 - ny1);
    ctx.translate(nx1, ny1);
    ctx.rotate(ang);
    ctx.lineCap = 'round';

    ctx.fillStyle = '#071115';
    ctx.strokeStyle = phase2 ? 'rgba(255, 172, 140, 0.32)' : 'rgba(179, 239, 227, 0.26)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-24 * s, -3.5 * s);
    ctx.lineTo(2 * s, -4.5 * s);
    ctx.lineTo(8 * s, -8 * s);
    ctx.lineTo(len, -1.6 * s);
    ctx.lineTo(len + 9 * s, 0);
    ctx.lineTo(len, 1.6 * s);
    ctx.lineTo(8 * s, 8 * s);
    ctx.lineTo(2 * s, 4.5 * s);
    ctx.lineTo(-24 * s, 3.5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const blade = ctx.createLinearGradient(0, 0, len, 0);
    blade.addColorStop(0, phase2 ? '#7d4a3f' : '#677a76');
    blade.addColorStop(0.28, phase2 ? '#deb096' : '#c7ded6');
    blade.addColorStop(0.72, phase2 ? '#ffd9c1' : '#ecfff8');
    blade.addColorStop(1, '#ffffff');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(4 * s, -5.4 * s);
    ctx.lineTo(len, -1.3 * s);
    ctx.lineTo(len + 8 * s, 0);
    ctx.lineTo(len, 1.3 * s);
    ctx.lineTo(4 * s, 5.4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(10 * s, -1.1 * s);
    ctx.lineTo(len - 3 * s, 0);
    ctx.stroke();

    ctx.fillStyle = '#1b2b2d';
    ctx.fillRect(-25 * s, -3.6 * s, 28 * s, 7.2 * s);
    ctx.strokeStyle = phase2 ? 'rgba(255, 188, 154, 0.5)' : 'rgba(181, 237, 225, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((-22 + i * 6) * s, -3.4 * s);
      ctx.lineTo((-19 + i * 6) * s, 3.4 * s);
      ctx.stroke();
    }
    ctx.strokeStyle = phase2 ? '#e7b299' : '#d4e7df';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(2 * s, -9 * s);
    ctx.lineTo(7 * s, 9 * s);
    ctx.stroke();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = phase2 ? 'rgba(255, 136, 91, 0.55)' : 'rgba(173, 255, 240, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12 * s, -2 * s);
    ctx.lineTo(len - 2 * s, 0);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  drawPhaseAura(ctx, game, b, t) {
    if (b.state === 'dead') return;
    const s = game.s;
    const phase2 = b.phase === 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const p = (t * (0.2 + i * 0.08) + i * 0.33) % 1;
      ctx.strokeStyle = `rgba(${phase2 ? '255, 126, 88' : '140, 255, 236'}, ${0.11 * (1 - p)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(b.x, b.chestY, (60 + p * 90) * s, (24 + p * 44) * s, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawShockwaves(ctx, game) {
    for (const s of game.shockwaves) {
      const frac = clamp(s.life / s.maxLife, 0, 1);
      const alpha = Math.min(1, frac * 3.2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const x = s.x;
      const y = game.floor;
      const wdt = s.width * 1.7;
      const height = s.height * (0.8 + Math.sin(game.time * 18 + x) * 0.08);
      const grad = ctx.createLinearGradient(x, y - height, x, y);
      grad.addColorStop(0, `rgba(255, 246, 214, 0)`);
      grad.addColorStop(0.55, `rgba(255, 219, 159, ${0.35 * alpha})`);
      grad.addColorStop(1, `rgba(174, 255, 240, ${0.1 * alpha})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - wdt, y);
      ctx.quadraticCurveTo(x - wdt * 0.4, y - height * 0.55, x, y - height);
      ctx.quadraticCurveTo(x + wdt * 0.4, y - height * 0.55, x + wdt, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 233, 184, ${0.45 * alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - wdt * 0.7, y);
      ctx.quadraticCurveTo(x - wdt * 0.25, y - height * 0.62, x, y - height);
      ctx.quadraticCurveTo(x + wdt * 0.25, y - height * 0.62, x + wdt * 0.7, y);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSpikes(ctx, game) {
    for (const sp of game.spikes) {
      const t = sp.t - sp.delay;
      if (t < 0) continue;
      const rise = clamp(t / 0.14, 0, 1);
      const fall = clmap01((sp.life - sp.t) / 0.2);
      const amount = Math.min(rise, fall);
      if (amount <= 0) continue;
      const h = sp.height * amount;
      const w = sp.width;
      const x = sp.x;
      const y = game.floor + 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const baseGlow = ctx.createRadialGradient(x, y - 8, 2, x, y - 8, 55 * game.s);
      baseGlow.addColorStop(0, 'rgba(159, 255, 237, 0.16)');
      baseGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = baseGlow;
      ctx.fillRect(x - 60 * game.s, y - 80 * game.s, 120 * game.s, 90 * game.s);
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      const grad = ctx.createLinearGradient(0, 0, 0, -h);
      grad.addColorStop(0, '#142f32');
      grad.addColorStop(0.5, '#a8cfc5');
      grad.addColorStop(1, '#effff9');
      ctx.fillStyle = grad;
      const shapes = [
        { ox: 0, w: w * 0.6, h: h * 1.00 },
        { ox: -w * 0.55, w: w * 0.38, h: h * 0.68 },
        { ox: w * 0.5, w: w * 0.34, h: h * 0.54 },
        { ox: -w * 0.2, w: w * 0.28, h: h * 0.8 },
        { ox: w * 0.22, w: w * 0.24, h: h * 0.66 }
      ];
      for (const sh of shapes) {
        ctx.beginPath();
        ctx.moveTo(sh.ox - sh.w, 0);
        ctx.lineTo(sh.ox + Math.sin(sh.ox) * 2, -sh.h);
        ctx.lineTo(sh.ox + sh.w, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(230, 255, 249, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-w * 0.6, 0);
      ctx.lineTo(0, -h);
      ctx.lineTo(w * 0.5, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawProjectiles(ctx, game, t) {
    for (const p of game.projectiles) {
      if (p.kind === 'nail') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(-90 * game.s, 0, 12 * game.s, 0);
        grad.addColorStop(0, 'rgba(255, 183, 135, 0)');
        grad.addColorStop(0.7, 'rgba(255, 190, 145, 0.24)');
        grad.addColorStop(1, 'rgba(255, 251, 230, 0.85)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3 * game.s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-95 * game.s, 0);
        ctx.lineTo(14 * game.s, 0);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 251, 232, 0.95)';
        ctx.beginPath();
        ctx.moveTo(18 * game.s, 0);
        ctx.lineTo(2 * game.s, -6 * game.s);
        ctx.lineTo(-5 * game.s, 0);
        ctx.lineTo(2 * game.s, 6 * game.s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }
      const phase2 = p.phase === 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 44 * game.s);
      halo.addColorStop(0, phase2 ? 'rgba(255, 221, 188, 0.8)' : 'rgba(224, 255, 247, 0.82)');
      halo.addColorStop(0.22, phase2 ? 'rgba(255, 109, 72, 0.45)' : 'rgba(112, 242, 223, 0.42)');
      halo.addColorStop(0.7, phase2 ? 'rgba(170, 49, 38, 0.09)' : 'rgba(44, 144, 137, 0.08)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(-46 * game.s, -46 * game.s, 92 * game.s, 92 * game.s);
      ctx.rotate(p.spin);
      ctx.strokeStyle = phase2 ? 'rgba(255, 178, 143, 0.85)' : 'rgba(196, 255, 245, 0.9)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = phase2 ? 'rgba(255, 115, 80, 0.5)' : 'rgba(98, 223, 209, 0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 1.8, 0.4, 2.1);
      ctx.stroke();
      ctx.fillStyle = phase2 ? '#ffd1b6' : '#eafff9';
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 0.45, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  drawRings(ctx, game) {
    for (const r of game.rings) {
      const p = clamp(1 - r.life / r.maxLife, 0, 1);
      if (r.slash) {
        this.drawSlashArc(ctx, game, r, p);
        continue;
      }
      const radius = r.maxR * easeOutCubic(p);
      const alpha = (1 - p) * 0.75;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(1, r.yScale);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(r.color, alpha);
      ctx.lineWidth = r.width * (1 - p * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      if (p < 0.55) {
        ctx.strokeStyle = rgba(r.color, alpha * 0.35);
        ctx.lineWidth = r.width * 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.82, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawSlashArc(ctx, game, r, p) {
    const s = game.s;
    const alpha = Math.sin(Math.min(1, p * 1.6) * Math.PI * 0.5) * (1 - p) * 0.95;
    const radius = r.maxR * (0.66 + p * 0.6);
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.scale(r.facing, 1);
    ctx.rotate(r.dir === 'up' ? -Math.PI / 2 : r.dir === 'down' ? Math.PI / 2 : 0);
    ctx.globalCompositeOperation = 'lighter';
    const spread = r.boss ? 1.05 : 0.92;
    for (let i = 0; i < 3; i++) {
      const rr = radius * (1 - i * 0.11);
      ctx.strokeStyle = rgba(r.color, alpha * (0.95 - i * 0.24));
      ctx.lineWidth = (r.width * (1 - i * 0.20)) * (1 - p * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, rr, -spread + p * 0.28, spread + p * 0.2);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(r.color, alpha * 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.06, -spread * 0.7, spread * 0.8);
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const a = -spread + (i + 0.5) / 4 * spread * 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      ctx.fillStyle = rgba(r.color, alpha * 0.75);
      ctx.beginPath();
      ctx.arc(x, y, (r.boss ? 2.2 : 1.3) * s * (1 - p * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles(ctx, game) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of game.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1) * p.alpha;
      if (p.type === 'spark' || p.type === 'soul') {
        const r = p.size * (0.7 + a * 0.5);
        if (p.glow) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
          g.addColorStop(0, rgba(p.color, a));
          g.addColorStop(0.4, rgba(p.color, a * 0.3));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - r * 4, p.y - r * 4, r * 8, r * 8);
        }
        ctx.fillStyle = rgba(p.color, a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      } else if (p.type === 'debris') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = rgba(p.color, a * 0.65);
        ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
        ctx.restore();
      } else {
        ctx.fillStyle = rgba(p.color, a * 0.55);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.3 - a * 0.4), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawForeground(ctx, game, t) {
    const w = this.w;
    const h = this.h;
    const floor = game.floor;
    ctx.save();
    ctx.globalAlpha = 0.28;
    const fog = ctx.createLinearGradient(0, floor - h * 0.09, 0, h);
    fog.addColorStop(0, 'rgba(8, 27, 32, 0)');
    fog.addColorStop(0.4, 'rgba(8, 27, 32, 0.24)');
    fog.addColorStop(1, 'rgba(2, 8, 11, 0.5)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, floor - h * 0.09, w, h - floor + h * 0.09);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(2, 8, 10, 0.92)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    const vine = (x, y, len, dir, sway, phase) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + dir * len * 0.12 + Math.sin(t * 0.5 + phase) * sway,
        y + len * 0.3,
        x - dir * len * 0.08 + Math.cos(t * 0.4 + phase) * sway,
        y + len * 0.7,
        x + dir * len * 0.2 + Math.sin(t * 0.6 + phase) * sway,
        y + len
      );
      ctx.stroke();
    };
    vine(w * 0.012, -4, h * 0.28, 1, 13, 0.2);
    vine(w * 0.045, -8, h * 0.18, 1, 9, 1.7);
    vine(w * 0.975, -5, h * 0.31, -1, 14, 2.4);
    vine(w * 0.95, -2, h * 0.2, -1, 8, 0.9);
    ctx.restore();

    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.30, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.7, 'rgba(0,0,0,0.14)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    if (this.noisePattern) {
      ctx.save();
      ctx.globalAlpha = 0.035;
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  drawScreenEffects(ctx, game, t) {
    if (game.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(224, 255, 246, ${game.flash * 0.42})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    const p = game.player;
    if (p.hurtFlash > 0) {
      const a = clamp(p.hurtFlash / 0.42, 0, 1);
      const grad = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.24, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
      grad.addColorStop(0, 'rgba(100, 20, 18, 0)');
      grad.addColorStop(1, `rgba(122, 30, 28, ${0.34 * a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    const low = clamp((1.6 - p.hp) / 1.6, 0, 1);
    if (low > 0 && game.state === 'playing') {
      const pulse = 0.05 + Math.sin(t * 4.2) * 0.025;
      const grad = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.34, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72);
      grad.addColorStop(0, 'rgba(90, 12, 10, 0)');
      grad.addColorStop(1, `rgba(108, 20, 18, ${(low * pulse)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    if (game.boss.state === 'phase') {
      const a = clamp(1 - game.boss.stateTime / 1.65, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(236, 104, 73, ${0.08 * a})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
  }
}

function clmap01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
