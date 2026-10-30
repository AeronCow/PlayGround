export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  LOG: 5,
  PLANKS: 6,
  LEAVES: 7,
  LEAVES_DARK: 8,
  SAND: 9,
  WATER: 10,
  ROOF: 11,
  BRICKS: 12,
  MOSSY: 13,
  IRON: 14,
  GOLD: 15,
  PATH: 16,
  GLASS: 17,
  DARK_PLANKS: 18,
  THATCH: 19,
  PLASTER: 20,
  WOOL_RED: 21,
  WOOL_BLUE: 22,
  WOOL_GOLD: 23,
  CRATE: 24,
  HAY: 25,
  COBBLE_MOSSY: 26,
  BIRCH_LOG: 27,
  BIRCH_PLANKS: 28,
  BANNER_RED: 29,
  BANNER_BLUE: 30,
  STONE_DARK: 31,
};

export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  LOG_SIDE: 5,
  LOG_TOP: 6,
  PLANKS: 7,
  LEAVES: 8,
  LEAVES_DARK: 9,
  SAND: 10,
  WATER: 11,
  ROOF: 12,
  BRICKS: 13,
  MOSSY: 14,
  IRON: 15,
  GOLD: 16,
  PATH: 17,
  GLASS: 18,
  DARK_PLANKS: 19,
  THATCH: 20,
  PLASTER: 21,
  WOOL_RED: 22,
  WOOL_BLUE: 23,
  WOOL_GOLD: 24,
  CRATE: 25,
  FLOWER: 26,
  GRASS_TUFT: 27,
  HAY: 28,
  BIRCH_SIDE: 29,
  BIRCH_TOP: 30,
  BIRCH_PLANKS: 31,
  BANNER_RED: 32,
  BANNER_BLUE: 33,
  STONE_DARK: 34,
};

function def(name, tiles, hardness, color, extra = {}) {
  return {
    name,
    top: tiles[0], bottom: tiles[1], side: tiles[2],
    hardness,
    color,
    solid: true,
    transparent: false,
    drop: null,
    tag: null,
    ...extra,
  };
}

