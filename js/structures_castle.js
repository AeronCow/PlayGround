import { B } from './blocks.js';
import { buildWell } from './structures_village.js';

export function buildCastle(w) {
  const base = w.castle.target;
  const x0 = -32, x1 = -4, z0 = -32, z1 = -4;
  w.clearBox(x0 - 1, base + 1, z0 - 1, x1 + 1, base + 26, z1 + 1);
  w.fillBox(x0, base, z0, x1, base, z1, B.BRICKS);

  w.wallRect(x0, z0, x1, z1, base + 1, 7, B.BRICKS, 2);
  for (let x = x0; x <= x1; x += 2) {
    for (let t = 0; t < 2; t++) {
      w.setBlock(x, base + 8, z0 + t, B.BRICKS, false);
      w.setBlock(x, base + 8, z1 - t, B.BRICKS, false);
    }
  }
  for (let z = z0; z <= z1; z += 2) {
    for (let t = 0; t < 2; t++) {
      w.setBlock(x0 + t, base + 8, z, B.BRICKS, false);
      w.setBlock(x1 - t, base + 8, z, B.BRICKS, false);
    }
  }
  for (let z = z0 + 3; z <= z1 - 3; z += 5) {
    for (let y = base + 3; y <= base + 6; y += 3) {
      w.setBlock(x0, y, z, B.BANNER_RED, false);
      w.setBlock(x1, y, z, B.BANNER_RED, false);
    }
  }

  buildTower(w, x0, z0, base, 13, B.BANNER_RED);
  buildTower(w, x1 - 6, z0, base, 13, B.BANNER_BLUE);
  buildTower(w, x0, z1 - 6, base, 13, B.BANNER_RED);
  buildTower(w, x1 - 6, z1 - 6, base, 13, B.BANNER_BLUE);

  buildGatehouse(w, -24, -9, -20, -4, base);
  buildGatehouse(w, -16, -9, -12, -4, base);
  w.clearBox(-20, base + 1, -6, -16, base + 4, -2);
  w.fillBox(-20, base + 5, -6, -16, base + 5, -2, B.BRICKS);
  for (let x = -20; x <= -16; x++) {
    w.setBlock(x, base + 6, -4, B.BRICKS, false);
    w.setBlock(x, base + 6, -5, B.BRICKS, false);
  }
  w.setBlock(-18, base + 4, -4, B.IRON, false);
  w.setBlock(-18, base + 4, -5, B.IRON, false);

  const kx0 = -24, kx1 = -12, kz0 = -26, kz1 = -14;
  w.clearBox(kx0, base + 1, kz0, kx1, base + 24, kz1);
  w.fillBox(kx0, base, kz0, kx1, base, kz1, B.BRICKS);
  w.wallRect(kx0, kz0, kx1, kz1, base + 1, 13, B.BRICKS, 2);
  for (let y = base + 3; y <= base + 11; y += 4) {
    for (let x = kx0 + 4; x <= kx1 - 4; x += 3) {
      w.setBlock(x, y, kz0, B.GLASS, false);
      w.setBlock(x, y, kz1, B.GLASS, false);
    }
    for (let z = kz0 + 4; z <= kz1 - 4; z += 3) {
      w.setBlock(kx0, y, z, B.GLASS, false);
      w.setBlock(kx1, y, z, B.GLASS, false);
    }
  }
  for (let y = base + 1; y <= base + 3; y++) {
    w.setBlock(-18, y, kz1, B.AIR, false);
    w.setBlock(-19, y, kz1, B.AIR, false);
  }
  for (let x = -19; x <= -17; x++) w.setBlock(x, base + 4, kz1, B.DARK_PLANKS, false);
  for (let x = kx0; x <= kx1; x += 2) {
    w.setBlock(x, base + 14, kz0, B.BRICKS, false);
    w.setBlock(x, base + 14, kz1, B.BRICKS, false);
  }
  for (let z = kz0; z <= kz1; z += 2) {
    w.setBlock(kx0, base + 14, z, B.BRICKS, false);
    w.setBlock(kx1, base + 14, z, B.BRICKS, false);
  }
  for (let s = 0; s < 4; s++) {
    w.fillBox(kx0 + 1 + s, base + 15 + s, kz0 + 1 + s, kx1 - 1 - s, base + 15 + s, kz1 - 1 - s, s < 2 ? B.ROOF : B.BRICKS);
  }
  for (let z = kz0 + 3; z <= kz1 - 3; z += 4) {
    w.setBlock(-18, base + 6, kz1, B.BANNER_RED, false);
    w.setBlock(-18, base + 8, kz1, B.BANNER_RED, false);
  }
  for (let y = base + 19; y <= base + 20; y++) w.setBlock(-18, y, -20, B.GOLD, false);
  for (let x = -19; x <= -17; x++) w.setBlock(x, base + 20, -20, B.GOLD, false);

  w.fillBox(-18, base, -20, -18, base + 1, -20, B.STONE_DARK);
  w.setBlock(-18, base + 2, -20, B.GOLD, false);
  w.setBlock(-18, base + 3, -20, B.AIR, false);
  w.setBlock(-21, base + 1, -22, B.CRATE, false);
  w.setBlock(-15, base + 1, -16, B.HAY, false);
  w.setBlock(-14, base + 1, -22, B.CRATE, false);

  w.fillBox(-20, base, -10, -16, base, -6, B.COBBLE);
  w.fillBox(-18, base, -13, -18, base, -11, B.PATH);
  buildWell(w, -8, -26, base);
  buildTrainingDummy(w, -10, -12, base);
  buildTrainingDummy(w, -26, -10, base);

  w.torches.push(
    { x: -18.5, y: base + 3.2, z: -3.2, light: true },
    { x: -18.5, y: base + 2.2, z: -13.2, light: true },
    { x: -22.5, y: base + 3.2, z: -20.5, light: true },
    { x: -13.5, y: base + 3.2, z: -20.5, light: true },
    { x: -6.5, y: base + 2.2, z: -30.5, light: false },
    { x: -30.5, y: base + 2.2, z: -6.5, light: false },
  );

  w.meta.npcs.push(
    { id: 'castle-guard1', name: 'Castle Watch', x: -20.5, y: base + 1, z: -7.5, yaw: 0.2, role: 'guard', robe: '#3d4a5a', trim: '#c9a24b' },
    { id: 'castle-guard2', name: 'Castle Watch', x: -15.5, y: base + 1, z: -7.5, yaw: -0.2, role: 'guard', robe: '#3d4a5a', trim: '#c9a24b' },
  );

  w.meta.chests.push({ id: 'castle', x: -22.5, y: base + 1, z: -24.5, yaw: 0.6, opened: false, loot: { gold: 22, apple: 2 } });
  w.meta.shards.push({ id: 'keep', x: -17.5, y: base + 2.6, z: -19.5, site: 'Castle Keep', collected: false });
  w.meta.enemies.push(
    { id: 'black-knight', name: 'The Black Knight', x: -18.5, y: base + 1, z: -18.5, boss: true, hp: 170, home: { x: -18.5, z: -18.5 }, radius: 5 },
    { id: 'brigand-c1', x: -26.5, y: base + 1, z: -12.5, hp: 65, home: { x: -26.5, z: -12.5 }, radius: 7 },
    { id: 'brigand-c2', x: -10.5, y: base + 1, z: -24.5, hp: 65, home: { x: -10.5, z: -24.5 }, radius: 7 },
    { id: 'brigand-c3', x: -8.5, y: base + 1, z: -8.5, hp: 65, home: { x: -8.5, z: -8.5 }, radius: 7 },
  );
  w.meta.castleBase = base;
}

