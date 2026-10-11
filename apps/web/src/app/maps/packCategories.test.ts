import { describe, expect, it } from 'vitest';
import { biomeOf, categoryCounts, classify, tileSquares } from './packCategories';

/** Real paths of the Forgotten Adventures packs (the zip's top folder already cut). */
const SAMPLES: [string, ReturnType<typeof classify>][] = [
  ['Woodlands/!Wilderness/Textures/Grass/Grass_E_03.jpg', 'terrain'],
  ['Woodlands/!Wilderness/Textures/Dirt/Gravel_Light_A.jpg', 'terrain'],
  [
    'Woodlands/!Wilderness/Textures/Grass/Grass_Overlays/Grass_Overlay_Medium_A_01.webp',
    'overlays',
  ],
  ['Woodlands/!Wilderness/Textures/Overlays/Pebbles_Overlay_A.webp', 'overlays'],
  ['Aquatic/!Wilderness/Textures/Water/Water_Still_B_01.jpg', 'water'],
  ['Volcanic/!Wilderness/Textures/Lava/Lava_A_01.jpg', 'water'],
  ['Arctic/!Wilderness/Textures/Snow/Frosted_Grass_A1_01.jpg', 'terrain'],
  ['!Core_Settlements/Textures/Stone_Floors/Cobblestone_Square_B_01.jpg', 'floors'],
  ['!Core_Settlements/Textures/Wooden_Floors/Planks_A_01.jpg', 'floors'],
  ['!Core_Settlements/Textures/Rug_and_Carpets/Carpet_DesignF_GoldRed_A1.jpg', 'floors'],
  ['!Core_Settlements/Textures/Roof/Roof_Texture_Tile_Gray_B2.webp', 'roofs'],
  ['!Core_Settlements/Textures/Hay/Roof_Texture_Hay_03_A3.webp', 'roofs'],
  [
    '!Core_Settlements/Structures/Building/Walls_and_Curbs/Wall_Stone_B/Wall_Stone_Earthy_B1_Straight_Path.webp',
    'walls',
  ],
  [
    '!Core_Settlements/Structures/Building/Walls_and_Curbs/Wall_Stone_B/Wall_Stone_Earthy_B1_Corner_A_1x1.webp',
    'wallpieces',
  ],
  ['!Core_Settlements/Structures/Building/Doors/Door_Metal_Gray_A_1x1.webp', 'doors'],
  ['!Core_Settlements/Structures/Building/Doors/Door_Frames/Frame_A_1x1.webp', 'doors'],
  ['!Core_Settlements/Structures/Building/Windows/Small_Windows/Window_A_1x1.webp', 'windows'],
  ['!Core_Settlements/Structures/Building/Pillars/Pillar_Stone_A_1x1.webp', 'buildings'],
  ['!Core_Settlements/Structures/Rubble/Rubble_Stone_A_2x2.webp', 'rubble'],
  ['Woodlands/!Wilderness/Elevation/Cliff_Paths/Cliff_Dirt_01_Path_D3.webp', 'cliffs'],
  ['Horror/!Wilderness/Paths/Sinews/Flesh_Peachy_Sinew_Path_B1.webp', 'paths'],
  ['Woodlands/!Wilderness/Decor/Tracks/Track_Boot_A_1x1.webp', 'decor'],
  [
    '!Core_Settlements/Structures/Building/Walls_and_Curbs/Shack_Wall_Wood/Shack_Wall_Wood_Ashen_A1_Path.webp',
    'walls',
  ],
  [
    '!Core_Settlements/Structures/Building/Walls_and_Curbs/Wall_Stone_B/Wall_Stone_Earthy_Rubble_A_2x2.webp',
    'rubble',
  ],
  [
    '!Core_Settlements/Structures/Building/Walls_and_Curbs/Wall_Stone_B/Broken_Wall_Endings/Broken_Wall_Ending_A_1x1.webp',
    'wallpieces',
  ],
  ['!Core_Settlements/Structures/Building/Doors/Addons/Door_Handle_A_1x1.webp', 'buildings'],
  [
    '!Core_Settlements/Structures/Building/Doors/Cellar_Doors/Cellar_Door_Wood_A1_Closed_2x1.webp',
    'buildings',
  ],
  ['!Core_Settlements/Textures/Grates/Grate_Metal_A_01.webp', 'overlays'],
  ['Woodlands/!Wilderness/Flora/Trees/Tree_Green_C5_5x5.webp', 'trees'],
  [
    'Woodlands/!Wilderness/Flora/Trees/Bare_Trees/Tree_Branches/Tree_Branch_Light_A24_2x2.webp',
    'trees',
  ],
  ['Woodlands/!Wilderness/Flora/Bushes/Bush_Red_B5_2x2.webp', 'bushes'],
  ['Woodlands/!Wilderness/Flora/Flowers/Flower_A_1x1.webp', 'plants'],
  ['Woodlands/!Wilderness/Decor/Rocks/Stones/Stone_Mossy_B2_1x1.webp', 'rocks'],
  ['Mountain/!Wilderness/Decor/Ore/Ore_Iron_A_1x1.webp', 'rocks'],
  ['Underdark/!Wilderness/Decor/Crystals/Crystal_Blue_A_1x1.webp', 'rocks'],
  ['Aquatic/!Wilderness/Water/Waterfalls/Waterfall_A_3x3.webp', 'waterfx'],
  ['Woodlands/!Wilderness/Decor/Puddles/Puddle_Water_Blue_B17_1x1.webp', 'decor'],
  ['!Core_Settlements/Furniture/Seating/Chair_Wood_Dark_A1_1x1.webp', 'furniture'],
  ['Desert/Base_Desert_Settlement/Furniture/Tables/Table_A_2x1.png', 'furniture'],
  ['!Core_Settlements/Clutter/Food/Apple_A_1x1.webp', 'clutter'],
  ['!Core_Settlements/Decor/Pottery/Vase_A_1x1.webp', 'decor'],
  ['!Core_Settlements/Lightsources/Candles/Candle_A_1x1.webp', 'lights'],
  ['!Core_Settlements/Workplace_Equipment/Smithing/Anvil_A_1x1.webp', 'workplace'],
  ['!Core_Settlements/Combat/Weapons/Sword_A_1x1.webp', 'combat'],
  ['!Core_Settlements/Burial_and_Graves/Tombstones/Tombstone_A_1x1.webp', 'graves'],
  ['!Core_Settlements/Vehicles/Boats/Rowboat_A_2x4.webp', 'vehicles'],
  ['Horror/!Wilderness/Gore/Blood_A_1x1.webp', 'gore'],
  ['!Effects/Fire/Fire_A_1x1.webp', 'effects'],
  ['Prefabs/Whatever/Thing_1x1.webp', 'other'],
];

describe('sorting pack pictures into categories', () => {
  it.each(SAMPLES)('%s is %s', (path, expected) => {
    expect(classify(path)).toBe(expected);
  });

  it('names the biome', () => {
    expect(biomeOf('Woodlands/!Wilderness/Flora/Trees/T_1x1.webp')).toBe('Woodlands');
    expect(biomeOf('!Core_Settlements/Furniture/X_1x1.webp')).toBe('Core settlements');
    expect(biomeOf('Astral/Ceremorph_Settlement/X_1x1.webp')).toBe('Astral');
  });

  it('counts per category', () => {
    const counts = categoryCounts([{ cat: 'trees' }, { cat: 'trees' }, { cat: 'rocks' }]);
    expect(counts.get('trees')).toBe(2);
    expect(counts.get('rocks')).toBe(1);
  });

  it('turns a texture size in pixels into squares at 200 pixels to the square', () => {
    expect(tileSquares(1000)).toBe(5);
    expect(tileSquares(600)).toBe(3);
    expect(tileSquares(50)).toBe(1);
  });
});
