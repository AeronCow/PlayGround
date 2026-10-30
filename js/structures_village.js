import { B } from './blocks.js';

export function buildVillage(w) {
  const base = w.village.target;
  const cx = w.village.cx, cz = w.village.cz;
  w.clearBox(cx - 13, base + 1, cz - 13, cx + 13, base + 18, cz + 13);

  buildChurch(w, 8, 8, base);

  buildCottage(w, 22, 7, 7, 6, base, 'south', B.THATCH);
  buildCottage(w, 25, 17, 6, 7, base, 'west', B.ROOF);
  buildCottage(w, 22, 25, 7, 6, base, 'south', B.THATCH);
  buildCottage(w, 10, 26, 6, 6, base, 'east', B.ROOF);

  buildMarket(w, 20, 11, base, B.WOOL_RED);
  buildMarket(w, 23, 21, base, B.WOOL_BLUE);
  buildWell(w, 18, 17, base);
  buildShrine(w, 16, 22, base);
  buildPalisade(w, base);
  buildHayField(w, 4, 24, base);

  w.torches.push(
    { x: 16.5, y: base + 2.2, z: 29.2, light: true },
    { x: 13.4, y: base + 2.2, z: 18.2, light: true },
    { x: 18.4, y: base + 2.2, z: 21.2, light: true },
    { x: 8.5, y: base + 3.2, z: 20.5, light: false },
    { x: 22.5, y: base + 2.2, z: 10.5, light: false },
    { x: 10.5, y: base + 2.2, z: 26.5, light: false },
  );
  w.smoke.push({ x: 21.2, y: base + 10.4, z: 8.2 }, { x: 24.2, y: base + 10.4, z: 24.2 });

  w.meta.npcs.push(
    { id: 'elder', name: 'Elder Rowan', x: 13.5, y: base + 1, z: 19.5, yaw: 2.4, role: 'elder', robe: '#5a4a32', trim: '#c9a24b' },
    { id: 'villager1', name: 'Mira the Baker', x: 20.5, y: base + 1, z: 19.5, yaw: 0.8, role: 'villager', robe: '#7a4a3a', trim: '#d8c49a' },
    { id: 'villager2', name: 'Tomas', x: 23.5, y: base + 1, z: 13.5, yaw: -1.2, role: 'villager', robe: '#4a5a3a', trim: '#c9b78a' },
    { id: 'guard1', name: 'Village Watch', x: 17.5, y: base + 1, z: 28.5, yaw: 0.2, role: 'guard', robe: '#3d4a5a', trim: '#a9b3c2' },
  );

  w.meta.chests.push({ id: 'village', x: 11.5, y: base + 1, z: 29.2, yaw: 0, opened: false, loot: { gold: 8, apple: 1 } });
  w.meta.campfires.push({ id: 'village-hearth', x: 14.5, y: base + 1, z: 24.5, rest: false });
  w.torches.push({ x: 14.5, y: base + 1.2, z: 24.5, light: true, campfire: true });
  w.meta.shrines.push({ id: 'village-shrine', x: 16.5, y: base + 2, z: 22.5 });
  w.meta.villageBase = base;
  w.meta.elder = { x: 13.5, y: base + 1, z: 19.5 };
  w.meta.shrine = { x: 16.5, y: base + 1, z: 22.5 };
}