function buildTower(w, x0, z0, base, height, banner) {
  const x1 = x0 + 6, z1 = z0 + 6;
  w.clearBox(x0, base + 1, z0, x1, base + height + 4, z1);
  w.fillBox(x0, base, z0, x1, base, z1, B.BRICKS);
  w.wallRect(x0, z0, x1, z1, base + 1, height, B.BRICKS, 2);
  for (let y = base + 4; y <= base + height - 3; y += 4) {
    w.setBlock(x0, y, z0 + 3, B.GLASS, false);
    w.setBlock(x1, y, z0 + 3, B.GLASS, false);
    w.setBlock(x0 + 3, y, z0, B.GLASS, false);
    w.setBlock(x0 + 3, y, z1, B.GLASS, false);
  }
  w.crenellate(x0, z0, x1, z1, base + height + 1, B.BRICKS);
  w.crenellate(x0, z0, x1, z1, base + height + 2, B.BRICKS);
  w.fillBox(x0 + 2, base + height, z0 + 2, x1 - 2, base + height, z1 - 2, B.STONE_DARK);
  w.setBlock(x0 + 3, base + height + 3, z0 + 3, banner, false);
  w.setBlock(x0 + 3, base + height + 4, z0 + 3, B.WOOL_GOLD, false);
}

