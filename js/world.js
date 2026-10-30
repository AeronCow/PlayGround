import * as THREE from 'three';
import { B, isSolid, isWater } from './blocks.js';
import { getAtlasCanvas, tileUV, tileSourceRect, TILE } from './textures.js';
import { RNG, fbm, hash3 } from './noise.js';
import { buildAllStructures } from './structures.js';

export const WORLD_X = 96;
export const WORLD_Z = 96;
export const WORLD_Y = 56;
export const SEA_LEVEL = 8;
export const CHUNK = 16;
const HX = WORLD_X >> 1;
const HZ = WORLD_Z >> 1;

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]], light: 0.84, t: [2, 1] },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]], light: 0.72, t: [2, 1] },
  { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]], light: 1.0, t: [0, 2] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], light: 0.55, t: [0, 2] },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], light: 0.92, t: [0, 1] },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], light: 0.78, t: [0, 1] },
];

const AO_LEVELS = [0.52, 0.68, 0.84, 1.0];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

export class World {
  constructor(seed = 20261030) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.data = new Uint8Array(WORLD_X * WORLD_Z * WORLD_Y);
    this.heights = new Int16Array(WORLD_X * WORLD_Z);
    this.edits = new Map();
    this.group = new THREE.Group();
    this.group.name = 'world';
    this.chunkMeshes = new Map();
    this.decorations = [];
    this.torches = [];
    this.smoke = [];
    this.sites = {};
    this.siteList = [];
    this.meta = {
      spawn: { x: 16.5, y: 20, z: 35.5, yaw: 0, pitch: -0.04 },
      chests: [], shards: [], enemies: [], npcs: [], campfires: [], shrines: [],
    };
    this.atlas = null;
    this.material = null;
    this.waterMaterial = null;
    this.waterTexture = null;
    this.decorMeshes = [];
  }

  index(x, y, z) { return ((y * WORLD_Z) + (z + HZ)) * WORLD_X + (x + HX); }
  hidx(x, z) { return (z + HZ) * WORLD_X + (x + HX); }
  inBounds(x, y, z) { return x >= -HX && x < HX && z >= -HZ && z < HZ && y >= 0 && y < WORLD_Y; }

  getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return B.STONE;
    if (!this.inBounds(x, y, z)) return B.AIR;
    return this.data[this.index(x, y, z)];
  }

  setBlock(x, y, z, id, record = true) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!this.inBounds(x, y, z)) return false;
    this.data[this.index(x, y, z)] = id;
    if (record) this.edits.set(`${x},${y},${z}`, id);
    return true;
  }

  setRaw(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.index(x, y, z)] = id;
  }

  isSolidAt(x, y, z) { return isSolid(this.getBlock(x, y, z)); }
  isWaterAt(x, y, z) { return isWater(this.getBlock(x, y, z)); }
  heightAt(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < -HX || x >= HX || z < -HZ || z >= HZ) return SEA_LEVEL;
    return this.heights[this.hidx(x, z)];
  }

  topSolidY(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < -HX || x >= HX || z < -HZ || z >= HZ) return SEA_LEVEL;
    for (let y = WORLD_Y - 1; y >= 0; y--) if (isSolid(this.getBlock(x, y, z))) return y;
    return 0;
  }

  groundY(x, z) { return this.topSolidY(x, z) + 1; }

  clearBox(x0, y0, z0, x1, y1, z1) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.setBlock(x, y, z, B.AIR, false);
  }

  fillBox(x0, y0, z0, x1, y1, z1, id) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.setBlock(x, y, z, id, false);
  }

  wallRect(x0, z0, x1, z1, y0, height, id, thickness = 1) {
    for (let y = y0; y < y0 + height; y++) {
      for (let t = 0; t < thickness; t++) {
        for (let x = x0 + t; x <= x1 - t; x++) {
          this.setBlock(x, y, z0 + t, id, false);
          this.setBlock(x, y, z1 - t, id, false);
        }
        for (let z = z0 + t; z <= z1 - t; z++) {
          this.setBlock(x0 + t, y, z, id, false);
          this.setBlock(x1 - t, y, z, id, false);
        }
      }
    }
  }

  crenellate(x0, z0, x1, z1, y, id) {
    for (let x = x0; x <= x1; x++) if ((x - x0) % 2 === 0) {
      this.setBlock(x, y, z0, id, false);
      this.setBlock(x, y, z1, id, false);
    }
    for (let z = z0; z <= z1; z++) if ((z - z0) % 2 === 0) {
      this.setBlock(x0, y, z, id, false);
      this.setBlock(x1, y, z, id, false);
    }
  }

  naturalHeight(x, z) {
    const nx = (x + HX) * 0.045;
    const nz = (z + HZ) * 0.045;
    const broad = fbm(nx, nz, 5, this.seed);
    const hills = fbm(nx * 0.45 + 12.7, nz * 0.45 - 8.3, 3, this.seed + 77);
    const ridge = fbm((x + HX) * 0.018 + 4.1, (z + HZ) * 0.018 - 2.6, 4, this.seed + 211);
    const edge = Math.max(Math.abs(x) / HX, Math.abs(z) / HZ);
    let h = 8 + broad * 8 + (hills - 0.5) * 6 + Math.max(0, ridge - 0.54) * 26;
    h += Math.pow(edge, 3.2) * 11;
    const river = 37 + 4.2 * Math.sin(z * 0.085) + 3.1 * Math.sin(z * 0.19 + 1.1);
    const dist = Math.abs(x - river);
    if (dist < 5.5) h -= (5.5 - dist) * 1.85;
    if (dist < 2.5) h -= 1.2;
    return clamp(Math.round(h), 3, 31);
  }

  async build(scene, onProgress = () => {}) {
    onProgress(0.04, 'Raising the mountains…');
    this.generateHeights();
    await tick();
    onProgress(0.16, 'Laying the foundations…');
    this.prepareSites();
    await tick();
    onProgress(0.28, 'Sowing grass and stone…');
    this.fillTerrain();
    await tick();
    onProgress(0.4, 'Paving the old roads…');
    this.paintPaths();
    await tick();
    onProgress(0.52, 'Building the villages and keeps…');
    buildAllStructures(this);
    await tick();
    onProgress(0.64, 'Planting the deep woods…');
    this.plantTrees();
    await tick();
    onProgress(0.74, 'Scattering wildflowers…');
    this.createMaterials();
    this.collectDecorations();
    this.buildDecorMeshes(scene);
    await tick();
    onProgress(0.82, 'Carving the land into chunks…');
    await this.buildMeshes(scene, onProgress);
    await tick();
    onProgress(0.98, 'Waking the realm…');
    this.finalizeMeta();
    scene.add(this.group);
    onProgress(1, 'The realm is ready.');
  }

  generateHeights() {
    for (let z = -HZ; z < HZ; z++) for (let x = -HX; x < HX; x++) {
      this.heights[this.hidx(x, z)] = this.naturalHeight(x, z);
    }
  }

  prepareSites() {
    const sites = {
      village: { cx: 16, cz: 16, hw: 13, hd: 13, blend: 5, min: 9, max: 13 },
      castle: { cx: -18, cz: -18, hw: 16, hd: 16, blend: 6, min: 14, max: 22, force: 2 },
      ruins: { cx: 22, cz: -28, hw: 7, hd: 7, blend: 4, min: 7, max: 18 },
      stones: { cx: -30, cz: 12, hw: 10, hd: 10, blend: 5, min: 12, max: 20, force: 1 },
      camp: { cx: -2, cz: 34, hw: 6, hd: 6, blend: 4, min: 8, max: 16 },
    };
    for (const site of Object.values(sites)) {
      let sum = 0, count = 0;
      for (let z = site.cz - site.hd; z <= site.cz + site.hd; z++) for (let x = site.cx - site.hw; x <= site.cx + site.hw; x++) {
        sum += this.heights[this.hidx(x, z)]; count++;
      }
      site.target = clamp(Math.round(sum / count + (site.force || 0)), site.min, site.max);
      for (let z = site.cz - site.hd - site.blend; z <= site.cz + site.hd + site.blend; z++) {
        for (let x = site.cx - site.hw - site.blend; x <= site.cx + site.hw + site.blend; x++) {
          if (x < -HX || x >= HX || z < -HZ || z >= HZ) continue;
          const dx = Math.max(site.cx - site.hw - x, 0, x - (site.cx + site.hw));
          const dz = Math.max(site.cz - site.hd - z, 0, z - (site.cz + site.hd));
          const d = Math.max(dx, dz);
          if (d <= 0) this.heights[this.hidx(x, z)] = site.target;
          else if (d <= site.blend) this.heights[this.hidx(x, z)] = Math.round(lerp(site.target, this.heights[this.hidx(x, z)], smooth(d / site.blend)));
        }
      }
    }
    this.siteList = Object.values(sites);
    this.village = sites.village;
    this.castle = sites.castle;
    this.ruins = sites.ruins;
    this.stones = sites.stones;
    this.camp = sites.camp;
  }

  fillTerrain() {
    for (let z = -HZ; z < HZ; z++) for (let x = -HX; x < HX; x++) {
      const h = this.heights[this.hidx(x, z)];
      const beach = h <= SEA_LEVEL + 1;
      const high = h > 22;
      for (let y = 0; y <= h; y++) {
        let id = B.STONE;
        if (y > h - 4) id = B.DIRT;
        if (y === h) id = beach ? B.SAND : high ? (h > 27 ? B.STONE_DARK : B.STONE) : B.GRASS;
        this.setRaw(x, y, z, id);
      }
      if (h < SEA_LEVEL) {
        for (let y = h + 1; y <= SEA_LEVEL; y++) this.setRaw(x, y, z, B.WATER);
        if (h > SEA_LEVEL - 2) this.setRaw(x, h, z, B.SAND);
      }
    }
  }

  paintColumn(x, z, id = B.PATH, clear = 2) {
    if (x < -HX || x >= HX || z < -HZ || z >= HZ) return;
    const h = this.heights[this.hidx(x, z)];
    if (h <= SEA_LEVEL) return;
    this.setRaw(x, h, z, id);
    for (let k = 1; k <= clear; k++) this.setRaw(x, h + k, z, B.AIR);
  }

  paintPath(x0, z0, x1, z1, width = 2, id = B.PATH) {
    const dx = x1 - x0, dz = z1 - z0;
    const steps = Math.max(Math.abs(dx), Math.abs(dz)) * 2;
    const half = width >> 1;
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x0 + dx * t), z = Math.round(z0 + dz * t);
      for (let oz = -half; oz <= half; oz++) for (let ox = -half; ox <= half; ox++) this.paintColumn(x + ox, z + oz, id);
    }
  }

  paintPaths() {
    this.paintPath(16, 36, 16, 29, 3);
    this.paintPath(16, 29, 16, 18, 3);
    this.paintPath(16, 18, 16, 9, 2);
    this.paintPath(16, 18, 7, 18, 2);
    this.paintPath(7, 18, 7, 21, 2);
    this.paintPath(16, 18, 29, 18, 2);
    this.paintPath(29, 18, 36, 13, 2);
    this.paintPath(36, 13, 38, 10, 2);
    this.paintPath(16, 18, 4, 18, 2);
    this.paintPath(4, 18, -6, 10, 2);
    this.paintPath(-6, 10, -18, 2, 2);
    this.paintPath(-18, 2, -18, -4, 2);
    this.paintPath(16, 29, 6, 32, 2);
    this.paintPath(6, 32, -2, 34, 2);
    this.paintPath(22, -28, 18, -20, 2);
    this.paintPath(18, -20, 16, -12, 2);
    this.paintPath(-30, 12, -18, 4, 2);
    this.paintPath(-30, 12, -30, 3, 2);
    for (let z = 15; z <= 20; z++) for (let x = 13; x <= 20; x++) this.paintColumn(x, z, B.COBBLE, 3);
    for (let z = 12; z <= 14; z++) for (let x = 14; x <= 18; x++) this.paintColumn(x, z, B.COBBLE, 3);
  }

  inSite(x, z, margin = 0) {
    for (const site of this.siteList) {
      if (x >= site.cx - site.hw - margin && x <= site.cx + site.hw + margin &&
          z >= site.cz - site.hd - margin && z <= site.cz + site.hd + margin) return true;
    }
    return false;
  }

  plantTrees() {
    for (let z = -HZ + 3; z < HZ - 3; z++) {
      for (let x = -HX + 3; x < HX - 3; x++) {
        const h = this.heights[this.hidx(x, z)];
        if (h <= SEA_LEVEL + 1) continue;
        if (this.getBlock(x, h, z) !== B.GRASS) continue;
        if (this.inSite(x, z, 3)) continue;
        const forest = fbm((x + HX) * 0.055 + 3.7, (z + HZ) * 0.055 - 9.1, 4, this.seed + 909);
        const p = clamp((forest - 0.46) * 0.5, 0, 0.14);
        if (hash3(x, z, 3, this.seed) > p) continue;
        const type = hash3(x, z, 9, this.seed + 4);
        if (type > 0.78) this.placePine(x, h + 1, z);
        else if (type > 0.64) this.placeBirch(x, h + 1, z);
        else this.placeOak(x, h + 1, z);
      }
    }
  }

  placeOak(x, y, z) {
    const height = 4 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < height; i++) this.setBlock(x, y + i, z, B.LOG, false);
    const top = y + height;
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy === 2 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && this.rng.chance(0.55)) continue;
        if (dx === 0 && dz === 0 && dy < 2) continue;
        if (this.getBlock(x + dx, top + dy, z + dz) === B.AIR) this.setBlock(x + dx, top + dy, z + dz, this.rng.chance(0.18) ? B.LEAVES_DARK : B.LEAVES, false);
      }
    }
  }

  placePine(x, y, z) {
    const height = 6 + Math.floor(this.rng.next() * 4);
    for (let i = 0; i < height; i++) this.setBlock(x, y + i, z, B.LOG, false);
    for (let i = 0; i < 5; i++) {
      const yy = y + height - 1 - i;
      const r = i < 2 ? 2 : i < 4 ? 1 : 0;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
        if (this.getBlock(x + dx, yy, z + dz) === B.AIR) this.setBlock(x + dx, yy, z + dz, B.LEAVES_DARK, false);
      }
    }
  }

  placeBirch(x, y, z) {
    const height = 5 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < height; i++) this.setBlock(x, y + i, z, B.BIRCH_LOG, false);
    const top = y + height;
    for (let dy = -1; dy <= 1; dy++) {
      const r = dy === 1 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
        if (dx === 0 && dz === 0 && dy < 1) continue;
        if (this.getBlock(x + dx, top + dy, z + dz) === B.AIR) this.setBlock(x + dx, top + dy, z + dz, B.LEAVES, false);
      }
    }
  }

  createMaterials() {
    const canvas = getAtlasCanvas();
    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.generateMipmaps = false;
    this.material = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });

    const wc = document.createElement('canvas');
    wc.width = 16; wc.height = 16;
    const src = tileSourceRect(TILE.WATER);
    wc.getContext('2d').drawImage(canvas, src.sx, src.sy, src.sw, src.sh, 0, 0, 16, 16);
    this.waterTexture = new THREE.CanvasTexture(wc);
    this.waterTexture.colorSpace = THREE.SRGBColorSpace;
    this.waterTexture.wrapS = THREE.RepeatWrapping;
    this.waterTexture.wrapT = THREE.RepeatWrapping;
    this.waterTexture.magFilter = THREE.NearestFilter;
    this.waterTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.waterMaterial = new THREE.MeshStandardMaterial({
      map: this.waterTexture, transparent: true, opacity: 0.82,
      roughness: 0.22, metalness: 0.06, depthWrite: false, side: THREE.DoubleSide,
    });
  }

  collectDecorations() {
    this.decorations.length = 0;
    for (let z = -HZ + 1; z < HZ - 1; z++) {
      for (let x = -HX + 1; x < HX - 1; x++) {
        const h = this.heights[this.hidx(x, z)];
        if (this.getBlock(x, h, z) !== B.GRASS) continue;
        if (this.getBlock(x, h + 1, z) !== B.AIR) continue;
        const r = hash3(x, z, 31, this.seed);
        if (r > 0.38) continue;
        const type = r < 0.045 ? 'flower' : 'tuft';
        this.decorations.push({
          x: x + 0.18 + hash3(x, z, 3, this.seed) * 0.64,
          y: h + 1,
          z: z + 0.18 + hash3(x, z, 4, this.seed) * 0.64,
          type,
          rot: hash3(x, z, 5, this.seed) * Math.PI,
          scale: 0.75 + hash3(x, z, 6, this.seed) * 0.55,
        });
      }
    }
  }

  buildDecorMeshes(scene) {
    const makeGeometry = (tile) => {
      const uv = tileUV(tile);
      const positions = [
        -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0,
        0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5,
      ];
      const uvs = [];
      for (let i = 0; i < 2; i++) {
        uvs.push(uv.x0, uv.y0, uv.x1, uv.y0, uv.x1, uv.y1, uv.x0, uv.y1);
      }
      const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      g.computeVertexNormals();
      return g;
    };
    const mat = new THREE.MeshLambertMaterial({ map: this.atlas, alphaTest: 0.45, side: THREE.DoubleSide });
    const dummy = new THREE.Object3D();
    for (const type of ['tuft', 'flower']) {
      const list = this.decorations.filter((d) => d.type === type);
      if (!list.length) continue;
      const geo = makeGeometry(type === 'flower' ? TILE.FLOWER : TILE.GRASS_TUFT);
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.frustumCulled = false;
      list.forEach((d, i) => {
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(0, d.rot, 0);
        dummy.scale.set(d.scale, d.scale * (type === 'flower' ? 0.9 : 1.0), d.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.decorMeshes.push(mesh);
    }
  }

  solidForAO(x, y, z) {
    const id = this.getBlock(x, y, z);
    return id !== B.AIR && id !== B.WATER;
  }

  buildChunkGeometry(cx, cz) {
    const x0 = -HX + cx * CHUNK, z0 = -HZ + cz * CHUNK;
    const solid = { pos: [], nor: [], uv: [], col: [], idx: [] };
    const water = { pos: [], nor: [], uv: [], idx: [] };
    const tint = (x, y, z) => 0.93 + hash3(x, y, z, this.seed + 17) * 0.13;

    for (let z = z0; z < z0 + CHUNK; z++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        for (let y = 0; y < WORLD_Y; y++) {
          const id = this.getBlock(x, y, z);
          if (id === B.AIR) continue;
          const def = id === B.WATER ? null : (BLOCK_FACES[id] || null);
          if (id === B.WATER) {
            for (let f = 0; f < 6; f++) {
              const face = FACES[f];
              const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
              const nid = this.getBlock(nx, ny, nz);
              if (nid !== B.AIR) continue;
              const base = water.pos.length / 3;
              for (let v = 0; v < 4; v++) {
                const c = face.corners[v];
                const px = x + c[0], py = y + c[1], pz = z + c[2];
                water.pos.push(px, py, pz);
                water.nor.push(face.dir[0], face.dir[1], face.dir[2]);
                if (f === 2) water.uv.push(px * 0.22, pz * 0.22);
                else water.uv.push((px + pz) * 0.22, py * 0.22);
              }
              water.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
            continue;
          }
          const faces = def;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
            const nid = this.getBlock(nx, ny, nz);
            if (nid !== B.AIR && nid !== B.WATER) continue;
            const tile = f === 2 ? def.top : f === 3 ? def.bottom : def.side;
            const uv = tileUV(tile);
            const base = solid.pos.length / 3;
            const t = tint(x, y, z);
            for (let v = 0; v < 4; v++) {
              const c = face.corners[v];
              const px = x + c[0], py = y + c[1], pz = z + c[2];
              const s1 = c[face.t[0]] * 2 - 1;
              const s2 = c[face.t[1]] * 2 - 1;
              const ax = nx, ay = ny, az = nz;
              const bx = ax, by = ay, bz = az;
              const p1 = [ax, ay, az]; p1[face.t[0]] += s1;
              const p2 = [ax, ay, az]; p2[face.t[1]] += s2;
              const p3 = [ax, ay, az]; p3[face.t[0]] += s1; p3[face.t[1]] += s2;
              const o1 = this.solidForAO(p1[0], p1[1], p1[2]) ? 1 : 0;
              const o2 = this.solidForAO(p2[0], p2[1], p2[2]) ? 1 : 0;
              const oc = this.solidForAO(p3[0], p3[1], p3[2]) ? 1 : 0;
              const ao = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
              const brightness = face.light * AO_LEVELS[ao] * t;
              solid.pos.push(px, py, pz);
              solid.nor.push(face.dir[0], face.dir[1], face.dir[2]);
              const u = face.uv[v];
              solid.uv.push(uv.x0 + u[0] * (uv.x1 - uv.x0), uv.y0 + u[1] * (uv.y1 - uv.y0));
              solid.col.push(brightness, brightness, brightness);
            }
            solid.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }

    const make = (data, material, castShadow) => {
      if (!data.pos.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(data.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
      if (data.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      g.setIndex(data.idx);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, material);
      m.castShadow = castShadow;
      m.receiveShadow = true;
      return m;
    };
    return {
      solid: make(solid, this.material, true),
      water: make(water, this.waterMaterial, false),
    };
  }

  async buildMeshes(scene, onProgress = () => {}) {
    const total = (WORLD_X / CHUNK) * (WORLD_Z / CHUNK);
    let done = 0;
    for (let cz = 0; cz < WORLD_Z / CHUNK; cz++) {
      for (let cx = 0; cx < WORLD_X / CHUNK; cx++) {
        const { solid, water } = this.buildChunkGeometry(cx, cz);
        if (solid) this.group.add(solid);
        if (water) this.group.add(water);
        this.chunkMeshes.set(`${cx},${cz}`, { solid, water });
        done++;
        if (done % 4 === 0) {
          onProgress(0.82 + (done / total) * 0.15, 'Carving the land into chunks…');
          await tick();
        }
      }
    }
  }

  updateChunk(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= WORLD_X / CHUNK || cz >= WORLD_Z / CHUNK) return;
    const key = `${cx},${cz}`;
    const old = this.chunkMeshes.get(key);
    if (old) {
      for (const m of [old.solid, old.water]) {
        if (!m) continue;
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
    const { solid, water } = this.buildChunkGeometry(cx, cz);
    if (solid) this.group.add(solid);
    if (water) this.group.add(water);
    this.chunkMeshes.set(key, { solid, water });
  }

  updateBlockMesh(x, z) {
    const cx = Math.floor((x + HX) / CHUNK), cz = Math.floor((z + HZ) / CHUNK);
    const lx = (x + HX) % CHUNK, lz = (z + HZ) % CHUNK;
    this.updateChunk(cx, cz);
    if (lx === 0) this.updateChunk(cx - 1, cz);
    if (lx === CHUNK - 1) this.updateChunk(cx + 1, cz);
    if (lz === 0) this.updateChunk(cx, cz - 1);
    if (lz === CHUNK - 1) this.updateChunk(cx, cz + 1);
  }

  applyEdits(edits) {
    for (const [key, id] of edits) {
      const [x, y, z] = key.split(',').map(Number);
      this.setRaw(x, y, z, id);
      this.edits.set(key, id);
    }
    for (let cz = 0; cz < WORLD_Z / CHUNK; cz++) for (let cx = 0; cx < WORLD_X / CHUNK; cx++) this.updateChunk(cx, cz);
  }

  finalizeMeta() {
    this.meta.spawn.y = this.groundY(16, 35) + 0.05;
    this.meta.spawn.yaw = 0;
    this.meta.spawn.pitch = -0.03;
    for (const npc of this.meta.npcs) npc.y = this.groundY(npc.x, npc.z) + 0.02;
    for (const e of this.meta.enemies) e.y = this.groundY(e.x, e.z) + 0.02;
    for (const c of this.meta.chests) c.y = this.groundY(c.x, c.z) + 0.02;
    for (const s of this.meta.shards) s.baseY = s.y;
    this.meta.village = { x: 16.5, y: this.village.target + 1, z: 16.5 };
    this.meta.castle = { x: -18.5, y: this.castle.target + 1, z: -18.5 };
  }

  update(dt) {
    if (this.waterTexture) {
      this.waterTexture.offset.x = (this.waterTexture.offset.x + dt * 0.018) % 1;
      this.waterTexture.offset.y = (this.waterTexture.offset.y + dt * 0.009) % 1;
    }
  }
}

const BLOCK_FACES = [];
BLOCK_FACES[B.GRASS] = { top: TILE.GRASS_TOP, bottom: TILE.DIRT, side: TILE.GRASS_SIDE };
BLOCK_FACES[B.DIRT] = { top: TILE.DIRT, bottom: TILE.DIRT, side: TILE.DIRT };
BLOCK_FACES[B.STONE] = { top: TILE.STONE, bottom: TILE.STONE, side: TILE.STONE };
BLOCK_FACES[B.COBBLE] = { top: TILE.COBBLE, bottom: TILE.COBBLE, side: TILE.COBBLE };
BLOCK_FACES[B.LOG] = { top: TILE.LOG_TOP, bottom: TILE.LOG_TOP, side: TILE.LOG_SIDE };
BLOCK_FACES[B.PLANKS] = { top: TILE.PLANKS, bottom: TILE.PLANKS, side: TILE.PLANKS };
BLOCK_FACES[B.LEAVES] = { top: TILE.LEAVES, bottom: TILE.LEAVES, side: TILE.LEAVES };
BLOCK_FACES[B.LEAVES_DARK] = { top: TILE.LEAVES_DARK, bottom: TILE.LEAVES_DARK, side: TILE.LEAVES_DARK };
BLOCK_FACES[B.SAND] = { top: TILE.SAND, bottom: TILE.SAND, side: TILE.SAND };
BLOCK_FACES[B.ROOF] = { top: TILE.ROOF, bottom: TILE.ROOF, side: TILE.ROOF };
BLOCK_FACES[B.BRICKS] = { top: TILE.BRICKS, bottom: TILE.BRICKS, side: TILE.BRICKS };
BLOCK_FACES[B.MOSSY] = { top: TILE.MOSSY, bottom: TILE.MOSSY, side: TILE.MOSSY };
BLOCK_FACES[B.IRON] = { top: TILE.IRON, bottom: TILE.IRON, side: TILE.IRON };
BLOCK_FACES[B.GOLD] = { top: TILE.GOLD, bottom: TILE.GOLD, side: TILE.GOLD };
BLOCK_FACES[B.PATH] = { top: TILE.PATH, bottom: TILE.PATH, side: TILE.PATH };
BLOCK_FACES[B.GLASS] = { top: TILE.GLASS, bottom: TILE.GLASS, side: TILE.GLASS };
BLOCK_FACES[B.DARK_PLANKS] = { top: TILE.DARK_PLANKS, bottom: TILE.DARK_PLANKS, side: TILE.DARK_PLANKS };
BLOCK_FACES[B.THATCH] = { top: TILE.THATCH, bottom: TILE.THATCH, side: TILE.THATCH };
BLOCK_FACES[B.PLASTER] = { top: TILE.PLASTER, bottom: TILE.PLASTER, side: TILE.PLASTER };
BLOCK_FACES[B.WOOL_RED] = { top: TILE.WOOL_RED, bottom: TILE.WOOL_RED, side: TILE.WOOL_RED };
BLOCK_FACES[B.WOOL_BLUE] = { top: TILE.WOOL_BLUE, bottom: TILE.WOOL_BLUE, side: TILE.WOOL_BLUE };
BLOCK_FACES[B.WOOL_GOLD] = { top: TILE.WOOL_GOLD, bottom: TILE.WOOL_GOLD, side: TILE.WOOL_GOLD };
BLOCK_FACES[B.CRATE] = { top: TILE.CRATE, bottom: TILE.CRATE, side: TILE.CRATE };
BLOCK_FACES[B.HAY] = { top: TILE.HAY, bottom: TILE.HAY, side: TILE.HAY };
BLOCK_FACES[B.COBBLE_MOSSY] = { top: TILE.MOSSY, bottom: TILE.MOSSY, side: TILE.MOSSY };
BLOCK_FACES[B.BIRCH_LOG] = { top: TILE.BIRCH_TOP, bottom: TILE.BIRCH_TOP, side: TILE.BIRCH_SIDE };
BLOCK_FACES[B.BIRCH_PLANKS] = { top: TILE.BIRCH_PLANKS, bottom: TILE.BIRCH_PLANKS, side: TILE.BIRCH_PLANKS };
BLOCK_FACES[B.BANNER_RED] = { top: TILE.BANNER_RED, bottom: TILE.BANNER_RED, side: TILE.BANNER_RED };
BLOCK_FACES[B.BANNER_BLUE] = { top: TILE.BANNER_BLUE, bottom: TILE.BANNER_BLUE, side: TILE.BANNER_BLUE };
BLOCK_FACES[B.STONE_DARK] = { top: TILE.STONE_DARK, bottom: TILE.STONE_DARK, side: TILE.STONE_DARK };