function buildCottage(w, cx, cz, width, depth, base, facing, roofId) {
  const x0 = cx - (width >> 1), x1 = x0 + width - 1;
  const z0 = cz - (depth >> 1), z1 = z0 + depth - 1;
  w.clearBox(x0 - 1, base + 1, z0 - 1, x1 + 1, base + 14, z1 + 1);
  w.fillBox(x0, base, z0, x1, base, z1, B.PLANKS);

  for (let y = base + 1; y <= base + 3; y++) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (!(x === x0 || x === x1 || z === z0 || z === z1)) continue;
        const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
        let id = corner ? B.LOG : B.PLANKS;
        if (y === base + 3) id = B.PLASTER;
        if (y === base + 2) {
          if (corner) id = B.LOG;
          else if ((x - x0) % 2 === 1 && (z === z0 || z === z1)) id = B.GLASS;
          else if ((z - z0) % 2 === 1 && (x === x0 || x === x1)) id = B.GLASS;
        }
        w.setBlock(x, y, z, id, false);
      }
    }
  }

  let doorX = cx, doorZ = z1;
  if (facing === 'west') { doorX = x0; doorZ = cz; }
  if (facing === 'east') { doorX = x1; doorZ = cz; }
  if (facing === 'north') { doorX = cx; doorZ = z0; }
  for (let y = base + 1; y <= base + 2; y++) {
    w.setBlock(doorX, y, doorZ, B.AIR, false);
    if (facing === 'south' || facing === 'north') {
      w.setBlock(doorX - 1, y, doorZ, B.DARK_PLANKS, false);
      w.setBlock(doorX + 1, y, doorZ, B.DARK_PLANKS, false);
    } else {
      w.setBlock(doorX, y, doorZ - 1, B.DARK_PLANKS, false);
      w.setBlock(doorX, y, doorZ + 1, B.DARK_PLANKS, false);
    }
  }
  w.setBlock(doorX, base + 3, doorZ, B.DARK_PLANKS, false);

  const roofBase = base + 4;
  const ridge = Math.floor((depth - 1) / 2);
  for (let dz = 0; dz < depth; dz++) {
    const lift = Math.min(dz, depth - 1 - dz);
    const y = roofBase + lift;
    for (let x = x0 - 1; x <= x1 + 1; x++) w.setBlock(x, y, z0 + dz, roofId, false);
  }
  for (let dz = 0; dz < depth; dz++) {
    const lift = Math.min(dz, depth - 1 - dz);
    for (let y = roofBase; y < roofBase + lift; y++) {
      w.setBlock(x0, y, z0 + dz, B.PLASTER, false);
      w.setBlock(x1, y, z0 + dz, B.PLASTER, false);
    }
  }

  const chimX = x1 - 1, chimZ = z0 + 1;
  const chimTop = roofBase + ridge + 2;
  for (let y = base + 3; y <= chimTop; y++) w.setBlock(chimX, y, chimZ, B.COBBLE, false);
  w.setBlock(chimX, chimTop + 1, chimZ, B.STONE_DARK, false);
  w.smoke.push({ x: chimX + 0.5, y: chimTop + 1.2, z: chimZ + 0.5 });

  w.setBlock(x0 + 1, base + 1, z0 + 1, B.CRATE, false);
  w.setBlock(x1 - 1, base + 1, z1 - 1, B.HAY, false);
  w.torches.push({ x: doorX + 0.5, y: base + 2.2, z: doorZ + (facing === 'north' ? -0.5 : 0.5), light: false });
}

