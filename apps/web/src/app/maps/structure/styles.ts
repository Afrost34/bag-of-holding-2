import type { StylePalette } from '../model';
import { pickOne, type Wanted } from '../packDefaults';
import { packRef, type PackEntry } from '../packModel';
import type { TerrainId } from '../terrain';

/**
 * Building styles: which Forgotten Adventures pictures a building is made of (its floors, wall
 * strip, door, window, stairs and roof), as `Wanted` queries. The pictures are picked once, when
 * the building is made (`resolveStyle`), and kept in its spec, so importing more packs later does
 * not change it. Without packs a building is drawn (`drawn` floors, ink walls). Pure.
 */

export interface Style {
  id: string;
  name: string;
  hint: string;
  floor: Wanted[];
  upperFloor: Wanted[];
  cellarFloor: Wanted[];
  wall: Wanted[];
  door: Wanted[];
  window: Wanted[];
  stairs: Wanted[];
  roof: Wanted[];
  /** Drawn floors without packs. */
  drawn: { floor: TerrainId; upperFloor: TerrainId; cellarFloor: TerrainId };
}

const floor = (...words: string[]): Wanted => ({
  cats: ['floors'],
  anyWords: words,
  not: ['overlay'],
});
const strip = (...words: string[]): Wanted => ({
  cats: ['walls'],
  anyWords: words,
  not: ['railing', 'half_wall'],
});
const door = (...words: string[]): Wanted => ({
  cats: ['doors'],
  words: ['/doors/'],
  anyWords: words,
  not: ['frame', 'double', 'large', 'open', 'portcullis', 'fallen'],
});
const window = (...words: string[]): Wanted => ({
  cats: ['windows'],
  words: ['small_windows/'],
  anyWords: words,
  not: ['broken', 'stained'],
});
const stairs = (...words: string[]): Wanted => ({
  cats: ['buildings'],
  words: ['/stairs_and_ladders/'],
  anyWords: words,
  file: /^stairs_[a-z]+_[a-z]+_[a-z]_1x3$/,
});
const roof = (...words: string[]): Wanted => ({ cats: ['roofs'], anyWords: words });

const WOOD_FLOOR = floor('wooden_flooring', 'wooden_floors');
const STONE_FLOOR = floor('cobblestone', 'flagstone');
const CELLAR_FLOOR = floor('flagstone', 'cobblestone', 'rectangular_tiles');

export const STYLES: readonly Style[] = [
  {
    id: 'stone',
    name: 'Stone',
    hint: 'stone walls, flagstone and plank floors, slate roof',
    floor: [STONE_FLOOR, WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    wall: [strip('wall_stone_earthy_a_straight'), strip('wall_stone_')],
    door: [door('door_wood_ashen', 'door_wood')],
    window: [window('window_small_wood')],
    stairs: [stairs('stairs_stone_earthy', 'stairs_stone'), stairs('stairs_wood')],
    roof: [roof('roof_texture_slate'), roof('roof_texture_tile')],
    drawn: { floor: 'stone', upperFloor: 'wood', cellarFloor: 'stone' },
  },
  {
    id: 'timber',
    name: 'Timber and plaster',
    hint: 'half-timbered walls, plank floors, tiled roof',
    floor: [WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    wall: [strip('wall_plasterwood_ashen'), strip('wall_plasterwood'), strip('wall_stonewood')],
    door: [door('door_wood_dark', 'door_wood')],
    window: [window('window_small_wood_dark', 'window_small_wood')],
    stairs: [stairs('stairs_wood_dark', 'stairs_wood')],
    roof: [roof('roof_texture_tile_brown', 'roof_texture_tile'), roof('roof_texture')],
    drawn: { floor: 'wood', upperFloor: 'wood', cellarFloor: 'stone' },
  },
  {
    id: 'brick',
    name: 'Brick',
    hint: 'brick walls, tiled floors, tiled roof',
    floor: [floor('rectangular_tiles', 'stone_square_tiles'), WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    wall: [strip('wall_brick_earthy'), strip('wall_brick_')],
    door: [door('door_wood_red', 'door_wood')],
    window: [window('window_small_wood_red', 'window_small_wood')],
    stairs: [stairs('stairs_stone'), stairs('stairs_wood')],
    roof: [roof('roof_texture_tile_red', 'roof_texture_tile')],
    drawn: { floor: 'stone', upperFloor: 'wood', cellarFloor: 'stone' },
  },
  {
    id: 'shack',
    name: 'Wooden shack',
    hint: 'plank walls, plank floors, thatch',
    floor: [WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    wall: [strip('shack_wall_wood', 'wall_wood_ashen'), strip('wall_wood_')],
    door: [door('door_wood_ashen', 'door_wood')],
    window: [window('shack_window', 'window_small_wood')],
    stairs: [stairs('stairs_wood_ashen', 'stairs_wood')],
    roof: [roof('roof_texture_hay', 'thatch'), roof('roof_texture')],
    drawn: { floor: 'wood', upperFloor: 'wood', cellarFloor: 'dirt' },
  },
];

const FIRST = STYLES[0];
if (!FIRST) throw new Error('No building styles');

export const styleById = (id: string): Style => STYLES.find((s) => s.id === id) ?? FIRST;

type Pickable = Pick<PackEntry, 'path' | 'pack' | 'cat'>;

/** The first picture any of the queries finds, as a reference. */
function first(entries: readonly Pickable[], wanted: readonly Wanted[]): string | undefined {
  for (const w of wanted) {
    const e = pickOne(entries, w);
    if (e) return packRef(e.pack, e.path);
  }
  return undefined;
}

/** The pictures a style picks from the packs (drawn floors and ink walls without them). */
export function resolveStyle(style: Style, entries: readonly Pickable[]): StylePalette {
  const pick = (w: readonly Wanted[]) => first(entries, w);
  const wall = pick(style.wall);
  const door = pick(style.door);
  const win = pick(style.window);
  const stair = pick(style.stairs);
  const roofTexture = pick(style.roof);
  return {
    floor: (pick(style.floor) as StylePalette['floor'] | undefined) ?? style.drawn.floor,
    upperFloor:
      (pick(style.upperFloor) as StylePalette['floor'] | undefined) ?? style.drawn.upperFloor,
    cellarFloor:
      (pick(style.cellarFloor) as StylePalette['floor'] | undefined) ?? style.drawn.cellarFloor,
    ...(wall ? { wall } : {}),
    ...(door ? { door } : {}),
    ...(win ? { window: win } : {}),
    ...(stair ? { stairs: stair } : {}),
    ...(roofTexture ? { roof: roofTexture } : {}),
  };
}
