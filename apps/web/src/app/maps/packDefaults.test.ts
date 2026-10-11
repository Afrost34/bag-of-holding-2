import { describe, expect, it } from 'vitest';
import { classify } from './packCategories';
import {
  defaultCaveFloor,
  defaultCaveWall,
  defaultCliff,
  defaultMaterial,
  defaultWater,
  defaultRoomStyle,
  defaultSlots,
  pickMany,
  pickOne,
} from './packDefaults';

const e = (path: string) => ({ pack: 'p', path, cat: classify(path) });
const tree = (i: number) => `Woodlands/!Wilderness/Flora/Trees/Tree_Green_C${String(i)}_5x5.webp`;
const bush = (i: number) => `Woodlands/!Wilderness/Flora/Bushes/Bush_Red_B${String(i)}_2x2.webp`;
const stone = (i: number) =>
  `Woodlands/!Wilderness/Decor/Rocks/Stones/Stone_Mossy_B${String(i)}_1x1.webp`;
const PACK = [
  'Woodlands/!Wilderness/Textures/Grass/Grass_E_03.jpg',
  'Woodlands/!Wilderness/Textures/Grass/Grass_Overlays/Grass_Overlay_A_01.webp',
  'Woodlands/!Wilderness/Textures/Dirt/Dirt_A_04.jpg',
  'Woodlands/!Wilderness/Textures/Dirt/Rocky_Dirt_04_C.jpg',
  'Woodlands/!Wilderness/Textures/Rock/Rock_Texture_G_06.jpg',
  'Desert/!Wilderness/Textures/Sand/Desert_Clumped_Sand_Red_A.jpg',
  'Aquatic/!Wilderness/Textures/Water/Water_Still_B_01.jpg',
  'Aquatic/!Wilderness/Textures/Water/Water_Opaque_A_01.jpg',
  ...[0, 1, 2, 3, 4, 5].map(tree),
  'Woodlands/!Wilderness/Flora/Trees/Tree_Shadows/Tree_Shadow_D6_3x3.webp',
  ...[0, 1, 2, 3].map(bush),
  ...[0, 1, 2, 3].map(stone),
].map(e);

describe('what the tools start with', () => {
  it('fills the terrain slots with grass, dirt, rock, sand and water from the packs', () => {
    const slots = defaultSlots(PACK);
    expect(slots[0]).toBe('pack:p:Woodlands/!Wilderness/Textures/Grass/Grass_E_03.jpg');
    expect(slots.some((s) => s.includes('Dirt_A_04'))).toBe(true);
    expect(slots.some((s) => s.includes('Rock_Texture'))).toBe(true);
    expect(slots.some((s) => s.includes('Sand'))).toBe(true);
    expect(slots.some((s) => s.includes('Water_Still'))).toBe(true);
    expect(slots.some((s) => s.includes('Overlay'))).toBe(false);
    expect(defaultSlots([])).toEqual([]);
  });

  it('picks the same picture every time, from the favourite biome', () => {
    const sand = pickOne(PACK, { cats: ['terrain'], words: ['sand'] });
    expect(sand?.path).toContain('Desert');
    expect(pickOne(PACK, { cats: ['terrain'], words: ['nothing'] })).toBeUndefined();
  });

  it('spreads a mix over many pictures', () => {
    expect(pickMany(PACK, { cats: ['trees'] }, 3)).toHaveLength(3);
  });
});

describe('the room a new map starts with', () => {
  it('takes a cobblestone floor and a stone wall strip from the packs', () => {
    const rooms = [
      '!Core_Settlements/Textures/Wooden_Floors/Planks_A_01.jpg',
      '!Core_Settlements/Textures/Stone_Floors/Cobblestone_A_01.jpg',
      '!Core_Settlements/Structures/Building/Walls_and_Curbs/Wall_Wood_A/Shack_Wall_Wood_Ashen_A1_Path.webp',
      '!Core_Settlements/Structures/Building/Walls_and_Curbs/Wall_Stone_B/Wall_Stone_Earthy_B1_Straight_Path.webp',
    ].map(e);
    const style = defaultRoomStyle(rooms);
    expect(style.floor).toContain('Cobblestone_A_01');
    expect(style.wall).toContain('Wall_Stone_Earthy');
    expect(defaultRoomStyle([])).toEqual({});
  });
});

describe('the rim of a cave', () => {
  it('is a cave cliff strip when the packs have one', () => {
    const cliffs = [
      'Woodlands/!Wilderness/Elevation/Cliff_Paths/Cliff_Dirt_01_Path_D3.webp',
      'Woodlands/!Wilderness/Elevation/Cliff_Paths/Burrows_Cave_Stone_Earthy_Path_A1.webp',
    ].map(e);
    expect(defaultCaveWall(cliffs)).toContain('Burrows_Cave');
    expect(defaultCaveWall([])).toBeUndefined();
  });
});

describe('the water brush', () => {
  it('starts from a water texture of the packs', () => {
    expect(defaultWater(PACK)).toContain('Water_Still_B_01');
    expect(defaultWater([])).toBeUndefined();
  });
});

describe('the material brush and the cave', () => {
  it('start from a rock texture and a cave or dirt floor of the packs', () => {
    expect(defaultMaterial(PACK)).toContain('Rock_Texture');
    expect(defaultCaveFloor(PACK)).toContain('Dirt_A_04');
    expect(defaultMaterial([])).toBeUndefined();
    expect(defaultCaveFloor([])).toBeUndefined();
  });
});

describe('a cliff along a contour', () => {
  it('is an open-air cliff strip, not a cave rim', () => {
    const cliffs = [
      'Woodlands/!Wilderness/Elevation/Cliff_Paths/Burrows_Cave_Stone_Earthy_Path_A1.webp',
      'Woodlands/!Wilderness/Elevation/Cliff_Paths/Cliff_Dirt_01_Path_D3.webp',
    ].map(e);
    expect(defaultCliff(cliffs)).toContain('Cliff_Dirt_01_Path');
    expect(defaultCliff([])).toBeUndefined();
  });
});