function buildChurch(w, cx, cz, base) {
  const x0 = cx - 4, x1 = cx + 4;
  const z0 = cz - 4, z1 = cz + 6;
  w.clearBox(x0 - 1, base + 1, z0 - 1, x1 + 1, base + 22, z1 + 1);
  w.fillBox(x0, base, z0, x1, base, z1, B.BRICKS);
  w.wallRect(x0, z0, x1, z1, base + 1, 5, B.BRICKS, 1);
  for (let y = base + 3; y <= base + 4; y++) {
    for (let x = x0 + 2; x <= x1 - 2; x += 2) {
      w.setBlock(x, y, z0, B.GLASS, false);
      w.setBlock(x, y, z1, B.GLASS, false);
    }
    for (let z = z0 + 2; z <= z1 - 2; z += 2) {
      w.setBlock(x0, y, z, B.GLASS, false);
      w.setBlock(x1, y, z, B.GLASS, false);
    }
  }
  for (let y = base + 1; y <= base + 2; y++) w.setBlock(cx, y, z1, B.AIR, false);
  for (let x = cx - 1; x <= cx + 1; x++) w.setBlock(x, base + 3, z1, B.DARK_PLANKS, false);

  const roofBase = base + 6;
  const ridge = Math.floor((x1 - x0) / 2);
  for (let dx = 0; dx <= ridge; dx++) {
    const y = roofBase + (ridge - dx);
    for (let z = z0 - 1; z <= z1 + 1; z++) {
      w.setBlock(x0 + dx, y, z, B.ROOF, false);
      w.setBlock(x1 - dx, y, z, B.ROOF, false);
    }
  }
  for (let dx = 0; dx <= ridge; dx++) {
    const lift = ridge - dx;
    for (let y = roofBase; y < roofBase + lift; y++) {
      w.setBlock(x0 + dx, y, z0, B.BRICKS, false);
      w.setBlock(x1 - dx, y, z0, B.BRICKS, false);
      w.setBlock(x0 + dx, y, z1, B.BRICKS, false);
      w.setBlock(x1 - dx, y, z1, B.BRICKS, false);
    }
  }

  const tx0 = cx - 3, tx1 = cx + 3, tz0 = z1, tz1 = z1 + 6;
  w.clearBox(tx0, base + 1, tz0, tx1, base + 26, tz1);
  w.fillBox(tx0, base, tz0, tx1, base, tz1, B.BRICKS);
  w.wallRect(tx0, tz0, tx1, tz1, base + 1, 14, B.BRICKS, 1);
  for (let y = base + 1; y <= base + 3; y++) w.setBlock(cx, y, tz1, B.AIR, false);
  w.setBlock(cx, base + 4, tz1, B.DARK_PLANKS, false);
  for (let y = base + 6; y <= base + 8; y += 2) {
    w.setBlock(tx0, y, cz + 2, B.GLASS, false);
    w.setBlock(tx1, y, cz + 2, B.GLASS, false);
    w.setBlock(cx, y, tz1, B.GLASS, false);
  }
  w.crenellate(tx0, tz0, tx1, tz1, base + 15, B.BRICKS);
  w.fillBox(cx - 1, base + 15, tz0 + 2, cx + 1, base + 15, tz1 - 2, B.STONE_DARK);
  for (let y = base + 18; y <= base + 20; y++) w.setBlock(cx, y, cz + 4, B.GOLD, false);
  for (let x = cx - 1; x <= cx + 1; x++) w.setBlock(x, base + 19, cz + 4, B.GOLD, false);
  w.torches.push({ x: cx + 0.5, y: base + 2.2, z: tz1 + 0.4, light: true });

  w.setBlock(cx - 2, base + 1, z0 + 1, B.DARK_PLANKS, false);
  w.setBlock(cx + 2, base + 1, z0 + 1, B.DARK_PLANKS, false);
  w.setBlock(cx, base + 2, z0 + 1, B.GOLD, false);
  w.setBlock(cx, base + 3, z0 + 1, B.GOLD, false);
}

function buildMarket(w, cx, cz, base, canopy) {
  const x0 = cx - 2, x1 = cx + 2, z0 = cz - 1, z1 = cz + 1;
  w.clearBox(x0, base + 1, z0, x1, base + 5, z1);
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    for (let y = base + 1; y <= base + 3; y++) w.setBlock(x, y, z, B.LOG, false);
  }
  for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) w.setBlock(x, base + 4, z, canopy, false);
  for (let x = x0 - 1; x <= x1 + 1; x += 2) w.setBlock(x, base + 3, z0 - 1, canopy, false);
  w.setBlock(x0, base + 1, cz, B.CRATE, false);
  w.setBlock(x1, base + 1, cz, B.CRATE, false);
  w.setBlock(cx, base + 1, cz, B.HAY, false);
  w.setBlock(cx - 1, base + 2, cz, B.WOOL_RED, false);
  w.setBlock(cx + 1, base + 2, cz, B.WOOL_BLUE, false);
}

export function buildWell(w, cx, cz, base) {
  w.clearBox(cx - 2, base + 1, cz - 2, cx + 2, base + 5, cz + 2);
  for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) w.setBlock(x, base, z, B.COBBLE, false);
  for (const [x, z] of [[cx - 1, cz - 1], [cx + 1, cz - 1], [cx - 1, cz + 1], [cx + 1, cz + 1]]) {
    for (let y = base + 1; y <= base + 2; y++) w.setBlock(x, y, z, B.COBBLE, false);
  }
  w.setBlock(cx, base + 1, cz, B.WATER, false);
  for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) w.setBlock(x, base + 3, z, B.ROOF, false);
  w.setBlock(cx, base + 4, cz, B.LOG, false);
  w.setBlock(cx, base + 5, cz, B.ROOF, false);
}

