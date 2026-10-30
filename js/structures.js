import { B } from './blocks.js';
import { buildVillage, buildTent, buildBridge } from './structures_village.js';
import { buildCastle, buildRuins, buildStones } from './structures_castle.js';

export function buildAllStructures(w) {
  buildVillage(w);
  buildCastle(w);
  buildRuins(w);
  buildStones(w);
  buildCamp(w);
  buildBridge(w);
}

function buildCamp(w) {
  const base = w.camp.target;
  const cx = w.camp.cx, cz = w.camp.cz;
  w.clearBox(cx - 7, base + 1, cz - 7, cx + 7, base + 10, cz + 7);
  buildTent(w, cx - 3, cz - 2, base, B.WOOL_RED);
  buildTent(w, cx + 3, cz + 2, base, B.WOOL_BLUE);
  for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) w.setBlock(x, base, z, B.COBBLE, false);
  w.setBlock(cx, base + 1, cz, B.LOG, false);
  w.setBlock(cx, base + 2, cz, B.LOG, false);
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) w.setBlock(cx + dx * 2, base + 1, cz + dz * 2, B.LOG, false);
  w.setBlock(cx - 3, base + 1, cz + 2, B.CRATE, false);
  w.setBlock(cx + 3, base + 1, cz - 2, B.HAY, false);
  w.setBlock(cx + 2, base + 1, cz + 3, B.CRATE, false);
  w.torches.push({ x: cx + 0.5, y: base + 1.2, z: cz + 0.5, light: true, campfire: true });
  w.meta.campfires.push({ id: 'camp', x: cx + 0.5, y: base + 1, z: cz + 0.5, rest: true });
  w.meta.chests.push({ id: 'camp', x: cx - 3.5, y: base + 1, z: cz + 2.5, yaw: 1.1, opened: false, loot: { gold: 10, apple: 2 } });
  w.meta.enemies.push({ id: 'brigand-camp', x: cx + 5.5, y: base + 1, z: cz - 4.5, hp: 55, home: { x: cx + 5.5, z: cz - 4.5 }, radius: 8 });
  w.meta.campBase = base;
}