function buildGatehouse(w, x0, z0, x1, z1, base) {
  w.clearBox(x0, base + 1, z0, x1, base + 16, z1);
  w.fillBox(x0, base, z0, x1, base, z1, B.BRICKS);
  w.wallRect(x0, z0, x1, z1, base + 1, 10, B.BRICKS, 1);
  w.crenellate(x0, z0, x1, z1, base + 11, B.BRICKS);
  w.crenellate(x0, z0, x1, z1, base + 12, B.BRICKS);
  for (let y = base + 4; y <= base + 8; y += 4) {
    w.setBlock(x0, y, z1, B.GLASS, false);
    w.setBlock(x1, y, z1, B.GLASS, false);
  }
  w.setBlock(x0, base + 6, z1, B.BANNER_RED, false);
  w.setBlock(x1, base + 6, z1, B.BANNER_BLUE, false);
}

function buildTrainingDummy(w, x, z, base) {
  w.clearBox(x, base + 1, z, x, base + 4, z);
  w.setBlock(x, base + 1, z, B.LOG, false);
  w.setBlock(x, base + 2, z, B.PLANKS, false);
  w.setBlock(x, base + 3, z, B.WOOL_RED, false);
  w.setBlock(x - 1, base + 2, z, B.DARK_PLANKS, false);
  w.setBlock(x + 1, base + 2, z, B.DARK_PLANKS, false);
  w.setBlock(x, base + 4, z, B.HAY, false);
}

export function buildRuins(w) {
  const base = w.ruins.target;
  const cx = w.ruins.cx, cz = w.ruins.cz;
  w.clearBox(cx - 8, base + 1, cz - 8, cx + 8, base + 18, cz + 8);
  for (let z = cz - 6; z <= cz + 6; z++) {
    for (let x = cx - 6; x <= cx + 6; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
      if (d >= 3.2 && d <= 5.2) {
        const h = hash(x, z, 7, 3);
        if (h < 0.16) continue;
        const top = base + 5 + Math.floor(hash(x, z, 19, 5) * 7);
        for (let y = base; y <= top; y++) {
          const id = (y + x + z) % 5 === 0 ? B.COBBLE_MOSSY : (h < 0.5 ? B.MOSSY : B.BRICKS);
          w.setBlock(x, y, z, id, false);
        }
      } else if (d < 3.2) {
        w.setBlock(x, base, z, B.COBBLE_MOSSY, false);
      }
    }
  }
  w.setBlock(cx, base, cz, B.MOSSY, false);
  w.setBlock(cx, base + 1, cz, B.MOSSY, false);
  w.setBlock(cx + 1, base + 1, cz, B.COBBLE, false);
  w.setBlock(cx - 1, base + 1, cz, B.COBBLE, false);
  for (let i = 0; i < 26; i++) {
    const a = w.rng.range(0, Math.PI * 2);
    const r = w.rng.range(5, 9);
    const x = Math.round(cx + Math.cos(a) * r);
    const z = Math.round(cz + Math.sin(a) * r);
    const y = base + Math.floor(w.rng.next() * 3);
    if (w.getBlock(x, y, z) === B.AIR) w.setBlock(x, y, z, w.rng.chance(0.5) ? B.COBBLE : B.MOSSY, false);
  }
  buildWell(w, cx + 5, cz + 4, base);
  w.torches.push(
    { x: cx + 0.5, y: base + 2.2, z: cz + 0.5, light: true },
    { x: cx + 4.5, y: base + 2.2, z: cz - 3.5, light: false },
  );
  w.meta.campfires.push({ id: 'ruins-fire', x: cx + 5.5, y: base + 1, z: cz + 4.5, rest: true });
  w.torches.push({ x: cx + 5.5, y: base + 1.2, z: cz + 4.5, light: true, campfire: true });
  w.meta.chests.push({ id: 'ruins', x: cx + 2.5, y: base + 1, z: cz - 1.5, yaw: -0.8, opened: false, loot: { gold: 14, apple: 1 } });
  w.meta.shards.push({ id: 'tower', x: cx + 0.5, y: base + 2.4, z: cz + 0.5, site: 'Ruined Watchtower', collected: false });
  w.meta.enemies.push(
    { id: 'brigand-r1', x: cx - 3.5, y: base + 1, z: cz + 3.5, hp: 65, home: { x: cx - 3.5, z: cz + 3.5 }, radius: 7 },
    { id: 'brigand-r2', x: cx + 4.5, y: base + 1, z: cz - 3.5, hp: 65, home: { x: cx + 4.5, z: cz - 3.5 }, radius: 7 },
  );
  w.meta.ruinsBase = base;
}

