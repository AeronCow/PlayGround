import { RNG } from './noise.js';
import { BLOCKS } from './blocks.js';

const COLS = 16;
const TILE_PX = 20;
const PAD = 2;
const CONTENT = 16;
const ATLAS = COLS * TILE_PX;

let atlasCache = null;
const tileCanvases = new Map();

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function makeTile(index, draw) {
  const c = document.createElement('canvas');
  c.width = CONTENT;
  c.height = CONTENT;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx, new RNG(9700 + index * 131), index);
  tileCanvases.set(index, c);
  return c;
}

function speckle(ctx, rng, palette, count = 80, x = 0, y = 0, w = 16, h = 16) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = palette[Math.floor(rng.next() * palette.length)];
    ctx.fillRect(x + Math.floor(rng.next() * w), y + Math.floor(rng.next() * h), 1, 1);
  }
}

function drawGrassTop(ctx, rng) {
  const p = ['#6f9a4a', '#7aa651', '#648c42', '#86ad58', '#5c823c'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rng.next() * 16), y = Math.floor(rng.next() * 16);
    ctx.fillStyle = rng.chance(0.5) ? '#4e7134' : '#94b864';
    ctx.fillRect(x, y, 1, rng.chance(0.5) ? 1 : 2);
  }
}

function drawGrassSide(ctx, rng) {
  const dirt = ['#7a5a3b', '#6e4f32', '#846344', '#5f4329'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = dirt[Math.floor(rng.next() * dirt.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  const greens = ['#6f9a4a', '#7aa651', '#648c42', '#5c823c'];
  for (let x = 0; x < 16; x++) {
    const h = 3 + Math.floor(rng.next() * 3);
    for (let y = 0; y < h; y++) {
      ctx.fillStyle = greens[Math.floor(rng.next() * greens.length)];
      ctx.fillRect(x, y, 1, 1);
    }
    if (rng.chance(0.3)) {
      ctx.fillStyle = '#4e7134';
      ctx.fillRect(x, h, 1, 1);
    }
    if (rng.chance(0.22)) {
      ctx.fillStyle = '#7aa651';
      ctx.fillRect(x, h + 1, 1, 1);
    }
  }
}

function drawDirt(ctx, rng) {
  const p = ['#7a5a3b', '#6e4f32', '#846344', '#5f4329', '#8a6947'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = '#4c3520';
    const x = Math.floor(rng.next() * 15), y = Math.floor(rng.next() * 15);
    ctx.fillRect(x, y, 2, 1);
  }
}

function drawStone(ctx, rng) {
  const p = ['#8d9297', '#83888d', '#969ba0', '#787d82'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 4; i++) {
    let x = Math.floor(rng.next() * 14), y = Math.floor(rng.next() * 14);
    ctx.fillStyle = '#656a6f';
    for (let k = 0; k < 3 + Math.floor(rng.next() * 4); k++) {
      ctx.fillRect(x, y, 1, 1);
      x += rng.chance(0.6) ? 1 : 0;
      y += rng.chance(0.5) ? 1 : 0;
      x = Math.min(15, x); y = Math.min(15, y);
    }
  }
  speckle(ctx, rng, ['#a4a9ae', '#6c7176'], 12);
}

function drawCobble(ctx, rng) {
  ctx.fillStyle = '#5f6469';
  ctx.fillRect(0, 0, 16, 16);
  const stones = [
    [1, 1, 6, 5], [8, 1, 7, 4], [1, 7, 4, 5], [6, 6, 6, 5],
    [13, 6, 2, 5], [1, 13, 7, 2], [9, 12, 6, 3],
  ];
  const p = ['#8a9096', '#7c8288', '#969ca2', '#848a90'];
  for (const [x, y, w, h] of stones) {
    const base = p[Math.floor(rng.next() * p.length)];
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shade(base.startsWith('#') ? base : '#8a9096', 18);
    ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = 'rgba(40,44,48,.35)';
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
  }
  speckle(ctx, rng, ['#a1a7ad', '#6a7075'], 18);
}

function drawLogSide(ctx, rng) {
  const p = ['#6b4a2a', '#5a3c21', '#785531', '#4f341c', '#866038'];
  for (let x = 0; x < 16; x++) {
    const base = p[Math.floor(rng.next() * p.length)];
    for (let y = 0; y < 16; y++) {
      ctx.fillStyle = rng.chance(0.12) ? p[Math.floor(rng.next() * p.length)] : base;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = '#3f2916';
  ctx.fillRect(3, 0, 1, 16);
  ctx.fillRect(11, 0, 1, 16);
  ctx.fillStyle = '#9a7042';
  ctx.fillRect(7, 3, 2, 4);
  ctx.fillStyle = '#4f341c';
  ctx.fillRect(8, 4, 1, 2);
}

function drawLogTop(ctx, rng) {
  ctx.fillStyle = '#a98252';
  ctx.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (rng.chance(0.18)) { ctx.fillStyle = rng.chance(0.5) ? '#b48d5b' : '#987247'; ctx.fillRect(x, y, 1, 1); }
  }
  ctx.strokeStyle = '#6e4d2c';
  ctx.lineWidth = 1;
  for (let r = 2; r <= 7; r += 2) {
    ctx.beginPath();
    ctx.arc(8, 8, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#5a3c21';
  ctx.fillRect(7, 7, 2, 2);
  ctx.strokeStyle = '#4f341c';
  ctx.beginPath();
  ctx.arc(8, 8, 7.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlanks(ctx, rng, dark = false) {
  const base = dark ? '#5a3c25' : '#b1844f';
  const p = dark ? ['#5a3c25', '#4f341f', '#654329', '#472e1b'] : ['#b1844f', '#a87a46', '#bb8f58', '#9d7040'];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (rng.chance(0.22)) { ctx.fillStyle = p[Math.floor(rng.next() * p.length)]; ctx.fillRect(x, y, 1, 1); }
  }
  const seam = dark ? '#2f1f12' : '#6e4a26';
  for (let y = 3; y < 16; y += 4) {
    ctx.fillStyle = seam;
    ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = dark ? '#6b472b' : '#c3965f';
    ctx.fillRect(0, y + 1, 16, 1);
  }
  ctx.fillStyle = seam;
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng.next() * 13) + 1, y = Math.floor(rng.next() * 3) * 4 + 1;
    ctx.fillRect(x, y, 2 + Math.floor(rng.next() * 2), 1);
  }
  ctx.fillStyle = dark ? '#2a1c10' : '#765129';
  ctx.fillRect(2, 3, 1, 1);
  ctx.fillRect(13, 7, 1, 1);
  ctx.fillRect(4, 11, 1, 1);
}

function drawLeaves(ctx, rng, dark = false) {
  const p = dark ? ['#2f532f', '#3a6338', '#274726', '#446e42'] : ['#426b31', '#4e7a39', '#365c29', '#5c8a42'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = dark ? '#1d381d' : '#294a22';
    ctx.fillRect(Math.floor(rng.next() * 16), Math.floor(rng.next() * 16), 1, 1);
  }
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = dark ? '#5b8a58' : '#7aa850';
    ctx.fillRect(Math.floor(rng.next() * 16), Math.floor(rng.next() * 16), 1, 1);
  }
}

function drawSand(ctx, rng) {
  const p = ['#d9c78e', '#d1bd80', '#e2d29b', '#c8b273'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  speckle(ctx, rng, ['#b9a267', '#eadcae'], 16);
}

function drawWater(ctx, rng) {
  const p = ['#3b7597', '#3e7a9c', '#376f91', '#4481a4'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 5; i++) {
    const y = 2 + Math.floor(rng.next() * 12);
    ctx.fillStyle = '#6aa5c4';
    for (let x = Math.floor(rng.next() * 8); x < 16; x += 5) ctx.fillRect(x, y, 3, 1);
  }
  ctx.fillStyle = 'rgba(230,248,255,.25)';
  for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(rng.next() * 15), Math.floor(rng.next() * 15), 2, 1);
}

function drawRoof(ctx, rng) {
  ctx.fillStyle = '#8a3f2c';
  ctx.fillRect(0, 0, 16, 16);
  const p = ['#9d4b34', '#b15a3f', '#843a29', '#a95239'];
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    for (let x = 0; x < 16; x += 4) {
      const off = row % 2 ? 2 : 0;
      ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
      ctx.fillRect((x + off) % 16, y, 4, 4);
      ctx.fillStyle = 'rgba(60,22,15,.35)';
      ctx.fillRect((x + off) % 16, y + 3, 4, 1);
      ctx.fillStyle = 'rgba(255,190,150,.16)';
      ctx.fillRect((x + off) % 16, y, 4, 1);
    }
    ctx.fillStyle = 'rgba(60,22,15,.4)';
    ctx.fillRect(0, y, 16, 1);
  }
}

function drawBricks(ctx, rng) {
  ctx.fillStyle = '#6f716e';
  ctx.fillRect(0, 0, 16, 16);
  const p = ['#8b8b82', '#94948b', '#7f8078', '#9a9a90'];
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const off = row % 2 ? 4 : 0;
    for (let x = -8; x < 16; x += 8) {
      ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
      ctx.fillRect(x + off + 1, y + 1, 6, 2);
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      ctx.fillRect(x + off + 1, y + 1, 6, 1);
    }
  }
  speckle(ctx, rng, ['#a5a59a', '#64665f'], 12);
}

function drawMossy(ctx, rng) {
  drawStone(ctx, rng);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng.next() * 12), y = Math.floor(rng.next() * 12);
    ctx.fillStyle = rng.chance(0.5) ? '#5e7a43' : '#4d6738';
    for (let k = 0; k < 4 + Math.floor(rng.next() * 5); k++) {
      ctx.fillRect(Math.min(15, x + Math.floor(rng.next() * 4)), Math.min(15, y + Math.floor(rng.next() * 4)), 1, 1);
    }
  }
}