export const BLOCKS = [];
BLOCKS[B.AIR] = { name: 'Air', solid: false, transparent: true, hardness: 0, color: '#000', top: 0, bottom: 0, side: 0 };
BLOCKS[B.GRASS] = def('Grass', [TILE.GRASS_TOP, TILE.DIRT, TILE.GRASS_SIDE], 0.38, '#6f9446', { drop: B.DIRT });
BLOCKS[B.DIRT] = def('Dirt', [TILE.DIRT, TILE.DIRT, TILE.DIRT], 0.32, '#7b5a3c');
BLOCKS[B.STONE] = def('Stone', [TILE.STONE, TILE.STONE, TILE.STONE], 1.15, '#8b9095', { drop: B.COBBLE, tag: 'stone' });
BLOCKS[B.COBBLE] = def('Cobblestone', [TILE.COBBLE, TILE.COBBLE, TILE.COBBLE], 1.0, '#7d8389', { tag: 'stone' });
BLOCKS[B.LOG] = def('Oak Log', [TILE.LOG_TOP, TILE.LOG_TOP, TILE.LOG_SIDE], 0.72, '#6e4d2c', { tag: 'wood' });
BLOCKS[B.PLANKS] = def('Oak Planks', [TILE.PLANKS, TILE.PLANKS, TILE.PLANKS], 0.58, '#b1844f', { tag: 'wood' });
BLOCKS[B.LEAVES] = def('Leaves', [TILE.LEAVES, TILE.LEAVES, TILE.LEAVES], 0.18, '#456b32', { drop: B.AIR });
BLOCKS[B.LEAVES_DARK] = def('Pine Needles', [TILE.LEAVES_DARK, TILE.LEAVES_DARK, TILE.LEAVES_DARK], 0.18, '#2f532f', { drop: B.AIR });
BLOCKS[B.SAND] = def('Sand', [TILE.SAND, TILE.SAND, TILE.SAND], 0.3, '#d6c48c');
BLOCKS[B.WATER] = def('Water', [TILE.WATER, TILE.WATER, TILE.WATER], 0, '#3b7597', { solid: false, transparent: true, drop: B.AIR });
BLOCKS[B.ROOF] = def('Clay Roof', [TILE.ROOF, TILE.ROOF, TILE.ROOF], 0.55, '#9d4b34');
BLOCKS[B.BRICKS] = def('Stone Bricks', [TILE.BRICKS, TILE.BRICKS, TILE.BRICKS], 1.25, '#8b8b82', { tag: 'stone' });
BLOCKS[B.MOSSY] = def('Mossy Stone', [TILE.MOSSY, TILE.MOSSY, TILE.MOSSY], 1.2, '#76806a', { tag: 'stone' });
BLOCKS[B.IRON] = def('Iron Block', [TILE.IRON, TILE.IRON, TILE.IRON], 1.7, '#b9bcc2', { tag: 'metal' });
BLOCKS[B.GOLD] = def('Gold Block', [TILE.GOLD, TILE.GOLD, TILE.GOLD], 1.5, '#d8b04a', { tag: 'metal' });
BLOCKS[B.PATH] = def('Gravel Path', [TILE.PATH, TILE.PATH, TILE.PATH], 0.36, '#a08d6c');
BLOCKS[B.GLASS] = def('Window Glass', [TILE.GLASS, TILE.GLASS, TILE.GLASS], 0.42, '#a8c8ce');
BLOCKS[B.DARK_PLANKS] = def('Dark Timber', [TILE.DARK_PLANKS, TILE.DARK_PLANKS, TILE.DARK_PLANKS], 0.62, '#5a3c25', { tag: 'wood' });
BLOCKS[B.THATCH] = def('Thatch', [TILE.THATCH, TILE.THATCH, TILE.THATCH], 0.4, '#b69a51');
BLOCKS[B.PLASTER] = def('Plaster', [TILE.PLASTER, TILE.PLASTER, TILE.PLASTER], 0.5, '#d8cbaa');
BLOCKS[B.WOOL_RED] = def('Crimson Wool', [TILE.WOOL_RED, TILE.WOOL_RED, TILE.WOOL_RED], 0.3, '#8e3128');
BLOCKS[B.WOOL_BLUE] = def('Azure Wool', [TILE.WOOL_BLUE, TILE.WOOL_BLUE, TILE.WOOL_BLUE], 0.3, '#36537f');
BLOCKS[B.WOOL_GOLD] = def('Golden Wool', [TILE.WOOL_GOLD, TILE.WOOL_GOLD, TILE.WOOL_GOLD], 0.3, '#c9a243');
BLOCKS[B.CRATE] = def('Supply Crate', [TILE.CRATE, TILE.CRATE, TILE.CRATE], 0.5, '#9a7138', { tag: 'wood' });
BLOCKS[B.HAY] = def('Hay Bale', [TILE.HAY, TILE.HAY, TILE.HAY], 0.3, '#c4a54c');
BLOCKS[B.COBBLE_MOSSY] = def('Mossy Cobble', [TILE.MOSSY, TILE.MOSSY, TILE.MOSSY], 1.05, '#71806b', { tag: 'stone' });
BLOCKS[B.BIRCH_LOG] = def('Birch Log', [TILE.BIRCH_TOP, TILE.BIRCH_TOP, TILE.BIRCH_SIDE], 0.68, '#c9c0a5', { tag: 'wood' });
BLOCKS[B.BIRCH_PLANKS] = def('Birch Planks', [TILE.BIRCH_PLANKS, TILE.BIRCH_PLANKS, TILE.BIRCH_PLANKS], 0.55, '#c7b78f', { tag: 'wood' });
BLOCKS[B.BANNER_RED] = def('Crimson Banner', [TILE.BANNER_RED, TILE.BANNER_RED, TILE.BANNER_RED], 0.4, '#7d2b23');
BLOCKS[B.BANNER_BLUE] = def('Azure Banner', [TILE.BANNER_BLUE, TILE.BANNER_BLUE, TILE.BANNER_BLUE], 0.4, '#2d4770');
BLOCKS[B.STONE_DARK] = def('Dark Stone', [TILE.STONE_DARK, TILE.STONE_DARK, TILE.STONE_DARK], 1.3, '#5f6368', { tag: 'stone' });

export const HOTBAR = [B.PLANKS, B.COBBLE, B.DIRT, B.LOG, B.SAND, B.BRICKS];

export const START_INVENTORY = {
  [B.PLANKS]: 24,
  [B.COBBLE]: 16,
  [B.DIRT]: 12,
  [B.LOG]: 8,
  [B.SAND]: 6,
  [B.BRICKS]: 8,
};

export function isSolid(id) {
  const d = BLOCKS[id];
  return !!d && d.solid;
}

export function isWater(id) { return id === B.WATER; }

export function blockName(id) {
  return BLOCKS[id] ? BLOCKS[id].name : 'Unknown';
}