function buildShrine(w, cx, cz, base) {
  w.clearBox(cx - 3, base + 1, cz - 3, cx + 3, base + 8, cz + 3);
  for (let z = cz - 2; z <= cz + 2; z++) for (let x = cx - 2; x <= cx + 2; x++) w.setBlock(x, base, z, B.BRICKS, false);
  for (const [x, z] of [[cx - 2, cz - 2], [cx + 2, cz - 2], [cx - 2, cz + 2], [cx + 2, cz + 2]]) {
    for (let y = base + 1; y <= base + 3; y++) w.setBlock(x, y, z, B.MOSSY, false);
  }
  for (let x = cx - 2; x <= cx + 2; x++) {
    w.setBlock(x, base + 4, cz - 2, B.MOSSY, false);
    w.setBlock(x, base + 4, cz + 2, B.MOSSY, false);
  }
  w.setBlock(cx, base + 1, cz, B.BRICKS, false);
  w.setBlock(cx, base + 2, cz, B.GOLD, false);
  w.torches.push({ x: cx + 2.5, y: base + 2.2, z: cz + 2.5, light: true });
}

function buildPalisade(w, base) {
  const x0 = 3, x1 = 29, z0 = 3, z1 = 29;
  for (let x = x0; x <= x1; x++) {
    if (x >= 14 && x <= 17) continue;
    for (let y = base + 1; y <= base + 2; y++) w.setBlock(x, y, z1, B.LOG, false);
    if ((x - x0) % 3 === 0) w.setBlock(x, base + 3, z1, B.LOG, false);
  }
  for (let z = z0; z <= z1; z++) {
    for (let y = base + 1; y <= base + 2; y++) {
      w.setBlock(x0, y, z, B.LOG, false);
      w.setBlock(x1, y, z, B.LOG, false);
    }
    if ((z - z0) % 3 === 0) {
      w.setBlock(x0, base + 3, z, B.LOG, false);
      w.setBlock(x1, base + 3, z, B.LOG, false);
    }
  }
  for (let x = x0; x <= x1; x++) {
    for (let y = base + 1; y <= base + 2; y++) w.setBlock(x, y, z0, B.LOG, false);
    if ((x - x0) % 3 === 0) w.setBlock(x, base + 3, z0, B.LOG, false);
  }
  for (let x = 14; x <= 17; x++) w.setBlock(x, base + 3, z1, B.DARK_PLANKS, false);
}

function buildHayField(w, x0, z0, base) {
  w.clearBox(x0, base + 1, z0, x0 + 5, base + 3, z0 + 5);
  for (let z = z0; z <= z0 + 5; z++) for (let x = x0; x <= x0 + 5; x++) {
    w.setBlock(x, base, z, B.PATH, false);
    if ((x + z) % 2 === 0) w.setBlock(x, base + 1, z, B.HAY, false);
  }
  for (let z = z0; z <= z0 + 5; z += 3) for (let x = x0; x <= x0 + 5; x++) w.setBlock(x, base + 2, z, B.DARK_PLANKS, false);
}

export function buildTent(w, cx, cz, base, wool) {
  const x0 = cx - 2, x1 = cx + 2, z0 = cz - 2, z1 = cz + 2;
  w.clearBox(x0, base + 1, z0, x1, base + 6, z1);
  for (let y = base + 1; y <= base + 2; y++) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (x === x0 || x === x1 || z === z0 || z === z1) w.setBlock(x, y, z, wool, false);
    }
  }
  for (let s = 0; s < 3; s++) {
    w.fillBox(x0 + s, base + 3 + s, z0 + s, x1 - s, base + 3 + s, z1 - s, s === 0 ? B.PLASTER : wool);
  }
  for (let y = base + 1; y <= base + 2; y++) w.setBlock(cx, y, z1, B.AIR, false);
  w.setBlock(cx, base + 3, z1, B.DARK_PLANKS, false);
}

export function buildBridge(w) {
  const y = 9;
  for (let x = 31; x <= 45; x++) {
    for (let z = 7; z <= 9; z++) w.setBlock(x, y, z, B.PLANKS, false);
    if (x % 2 === 0) for (const z of [7, 9]) w.setBlock(x, y + 1, z, B.LOG, false);
    for (const z of [6, 10]) w.setBlock(x, y + 1, z, B.DARK_PLANKS, false);
    if (x % 4 === 0) for (const z of [6, 10]) for (let yy = y; yy >= y - 6; yy--) w.setBlock(x, yy, z, B.LOG, false);
  }
  for (let x = 31; x <= 45; x += 2) {
    w.setBlock(x, y + 2, 6, B.LOG, false);
    w.setBlock(x, y + 2, 10, B.LOG, false);
  }
  w.torches.push(
    { x: 31.5, y: y + 2.2, z: 6.5, light: true },
    { x: 44.5, y: y + 2.2, z: 9.5, light: true },
  );
  w.meta.bridgeY = y;
}