function drawMetal(ctx, rng, gold = false) {
  const base = gold ? '#d8b04a' : '#b9bcc2';
  const p = gold ? ['#d8b04a', '#e5c162', '#c99d38', '#f0d47a'] : ['#b9bcc2', '#c5c8ce', '#a9adb3', '#d3d6da'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = gold ? '#9a7424' : '#84888e';
  ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
  ctx.fillStyle = gold ? '#f7e2a0' : '#e2e5e9';
  ctx.fillRect(2, 2, 2, 2); ctx.fillRect(12, 2, 2, 2); ctx.fillRect(2, 12, 2, 2); ctx.fillRect(12, 12, 2, 2);
  ctx.fillStyle = gold ? '#7c5a18' : '#6d7177';
  ctx.fillRect(3, 3, 1, 1); ctx.fillRect(13, 3, 1, 1); ctx.fillRect(3, 13, 1, 1); ctx.fillRect(13, 13, 1, 1);
  ctx.fillStyle = gold ? 'rgba(255,248,200,.4)' : 'rgba(255,255,255,.35)';
  ctx.fillRect(4, 1, 8, 1);
}

function drawPath(ctx, rng) {
  const p = ['#a08d6c', '#94805f', '#ae9c7c', '#897454', '#b5a586'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = rng.chance(0.5) ? '#6f5c40' : '#c6b99d';
    const x = Math.floor(rng.next() * 15), y = Math.floor(rng.next() * 15);
    ctx.fillRect(x, y, 2, 1);
  }
}

function drawGlass(ctx, rng) {
  ctx.fillStyle = '#a8c8ce';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = 'rgba(225,245,248,.55)';
  ctx.fillRect(2, 2, 12, 12);
  ctx.fillStyle = '#6d7a7e';
  ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
  ctx.fillRect(7, 0, 2, 16); ctx.fillRect(0, 7, 16, 2);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(2, 2, 4, 1); ctx.fillRect(2, 3, 2, 2);
  ctx.fillStyle = 'rgba(80,120,130,.2)';
  ctx.fillRect(9, 9, 4, 4);
}

function drawThatch(ctx, rng) {
  const p = ['#b69a51', '#c7ab60', '#a58943', '#d2b76c'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = rng.chance(0.5) ? '#8f7435' : '#e0c981';
    const x = Math.floor(rng.next() * 16);
    ctx.fillRect(x, Math.floor(rng.next() * 12), 1, 2 + Math.floor(rng.next() * 4));
  }
  for (let y = 3; y < 16; y += 5) {
    ctx.fillStyle = 'rgba(110,85,35,.35)';
    ctx.fillRect(0, y, 16, 1);
  }
}

function drawPlaster(ctx, rng) {
  const p = ['#d8cbaa', '#e0d4b5', '#cfc09d', '#e7dcc0'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#b4a480';
    let x = Math.floor(rng.next() * 14) + 1, y = Math.floor(rng.next() * 12) + 2;
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(x, y, 1, 1); x += rng.chance(0.5) ? 1 : 0; y += rng.chance(0.7) ? 1 : 0;
    }
  }
}

