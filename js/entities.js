import * as THREE from 'three';
import { B } from './blocks.js';
import { makeGlowTexture, makeParticleTexture, makeSmokeTexture } from './textures.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function mat(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

function box(w, h, d, color, x = 0, y = 0, z = 0, extra = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeLabel(text, color = '#f2e4c2', bg = 'rgba(18,15,9,.72)', scale = 1) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  if (bg) {
    ctx.fillStyle = bg;
    const w = Math.min(480, ctx.measureText(text).width + 80);
    roundRect(ctx, 256 - w / 2, 22, w, 74, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,180,95,.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.font = '600 46px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 62);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true }));
  sprite.scale.set(2.4 * scale, 0.6 * scale, 1);
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function healthSprite() {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 24;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true }));
  sprite.scale.set(1.35, 0.2, 1);
  const draw = (ratio) => {
    ctx.clearRect(0, 0, 160, 24);
    ctx.fillStyle = 'rgba(8,7,5,.82)';
    roundRect(ctx, 2, 4, 156, 16, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(217,180,95,.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = ratio > 0.5 ? '#b53a2a' : '#d18a2e';
    roundRect(ctx, 5, 7, 150 * clamp(ratio, 0, 1), 10, 3); ctx.fill();
    tex.needsUpdate = true;
  };
  return { sprite, draw };
}

class Particles {
  constructor(scene, count, additive = false) {
    this.count = count;
    this.cursor = 0;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.gravity = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.baseSize = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry = g;
    const material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: new THREE.CanvasTexture(makeParticleTexture()) } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = color; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / max(0.1, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          float a = tex.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, color, opts = {}) {
    const i = this.cursor++ % this.count;
    const c = new THREE.Color(color);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    const speed = opts.speed ?? 2;
    this.vel[i * 3] = (Math.random() - 0.5) * speed;
    this.vel[i * 3 + 1] = (opts.up ?? 1) + Math.random() * speed * 0.7;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * speed;
    this.life[i] = this.maxLife[i] = opts.life ?? 0.8;
    this.gravity[i] = opts.gravity ?? -7;
    this.drag[i] = opts.drag ?? 0.94;
    this.baseSize[i] = opts.size ?? 0.12;
    this.size[i] = this.baseSize[i];
    this.alpha[i] = 1;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const p = i * 3;
      this.vel[p + 1] += this.gravity[i] * dt;
      this.vel[p] *= this.drag[i];
      this.vel[p + 1] *= this.drag[i];
      this.vel[p + 2] *= this.drag[i];
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      const t = clamp(this.life[i] / this.maxLife[i], 0, 1);
      this.alpha[i] = t;
      this.size[i] = this.baseSize[i] * (0.5 + t * 0.5);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

function createHumanoid(colors, role) {
  const g = new THREE.Group();
  const robe = colors.robe, trim = colors.trim;
  const body = box(0.56, 0.72, 0.32, robe, 0, 1.08, 0);
  const skirt = box(0.64, 0.5, 0.38, robe, 0, 0.58, 0);
  const head = box(0.36, 0.36, 0.34, colors.skin || '#c79d70', 0, 1.63, 0);
  const hair = box(0.38, 0.12, 0.36, colors.hair || '#4a3826', 0, 1.8, 0);
  const armL = box(0.15, 0.58, 0.16, robe, -0.37, 1.12, 0);
  const armR = box(0.15, 0.58, 0.16, robe, 0.37, 1.12, 0);
  const legL = box(0.19, 0.52, 0.22, colors.legs || '#3a3025', -0.15, 0.29, 0);
  const legR = box(0.19, 0.52, 0.22, colors.legs || '#3a3025', 0.15, 0.29, 0);
  const belt = box(0.58, 0.1, 0.34, trim, 0, 0.82, 0);
  g.add(body, skirt, head, hair, armL, armR, legL, legR, belt);
  if (role === 'elder') {
    g.add(box(0.3, 0.18, 0.1, '#e8e1cf', 0, 1.49, 0.18));
    const staff = box(0.06, 1.6, 0.06, '#5b4227', 0.46, 0.95, 0.05);
    staff.rotation.z = -0.08;
    g.add(staff);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshStandardMaterial({ color: '#d9b45f', emissive: '#8f6d31', emissiveIntensity: 0.8, roughness: 0.35 }));
    gem.position.set(0.53, 1.78, 0.05);
    g.add(gem);
  }
  if (role === 'guard') {
    g.add(box(0.34, 0.42, 0.12, trim, 0, 1.14, 0.23));
    g.add(box(0.12, 0.34, 0.12, '#8b8f96', -0.45, 1.22, 0));
    g.add(box(0.5, 0.12, 0.2, '#6f757c', -0.45, 1.41, 0));
    g.add(box(0.36, 0.16, 0.36, '#5b6067', 0, 1.86, 0));
  }
  if (role === 'villager') {
    g.add(box(0.44, 0.34, 0.1, trim, 0, 1.12, 0.2));
  }
  g.userData.parts = { armL, armR, legL, legR, head, body };
  return g;
}

export class EntityManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.npcs = [];
    this.enemies = [];
    this.chests = [];
    this.shards = [];
    this.torches = [];
    this.campfires = [];
    this.debris = new Particles(scene, 600, false);
    this.sparkles = new Particles(scene, 320, true);
    this.smoke = new Particles(scene, 260, false);
    this.glowTex = new THREE.CanvasTexture(makeGlowTexture());
    this.glowTex.colorSpace = THREE.SRGBColorSpace;
    this.smokeTex = new THREE.CanvasTexture(makeSmokeTexture());
    this.time = 0;
    this.lightBudget = 6;
  }

  build() {
    this.buildTorches();
    this.buildCampfires();
    this.buildNPCs();
    this.buildChests();
    this.buildShards();
    this.buildEnemies();
  }

  buildTorches() {
    const glowMat = new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffc26a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 });
    let lights = 0;
    for (const t of this.world.torches) {
      if (t.campfire) continue;
      const g = new THREE.Group();
      g.position.set(t.x, t.y, t.z);
      const stick = box(0.08, 0.62, 0.08, '#5b3f22', 0, -0.31, 0);
      stick.rotation.z = 0.12;
      g.add(stick);
      const flame = new THREE.Sprite(glowMat.clone());
      flame.scale.set(0.7, 0.9, 1);
      flame.position.y = 0.08;
      g.add(flame);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xfff0b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.scale.set(0.25, 0.4, 1);
      core.position.y = 0.12;
      g.add(core);
      if (t.light && lights < this.lightBudget) {
        const light = new THREE.PointLight(0xffa44e, 14, 11, 2);
        light.position.y = 0.25;
        g.add(light);
        lights++;
      }
      g.userData.flame = flame;
      g.userData.core = core;
      g.userData.baseScale = 1;
      this.torches.push(g);
      this.scene.add(g);
    }
  }

  buildCampfires() {
    for (const c of this.world.meta.campfires) {
      const g = new THREE.Group();
      g.position.set(c.x, c.y, c.z);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const log = box(0.55, 0.12, 0.14, '#5b3f22', Math.cos(a) * 0.38, 0.1, Math.sin(a) * 0.38);
        log.rotation.y = -a;
        log.rotation.z = 0.18;
        g.add(log);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff9d3c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.7, 1.8, 1);
      glow.position.y = 0.55;
      g.add(glow);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffe6a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.scale.set(0.55, 0.9, 1);
      core.position.y = 0.45;
      g.add(core);
      if (this.lightBudget > 0) {
        const light = new THREE.PointLight(0xff9c45, 18, 12, 2);
        light.position.y = 0.7;
        g.add(light);
        this.lightBudget--;
      }
      g.userData.glow = glow;
      g.userData.core = core;
      g.userData.fire = c;
      this.campfires.push(g);
      this.scene.add(g);
    }
  }

  buildNPCs() {
    for (const n of this.world.meta.npcs) {
      const g = createHumanoid({ robe: n.robe, trim: n.trim, skin: '#c79d70', hair: n.role === 'elder' ? '#d9d2c2' : '#4a3826' }, n.role);
      g.position.set(n.x, n.y, n.z);
      g.rotation.y = n.yaw;
      const label = makeLabel(n.name, n.role === 'elder' ? '#f0d693' : '#eadfc6');
      label.position.y = 2.25;
      g.add(label);
      g.userData.npc = n;
      g.userData.label = label;
      g.userData.baseY = n.y;
      g.userData.phase = Math.random() * TAU;
      this.npcs.push(g);
      this.scene.add(g);
    }
  }

  buildChests() {
    for (const c of this.world.meta.chests) {
      const g = new THREE.Group();
      g.position.set(c.x, c.y, c.z);
      g.rotation.y = c.yaw;
      const base = box(0.9, 0.5, 0.62, '#8a5f31', 0, 0.25, 0);
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.5, -0.31);
      const lid = box(0.92, 0.2, 0.64, '#9c6d3a', 0, 0.1, 0.31);
      lidPivot.add(lid);
      const band = box(0.96, 0.09, 0.66, '#6a6f75', 0, 0.3, 0);
      const lock = box(0.14, 0.16, 0.06, '#d8b45e', 0, 0.4, 0.34);
      g.add(base, lidPivot, band, lock);
      g.userData.chest = c;
      g.userData.lid = lidPivot;
      g.userData.open = false;
      this.chests.push(g);
      this.scene.add(g);
    }
  }

  buildShards() {
    for (const s of this.world.meta.shards) {
      const g = new THREE.Group();
      g.position.set(s.x, s.y, s.z);
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3, 0),
        new THREE.MeshStandardMaterial({ color: '#f6d783', emissive: '#d8a83a', emissiveIntensity: 1.4, metalness: 0.5, roughness: 0.18 }),
      );
      crystal.castShadow = true;
      g.add(crystal);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffd77a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
      glow.scale.set(1.5, 1.5, 1);
      g.add(glow);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.015, 6, 24), new THREE.MeshBasicMaterial({ color: '#e8c06a', transparent: true, opacity: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.35;
      g.add(ring);
      g.userData.shard = s;
      g.userData.crystal = crystal;
      g.userData.glow = glow;
      g.userData.ring = ring;
      g.userData.collected = !!s.collected;
      g.visible = !s.collected;
      this.shards.push(g);
      this.scene.add(g);
    }
  }

  buildEnemies() {
    for (const e of this.world.meta.enemies) {
      const colors = e.boss
        ? { robe: '#1d1d22', trim: '#8a2b22', skin: '#3a3430', hair: '#111114', legs: '#222226' }
        : { robe: '#4b3b2a', trim: '#7d3a2c', skin: '#a97c55', hair: '#2f2419', legs: '#2d2a22' };
      const g = createHumanoid(colors, 'villager');
      const scale = e.boss ? 1.3 : 1;
      g.scale.setScalar(scale);
      g.position.set(e.x, e.y, e.z);
      const sword = box(0.08, 0.95, 0.14, '#a8adb4', 0.48, 1.1, 0.1);
      sword.rotation.z = -0.25;
      sword.rotation.x = 0.25;
      g.add(sword);
      if (e.boss) {
        g.add(box(0.42, 0.5, 0.12, '#24242b', -0.44, 1.16, 0.1));
        const plume = box(0.16, 0.3, 0.5, '#8a2b22', 0, 1.98, -0.1);
        plume.rotation.x = -0.3;
        g.add(plume);
        const horns = box(0.5, 0.1, 0.12, '#3b3b42', 0, 1.95, 0.16);
        g.add(horns);
      }
      const hp = healthSprite();
      hp.sprite.position.y = 2.35;
      hp.draw(1);
      g.add(hp.sprite);
      g.userData.enemy = e;
      g.userData.hp = e.hp;
      g.userData.maxHp = e.hp;
      g.userData.healthSprite = hp;
      g.userData.attackCd = 0;
      g.userData.attackAnim = 0;
      g.userData.dead = false;
      g.userData.deadTimer = 0;
      g.userData.wander = { x: e.x, z: e.z, timer: Math.random() * 3 };
      g.userData.phase = Math.random() * TAU;
      g.userData.baseY = e.y;
      this.enemies.push(g);
      this.scene.add(g);
    }
  }

  entityBlocked(x, y, z) {
    return this.world.isSolidAt(x, y, z) || this.world.isSolidAt(x, y + 1, z);
  }

  moveGround(g, dx, dz) {
    const w = this.world;
    const tryAxis = (ax, az) => {
      const nx = g.position.x + ax, nz = g.position.z + az;
      const gy = w.groundY(nx, nz);
      if (Math.abs(gy - g.position.y) > 1.25) return false;
      if (this.entityBlocked(nx, gy, nz)) return false;
      g.position.x = nx; g.position.z = nz; g.position.y = gy;
      return true;
    };
    if (!tryAxis(dx, dz)) { tryAxis(dx, 0); tryAxis(0, dz); }
  }

  update(dt, player, game) {
    this.time += dt;
    const pp = player.position;
    for (const g of this.npcs) {
      const n = g.userData.npc;
      const dx = pp.x - g.position.x, dz = pp.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      g.userData.label.visible = dist < 11;
      g.position.y = g.userData.baseY + Math.sin(this.time * 1.4 + g.userData.phase) * 0.012;
      if (dist < 5) {
        const target = Math.atan2(dx, dz);
        let diff = ((target - g.rotation.y + Math.PI * 3) % TAU) - Math.PI;
        g.rotation.y += diff * Math.min(1, dt * 2.2);
      }
      const parts = g.userData.parts;
      parts.armL.rotation.x = Math.sin(this.time * 1.1 + g.userData.phase) * 0.06;
      parts.armR.rotation.x = -Math.sin(this.time * 1.1 + g.userData.phase) * 0.06;
    }

    for (const g of this.enemies) {
      if (g.userData.dead) {
        g.userData.deadTimer += dt;
        g.rotation.z = Math.min(Math.PI / 2, g.userData.deadTimer * 3.5);
        g.position.y = g.userData.baseY - Math.max(0, (g.userData.deadTimer - 1) * 0.5);
        g.visible = g.userData.deadTimer < 2.6;
        continue;
      }
      const e = g.userData.enemy;
      const dx = pp.x - g.position.x, dz = pp.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      g.userData.attackCd = Math.max(0, g.userData.attackCd - dt);
      g.userData.attackAnim = Math.max(0, g.userData.attackAnim - dt);
      const speed = e.boss ? 1.7 : 2.25;
      if (dist < (e.boss ? 16 : 13) && dist > 1.35) {
        const len = Math.max(0.0001, dist);
        const step = speed * dt;
        this.moveGround(g, (dx / len) * step, (dz / len) * step);
        const target = Math.atan2(dx, dz);
        let diff = ((target - g.rotation.y + Math.PI * 3) % TAU) - Math.PI;
        g.rotation.y += diff * Math.min(1, dt * 6);
      } else if (dist >= 13) {
        const wd = g.userData.wander;
        wd.timer -= dt;
        if (wd.timer <= 0) {
          wd.timer = 2 + Math.random() * 4;
          const a = Math.random() * TAU, r = Math.random() * (e.radius || 5);
          wd.x = e.home.x + Math.cos(a) * r;
          wd.z = e.home.z + Math.sin(a) * r;
        }
        const wx = wd.x - g.position.x, wz = wd.z - g.position.z;
        const wl = Math.hypot(wx, wz);
        if (wl > 0.4) {
          this.moveGround(g, (wx / wl) * speed * 0.42 * dt, (wz / wl) * speed * 0.42 * dt);
          const target = Math.atan2(wx, wz);
          let diff = ((target - g.rotation.y + Math.PI * 3) % TAU) - Math.PI;
          g.rotation.y += diff * Math.min(1, dt * 3);
        }
      }
      if (dist < 1.85 && g.userData.attackCd <= 0) {
        g.userData.attackCd = e.boss ? 1.35 : 1.6;
        g.userData.attackAnim = 0.35;
        const dmg = e.boss ? 22 : 10;
        player.takeDamage(dmg, g.position);
        game.audio.play('hurt');
        game.flashDamage();
      }
      const parts = g.userData.parts;
      const walk = Math.min(1, dist > 1.35 ? 1 : 0);
      const swing = Math.sin(this.time * 8 + g.userData.phase) * 0.5 * walk;
      parts.legL.rotation.x = swing;
      parts.legR.rotation.x = -swing;
      parts.armL.rotation.x = -swing * 0.7;
      parts.armR.rotation.x = g.userData.attackAnim > 0 ? -1.8 * Math.sin((g.userData.attackAnim / 0.35) * Math.PI) : swing * 0.7;
      const hp = g.userData.hp / g.userData.maxHp;
      g.userData.healthSprite.sprite.visible = e.boss || hp < 1 || dist < 9;
      g.userData.healthSprite.sprite.position.y = 2.35;
    }

    for (const g of this.shards) {
      if (g.userData.collected) continue;
      g.rotation.y += dt * 1.2;
      g.position.y = g.userData.shard.y + Math.sin(this.time * 2 + g.userData.shard.x) * 0.1;
      g.userData.crystal.rotation.x += dt * 0.8;
      g.userData.ring.rotation.z += dt * 0.5;
      g.userData.ring.scale.setScalar(1 + Math.sin(this.time * 2.5) * 0.08);
      if (Math.random() < dt * 3) {
        this.sparkles.spawn(
          g.position.x + (Math.random() - 0.5) * 0.7,
          g.position.y + (Math.random() - 0.5) * 0.7,
          g.position.z + (Math.random() - 0.5) * 0.7,
          '#ffd77a', { speed: 0.4, up: 0.4, life: 1.2, gravity: 0.4, size: 0.08 },
        );
      }
    }

    for (const g of this.torches) {
      const f = 0.85 + Math.sin(this.time * 11 + g.position.x * 2) * 0.08 + Math.sin(this.time * 17 + g.position.z) * 0.05;
      g.userData.flame.scale.set(0.7 * f, 0.9 * f, 1);
      g.userData.core.scale.set(0.25 * f, 0.4 * f, 1);
      if (Math.random() < dt * 1.2) this.smoke.spawn(g.position.x, g.position.y + 0.25, g.position.z, '#8b8378', { speed: 0.15, up: 0.35, life: 2.2, gravity: 0.2, size: 0.13, drag: 0.99 });
    }
    for (const g of this.campfires) {
      const f = 0.9 + Math.sin(this.time * 9 + g.position.x) * 0.1;
      g.userData.glow.scale.set(1.7 * f, 1.8 * f, 1);
      g.userData.core.scale.set(0.55 * f, 0.9 * f, 1);
      if (Math.random() < dt * 5) {
        this.sparkles.spawn(g.position.x + (Math.random() - 0.5) * 0.4, g.position.y + 0.4, g.position.z + (Math.random() - 0.5) * 0.4, '#ffb15a', { speed: 0.6, up: 1.1, life: 0.7, gravity: -1.5, size: 0.09 });
      }
      if (Math.random() < dt * 3) this.smoke.spawn(g.position.x, g.position.y + 0.8, g.position.z, '#6f685f', { speed: 0.15, up: 0.6, life: 2.6, gravity: 0.35, size: 0.2, drag: 0.995 });
    }
    for (const s of this.world.smoke) {
      if (Math.random() < dt * 0.7) this.smoke.spawn(s.x, s.y, s.z, '#8c877e', { speed: 0.1, up: 0.4, life: 3.2, gravity: 0.25, size: 0.22, drag: 0.997 });
    }

    this.debris.update(dt);
    this.sparkles.update(dt);
    this.smoke.update(dt);
  }

  findInteraction(playerPos, forward) {
    let best = null;
    const consider = (pos, radius, target, label) => {
      const dx = pos.x - playerPos.x, dz = pos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > radius) return;
      const dot = (dx * forward.x + dz * forward.z) / Math.max(0.001, dist);
      if (dot < -0.35) return;
      if (!best || dist < best.dist) best = { dist, target, label };
    };
    for (const g of this.shards) if (!g.userData.collected) consider(g.position, 3.2, { kind: 'shard', entity: g }, 'Take the Crown Shard');
    for (const g of this.chests) if (!g.userData.open) consider(g.position, 2.8, { kind: 'chest', entity: g }, 'Open the chest');
    for (const g of this.npcs) consider(g.position, 3.2, { kind: 'npc', entity: g }, `Speak with ${g.userData.npc.name}`);
    for (const g of this.campfires) consider(g.position, 3.0, { kind: 'campfire', entity: g }, 'Rest at the campfire');
    for (const s of this.world.meta.shrines) consider(s, 3.4, { kind: 'shrine', entity: s }, 'Touch the shrine');
    return best;
  }

  interact(target, game) {
    const { kind, entity } = target;
    if (kind === 'npc') {
      const npc = entity.userData.npc;
      if (npc.role === 'elder') game.talkToElder();
      else game.showDialogue(npc.name, npc.role === 'guard' ? 'Keep your blade close, traveller. The Black Knight holds the keep, and brigands have been seen near the old stones.' : 'Blessings on you, traveller. The village has not been the same since the Crown was broken.');
      return true;
    }
    if (kind === 'chest') {
      const g = entity;
      if (g.userData.open) return false;
      g.userData.open = true;
      g.userData.chest.opened = true;
      game.openChest(g);
      return true;
    }
    if (kind === 'shard') {
      const g = entity;
      if (g.userData.collected) return false;
      g.userData.collected = true;
      g.userData.shard.collected = true;
      g.visible = false;
      game.collectShard(g);
      return true;
    }
    if (kind === 'campfire') {
      game.restAtCampfire(entity);
      return true;
    }
    if (kind === 'shrine') {
      game.touchShrine(entity);
      return true;
    }
    return false;
  }

  attack(player) {
    const pp = player.position;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    let best = null;
    for (const g of this.enemies) {
      if (g.userData.dead) continue;
      const dx = g.position.x - pp.x, dz = g.position.z - pp.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 3.3) continue;
      const dot = (dx * fx + dz * fz) / Math.max(0.001, dist);
      if (dot < 0.35) continue;
      if (!best || dist < best.dist) best = { g, dist };
    }
    if (!best) return null;
    return best.g;
  }

  damageEnemy(g, amount, game) {
    if (g.userData.dead) return false;
    g.userData.hp -= amount;
    g.userData.healthSprite.draw(clamp(g.userData.hp / g.userData.maxHp, 0, 1));
    g.userData.healthSprite.sprite.visible = true;
    const p = g.position;
    for (let i = 0; i < 8; i++) {
      this.sparkles.spawn(p.x + (Math.random() - 0.5) * 0.5, p.y + 1.1 + (Math.random() - 0.5) * 0.5, p.z + (Math.random() - 0.5) * 0.5, '#ffcf6a', { speed: 2.5, up: 1.5, life: 0.45, gravity: -8, size: 0.1 });
    }
    if (g.userData.hp <= 0) {
      g.userData.dead = true;
      g.userData.deadTimer = 0;
      g.userData.healthSprite.sprite.visible = false;
      for (let i = 0; i < 22; i++) {
        this.debris.spawn(p.x + (Math.random() - 0.5) * 0.6, p.y + 0.8 + Math.random() * 0.8, p.z + (Math.random() - 0.5) * 0.6, i % 3 ? '#4b3b2a' : '#7d3a2c', { speed: 3, up: 2.5, life: 1.1, gravity: -10, size: 0.12 });
      }
      if (g.userData.enemy.boss) game.onBossDefeated(g);
      else game.onEnemyDefeated(g);
      return true;
    }
    return false;
  }

  collectShardVisual(g) {
    for (let i = 0; i < 26; i++) {
      this.sparkles.spawn(g.position.x, g.position.y, g.position.z, i % 2 ? '#ffe7a8' : '#e0ad44', { speed: 3.4, up: 2.4, life: 1.2, gravity: -2, size: 0.14 });
    }
  }

  burstBlock(x, y, z, color) {
    for (let i = 0; i < 14; i++) {
      this.debris.spawn(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6, color, { speed: 2.4, up: 2.2, life: 0.7, gravity: -11, size: 0.13 });
    }
  }

  burstChest(g) {
    for (let i = 0; i < 22; i++) {
      this.sparkles.spawn(g.position.x, g.position.y + 0.7, g.position.z, i % 2 ? '#ffe7a8' : '#d8b45e', { speed: 2.2, up: 2.2, life: 1.0, gravity: -4, size: 0.1 });
    }
  }
}