export function buildStones(w) {
  const base = w.stones.target;
  const cx = w.stones.cx, cz = w.stones.cz;
  w.clearBox(cx - 11, base + 1, cz - 11, cx + 11, base + 16, cz + 11);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * 7);
    const z = Math.round(cz + Math.sin(a) * 7);
    const h = 4 + Math.floor(hash(i, 1, 4, 9) * 3);
    for (let dx = 0; dx <= 1; dx++) for (let dz = 0; dz <= 1; dz++) {
      for (let y = base; y <= base + h; y++) {
        w.setBlock(x + dx, y, z + dz, (y + i) % 6 === 0 ? B.MOSSY : B.STONE_DARK, false);
      }
    }
    if (i % 2 === 0) {
      const nx = Math.round(cx + Math.cos(a + Math.PI / 8) * 7);
      const nz = Math.round(cz + Math.sin(a + Math.PI / 8) * 7);
      for (let t = 0; t <= 2; t++) w.setBlock(x + t, base + h + 1, z, B.MOSSY, false);
    }
    w.setBlock(x, base + h + 1, z, B.MOSSY, false);
  }
  for (let a = 0; a < Math.PI * 2; a += 0.18) {
    const x = Math.round(cx + Math.cos(a) * 4.5);
    const z = Math.round(cz + Math.sin(a) * 4.5);
    w.setBlock(x, base, z, B.MOSSY, false);
  }
  for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) {
    w.setBlock(x, base, z, B.BRICKS, false);
    w.setBlock(x, base + 1, z, B.BRICKS, false);
  }
  w.setBlock(cx, base + 2, cz, B.GOLD, false);
  w.torches.push(
    { x: cx - 2.5, y: base + 2.2, z: cz + 2.5, light: true },
    { x: cx + 2.5, y: base + 2.2, z: cz - 2.5, light: true },
  );
  w.meta.shards.push({ id: 'stones', x: cx + 0.5, y: base + 3.2, z: cz + 0.5, site: 'Standing Stones', collected: false });
  w.meta.enemies.push(
    { id: 'brigand-s1', x: cx - 4.5, y: base + 1, z: cz + 1.5, hp: 70, home: { x: cx - 4.5, z: cz + 1.5 }, radius: 8 },
    { id: 'brigand-s2', x: cx + 4.5, y: base + 1, z: cz - 1.5, hp: 70, home: { x: cx + 4.5, z: cz - 1.5 }, radius: 8 },
  );
  w.meta.stonesBase = base;
}

function hash(x, y, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