function drawWool(ctx, rng, base) {
  const p = [base, shade(base, 10), shade(base, -12), shade(base, 4)];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let y = 0; y < 16; y += 2) {
    for (let x = 0; x < 16; x += 2) {
      ctx.fillStyle = (x / 2 + y / 2) % 2 ? shade(base, 7) : shade(base, -6);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawCrate(ctx, rng) {
  drawPlanks(ctx, rng);
  ctx.fillStyle = '#6d4c26';
  ctx.fillRect(0, 0, 16, 2); ctx.fillRect(0, 14, 16, 2); ctx.fillRect(0, 0, 2, 16); ctx.fillRect(14, 0, 2, 16);
  ctx.fillStyle = '#8d949b';
  ctx.fillRect(2, 6, 12, 2);
  ctx.fillStyle = '#5c6268';
  ctx.fillRect(2, 8, 12, 1);
  ctx.strokeStyle = '#6d4c26';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, 2); ctx.lineTo(14, 14);
  ctx.moveTo(14, 2); ctx.lineTo(2, 14);
  ctx.stroke();
  ctx.fillStyle = '#c9a243';
  ctx.fillRect(7, 6, 2, 2);
}

function drawFlower(ctx, rng) {
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = '#4f7a3a';
  ctx.fillRect(7, 8, 1, 7);
  ctx.fillRect(5, 10, 2, 1);
  ctx.fillRect(9, 12, 2, 1);
  ctx.fillStyle = '#5f8f45';
  ctx.fillRect(6, 9, 1, 1); ctx.fillRect(10, 11, 1, 1);
  const petals = ['#b23a2c', '#c44734', '#9e3025'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.fillStyle = petals[i % petals.length];
    ctx.fillRect(7 + Math.round(Math.cos(a) * 2.2), 5 + Math.round(Math.sin(a) * 2.2), 2, 2);
  }
  ctx.fillStyle = '#e3c14c';
  ctx.fillRect(7, 4, 2, 2);
}

function drawGrassTuft(ctx, rng) {
  ctx.clearRect(0, 0, 16, 16);
  const p = ['#5f8b3f', '#6f9a4a', '#4e7134', '#7aa651'];
  for (let i = 0; i < 14; i++) {
    const x = 2 + Math.floor(rng.next() * 12);
    const h = 4 + Math.floor(rng.next() * 8);
    const lean = rng.chance(0.5) ? 1 : 0;
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    for (let k = 0; k < h; k++) ctx.fillRect(x + (k > h * 0.6 ? lean : 0), 15 - k, 1, 1);
  }
  ctx.fillStyle = '#c9a243';
  ctx.fillRect(5, 6, 1, 1); ctx.fillRect(11, 8, 1, 1);
}

function drawHay(ctx, rng) {
  const p = ['#c4a54c', '#d1b45d', '#b1923c', '#ddc470'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = '#7d6528';
  ctx.fillRect(0, 3, 16, 1); ctx.fillRect(0, 11, 16, 1);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = rng.chance(0.5) ? '#e8d184' : '#9b7c2e';
    ctx.fillRect(Math.floor(rng.next() * 16), Math.floor(rng.next() * 16), 1, 2);
  }
}

function drawBirchSide(ctx, rng) {
  const p = ['#d7cfb4', '#e2dbc3', '#c9c0a5', '#cfc7ac'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = '#3c3a31';
    const x = Math.floor(rng.next() * 12), y = Math.floor(rng.next() * 16);
    ctx.fillRect(x, y, 2 + Math.floor(rng.next() * 3), 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(2, 0, 1, 16);
}

function drawBirchTop(ctx, rng) {
  ctx.fillStyle = '#d8d0b6';
  ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = '#a99f82';
  for (let r = 2; r <= 7; r += 2) {
    ctx.beginPath(); ctx.arc(8, 8, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#8e8264';
  ctx.fillRect(7, 7, 2, 2);
}

function drawBirchPlanks(ctx, rng) {
  const p = ['#c7b78f', '#d0c19b', '#bdac83', '#d8cbaa'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  for (let y = 3; y < 16; y += 4) {
    ctx.fillStyle = '#8f805f'; ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = '#e0d4b5'; ctx.fillRect(0, y + 1, 16, 1);
  }
  speckle(ctx, rng, ['#a29370', '#e2d6b7'], 10);
}

function drawBanner(ctx, rng, base) {
  const p = [base, shade(base, 12), shade(base, -12), shade(base, 4)];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
  ctx.fillStyle = '#d8b45e';
  ctx.fillRect(2, 2, 12, 1);
  ctx.fillRect(3, 13, 10, 1);
  ctx.fillRect(7, 5, 2, 6);
  ctx.fillRect(5, 7, 6, 1);
  ctx.fillRect(4, 5, 2, 1); ctx.fillRect(10, 5, 2, 1);
  ctx.fillRect(4, 4, 1, 1); ctx.fillRect(11, 4, 1, 1);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  for (let x = 3; x < 16; x += 3) ctx.fillRect(x, 0, 1, 16);
}

function drawStoneDark(ctx, rng) {
  const p = ['#5f6368', '#565a5f', '#686c71', '#4e5257'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = p[Math.floor(rng.next() * p.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  speckle(ctx, rng, ['#767b80', '#42464a'], 18);
}

function buildTiles() {
  const drawers = {
    0: drawGrassTop, 1: drawGrassSide, 2: drawDirt, 3: drawStone, 4: drawCobble,
    5: drawLogSide, 6: drawLogTop, 7: (c, r) => drawPlanks(c, r, false),
    8: (c, r) => drawLeaves(c, r, false), 9: (c, r) => drawLeaves(c, r, true),
    10: drawSand, 11: drawWater, 12: drawRoof, 13: drawBricks, 14: drawMossy,
    15: (c, r) => drawMetal(c, r, false), 16: (c, r) => drawMetal(c, r, true),
    17: drawPath, 18: drawGlass, 19: (c, r) => drawPlanks(c, r, true),
    20: drawThatch, 21: drawPlaster, 22: (c, r) => drawWool(c, r, '#8e3128'),
    23: (c, r) => drawWool(c, r, '#36537f'), 24: (c, r) => drawWool(c, r, '#c9a243'),
    25: drawCrate, 26: drawFlower, 27: drawGrassTuft, 28: drawHay,
    29: drawBirchSide, 30: drawBirchTop, 31: drawBirchPlanks,
    32: (c, r) => drawBanner(c, r, '#8e3128'), 33: (c, r) => drawBanner(c, r, '#36537f'),
    34: drawStoneDark,
  };
  for (let i = 0; i < COLS * COLS; i++) {
    const fn = drawers[i];
    if (fn) makeTile(i, fn);
  }
}

export function getAtlasCanvas() {
  if (atlasCache) return atlasCache;
  buildTiles();
  const atlas = document.createElement('canvas');
  atlas.width = ATLAS;
  atlas.height = ATLAS;
  const ctx = atlas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const [index, tile] of tileCanvases) {
    const col = index % COLS, row = Math.floor(index / COLS);
    const x = col * TILE_PX, y = row * TILE_PX;
    ctx.drawImage(tile, x + PAD, y + PAD);
    const edge = (sx, sy, sw, sh, dx, dy, dw, dh) => ctx.drawImage(tile, sx, sy, sw, sh, dx, dy, dw, dh);
    edge(0, 0, 16, 1, x, y, TILE_PX, PAD);
    edge(0, 15, 16, 1, x, y + TILE_PX - PAD, TILE_PX, PAD);
    edge(0, 0, 1, 16, x, y, PAD, TILE_PX);
    edge(15, 0, 1, 16, x + TILE_PX - PAD, y, PAD, TILE_PX);
    edge(0, 0, 1, 1, x, y, PAD, PAD);
    edge(15, 0, 1, 1, x + TILE_PX - PAD, y, PAD, PAD);
    edge(0, 15, 1, 1, x, y + TILE_PX - PAD, PAD, PAD);
    edge(15, 15, 1, 1, x + TILE_PX - PAD, y + TILE_PX - PAD, PAD, PAD);
  }
  atlasCache = atlas;
  return atlas;
}

export const ATLAS_SIZE = ATLAS;
export const TILE_SIZE = TILE_PX;
export const TILE_PAD = PAD;
export const TILE_CONTENT = CONTENT;
export const TILE_COLS = COLS;

export function tileUV(tileIndex) {
  const col = tileIndex % COLS, row = Math.floor(tileIndex / COLS);
  const inset = 0.03;
  const x0 = (col * TILE_PX + PAD + inset) / ATLAS;
  const y0 = (row * TILE_PX + PAD + inset) / ATLAS;
  const x1 = (col * TILE_PX + PAD + CONTENT - inset) / ATLAS;
  const y1 = (row * TILE_PX + PAD + CONTENT - inset) / ATLAS;
  return { x0, y0, x1, y1 };
}

export function tileSourceRect(tileIndex) {
  const col = tileIndex % COLS, row = Math.floor(tileIndex / COLS);
  return { sx: col * TILE_PX + PAD, sy: row * TILE_PX + PAD, sw: CONTENT, sh: CONTENT };
}

export function blockIconDataURL(blockId) {
  const def = BLOCKS[blockId];
  if (!def) return '';
  const atlas = getAtlasCanvas();
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const top = tileSourceRect(def.top);
  const side = tileSourceRect(def.side);
  const drawFace = (src, a, b, e, brightness) => {
    ctx.save();
    ctx.setTransform(a.x / CONTENT, a.y / CONTENT, b.x / CONTENT, b.y / CONTENT, e.x, e.y);
    ctx.drawImage(atlas, src.sx, src.sy, src.sw, src.sh, 0, 0, CONTENT, CONTENT);
    ctx.restore();
    if (brightness !== 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = brightness < 1 ? `rgba(0,0,0,${1 - brightness})` : `rgba(255,255,255,${brightness - 1})`;
      ctx.fillRect(0, 0, 64, 64);
      ctx.restore();
    }
  };
  drawFace(top, { x: 24, y: 14 }, { x: -24, y: 14 }, { x: 32, y: 6 }, 1);
  drawFace(side, { x: 24, y: 14 }, { x: 0, y: 24 }, { x: 8, y: 20 }, 0.78);
  drawFace(side, { x: 24, y: -14 }, { x: 0, y: 24 }, { x: 32, y: 34 }, 0.62);
  ctx.strokeStyle = 'rgba(0,0,0,.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 20); ctx.lineTo(32, 34); ctx.lineTo(56, 20); ctx.lineTo(32, 6); ctx.closePath();
  ctx.moveTo(32, 34); ctx.lineTo(32, 58);
  ctx.stroke();
  return c.toDataURL('image/png');
}

export function makeParticleTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,.9)');
  g.addColorStop(0.75, 'rgba(255,255,255,.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,236,178,1)');
  g.addColorStop(0.18, 'rgba(255,196,92,.8)');
  g.addColorStop(0.5, 'rgba(255,142,40,.24)');
  g.addColorStop(1, 'rgba(255,110,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

export function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(210,205,195,.65)');
  g.addColorStop(0.6, 'rgba(170,165,155,.22)');
  g.addColorStop(1, 'rgba(150,145,135,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}
