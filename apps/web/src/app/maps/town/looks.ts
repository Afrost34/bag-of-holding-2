import type { Wanted } from '../packDefaults';
import type { TerrainId } from '../terrain';

/**
 * How a town looks: the building styles it mixes (`structure/styles.ts`, by weight, so a
 * temperate town is mostly timber with some brick and stone), what its streets and its square are
 * paved with (Forgotten Adventures floor tiles, in order of preference; a drawn terrain without
 * packs). `town.test.ts` checks every look's paving on real names. Pure data.
 */

export interface TownLook {
  id: string;
  name: string;
  hint: string;
  /** Building styles and how often each is picked. */
  styles: { style: string; weight: number }[];
  /** The wealthy middle of the town builds in this style when it has it (stone for the rich). */
  core?: string;
  street: Wanted[];
  square: Wanted[];
  /** Drawn without packs. */
  drawn: { street: TerrainId; square: TerrainId };
}

const tiles = (...words: string[]): Wanted => ({
  cats: ['floors', 'terrain'],
  words: ['textures/'],
  anyWords: words,
  not: ['overlay', 'substrate', 'cracked', 'grout'],
});

const COBBLE = tiles('/stone_floors/cobblestone');
const FLAGSTONE = tiles('/stone_floors/large_flagstone', '/stone_floors/flagstone');
const DIRT = tiles('/textures/dirt/');

export const TOWN_LOOKS: readonly TownLook[] = [
  {
    id: 'temperate',
    name: 'Market town',
    hint: 'timber houses, brick and stone in the middle, cobbled streets',
    styles: [
      { style: 'timber', weight: 5 },
      { style: 'brick', weight: 2 },
      { style: 'stone', weight: 2 },
    ],
    core: 'stone',
    street: [COBBLE, FLAGSTONE],
    square: [FLAGSTONE, COBBLE],
    drawn: { street: 'stone', square: 'stone' },
  },
  {
    id: 'city',
    name: 'Stone city',
    hint: 'stone and brick, flagstone streets',
    styles: [
      { style: 'stone', weight: 4 },
      { style: 'brick', weight: 3 },
      { style: 'timber', weight: 1 },
    ],
    core: 'stone',
    street: [FLAGSTONE, COBBLE],
    square: [FLAGSTONE],
    drawn: { street: 'stone', square: 'stone' },
  },
  {
    id: 'village',
    name: 'Village',
    hint: 'timber and shacks on dirt lanes',
    styles: [
      { style: 'timber', weight: 4 },
      { style: 'shack', weight: 2 },
    ],
    street: [DIRT, COBBLE],
    square: [COBBLE, DIRT],
    drawn: { street: 'dirt', square: 'dirt' },
  },
  {
    id: 'desert',
    name: 'Desert town',
    hint: 'sandstone houses round a tiled square',
    styles: [{ style: 'desert', weight: 1 }],
    street: [
      tiles('stone_tile_medium_sandstone', 'stone_tile_small_sandstone'),
      tiles('/stone_tiles/'),
    ],
    square: [tiles('stone_tile_small_terracotta', 'terracotta'), tiles('/stone_tiles/')],
    drawn: { street: 'sand', square: 'sand' },
  },
  {
    id: 'dwarven',
    name: 'Dwarven hold',
    hint: 'carved stone halls, dwarven paving',
    styles: [
      { style: 'dwarven', weight: 4 },
      { style: 'stone', weight: 1 },
    ],
    street: [tiles('/dwarven_stone'), FLAGSTONE],
    square: [tiles('/dwarven_stone'), FLAGSTONE],
    drawn: { street: 'rock', square: 'stone' },
  },
  {
    id: 'drow',
    name: 'Drow city',
    hint: 'drow stone, patterned tiles',
    styles: [{ style: 'drow', weight: 1 }],
    street: [tiles('drow_stone'), FLAGSTONE],
    square: [tiles('drow_stone_patterned'), tiles('drow_stone')],
    drawn: { street: 'rock', square: 'stone' },
  },
  {
    id: 'arctic',
    name: 'Arctic village',
    hint: 'frosty timber shacks on snow',
    styles: [
      { style: 'arctic', weight: 3 },
      { style: 'timber', weight: 1 },
    ],
    street: [COBBLE],
    square: [FLAGSTONE, COBBLE],
    drawn: { street: 'snow', square: 'snow' },
  },
  {
    id: 'rust',
    name: 'Rust town',
    hint: 'metal sheds and shanties on plated streets',
    styles: [
      { style: 'industrial', weight: 3 },
      { style: 'rust', weight: 2 },
      { style: 'shack', weight: 1 },
    ],
    street: [tiles('metal_floor', 'metal_rectangle_panels'), COBBLE],
    square: [tiles('metal_square_panels', 'metal_floor'), FLAGSTONE],
    drawn: { street: 'rock', square: 'stone' },
  },
];

const FIRST = TOWN_LOOKS[0];
if (!FIRST) throw new Error('No town looks');

export const townLookById = (id: string): TownLook => TOWN_LOOKS.find((l) => l.id === id) ?? FIRST;
