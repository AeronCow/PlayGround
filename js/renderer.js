import { TAU, clamp, lerp, rand, mulberry32 } from './utils.js';

/* ============================================================
   IRON DAWN — cinematic canvas renderer
   All art is procedural: no external sprites or textures.
   ============================================================ */

const HORIZON = 620;

function roundedPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.dpr = 1;
    this.scale = 1;
    this.viewW = 1280;
    this.viewH = 720;
    this.offsetX = 0;
    this.offsetY = 0;
    this.cssW = 1280;
    this.cssH = 720;
    this.backdrop = null;
    this.backdropId = -1;
    this.rainSeeds = Array.from({ length: 150 }, () => ({
      x: Math.random(), y: Math.random(), s: rand(0.7, 1.3), a: rand(0.16, 0.5)
    }));
    this.ashSeeds = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(), s: rand(0.4, 1.4), a: rand(0.08, 0.32), p: rand(0.4, 1.8)
    }));
    this.emberSeeds = Array.from({ length: 65 }, () => ({
      x: Math.random(), y: Math.random(), s: rand(0.7, 2.1), a: rand(0.2, 0.7), p: rand(0.6, 2)
    }));
    this.moteSeeds = Array.from({ length: 50 }, () => ({
      x: Math.random(), y: Math.random(), s: rand(0.6, 2.2), a: rand(0.07, 0.25), p: rand(0.3, 1.3)
    }));
  }

  resize() {
    const cssW = Math.max(320, window.innerWidth);
    const cssH = Math.max(320, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    if (cssW >= cssH) {
      this.viewH = 720;
      this.scale = Math.min(cssH / 720, cssW / 1000);
      this.viewW = cssW / this.scale;
      this.offsetX = 0;
      this.offsetY = (cssH - this.viewH * this.scale) / 2;
    } else {
      this.viewW = 760;
      this.viewH = 720;
      this.scale = Math.min(cssW / 760, cssH / 720);
      this.offsetX = (cssW - this.viewW * this.scale) / 2;
      this.offsetY = (cssH - this.viewH * this.scale) / 2;
    }
    this.game.view = {
      w: this.viewW, h: this.viewH, scale: this.scale,
      offsetX: this.offsetX, offsetY: this.offsetY, cssW, cssH, dpr
    };
  }

  prepareLevel(level, force = false) {
    if (!force && this.backdropId === level.id && this.backdrop) return;
    this.backdropId = level.id;
    const rng = mulberry32(level.skylineSeed || 1);
    const theme = level.theme;
    const makeLayer = (count, minW, maxW, minH, maxH, gap, bottom, windows) => {
      const arr = [];
      let x = -300;
      for (let i = 0; i < count; i++) {
        const w = minW + rng() * (maxW - minW);
        const h = minH + rng() * (maxH - minH);
        const b = {
          x, w, h, bottom, damaged: rng() < 0.42,
          roof: rng(), antenna: rng() < 0.16,
          tone: rng(),
          windows: []
        };
        if (windows) {
          const cols = Math.max(1, Math.floor(w / 15));
          const rows = Math.max(1, Math.floor(h / 19));
          for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
              if (rng() < 0.23) {
                b.windows.push({
                  x: 6 + cx * ((w - 12) / cols),
                  y: 12 + cy * ((h - 20) / rows),
                  w: Math.max(2.2, (w - 12) / cols * 0.34),
                  h: Math.max(2, (h - 20) / rows * 0.28),
                  warm: rng() < 0.72,
                  flick: rng()
                });
              }
            }
          }
        }
        arr.push(b);
        x += w + gap * (0.4 + rng() * 1.1);
      }
      return arr;
    };
    const far = makeLayer(45, 38, 120, 65, 270, 15, HORIZON, false);
    const mid = makeLayer(38, 60, 180, 95, 360, 28, HORIZON + 5, true);
    const near = makeLayer(24, 90, 260, 50, 220, 60, HORIZON + 30, false);
    const smoke = [];
    for (let i = 0; i < 6; i++) {
      const b = mid[Math.floor(rng() * mid.length)] || mid[0];
      if (!b) break;
      smoke.push({
        x: b.x + b.w * (0.2 + rng() * 0.6), y: b.bottom - b.h - 8,
        s: 10 + rng() * 22, drift: rand(-12, 22), speed: rand(0.3, 0.8), phase: rng() * TAU
      });
    }
    const wires = [];
    for (let i = 0; i < 7; i++) {
      wires.push({
        x1: rng() * (level.width + 1200) - 200,
        x2: rng() * (level.width + 1200) - 200,
        y1: 180 + rng() * 210, y2: 180 + rng() * 210,
        sag: 30 + rng() * 75, alpha: 0.12 + rng() * 0.18
      });
    }
    const clouds = [];
    for (let i = 0; i < 11; i++) {
      clouds.push({
        x: rng() * 1.35 - 0.15, y: 0.04 + rng() * 0.38,
        w: 90 + rng() * 280, h: 12 + rng() * 30,
        a: 0.05 + rng() * 0.13, drift: rand(0.0008, 0.0035)
      });
    }
    const stars = [];
    if (theme.night) {
      for (let i = 0; i < 90; i++) {
        stars.push({ x: rng(), y: rng() * 0.5, s: rng() < 0.85 ? 1 : 1.8, p: rng() * TAU, a: 0.15 + rng() * 0.55 });
      }
    }
    const debris = [];
    for (let i = 0; i < 50; i++) {
      debris.push({
        x: rng() * (level.width + 1000) - 500,
        y: HORIZON + 10 + rng() * 80,
        s: 1 + rng() * 4, a: 0.08 + rng() * 0.22
      });
    }
    this.backdrop = { far, mid, near, smoke, wires, clouds, stars, debris };
  }

  render() {
    const g = this.game;
    const ctx = this.ctx;
    const d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#040708';
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.beginPath();
    ctx.rect(0, 0, this.viewW, this.viewH);
    ctx.clip();

    this.drawSky();
    this.drawBackdrop();

    const shakeX = g.camera.shake > 0 ? rand(-1, 1) * g.camera.shake : 0;
    const shakeY = g.camera.shake > 0 ? rand(-1, 1) * g.camera.shake : 0;
    ctx.save();
    ctx.translate(-g.camera.x + shakeX, -g.camera.y + shakeY);

    this.drawDecorations();
    this.drawPlatforms();
    this.drawDecals();
    if (g.level.exit) this.drawExtraction(g.level.exit);
    this.drawCheckpoints();
    this.drawHazards();
    this.drawPickups();
    this.drawDestructibles();
    this.drawEnemies();
    if (g.player && g.state !== 'gameover' && g.state !== 'victory') this.drawPlayer(g.player);
    this.drawGate();
    this.drawBullets();
    this.drawGrenades();
    this.drawEffects();
    this.drawParticles();
    this.drawFloatingTexts();
    ctx.restore();

    this.drawObjectiveMarker();
    this.drawWeather();
    this.drawPostFx();
    if ((g.state === 'playing' || g.state === 'paused') && !g.touchMode) this.drawCrosshair();
    ctx.restore();
  }

  /* ---------------------------------------------------------- */
  /* Sky and parallax                                            */
  /* ---------------------------------------------------------- */
  drawSky() {
    const ctx = this.ctx;
    const g = this.game;
    const t = g.level.theme;
    const w = this.viewW;
    const h = this.viewH;
    const cam = g.camera.x;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, t.skyTop);
    grad.addColorStop(0.47, t.skyMid);
    grad.addColorStop(0.86, t.skyBottom);
    grad.addColorStop(1, t.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (t.night) {
      for (const s of this.backdrop.stars) {
        const tw = 0.58 + Math.sin(g.animTime * 0.7 + s.p) * 0.42;
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = '#cfdfe6';
        ctx.fillRect((s.x * w - cam * 0.003) % w, s.y * h, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    const sunX = w * t.sunX - cam * 0.012;
    const sunY = h * t.sunY;
    const sunR = t.night ? 34 : 48;
    const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, sunR * 4.8);
    glow.addColorStop(0, t.sun);
    glow.addColorStop(0.127, t.night ? 'rgba(188,216,228,.4)' : 'rgba(255,225,172,.74)');
    glow.addColorStop(0.36, t.night ? 'rgba(118,160,181,.13)' : 'rgba(233,151,81,.2)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - sunR * 5, sunY - sunR * 5, sunR * 10, sunR * 10);
    ctx.fillStyle = t.sun;
    ctx.globalAlpha = t.night ? 0.66 : 0.93;
    ellipse(ctx, sunX, sunY, sunR, sunR);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (t.night) {
      ctx.fillStyle = t.skyTop;
      ellipse(ctx, sunX + 12, sunY - 6, sunR * 0.92, sunR * 0.92);
      ctx.fill();
    }

    for (const c of this.backdrop.clouds) {
      const x = ((c.x + g.animTime * c.drift * 0.008) % 1.35) * w - 100;
      ctx.globalAlpha = c.a;
      const cg = ctx.createLinearGradient(x - c.w / 2, 0, x + c.w / 2, 0);
      cg.addColorStop(0, 'rgba(255,255,255,0)');
      cg.addColorStop(0.35, t.haze);
      cg.addColorStop(0.65, t.haze);
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ellipse(ctx, x, c.y * h, c.w / 2, c.h, 0);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (!t.night) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) {
        const ang = -0.72 + i * 0.27;
        const x = sunX - Math.cos(ang) * 0 - cam * 0.01;
        ctx.globalAlpha = 0.028 + i * 0.008;
        ctx.fillStyle = '#ffe9b8';
        ctx.beginPath();
        ctx.moveTo(x, sunY);
        ctx.lineTo(x + Math.cos(ang) * 900 - 120, h + 80);
        ctx.lineTo(x + Math.cos(ang) * 900 + 5, h + 80);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const haze = ctx.createLinearGradient(0, HORIZON - 130, 0, h);
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(0.55, t.fog);
    haze.addColorStop(1, t.fog);
    ctx.fillStyle = haze;
    ctx.fillRect(0, HORIZON - 130, w, h - HORIZON + 130);
  }

  drawBackdrop() {
    const ctx = this.ctx;
    const g = this.game;
    const t = g.level.theme;
    const cam = g.camera.x;
    if (!this.backdrop) return;

    const drawLayer = (layer, factor, colorFar, colorNear, yOffset, alpha, windowed) => {
      const shift = cam * factor;
      const w = this.viewW;
      for (const b of layer) {
        const x = b.x - shift;
        if (x + b.w < -40 || x > w + 40) continue;
        const bottom = b.bottom + yOffset;
        const top = bottom - b.h;
        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, colorFar);
        grad.addColorStop(1, colorNear);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.fillRect(x, top, b.w, b.h);
        ctx.globalAlpha = 1;

        if (windowed) {
          for (const wnd of b.windows) {
            const flick = wnd.flick < 0.12 ? (Math.sin(g.animTime * 4 + wnd.flick * 40) > 0.2 ? 1 : 0.25) : 1;
            ctx.globalAlpha = alpha * (wnd.warm ? 0.6 : 0.35) * flick;
            ctx.fillStyle = wnd.warm ? t.window : '#7fa2ad';
            ctx.fillRect(x + wnd.x, top + wnd.y, wnd.w, wnd.h);
          }
          ctx.globalAlpha = 1;
        }

        if (b.damaged) {
          ctx.fillStyle = colorNear;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          const cut = b.w * (0.2 + b.tone * 0.35);
          ctx.moveTo(x + cut, top);
          ctx.lineTo(x + cut + 8, top + 10 + b.tone * 20);
          ctx.lineTo(x + cut + 2, top + 18 + b.tone * 16);
          ctx.lineTo(x + cut + 12, top + 28 + b.tone * 30);
          ctx.lineTo(x + b.w, top + 18);
          ctx.lineTo(x + b.w, top);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (b.antenna) {
          ctx.strokeStyle = colorNear;
          ctx.globalAlpha = alpha * 0.9;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + b.w * 0.65, top);
          ctx.lineTo(x + b.w * 0.65, top - 16 - b.tone * 30);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    };

    drawLayer(this.backdrop.far, 0.045, t.far, t.far, 6, 0.66, false);
    drawLayer(this.backdrop.mid, 0.145, t.mid, t.near, 4, 0.9, true);

    // smoke columns
    for (const s of this.backdrop.smoke) {
      const x = s.x - cam * 0.11;
      if (x < -180 || x > this.viewW + 180) continue;
      for (let i = 0; i < 8; i++) {
        const prog = ((g.animTime * s.speed + i * 0.18 + s.phase) % 1.4);
        const sx = x + Math.sin(prog * 5 + s.phase) * 14 + prog * s.drift;
        const sy = s.y - prog * 155;
        const r = s.s * (0.55 + prog * 2.2);
        const alpha = (1 - prog / 1.4) * 0.09;
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        sg.addColorStop(0, `rgba(54,56,54,${alpha})`);
        sg.addColorStop(0.6, `rgba(58,58,53,${alpha * 0.6})`);
        sg.addColorStop(1, 'rgba(30,30,28,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
    }

    // cables and wires
    ctx.save();
    ctx.strokeStyle = '#060a0b';
    for (const wire of this.backdrop.wires) {
      const x1 = wire.x1 - cam * 0.19;
      const x2 = wire.x2 - cam * 0.19;
      if ((x1 < -200 && x2 < -200) || (x1 > this.viewW + 200 && x2 > this.viewW + 200)) continue;
      ctx.globalAlpha = wire.alpha;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, wire.y1);
      ctx.quadraticCurveTo((x1 + x2) / 2, (wire.y1 + wire.y2) / 2 + wire.sag, x2, wire.y2);
      ctx.stroke();
    }
    ctx.restore();

    drawLayer(this.backdrop.near, 0.31, '#070b0c', '#0a0f10', 20, 0.82, false);

    // distant ground haze
    const fog = ctx.createLinearGradient(0, HORIZON - 18, 0, HORIZON + 70);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(1, t.fog);
    ctx.fillStyle = fog;
    ctx.fillRect(0, HORIZON - 18, this.viewW, 90);
  }

  /* ---------------------------------------------------------- */
  /* World decorations                                           */
  /* ---------------------------------------------------------- */
  drawDecorations() {
    const g = this.game;
    const theme = g.level.theme;
    const cam = g.camera.x;
    for (const d of g.level.decorations || []) {
      if (d.x < cam - 260 || d.x > cam + this.viewW + 260) continue;
      this.drawDecoration(d, theme, g.animTime);
    }
  }

  drawDecoration(d, theme, time) {
    const ctx = this.ctx;
    const x = d.x;
    const y = d.y;
    ctx.save();
    ctx.translate(x, y);
    switch (d.type) {
      case 'wreck':
      case 'car': {
        const wreck = d.type === 'wreck';
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = '#101617';
        ctx.beginPath();
        ctx.ellipse(0, 3, wreck ? 58 : 54, 8, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        const body = wreck ? '#2b2521' : '#28383a';
        const body2 = wreck ? '#45352b' : '#3c5254';
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(-52, -6);
        ctx.lineTo(-44, -28);
        ctx.lineTo(-12, -39);
        ctx.lineTo(12, -40);
        ctx.lineTo(39, -30);
        ctx.lineTo(49, -12);
        ctx.lineTo(52, -4);
        ctx.lineTo(48, 0);
        ctx.lineTo(-49, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = body2;
        ctx.beginPath();
        ctx.moveTo(-34, -25);
        ctx.lineTo(-16, -34);
        ctx.lineTo(2, -35);
        ctx.lineTo(4, -23);
        ctx.lineTo(-30, -22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = wreck ? '#171b1b' : '#152021';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(8, -35);
        ctx.lineTo(31, -27);
        ctx.lineTo(36, -14);
        ctx.lineTo(7, -16);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = wreck ? '#5b3b2a' : '#657774';
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-20, -6);
        ctx.lineTo(18, -10);
        ctx.moveTo(-33, -8);
        ctx.lineTo(-45, -16);
        ctx.stroke();
        ctx.globalAlpha = 1;
        for (const wx of [-33, 32]) {
          ctx.fillStyle = '#0b0e0e';
          ellipse(ctx, wx, -2, 10, 10);
          ctx.fill();
          ctx.fillStyle = '#2e3534';
          ellipse(ctx, wx, -2, 4.5, 4.5);
          ctx.fill();
        }
        if (wreck) {
          ctx.fillStyle = '#c76b37';
          ctx.globalAlpha = 0.22;
          ctx.fillRect(-48, -18, 16, 8);
          ctx.fillRect(20, -11, 19, 5);
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'sandbags': {
        const bag = '#67593f';
        const bagLight = '#7e6b4b';
        for (let row = 0; row < 3; row++) {
          const count = 4 - row;
          for (let i = 0; i < count; i++) {
            const bx = (i - count / 2) * 21 + row * 6;
            const by = -7 - row * 10;
            ctx.fillStyle = bag;
            ellipse(ctx, bx, by, 12, 7.3, (i % 2 ? -0.08 : 0.06));
            ctx.fill();
            ctx.strokeStyle = bagLight;
            ctx.globalAlpha = 0.22;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
        break;
      }
      case 'barrier': {
        const gr = ctx.createLinearGradient(0, -46, 0, 0);
        gr.addColorStop(0, '#7e7768');
        gr.addColorStop(1, '#3c3d37');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(-32, 0);
        ctx.lineTo(-28, -38);
        ctx.lineTo(28, -38);
        ctx.lineTo(32, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d0a959';
        ctx.globalAlpha = 0.55;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 13 - 4, -34);
          ctx.lineTo(i * 13 + 2, -34);
          ctx.lineTo(i * 13 + 9, -4);
          ctx.lineTo(i * 13 + 3, -4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(18,20,18,.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-18, -30);
        ctx.lineTo(-12, -15);
        ctx.lineTo(-16, -6);
        ctx.stroke();
        break;
      }
      case 'lamp': {
        ctx.fillStyle = '#171d1c';
        ctx.fillRect(-3, -118, 6, 118);
        ctx.fillStyle = '#232c2a';
        ctx.fillRect(-5, -4, 10, 4);
        ctx.beginPath();
        ctx.moveTo(0, -116);
        ctx.quadraticCurveTo(25, -123, 34, -108);
        ctx.lineTo(38, -100);
        ctx.lineTo(26, -99);
        ctx.lineTo(22, -107);
        ctx.lineTo(0, -108);
        ctx.closePath();
        ctx.fill();
        const flick = 0.72 + Math.sin(time * 2.4 + x) * 0.12 + (Math.sin(time * 19) > 0.95 ? -0.4 : 0);
        const glow = ctx.createRadialGradient(30, -101, 0, 30, -101, 95);
        glow.addColorStop(0, `rgba(255,207,130,${0.38 * flick})`);
        glow.addColorStop(0.3, `rgba(239,166,80,${0.1 * flick})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-65, -196, 190, 190);
        ctx.fillStyle = `rgba(255,229,181,${0.8 * flick})`;
        ctx.fillRect(24, -103, 12, 4);
        break;
      }
      case 'sign': {
        ctx.fillStyle = '#1a2020';
        ctx.fillRect(-2, -88, 4, 88);
        ctx.fillStyle = '#25312f';
        ctx.fillRect(-35, -92, 70, 30);
        ctx.strokeStyle = 'rgba(216,173,101,.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-35, -92, 70, 30);
        ctx.fillStyle = '#d8ad65';
        ctx.font = '700 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(d.text || 'EVAC →', 0, -73);
        ctx.textAlign = 'left';
        break;
      }
      case 'container': {
        const tones = {
          rust: ['#5e3528', '#7b4732'],
          green: ['#2c463b', '#3a5a4a'],
          blue: ['#293c46', '#38525d']
        };
        const [c1, c2] = tones[d.tone] || tones.rust;
        const gr = ctx.createLinearGradient(0, -84, 0, 0);
        gr.addColorStop(0, c2);
        gr.addColorStop(0.5, c1);
        gr.addColorStop(1, '#1a1e1d');
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = gr;
        ctx.fillRect(-96, -84, 192, 84);
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#0b0e0e';
        ctx.lineWidth = 2;
        for (let i = -88; i <= 88; i += 12) {
          ctx.beginPath();
          ctx.moveTo(i, -82);
          ctx.lineTo(i, -2);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = 'rgba(207,195,166,.22)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-96, -84, 192, 84);
        ctx.fillStyle = 'rgba(220,196,152,.28)';
        ctx.font = '700 8px "Courier New", monospace';
        ctx.fillText('VOLKOV LOGISTICS // 07', -84, -68);
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.fillRect(86, -82, 3, 80);
        ctx.globalAlpha = 1;
        break;
      }
      case 'pipe': {
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#4c4b41';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-55, -13);
        ctx.lineTo(55, -13);
        ctx.stroke();
        ctx.strokeStyle = '#2b2e2a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-55, -15);
        ctx.lineTo(55, -15);
        ctx.stroke();
        ctx.fillStyle = '#242823';
        ctx.fillRect(-42, -13, 5, 13);
        ctx.fillRect(28, -13, 5, 13);
        ctx.globalAlpha = 1;
        break;
      }
      case 'rubble': {
        ctx.globalAlpha = 0.85;
        const chunks = [[-42, -8, 20, 10], [-24, -16, 16, 14], [-6, -7, 26, 9], [20, -14, 19, 16], [38, -5, 16, 7]];
        for (let i = 0; i < chunks.length; i++) {
          const [cx, cy, cw, ch] = chunks[i];
          ctx.fillStyle = i % 2 ? '#3e3c35' : '#514c40';
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx + 2, cy);
          ctx.lineTo(cx + cw * 0.55, cy - ch * 0.4);
          ctx.lineTo(cx + cw, cy + 2);
          ctx.lineTo(cx + cw, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = '#8a6c45';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-15, -14);
        ctx.lineTo(4, -30);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'flag': {
        ctx.fillStyle = '#242a26';
        ctx.fillRect(-2, -146, 4, 146);
        ctx.strokeStyle = 'rgba(222,232,228,.24)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const wave = Math.sin(time * 2.4 + i * 0.8) * 4;
          ctx.beginPath();
          ctx.moveTo(2, -138 + i * 9);
          ctx.lineTo(35 + wave, -135 + i * 9);
          ctx.strokeStyle = i % 2 ? `${theme.accent}55` : 'rgba(213,226,222,.45)';
          ctx.stroke();
        }
        ctx.fillStyle = '#1b3f60';
        ctx.fillRect(2, -138, 15, 19);
        ctx.fillStyle = 'rgba(224,232,228,.55)';
        for (let i = 0; i < 3; i++) ctx.fillRect(4 + i * 4, -134, 1.5, 1.5);
        break;
      }
      case 'watchtower': {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#1a2020';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-26, 0);
        ctx.lineTo(-18, -118);
        ctx.moveTo(26, 0);
        ctx.lineTo(18, -118);
        ctx.stroke();
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const yy = -20 - i * 20;
          ctx.beginPath();
          ctx.moveTo(-24 + i * 1.5, yy);
          ctx.lineTo(24 - i * 1.5, yy - 20);
          ctx.moveTo(24 - i * 1.5, yy);
          ctx.lineTo(-24 + i * 1.5, yy - 20);
          ctx.stroke();
        }
        ctx.fillStyle = '#151b1b';
        ctx.fillRect(-30, -132, 60, 16);
        ctx.fillRect(-17, -148, 34, 16);
        ctx.fillStyle = 'rgba(255,176,100,.5)';
        ctx.fillRect(-8, -142, 16, 5);
        const beam = ctx.createLinearGradient(18, -136, 150, -90);
        beam.addColorStop(0, 'rgba(255,200,120,.13)');
        beam.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(18, -138);
        ctx.lineTo(155, -96);
        ctx.lineTo(145, -70);
        ctx.lineTo(15, -120);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'generator': {
        ctx.fillStyle = '#202724';
        ctx.fillRect(-25, -38, 50, 38);
        ctx.fillStyle = '#303b34';
        ctx.fillRect(-21, -34, 42, 12);
        ctx.strokeStyle = '#121716';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-17, -18 + i * 4);
          ctx.lineTo(15, -18 + i * 4);
          ctx.stroke();
        }
        const blink = Math.sin(time * 5.3 + x) > 0.3 ? 1 : 0.2;
        ctx.fillStyle = `rgba(224,80,56,${0.8 * blink})`;
        ctx.fillRect(17, -35, 4, 4);
        break;
      }
      case 'tank': {
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = '#3b3a33';
        ctx.fillRect(-48, -120, 96, 120);
        ctx.fillStyle = '#4a493f';
        ctx.fillRect(-44, -116, 88, 14);
        ctx.fillStyle = '#2b2e29';
        ctx.fillRect(-38, -98, 76, 62);
        ctx.strokeStyle = 'rgba(228,180,96,.24)';
        ctx.setLineDash([9, 7]);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-38, -40);
        ctx.lineTo(38, -40);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(16,20,19,.65)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-20, -108 + i * 10);
          ctx.lineTo(-20, -74 + i * 10);
          ctx.stroke();
        }
        ctx.fillStyle = '#212623';
        ctx.fillRect(-58, -8, 116, 8);
        ctx.globalAlpha = 1;
        break;
      }
      case 'crane': {
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = '#101718';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(-14, -180);
        ctx.moveTo(40, 0);
        ctx.lineTo(15, -180);
        ctx.moveTo(-14, -180);
        ctx.lineTo(120, -180);
        ctx.moveTo(-14, -180);
        ctx.lineTo(-12, -80);
        ctx.stroke();
        ctx.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
          ctx.beginPath();
          ctx.moveTo(-36 + i * 2.7, -i * 20);
          ctx.lineTo(36 - i * 2.7, -i * 20 - 18);
          ctx.stroke();
        }
        ctx.fillStyle = '#0d1314';
        ctx.fillRect(90, -183, 14, 11);
        ctx.strokeStyle = '#0d1314';
        ctx.beginPath();
        ctx.moveTo(97, -172);
        ctx.lineTo(97, -100);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------- */
  /* Platforms                                                  */
  /* ---------------------------------------------------------- */
  drawPlatforms() {
    const ctx = this.ctx;
    const g = this.game;
    const cam = g.camera.x;
    const theme = g.level.theme;
    for (const p of g.runtime.platforms) {
      if (p.x + p.w < cam - 60 || p.x > cam + this.viewW + 60) continue;
      this.drawPlatform(p, theme);
    }
  }

  drawPlatform(p, theme) {
    const ctx = this.ctx;
    const d = p.detail;
    if (p.kind === 'metal') {
      const gr = ctx.createLinearGradient(0, p.y, 0, p.y + Math.max(p.h, 34));
      gr.addColorStop(0, '#555a55');
      gr.addColorStop(0.18, '#343b39');
      gr.addColorStop(1, '#171c1c');
      ctx.fillStyle = gr;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#767d73';
      ctx.fillRect(p.x, p.y, p.w, 3);
      ctx.fillStyle = 'rgba(219,177,99,.38)';
      ctx.fillRect(p.x, p.y + 3, p.w, 1);
      ctx.fillStyle = 'rgba(11,14,14,.7)';
      for (let i = 14; i < p.w - 10; i += 28) ctx.fillRect(p.x + i, p.y + 7, 2, p.h - 7);
      // hazard plates
      for (let i = 10; i < p.w - 24; i += 72) {
        ctx.fillStyle = 'rgba(205,158,77,.22)';
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x + i, p.y + p.h - 9, 34, 4);
        ctx.clip();
        ctx.fillRect(p.x + i, p.y + p.h - 9, 34, 4);
        ctx.fillStyle = 'rgba(12,14,12,.5)';
        for (let k = -2; k < 6; k++) {
          ctx.save();
          ctx.translate(p.x + i + k * 10, p.y + p.h - 9);
          ctx.rotate(-0.5);
          ctx.fillRect(0, 0, 4, 12);
          ctx.restore();
        }
        ctx.restore();
      }
      if (d) {
        ctx.strokeStyle = 'rgba(230,236,226,.16)';
        ctx.lineWidth = 1;
        for (const bolt of d.bolts) {
          ctx.beginPath();
          ctx.arc(bolt.x, bolt.y, 1.1, 0, TAU);
          ctx.stroke();
        }
      }
    } else if (p.kind === 'ground') {
      const gr = ctx.createLinearGradient(0, p.y, 0, p.y + 110);
      gr.addColorStop(0, theme.groundTop);
      gr.addColorStop(0.08, '#565046');
      gr.addColorStop(0.32, theme.groundBase);
      gr.addColorStop(1, theme.groundDeep);
      ctx.fillStyle = gr;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(234,217,178,.3)';
      ctx.fillRect(p.x, p.y, p.w, 2);
      ctx.fillStyle = 'rgba(28,31,29,.38)';
      for (let i = 8; i < p.w; i += 78) ctx.fillRect(p.x + i, p.y + 8, 1, 30);
      // pavement seams
      ctx.strokeStyle = 'rgba(24,27,25,.3)';
      ctx.lineWidth = 1;
      for (let i = 70; i < p.w; i += 110) {
        ctx.beginPath();
        ctx.moveTo(p.x + i, p.y + 4);
        ctx.lineTo(p.x + i + 3, p.y + 18);
        ctx.stroke();
      }
      if (d) {
        ctx.strokeStyle = 'rgba(15,18,17,.38)';
        for (const crack of d.cracks) {
          ctx.beginPath();
          ctx.moveTo(p.x + crack.x, p.y + crack.y);
          ctx.lineTo(p.x + crack.x + crack.dx, p.y + crack.y + crack.dy);
          ctx.lineTo(p.x + crack.x + crack.dx * 1.5, p.y + crack.y + crack.dy * 1.8);
          ctx.stroke();
        }
        for (const stain of d.stains) {
          ctx.fillStyle = `rgba(18,17,15,${stain.a})`;
          ellipse(ctx, p.x + stain.x, p.y + stain.y, stain.w, stain.h);
          ctx.fill();
        }
      }
      // rebar sticking out at exposed ends
      if (d && d.rebar) {
        ctx.strokeStyle = '#8a5e35';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(p.x + p.w - 2, p.y + 16 + i * 10);
          ctx.lineTo(p.x + p.w + 8 + i * 2, p.y + 11 + i * 10);
          ctx.stroke();
        }
      }
    } else {
      const gr = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
      gr.addColorStop(0, '#6b6659');
      gr.addColorStop(0.2, '#4a4740');
      gr.addColorStop(1, '#202421');
      ctx.fillStyle = gr;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#938977';
      ctx.fillRect(p.x, p.y, p.w, 3);
      ctx.strokeStyle = 'rgba(28,30,27,.35)';
      for (let i = 60; i < p.w; i += 60) {
        ctx.beginPath();
        ctx.moveTo(p.x + i, p.y + 4);
        ctx.lineTo(p.x + i, p.y + p.h);
        ctx.stroke();
      }
    }

    // top edge glint
    ctx.fillStyle = `rgba(${theme.accentRGB},.18)`;
    ctx.fillRect(p.x + 2, p.y - 1, p.w - 4, 1);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(p.x, p.y + Math.min(6, p.h), p.w, 2);
  }

  /* ---------------------------------------------------------- */
  /* Decals, hazards, extraction                                */
  /* ---------------------------------------------------------- */
  drawDecals() {
    const ctx = this.ctx;
    for (const d of this.game.runtime.decals) {
      const alpha = clamp(d.life / d.maxLife, 0, 1);
      if (d.type === 'blood') {
        ctx.globalAlpha = alpha * 0.38;
        ctx.fillStyle = '#5d1814';
        ellipse(ctx, d.x, d.y, d.size, d.size * 0.55, d.angle);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.24;
        ellipse(ctx, d.x + d.size * 0.4, d.y + 2, d.size * 0.35, d.size * 0.2);
        ctx.fill();
      } else {
        ctx.globalAlpha = alpha * 0.62;
        ctx.fillStyle = '#0a0c0c';
        ellipse(ctx, d.x, d.y, d.size * 0.5, d.size * 0.36, d.angle);
        ctx.fill();
        ctx.strokeStyle = 'rgba(10,12,12,.36)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.size * 0.8, d.y - d.size * 0.6);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawHazards() {
    const ctx = this.ctx;
    const g = this.game;
    for (const h of g.runtime.hazards) {
      if (h.x < g.camera.x - 120 || h.x > g.camera.x + this.viewW + 120) continue;
      if (h.type === 'fire') {
        const pulse = 0.8 + Math.sin(g.animTime * 9 + h.x) * 0.18;
        const baseY = h.y + h.h;
        ctx.fillStyle = '#30201a';
        ctx.fillRect(h.x - 5, baseY - 5, h.w + 10, 7);
        ctx.fillStyle = 'rgba(230,180,85,.22)';
        ctx.fillRect(h.x - 5, baseY - 5, h.w + 10, 1);
        const glow = ctx.createRadialGradient(h.x + h.w / 2, baseY - 25, 0, h.x + h.w / 2, baseY - 25, 85);
        glow.addColorStop(0, 'rgba(255,121,42,.18)');
        glow.addColorStop(1, 'rgba(255,121,42,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(h.x - 60, baseY - 110, h.w + 120, 150);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const fx = h.x + h.w * (0.15 + i * 0.18) + Math.sin(g.animTime * 11 + i) * 4;
          const fh = h.h * (0.48 + i * 0.1) * pulse;
          const grad = ctx.createLinearGradient(fx, baseY, fx, baseY - fh);
          grad.addColorStop(0, 'rgba(255,97,25,.62)');
          grad.addColorStop(0.5, 'rgba(255,165,48,.48)');
          grad.addColorStop(1, 'rgba(255,235,150,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(fx - 8, baseY - 2);
          ctx.quadraticCurveTo(fx - 16 + Math.sin(g.animTime * 6 + i) * 4, baseY - fh * 0.62, fx + Math.sin(g.animTime * 4 + i) * 3, baseY - fh);
          ctx.quadraticCurveTo(fx + 13 + Math.sin(g.animTime * 5 + i) * 4, baseY - fh * 0.56, fx + 8, baseY - 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (h.type === 'electric') {
        const pulse = 0.5 + Math.sin(g.animTime * 14 + h.x) * 0.5;
        ctx.fillStyle = '#272d2a';
        ctx.fillRect(h.x - 6, h.y + h.h - 5, h.w + 12, 5);
        ctx.fillStyle = '#7e8b84';
        ctx.fillRect(h.x, h.y + 8, h.w, 2);
        ctx.fillStyle = 'rgba(139,215,232,.32)';
        ctx.fillRect(h.x, h.y + 8, h.w, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(137,224,242,${0.35 + pulse * 0.5})`;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(h.x + 4, h.y + h.h - 6);
          let xx = h.x + 4;
          let yy = h.y + h.h - 6;
          for (let k = 0; k < 4; k++) {
            xx += 12 + Math.sin(g.animTime * 20 + i * 8 + k) * 7;
            yy -= 7;
            ctx.lineTo(xx, yy);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  drawExtraction(exit) {
    const ctx = this.ctx;
    const g = this.game;
    if (exit.x < g.camera.x - 200 || exit.x > g.camera.x + this.viewW + 200) return;
    const x = exit.x + exit.w / 2;
    const base = 620;
    const t = g.animTime;
    const dist = Math.abs(g.player ? g.player.x - exit.x : 999);
    const intensity = clamp(1 - dist / 520, 0.25, 1);
    ctx.save();
    const glow = ctx.createRadialGradient(x, base - 40, 0, x, base - 40, 135);
    glow.addColorStop(0, `rgba(115,220,152,${0.14 * intensity})`);
    glow.addColorStop(1, 'rgba(115,220,152,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 145, base - 185, 290, 220);
    ctx.strokeStyle = `rgba(138,231,164,${0.18 + intensity * 0.22})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ellipse(ctx, x, base - 3, 58, 15);
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = (t * 0.65) % 1;
    ctx.strokeStyle = `rgba(144,237,170,${(1 - pulse) * 0.36 * intensity})`;
    ctx.lineWidth = 2;
    ellipse(ctx, x, base - 4, 18 + pulse * 50, 5 + pulse * 12);
    ctx.stroke();
    // smoke
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const prog = (t * 0.19 + i * 0.16) % 1;
      const sx = x + Math.sin(prog * 7 + i * 2) * 14;
      const sy = base - 24 - prog * 150;
      const r = 10 + prog * 30;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      sg.addColorStop(0, `rgba(115,220,152,${0.1 * (1 - prog)})`);
      sg.addColorStop(1, 'rgba(115,220,152,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.restore();
    // beacon mast
    ctx.fillStyle = '#1c2321';
    ctx.fillRect(x - 2, base - 118, 4, 118);
    ctx.fillStyle = '#2e3a34';
    ctx.fillRect(x - 12, base - 119, 24, 4);
    const blink = Math.sin(t * 5) > 0.2 ? 1 : 0.2;
    ctx.fillStyle = `rgba(137,235,164,${blink})`;
    ctx.fillRect(x - 4, base - 126, 8, 8);
    ctx.strokeStyle = `rgba(137,235,164,${0.28 * blink})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, base - 126);
    ctx.lineTo(x - 18, base - 148);
    ctx.moveTo(x, base - 126);
    ctx.lineTo(x + 18, base - 148);
    ctx.stroke();
    ctx.fillStyle = 'rgba(183,235,194,.56)';
    ctx.font = '700 8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LZ // EVAC', x, base - 154);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ---------------------------------------------------------- */
  /* Entities                                                   */
  /* ---------------------------------------------------------- */
  drawCheckpoints() {
    const ctx = this.ctx;
    const g = this.game;
    for (const c of g.runtime.checkpoints) {
      if (c.x < g.camera.x - 90 || c.x > g.camera.x + this.viewW + 90) continue;
      const pulse = 0.5 + Math.sin(g.animTime * 3 + c.seed) * 0.5;
      const tint = c.active ? '#9fd9a0' : '#d7b26d';
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ellipse(ctx, 0, 1, 23, 4);
      ctx.fill();
      // field crate base
      ctx.fillStyle = c.active ? '#2e4034' : '#3a352a';
      ctx.fillRect(-18, -26, 36, 26);
      ctx.strokeStyle = c.active ? '#6f9a75' : '#776b51';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-18, -26, 36, 26);
      ctx.fillStyle = tint;
      ctx.fillRect(-2, -21, 4, 16);
      ctx.fillRect(-8, -15, 16, 4);
      // beacon pole + cloth
      ctx.strokeStyle = c.active ? '#7d8b76' : '#756b58';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, -26);
      ctx.lineTo(-12, -86);
      ctx.stroke();
      ctx.fillStyle = c.active ? `rgba(159,217,160,${0.66 + pulse * 0.3})` : 'rgba(215,178,109,.38)';
      ctx.beginPath();
      ctx.moveTo(-11, -84);
      ctx.lineTo(24, -75);
      ctx.lineTo(-11, -62);
      ctx.closePath();
      ctx.fill();
      // beacon light
      const glow = ctx.createRadialGradient(-12, -90, 0, -12, -90, 26);
      glow.addColorStop(0, c.active ? `rgba(159,217,160,${0.28 + pulse * 0.28})` : 'rgba(215,178,109,.16)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-38, -116, 52, 52);
      ctx.fillStyle = c.active ? '#c9f2c8' : '#8a8068';
      ellipse(ctx, -12, -86, 3.2, 3.2);
      ctx.fill();
      ctx.fillStyle = c.active ? '#cfe8cb' : '#857c68';
      ctx.font = '700 7px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.active ? 'SECURED' : 'CHECKPOINT', 0, -7);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  drawPickups() {
    const ctx = this.ctx;
    const g = this.game;
    for (const p of g.runtime.pickups) {
      if (p.dead || p.x < g.camera.x - 80 || p.x > g.camera.x + this.viewW + 80) continue;
      const bob = p.grounded ? Math.sin(g.animTime * 3.4 + p.seed) * 3 : 0;
      const y = p.y + bob;
      const cx = p.x + p.w / 2;
      const cy = y + p.h / 2;
      const color = p.type === 'health' ? '#e76353' : p.type === 'armor' ? '#74b6cd' : p.type === 'grenade' ? '#9bb28a' : p.type === 'weapon' ? '#e6bc6e' : '#e2bd73';
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
      glow.addColorStop(0, `${color}44`);
      glow.addColorStop(1, `${color}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 28, cy - 28, 56, 56);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ellipse(ctx, cx, p.y + p.h + 2, 12, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(g.animTime * 2 + p.seed) * 0.05);
      if (p.type === 'ammo') {
        ctx.fillStyle = '#25302c';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.strokeStyle = '#d9b878';
        ctx.lineWidth = 1;
        ctx.strokeRect(-10, -8, 20, 16);
        ctx.fillStyle = '#e7c37d';
        for (let i = 0; i < 3; i++) ctx.fillRect(-6 + i * 5, -5, 2, 7);
      } else if (p.type === 'health') {
        ctx.fillStyle = '#d8ded6';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#c84a3d';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-6, -2, 12, 4);
      } else if (p.type === 'armor') {
        ctx.fillStyle = '#33515c';
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(10, -6); ctx.lineTo(8, 5); ctx.lineTo(0, 10); ctx.lineTo(-8, 5); ctx.lineTo(-10, -6); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#8cc6d7';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(151,210,227,.55)';
        ctx.fillRect(-2, -4, 4, 8);
      } else if (p.type === 'grenade') {
        ctx.fillStyle = '#475b43';
        roundedPath(ctx, -5, -7, 10, 14, 4);
        ctx.fill();
        ctx.fillStyle = '#97a888';
        ctx.fillRect(-4, -10, 8, 3);
        ctx.strokeStyle = '#b7c6aa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(4, -9, 3, -1.4, 1.4);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#3b2b15';
        ctx.fillRect(-12, -8, 24, 16);
        ctx.strokeStyle = '#edc57c';
        ctx.strokeRect(-12, -8, 24, 16);
        ctx.fillStyle = '#edc57c';
        ctx.font = '700 7px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WPN', 0, 2);
        ctx.textAlign = 'left';
      }
      ctx.restore();
    }
  }

  drawDestructibles() {
    const ctx = this.ctx;
    const g = this.game;
    for (const d of g.runtime.destructibles) {
      if (d.dead || d.x < g.camera.x - 100 || d.x > g.camera.x + this.viewW + 100) continue;
      const flash = d.flash > 0;
      const shake = d.flash > 0 ? Math.sin(d.flash * 80) * 1.6 : 0;
      ctx.save();
      ctx.translate(d.x + shake, d.y);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ellipse(ctx, d.w / 2, d.h + 2, d.w * 0.52, 4);
      ctx.fill();
      if (d.type === 'barrel') {
        const grad = ctx.createLinearGradient(0, 0, d.w, 0);
        grad.addColorStop(0, '#4c211b');
        grad.addColorStop(0.22, '#9c3527');
        grad.addColorStop(0.48, '#c25136');
        grad.addColorStop(0.78, '#79251c');
        grad.addColorStop(1, '#3b1814');
        ctx.fillStyle = flash ? '#fff0da' : grad;
        roundedPath(ctx, 0, 4, d.w, d.h - 4, 4);
        ctx.fill();
        ctx.fillStyle = flash ? '#fff' : '#2d2923';
        ctx.fillRect(0, 12, d.w, 4);
        ctx.fillRect(0, d.h - 15, d.w, 4);
        ctx.fillStyle = flash ? '#fff' : '#4c1f18';
        ellipse(ctx, d.w / 2, 4, d.w / 2, 4);
        ctx.fill();
        ctx.strokeStyle = flash ? '#fff' : '#c88453';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ellipse(ctx, d.w / 2, 4, d.w / 2 - 3, 2.3);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // hazard diamond
        ctx.save();
        ctx.translate(d.w / 2, 29);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(238,201,107,.7)';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = '#3c1e17';
        ctx.font = '700 8px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 0.5);
        ctx.restore();
        const blink = 0.25 + (Math.sin(g.animTime * 5 + d.x) + 1) * 0.3;
        ctx.fillStyle = `rgba(255,202,105,${blink})`;
        ctx.fillRect(d.w - 7, 8, 3, 3);
      } else {
        const grad = ctx.createLinearGradient(0, 0, d.w, d.h);
        grad.addColorStop(0, '#8a653d');
        grad.addColorStop(0.5, '#6d4a2a');
        grad.addColorStop(1, '#4b321d');
        ctx.fillStyle = flash ? '#fff1d8' : grad;
        ctx.fillRect(0, 0, d.w, d.h);
        ctx.strokeStyle = flash ? '#fff' : '#382413';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(1, 1, d.w - 2, d.h - 2);
        ctx.fillStyle = flash ? '#fff' : 'rgba(34,22,12,.55)';
        for (let i = 0; i < 3; i++) ctx.fillRect(5, 6 + i * 11, d.w - 10, 2);
        ctx.strokeStyle = flash ? '#fff' : '#85837a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, 4); ctx.lineTo(d.w - 4, d.h - 4);
        ctx.moveTo(d.w - 4, 4); ctx.lineTo(4, d.h - 4);
        ctx.stroke();
        ctx.fillStyle = 'rgba(236,214,174,.45)';
        ctx.font = '700 7px "Courier New", monospace';
        ctx.fillText('MUNITIONS', 5, d.h - 5);
        ctx.fillStyle = 'rgba(40,67,46,.8)';
        ctx.fillRect(4, 4, 9, 3);
      }
      if (d.hp < d.maxHp * 0.65) {
        ctx.strokeStyle = 'rgba(16,12,9,.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.w * 0.55, 3);
        ctx.lineTo(d.w * 0.48, d.h * 0.35);
        ctx.lineTo(d.w * 0.62, d.h * 0.58);
        ctx.lineTo(d.w * 0.52, d.h - 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawEnemies() {
    const g = this.game;
    for (const e of g.runtime.enemies) {
      if (e.dead && e.deathTimer <= 0) continue;
      if (e.x < g.camera.x - 160 || e.x > g.camera.x + this.viewW + 160) continue;
      this.drawEnemy(e, g);
    }
    if (g.boss && !g.boss.removed) this.drawBoss(g.boss, g);
  }

  drawEnemy(e, g) {
    const ctx = this.ctx;
    const alpha = e.dead ? clamp(e.deathTimer / 0.75, 0, 1) : 1;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (e.hitFlash > 0) ctx.globalCompositeOperation = 'lighter';
    if (e.type === 'drone') {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(clamp(e.vx / 500, -0.24, 0.24));
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ellipse(ctx, 0, 44, 17, 4);
      ctx.fill();
      const body = e.hitFlash > 0 ? '#fff' : '#22302f';
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-17, -4);
      ctx.lineTo(-8, -11);
      ctx.lineTo(9, -10);
      ctx.lineTo(18, 0);
      ctx.lineTo(8, 9);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = e.hitFlash > 0 ? '#fff' : '#50615c';
      ctx.lineWidth = 1;
      ctx.stroke();
      const spin = g.animTime * 32;
      ctx.strokeStyle = 'rgba(196,216,210,.5)';
      ctx.lineWidth = 1.4;
      for (const sx of [-13, 13]) {
        ctx.save();
        ctx.translate(sx, -12);
        ctx.rotate(spin);
        ctx.beginPath();
        ctx.moveTo(-9, 0); ctx.lineTo(9, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(206,72,53,.9)';
      ellipse(ctx, e.aimX || 0, 0, 3.5, 3.5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(206,72,53,.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, TAU);
      ctx.stroke();
      if (e.alert) {
        ctx.fillStyle = `rgba(235,111,82,${0.7 + Math.sin(g.animTime * 8) * 0.3})`;
        ctx.font = '700 12px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, -20);
      }
    } else if (e.type === 'turret') {
      const cx = e.x + e.w / 2;
      const base = e.y + e.h;
      ctx.translate(cx, base);
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ellipse(ctx, 0, 0, 22, 4);
      ctx.fill();
      ctx.strokeStyle = e.hitFlash > 0 ? '#fff' : '#394440';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-5, -20);
      ctx.moveTo(14, 0); ctx.lineTo(5, -20);
      ctx.stroke();
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#2b3431';
      roundedPath(ctx, -13, -27, 26, 13, 3);
      ctx.fill();
      ctx.save();
      ctx.translate(0, -25);
      ctx.rotate(e.aimAngle || 0);
      ctx.fillStyle = '#1c2422';
      ctx.fillRect(0, -4, 30, 7);
      ctx.fillStyle = '#45514b';
      ctx.fillRect(2, -5, 13, 2);
      ctx.fillStyle = 'rgba(224,82,58,.85)';
      ctx.fillRect(4, -1, 3, 3);
      ctx.restore();
      ctx.fillStyle = 'rgba(230,184,98,.7)';
      ctx.fillRect(-4, -31, 8, 2);
    } else {
      const isHeavy = e.type === 'heavy';
      const feet = e.y + e.h;
      const cx = e.x + e.w / 2;
      ctx.translate(cx, feet);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ellipse(ctx, 0, 1, isHeavy ? 23 : 15, 4);
      ctx.fill();
      const walk = Math.abs(e.vx) > 5 ? Math.sin(g.animTime * 11 + e.x) : 0;
      const body = e.hitFlash > 0 ? '#fff8e8' : isHeavy ? '#2a2e2c' : '#33362f';
      const gear = e.hitFlash > 0 ? '#fff' : isHeavy ? '#474d49' : '#4a5148';
      const accent = e.hitFlash > 0 ? '#fff' : '#7e2b25';
      // legs
      ctx.strokeStyle = body;
      ctx.lineWidth = isHeavy ? 10 : 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-5, -28);
      ctx.lineTo(-6 + walk * 6, -15);
      ctx.lineTo(-8 + walk * 9, -2);
      ctx.moveTo(5, -28);
      ctx.lineTo(6 - walk * 6, -15);
      ctx.lineTo(8 - walk * 9, -2);
      ctx.stroke();
      // torso
      ctx.fillStyle = body;
      roundedPath(ctx, isHeavy ? -18 : -13, isHeavy ? -57 : -50, isHeavy ? 36 : 26, isHeavy ? 32 : 25, 5);
      ctx.fill();
      ctx.fillStyle = gear;
      roundedPath(ctx, isHeavy ? -16 : -11, isHeavy ? -53 : -47, isHeavy ? 32 : 22, isHeavy ? 18 : 14, 3);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(isHeavy ? -17 : -12, isHeavy ? -49 : -43, 4, 10);
      // head
      const headY = isHeavy ? -66 : -58;
      const headR = isHeavy ? 9 : 7;
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#b58965';
      ellipse(ctx, 0, headY, headR, headR * 1.1);
      ctx.fill();
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : isHeavy ? '#252a28' : '#30362f';
      ctx.beginPath();
      ctx.arc(0, headY - 1, headR + 2.5, Math.PI, TAU);
      ctx.fill();
      ctx.fillRect(-headR - 1.5, headY - 3, (headR + 1.5) * 2, 3);
      // visor
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : 'rgba(206,83,58,.88)';
      ctx.fillRect(e.facing > 0 ? 2 : -7, headY - 2, 5, 2);
      // rifle
      ctx.save();
      ctx.translate(0, isHeavy ? -45 : -39);
      ctx.rotate(e.aimAngle || 0);
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#171d1b';
      ctx.fillRect(4, -2, isHeavy ? 38 : 30, 4);
      ctx.fillRect(12, 1, 5, isHeavy ? 10 : 7);
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#515a53';
      ctx.fillRect(7, -3, 9, 1);
      ctx.restore();
      if (isHeavy) {
        ctx.strokeStyle = 'rgba(205,177,120,.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-17, -48, 34, 18);
      }
      if (e.hp < e.maxHp) {
        const w = isHeavy ? 42 : 30;
        ctx.fillStyle = 'rgba(4,6,7,.65)';
        ctx.fillRect(-w / 2, headY - 23, w, 3);
        ctx.fillStyle = '#d5a24e';
        ctx.fillRect(-w / 2, headY - 23, w * clamp(e.hp / e.maxHp, 0, 1), 3);
      }
      if (e.alert && !e.dead) {
        ctx.fillStyle = `rgba(235,111,82,${0.72 + Math.sin(g.animTime * 7) * 0.28})`;
        ctx.font = '700 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, headY - 27);
      }
    }
    ctx.restore();
  }

  drawBoss(b, g) {
    const ctx = this.ctx;
    if (b.dead && b.deathTimer <= 0) return;
    ctx.save();
    const alpha = b.dead ? clamp(b.deathTimer / 2.2, 0, 1) : 1;
    ctx.globalAlpha = alpha;
    if (b.hitFlash > 0) ctx.globalCompositeOperation = 'lighter';
    const feet = b.y + b.h;
    const cx = b.x + b.w / 2;
    ctx.translate(cx, feet);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ellipse(ctx, 0, 2, 50, 8);
    ctx.fill();
    const h = b.h;
    const legSwing = Math.sin(g.animTime * 4) * 3;
    ctx.strokeStyle = b.hitFlash > 0 ? '#fff' : '#252825';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-15, -h * 0.4);
    ctx.lineTo(-19 + legSwing, -h * 0.18);
    ctx.lineTo(-22, 0);
    ctx.moveTo(15, -h * 0.4);
    ctx.lineTo(19 - legSwing, -h * 0.18);
    ctx.lineTo(22, 0);
    ctx.stroke();
    // armored torso
    const armor = b.phase === 2 ? '#4d2b25' : '#2e3431';
    ctx.fillStyle = b.hitFlash > 0 ? '#fff6dd' : armor;
    ctx.beginPath();
    ctx.moveTo(-40, -h * 0.78);
    ctx.lineTo(-32, -h * 0.4);
    ctx.lineTo(-20, -h * 0.33);
    ctx.lineTo(22, -h * 0.33);
    ctx.lineTo(36, -h * 0.42);
    ctx.lineTo(42, -h * 0.78);
    ctx.lineTo(20, -h * 0.86);
    ctx.lineTo(-22, -h * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = b.hitFlash > 0 ? '#fff' : '#59605a';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // chest core
    const core = 0.6 + Math.sin(g.animTime * 5) * 0.4;
    ctx.fillStyle = b.phase === 2 ? `rgba(255,115,66,${core})` : `rgba(230,170,86,${core * 0.6})`;
    ctx.fillRect(-9, -h * 0.65, 18, 10);
    ctx.fillStyle = 'rgba(255,236,184,.7)';
    ctx.fillRect(-3, -h * 0.63, 6, 2);
    // shoulder plates
    ctx.fillStyle = b.hitFlash > 0 ? '#fff' : '#454b46';
    ctx.beginPath();
    ctx.moveTo(-48, -h * 0.81);
    ctx.lineTo(-35, -h * 0.9);
    ctx.lineTo(-24, -h * 0.84);
    ctx.lineTo(-26, -h * 0.68);
    ctx.lineTo(-44, -h * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(48, -h * 0.81);
    ctx.lineTo(35, -h * 0.9);
    ctx.lineTo(24, -h * 0.84);
    ctx.lineTo(26, -h * 0.68);
    ctx.lineTo(44, -h * 0.66);
    ctx.closePath();
    ctx.fill();
    // head/helmet
    const headY = -h * 0.92;
    ctx.fillStyle = b.hitFlash > 0 ? '#fff' : '#b08a68';
    ellipse(ctx, 0, headY, 10, 11);
    ctx.fill();
    ctx.fillStyle = b.hitFlash > 0 ? '#fff' : '#272b27';
    ctx.beginPath();
    ctx.arc(0, headY - 1, 12, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(-12, headY - 4, 24, 4);
    ctx.fillStyle = b.phase === 2 ? 'rgba(255,95,58,.95)' : 'rgba(238,154,83,.85)';
    ctx.fillRect(b.facing > 0 ? 2 : -10, headY - 2, 8, 3);
    // giant dog tags
    ctx.strokeStyle = 'rgba(200,177,128,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -h * 0.62); ctx.lineTo(-6, -h * 0.55);
    ctx.moveTo(6, -h * 0.62); ctx.lineTo(4, -h * 0.55);
    ctx.stroke();
    // minigun
    ctx.save();
    ctx.translate(0, -h * 0.72);
    ctx.rotate(b.aimAngle || 0);
    ctx.fillStyle = '#1b201e';
    ctx.fillRect(6, -9, 48, 18);
    ctx.fillStyle = '#59615b';
    ctx.fillRect(8, -7, 43, 3);
    ctx.fillRect(8, 4, 43, 3);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#2d3330';
      ctx.fillRect(46 + i * 5, -7 + i * 5, 14, 3);
    }
    const muzzleGlow = b.muzzleTimer > 0 ? 1 : 0;
    if (muzzleGlow) {
      ctx.fillStyle = 'rgba(255,211,130,.9)';
      ellipse(ctx, 64, 0, 15, 6);
      ctx.fill();
    }
    ctx.restore();
    // name tag glow
    ctx.fillStyle = 'rgba(231,212,174,.58)';
    ctx.font = '700 7px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('COL. VOLKOV', 0, -h - 18);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  drawGate() {
    const g = this.game;
    if (!g.runtime.gate || g.runtime.gate.open >= 1) return;
    const gate = g.runtime.gate;
    const ctx = this.ctx;
    const x = gate.x;
    const raise = gate.open * 280;
    const y = 210 + raise;
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,10,.52)';
    ctx.fillRect(x - 4, y, 48, 410);
    ctx.strokeStyle = '#454a42';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, 40, 410);
    ctx.fillStyle = '#2b302c';
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 5, y + 8 + i * 24, 30, 4);
    ctx.fillStyle = 'rgba(232,180,96,.28)';
    for (let i = 0; i < 7; i++) {
      ctx.save();
      ctx.translate(x + 4, y + 16 + i * 56);
      ctx.rotate(-0.6);
      ctx.fillRect(0, 0, 10, 30);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(220,69,51,.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 30);
    ctx.lineTo(x + 32, y + 62);
    ctx.moveTo(x + 32, y + 30);
    ctx.lineTo(x + 8, y + 62);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------- */
  /* Player                                                     */
  /* ---------------------------------------------------------- */
  drawPlayer(p) {
    const ctx = this.ctx;
    const g = this.game;
    if (!p || p.hidden) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 28) % 2 === 0) ctx.globalAlpha = 0.5;
    const feet = p.y + p.h;
    const cx = p.x + p.w / 2;
    const moving = Math.abs(p.vx) > 12 && p.grounded;
    const crouch = p.crouch || 0;
    const run = g.animTime * 11 + p.runPhase;
    const cyc = moving ? Math.sin(run) : Math.sin(g.animTime * 1.9) * 0.15;
    const alt = moving ? Math.sin(run + Math.PI) : 0;
    const aim = p.aimAngle;
    const facing = Math.cos(aim) >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(cx, feet);
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ellipse(ctx, 0, 2, p.grounded ? 19 : 13, 4.5);
    ctx.fill();

    if (p.rollTimer > 0) {
      const spin = (1 - p.rollTimer / p.rollDuration) * TAU * (p.facing || 1);
      ctx.translate(0, -24);
      ctx.rotate(spin);
      ctx.fillStyle = '#2c372f';
      roundedPath(ctx, -19, -14, 38, 28, 12);
      ctx.fill();
      ctx.fillStyle = '#4a5544';
      roundedPath(ctx, -14, -10, 20, 16, 6);
      ctx.fill();
      ctx.fillStyle = '#b98c67';
      ellipse(ctx, 12, -2, 6, 7);
      ctx.fill();
      ctx.fillStyle = '#1d2621';
      ctx.fillRect(10, -4, 8, 3);
      ctx.restore();
      return;
    }

    const lean = moving ? clamp(p.vx / 1400, -0.1, 0.1) : 0;
    // legs
    ctx.lineCap = 'round';
    const legSwing = moving ? cyc * 8 : 0;
    const backSwing = moving ? alt * 8 : 0;
    ctx.strokeStyle = '#27312b';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-5, -30);
    ctx.lineTo(-6 + backSwing * 0.7, -16);
    ctx.lineTo(-9 + backSwing * 1.15, -3);
    ctx.stroke();
    ctx.strokeStyle = '#344036';
    ctx.beginPath();
    ctx.moveTo(5, -30);
    ctx.lineTo(6 + legSwing * 0.7, -16);
    ctx.lineTo(9 + legSwing * 1.15, -2);
    ctx.stroke();
    // boots
    ctx.fillStyle = '#121716';
    roundedPath(ctx, -13 + backSwing * 1.1, -5, 12, 5, 2);
    ctx.fill();
    roundedPath(ctx, 4 + legSwing * 1.1, -5, 12, 5, 2);
    ctx.fill();
    // torso group
    ctx.save();
    ctx.translate(0, -30);
    ctx.rotate(lean);
    const torsoY = -22;
    // backpack
    ctx.fillStyle = '#202821';
    roundedPath(ctx, -17, torsoY + 3, 9, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#394738';
    roundedPath(ctx, -11, torsoY, 22, 24, 5);
    ctx.fill();
    // vest
    ctx.fillStyle = '#4d5846';
    roundedPath(ctx, -9, torsoY + 2, 18, 17, 3);
    ctx.fill();
    ctx.fillStyle = '#2a332b';
    ctx.fillRect(-7, torsoY + 7, 14, 2);
    ctx.fillRect(-7, torsoY + 12, 14, 2);
    // pouches / flag patch
    ctx.fillStyle = '#6f5b3b';
    ctx.fillRect(-8, torsoY + 16, 5, 4);
    ctx.fillRect(-1, torsoY + 16, 5, 4);
    ctx.fillStyle = '#1d3f61';
    ctx.fillRect(6, torsoY + 3, 4, 3);
    ctx.fillStyle = '#b64135';
    ctx.fillRect(6, torsoY + 3, 4, 1);
    ctx.fillStyle = 'rgba(231,234,225,.65)';
    ctx.fillRect(6.5, torsoY + 4.2, 1.4, 0.8);
    // neck / scarf
    ctx.fillStyle = '#9d3c2e';
    ctx.fillRect(-4, torsoY - 2, 9, 4);
    // head
    const headY = torsoY - 8;
    ctx.fillStyle = '#b88d69';
    ellipse(ctx, 1, headY, 7.5, 8);
    ctx.fill();
    // face details (mask + eye)
    ctx.fillStyle = '#29312b';
    ctx.fillRect(2 + facing * 1.5, headY - 2, 5, 3);
    ctx.fillStyle = '#1d2620';
    ctx.fillRect(0, headY + 3, 8, 3);
    // helmet
    ctx.fillStyle = '#384536';
    ctx.beginPath();
    ctx.arc(1, headY - 2, 9.5, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(-9.5, headY - 3, 20, 3);
    ctx.fillStyle = '#596a50';
    ctx.fillRect(-7, headY - 11, 9, 2);
    ctx.fillStyle = '#1e2821';
    ctx.fillRect(-9, headY - 4, 20, 2);
    // goggles
    ctx.fillStyle = 'rgba(191,154,86,.8)';
    ctx.fillRect(4 + facing * 2, headY - 4, 4, 2);
    // bandana tail
    ctx.strokeStyle = '#a43b2d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, headY + 3);
    ctx.quadraticCurveTo(-16 - Math.sin(g.animTime * 4) * 3, headY + 8, -13, headY + 14);
    ctx.stroke();
    // shoulder star
    ctx.fillStyle = 'rgba(233,224,196,.6)';
    ctx.font = '700 4px "Courier New", monospace';
    ctx.fillText('★', -6, torsoY + 5);
    ctx.restore();

    // aiming arm + weapon
    this.drawPlayerWeapon(p, g, facing, aim, moving);

    // knife slash
    if (p.knifeTimer > 0) {
      const prog = 1 - p.knifeTimer / 0.24;
      ctx.save();
      ctx.translate(0, -40);
      ctx.rotate(aim);
      ctx.strokeStyle = `rgba(240,224,184,${0.75 * (1 - prog)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(14, 0, 34 + prog * 20, -0.7 + prog * 1.2, 0.6 + prog * 1.2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,245,220,${0.9 * (1 - prog)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(14, 0, 42 + prog * 20, -0.5 + prog * 1.2, 0.3 + prog * 1.2);
      ctx.stroke();
      ctx.restore();
    }
    // muzzle flash
    if (p.muzzleTimer > 0) {
      const flash = p.muzzleTimer / 0.055;
      const mx = Math.cos(aim) * p.muzzleLen;
      const my = -40 + Math.sin(aim) * p.muzzleLen;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(aim);
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 * flash);
      grad.addColorStop(0, 'rgba(255,245,190,.95)');
      grad.addColorStop(0.3, 'rgba(255,166,71,.66)');
      grad.addColorStop(1, 'rgba(255,120,36,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-35, -35, 70, 70);
      ctx.strokeStyle = `rgba(255,226,150,${0.9 * flash})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU + p.muzzleSeed;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 18 * flash, Math.sin(a) * 18 * flash);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawPlayerWeapon(p, g, facing, aim, moving) {
    const ctx = this.ctx;
    const reload = p.reloading;
    const bob = moving ? Math.sin(g.animTime * 11 + p.runPhase) * 1.2 : Math.sin(g.animTime * 2) * 0.6;
    ctx.save();
    ctx.translate(0, -40 + bob);
    let gunAngle = aim;
    let handOff = 0;
    if (reload) {
      const prog = p.reloadProgress || 0;
      gunAngle += Math.sin(prog * Math.PI) * 0.6;
      handOff = Math.sin(prog * Math.PI) * 7;
    }
    // arm
    ctx.save();
    ctx.rotate(gunAngle);
    ctx.strokeStyle = '#4a5644';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(1, 5);
    ctx.lineTo(18 + handOff, 3);
    ctx.stroke();
    ctx.strokeStyle = '#b88964';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(17 + handOff, 3);
    ctx.lineTo(23 + handOff, 1);
    ctx.stroke();
    ctx.fillStyle = '#121717';
    const w = p.weaponId;
    if (w === 'pistol') {
      ctx.fillRect(19 + handOff, -3, 18, 5);
      ctx.fillStyle = '#4d554c';
      ctx.fillRect(20 + handOff, -4, 16, 2);
      ctx.fillStyle = '#c9a56e';
      ctx.fillRect(23 + handOff, 2, 4, 5);
      ctx.fillStyle = '#282e29';
      ctx.fillRect(22 + handOff, 4, 5, 7);
      p.muzzleLen = 38;
    } else if (w === 'smg') {
      ctx.fillRect(16 + handOff, -3, 27, 6);
      ctx.fillStyle = '#3f4a43';
      ctx.fillRect(17 + handOff, -4, 22, 2);
      ctx.fillStyle = '#151a18';
      ctx.fillRect(26 + handOff, 3, 5, 9);
      ctx.fillRect(12 + handOff, -2, 6, 4);
      p.muzzleLen = 48;
    } else if (w === 'shotgun') {
      ctx.fillRect(10 + handOff, -2, 42, 5);
      ctx.fillStyle = '#4b4133';
      ctx.fillRect(22 + handOff, 1, 13, 4);
      ctx.fillStyle = '#5c5549';
      ctx.fillRect(13 + handOff, -4, 34, 2);
      ctx.fillStyle = '#2b312b';
      ctx.fillRect(13 + handOff, 2, 20, 4);
      p.muzzleLen = 55;
    } else if (w === 'rifle') {
      ctx.fillRect(10 + handOff, -3, 47, 6);
      ctx.fillStyle = '#49554d';
      ctx.fillRect(12 + handOff, -5, 32, 2);
      ctx.fillStyle = '#161c19';
      ctx.fillRect(30 + handOff, 3, 6, 10);
      ctx.fillRect(2 + handOff, -2, 11, 4);
      ctx.fillStyle = '#292f2b';
      ctx.fillRect(28 + handOff, -8, 9, 3);
      p.muzzleLen = 60;
    } else {
      ctx.fillRect(6 + handOff, -7, 48, 12);
      ctx.fillStyle = '#4e5349';
      ctx.fillRect(8 + handOff, -7, 18, 2);
      ctx.fillStyle = '#1d211c';
      ctx.fillRect(26 + handOff, 5, 7, 8);
      ctx.fillStyle = '#b47b3f';
      ctx.beginPath();
      ctx.moveTo(54 + handOff, -7);
      ctx.lineTo(66 + handOff, -2);
      ctx.lineTo(54 + handOff, 5);
      ctx.closePath();
      ctx.fill();
      p.muzzleLen = 68;
    }
    ctx.fillStyle = '#c09468';
    ctx.fillRect(19 + handOff, -1, 5, 4);
    ctx.restore();
    ctx.restore();
  }

  /* ---------------------------------------------------------- */
  /* Projectiles, effects, particles                            */
  /* ---------------------------------------------------------- */
  drawBullets() {
    const ctx = this.ctx;
    const g = this.game;
    for (const b of g.runtime.bullets) {
      if (b.x < g.camera.x - 100 || b.x > g.camera.x + this.viewW + 100) continue;
      const col = b.owner === 'player' ? b.color || '#ffe4ad' : '#ff765d';
      const alpha = clamp(b.life / 0.25, 0, 1);
      if (b.rocket) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#2c302b';
        ctx.fillRect(-9, -3, 14, 6);
        ctx.fillStyle = '#b77b44';
        ctx.beginPath();
        ctx.moveTo(5, -3); ctx.lineTo(11, 0); ctx.lineTo(5, 3); ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const fl = ctx.createRadialGradient(-12, 0, 0, -12, 0, 15);
        fl.addColorStop(0, 'rgba(255,220,136,.85)');
        fl.addColorStop(0.5, 'rgba(255,123,43,.45)');
        fl.addColorStop(1, 'rgba(255,95,26,0)');
        ctx.fillStyle = fl;
        ctx.fillRect(-28, -16, 32, 32);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = b.owner === 'player' ? 'rgba(255,229,176,.2)' : 'rgba(255,116,88,.2)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = b.owner === 'player' ? 1.8 : 1.5;
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = col;
      ellipse(ctx, b.x, b.y, 1.5, 1.5);
      ctx.fill();
      ctx.restore();
    }
  }

  drawGrenades() {
    const ctx = this.ctx;
    const g = this.game;
    for (const n of g.runtime.grenades) {
      const bob = Math.sin(g.animTime * 12) * 1;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.rot);
      ctx.fillStyle = n.owner === 'enemy' ? '#5d2621' : '#3e513b';
      roundedPath(ctx, -3.5, -4.5, 7, 9, 3);
      ctx.fill();
      ctx.fillStyle = '#181d18';
      ctx.fillRect(-2, -6.5 + bob, 4, 2);
      ctx.strokeStyle = '#a7b19a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(2.5, -5.5, 2, -1.4, 1.6);
      ctx.stroke();
      const blink = Math.sin(n.fuse * 20) > 0.1 ? 1 : 0.2;
      ctx.fillStyle = `rgba(238,82,57,${blink})`;
      ctx.fillRect(-1, -8, 2, 2);
      ctx.restore();
    }
  }

  drawEffects() {
    const ctx = this.ctx;
    const g = this.game;
    for (const e of g.runtime.effects) {
      const t = e.age / e.duration;
      if (e.type === 'explosion') {
        const alpha = 1 - t;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const r = e.radius * (0.22 + t * 0.88);
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
        grad.addColorStop(0, `rgba(255,244,195,${alpha * 0.9})`);
        grad.addColorStop(0.22, `rgba(255,174,69,${alpha * 0.7})`);
        grad.addColorStop(0.52, `rgba(224,82,31,${alpha * 0.3})`);
        grad.addColorStop(1, 'rgba(80,20,7,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
        ctx.strokeStyle = `rgba(255,220,146,${alpha * 0.7})`;
        ctx.lineWidth = 3 * alpha + 0.5;
        ellipse(ctx, e.x, e.y, r * 1.02, r * 0.7);
        ctx.stroke();
        ctx.restore();
      } else if (e.type === 'shockwave') {
        const alpha = 1 - t;
        ctx.strokeStyle = `rgba(236,206,148,${alpha * 0.6})`;
        ctx.lineWidth = 2 * alpha + 0.5;
        ellipse(ctx, e.x, e.y, 20 + e.radius * t, 6 + e.radius * 0.35 * t);
        ctx.stroke();
      } else if (e.type === 'slash') {
        ctx.strokeStyle = `rgba(255,244,215,${(1 - t) * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, e.start, e.start + e.arc * (0.3 + t));
        ctx.stroke();
      }
    }
  }

  drawParticles() {
    const ctx = this.ctx;
    const g = this.game;
    ctx.save();
    for (const p of g.runtime.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'spark' || p.type === 'ember') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
        ctx.stroke();
      } else if (p.type === 'smoke') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha * 0.4;
        const r = p.size * (1 + (1 - alpha) * 1.8);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.type === 'blood') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = p.color;
        ellipse(ctx, p.x, p.y, p.size, p.size * 0.7, p.angle);
        ctx.fill();
      } else if (p.type === 'debris' || p.type === 'casing') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.type === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ellipse(ctx, p.x, p.y, p.size * alpha, p.size * alpha * 0.6);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ellipse(ctx, p.x, p.y, p.size, p.size, p.angle);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawFloatingTexts() {
    const ctx = this.ctx;
    const g = this.game;
    ctx.textAlign = 'center';
    for (const t of g.runtime.texts) {
      const alpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${t.size}px "Courier New", monospace`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = 'rgba(0,0,0,.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /* ---------------------------------------------------------- */
  /* HUD-ish overlays                                           */
  /* ---------------------------------------------------------- */
  drawObjectiveMarker() {
    const g = this.game;
    if (!g.level || (g.state !== 'playing' && g.state !== 'paused')) return;
    let target = g.level.exit ? g.level.exit.x + (g.level.exit.w || 0) / 2 : (g.boss ? g.boss.x + g.boss.w / 2 : null);
    if (!target) return;
    if (g.boss && g.boss.active) target = g.boss.x + g.boss.w / 2;
    const sx = target - g.camera.x;
    const inView = sx > 30 && sx < this.viewW - 30;
    if (inView) return;
    const ctx = this.ctx;
    const edge = sx < 0 ? 36 : this.viewW - 36;
    const y = 360;
    const bob = Math.sin(g.animTime * 4) * 3;
    ctx.save();
    ctx.translate(edge, y + bob);
    ctx.rotate(sx < 0 ? Math.PI : 0);
    ctx.fillStyle = 'rgba(216,173,101,.86)';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-3, -7);
    ctx.lineTo(-3, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(216,173,101,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(226,200,153,.55)';
    ctx.font = '700 7px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OBJECTIVE', edge + (sx < 0 ? 18 : -18), y + 28);
    ctx.textAlign = 'left';
  }

  drawWeather() {
    const g = this.game;
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    const t = g.level.theme;
    const time = g.animTime;
    ctx.save();
    if (g.level.weather === 'rain' || g.level.weather === 'storm') {
      ctx.strokeStyle = 'rgba(167,200,215,.23)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const r of this.rainSeeds) {
        const x = ((r.x + time * 0.018 * r.s) % 1) * (w + 200) - 100;
        const y = ((r.y + time * (0.62 + r.s * 0.18)) % 1) * (h + 100) - 50;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4 * r.s, y + 17 * r.s);
      }
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (g.level.weather === 'storm' && g.lightning > 0) {
        ctx.fillStyle = `rgba(196,224,238,${g.lightning * 0.23})`;
        ctx.fillRect(0, 0, w, h);
      }
    } else if (g.level.weather === 'ash') {
      for (const a of this.ashSeeds) {
        const x = ((a.x + Math.sin(time * 0.4 * a.p + a.x * 12) * 0.015 + time * 0.006) % 1) * w;
        const y = ((a.y + time * 0.025 * a.p) % 1) * h;
        ctx.globalAlpha = a.a;
        ctx.fillStyle = '#d7cdbc';
        ellipse(ctx, x, y, a.s, a.s, 0);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (g.level.weather === 'embers') {
      ctx.globalCompositeOperation = 'lighter';
      for (const e of this.emberSeeds) {
        const x = ((e.x + Math.sin(time * 0.7 * e.p + e.x * 18) * 0.025 + time * 0.005) % 1) * w;
        const y = (1 - ((e.y + time * 0.026 * e.p) % 1)) * h;
        ctx.globalAlpha = e.a * (0.5 + Math.sin(time * 4 + e.x * 20) * 0.5);
        ctx.fillStyle = '#f39a4b';
        ellipse(ctx, x, y, e.s, e.s, 0);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      for (const m of this.moteSeeds) {
        const x = ((m.x + time * 0.004 * m.p) % 1) * w;
        const y = ((m.y + Math.sin(time * 0.3 + m.x * 10) * 0.012) % 1) * h;
        ctx.globalAlpha = m.a;
        ctx.fillStyle = '#ffe6b5';
        ellipse(ctx, x, y, m.s, m.s);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawPostFx() {
    const g = this.game;
    const ctx = this.ctx;
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,182,102,${clamp(g.flash, 0, 1) * 0.24})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    // subtle warm/cool grading
    const grade = ctx.createLinearGradient(0, 0, 0, this.viewH);
    grade.addColorStop(0, 'rgba(10,14,18,.07)');
    grade.addColorStop(0.6, 'rgba(0,0,0,0)');
    grade.addColorStop(1, 'rgba(7,10,10,.16)');
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (g.player && g.player.health <= 30 && g.state === 'playing') {
      const pulse = 0.04 + (Math.sin(g.animTime * 4) * 0.5 + 0.5) * 0.05;
      const rg = ctx.createRadialGradient(this.viewW / 2, this.viewH / 2, this.viewH * 0.25, this.viewW / 2, this.viewH / 2, this.viewH * 0.78);
      rg.addColorStop(0, 'rgba(130,12,8,0)');
      rg.addColorStop(1, `rgba(144,18,12,${pulse})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  }

  drawCrosshair() {
    const g = this.game;
    const ctx = this.ctx;
    const d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const x = g.mouse.sx;
    const y = g.mouse.sy;
    if (x < 0 || y < 0) return;
    const hover = g.mouse.hoverEnemy;
    const spread = g.crosshairSpread || 0;
    const size = 9 + spread;
    const gap = 3 + spread * 0.4;
    ctx.save();
    ctx.strokeStyle = hover ? 'rgba(255,109,84,.95)' : 'rgba(237,241,228,.82)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - gap - size, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + size, y);
    ctx.moveTo(x, y - gap - size); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + size);
    ctx.stroke();
    ctx.fillStyle = hover ? '#ff6d54' : 'rgba(237,241,228,.92)';
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.strokeStyle = hover ? 'rgba(255,109,84,.2)' : 'rgba(237,241,228,.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 20 + spread, 0, TAU);
    ctx.stroke();
    if (g.hitMarker > 0) {
      const a = clamp(g.hitMarker / 0.12, 0, 1);
      ctx.strokeStyle = `rgba(255,246,220,${a})`;
      ctx.lineWidth = 1.8;
      const h = 5;
      ctx.beginPath();
      ctx.moveTo(x - h, y - h); ctx.lineTo(x - 2, y - 2);
      ctx.moveTo(x + h, y - h); ctx.lineTo(x + 2, y - 2);
      ctx.moveTo(x - h, y + h); ctx.lineTo(x - 2, y + 2);
      ctx.moveTo(x + h, y + h); ctx.lineTo(x + 2, y + 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
