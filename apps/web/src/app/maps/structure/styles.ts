import type { BuildingSpec, StylePalette } from '../model';
import { pickOne, type Wanted } from '../packDefaults';
import { packRef, type PackEntry } from '../packModel';
import type { TerrainId } from '../terrain';

/**
 * Building styles: which Forgotten Adventures pictures a building is made of (its floors, wall
 * strip, door, window, stairs, roof and chimney), as `Wanted` queries. The pictures are picked
 * once, when the building is made (`resolveStyle`), and kept in its spec, so importing more packs
 * later does not change it. Without packs a building is drawn (`drawn` floors, ink walls). The
 * classic styles use the Core pack; the others the Desert, Mountain, Underdark, Arctic and
 * Industrial settlement sets, falling back to Core pictures where a set has none. Pure.
 */

export interface Style {
  id: string;
  name: string;
  hint: string;
  floor: Wanted[];
  upperFloor: Wanted[];
  cellarFloor: Wanted[];
  /** The ground floor of working rooms (kitchen, storage, smithy…); the floor when empty. */
  hardFloor: Wanted[];
  wall: Wanted[];
  door: Wanted[];
  window: Wanted[];
  stairs: Wanted[];
  roof: Wanted[];
  /** The roof's shape when drawn (and its colour without a pack texture). */
  roofKind: BuildingSpec['roof'];
  /** Chimneys over the hearths (none for styles with no chimneys, like tents or metal sheds). */
  chimney: Wanted[];
  /** Other pictures, by name (a ship's masts, sails, cannons…): `palette.parts`. */
  parts?: Record<string, Wanted[]>;
  /** How a building of this style starts (Heliark ruins are ruined). */
  condition?: BuildingSpec['condition'];
  /** Drawn floors without packs. */
  drawn: { floor: TerrainId; upperFloor: TerrainId; cellarFloor: TerrainId };
}

/** Seamless floor tiles of the Core and settlement packs. */
const floor = (...words: string[]): Wanted => ({
  cats: ['floors'],
  anyWords: words,
  not: ['overlay'],
});
/** A settlement's own floor tiles, which the categories may count as terrain (metal, shack…). */
const tiles = (...words: string[]): Wanted => ({
  cats: ['floors', 'terrain'],
  words: ['textures/'],
  anyWords: words,
  not: ['overlay', 'substrate', 'cracked', 'grout'],
});
const strip = (...words: string[]): Wanted => ({
  cats: ['walls'],
  anyWords: words,
  not: ['railing', 'half_wall', 'ruined', 'overlay'],
});
const ruinedStrip = (...words: string[]): Wanted => ({ cats: ['walls'], anyWords: words });
const door = (...words: string[]): Wanted => ({
  cats: ['doors'],
  anyWords: words,
  not: ['frame', 'double', 'large', 'open', 'portcullis', 'fallen', 'rusty_1x1'],
  file: /_1x1$/,
});
const window = (...words: string[]): Wanted => ({
  cats: ['windows'],
  anyWords: words,
  not: ['broken', 'stained', 'large', 'sill', 'shutter'],
  file: /_1x1$/,
});
const stairs = (...words: string[]): Wanted => ({
  cats: ['buildings'],
  words: ['/stairs_and_ladders/'],
  anyWords: words,
  file: /^stairs_[a-z]+_[a-z]+_[a-z]_1x3$/,
});
const roof = (...words: string[]): Wanted => ({ cats: ['roofs'], anyWords: words });
/** A ship part of the Aquatic pack (or a boat of the Core pack): not upside down or broken. */
const vehicle = (...words: string[]): Wanted => ({
  cats: ['vehicles'],
  anyWords: words,
  not: ['broken', 'upside', 'filled', 'rusty'],
});
const chimney = (...words: string[]): Wanted => ({
  cats: ['buildings', 'decor', 'other'],
  words: ['/roofs/chimneys/'],
  anyWords: words,
});

const WOOD_FLOOR = floor('wooden_flooring', 'wooden_floors');
const STONE_FLOOR = floor('cobblestone', 'flagstone');
const CELLAR_FLOOR = floor('flagstone', 'cobblestone', 'rectangular_tiles');
const STONE_STAIRS = stairs('stairs_stone');
const WOOD_STAIRS = stairs('stairs_wood');

export const STYLES: readonly Style[] = [
  {
    id: 'stone',
    name: 'Stone',
    hint: 'stone walls, flagstone and plank floors, slate roof',
    floor: [STONE_FLOOR, WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    hardFloor: [STONE_FLOOR],
    wall: [strip('wall_stone_earthy_a_straight'), strip('wall_stone_')],
    door: [door('door_wood_ashen'), door('door_wood')],
    window: [window('window_small_wood')],
    stairs: [stairs('stairs_stone_earthy'), stairs('stairs_stone'), WOOD_STAIRS],
    roof: [roof('roof_texture_slate'), roof('roof_texture_tile')],
    roofKind: 'slate',
    chimney: [chimney('chimney_stone_slate'), chimney('chimney_stone')],
    drawn: { floor: 'stone', upperFloor: 'wood', cellarFloor: 'stone' },
  },
  {
    id: 'timber',
    name: 'Timber and plaster',
    hint: 'half-timbered walls, plank floors, tiled roof',
    floor: [WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    hardFloor: [STONE_FLOOR],
    wall: [strip('wall_plasterwood_ashen'), strip('wall_plasterwood'), strip('wall_stonewood')],
    door: [door('door_wood_dark'), door('door_wood')],
    window: [window('window_small_wood_dark'), window('window_small_wood')],
    stairs: [stairs('stairs_wood_dark'), stairs('stairs_wood')],
    roof: [roof('roof_texture_tile_brown'), roof('roof_texture_tile'), roof('roof_texture')],
    roofKind: 'tiles',
    chimney: [chimney('chimney_stone_earthy'), chimney('chimney_stone')],
    drawn: { floor: 'wood', upperFloor: 'wood', cellarFloor: 'stone' },
  },
  {
    id: 'brick',
    name: 'Brick',
    hint: 'brick walls, tiled floors, tiled roof',
    floor: [floor('rectangular_tiles'), floor('stone_square_tiles'), WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    hardFloor: [floor('rectangular_tiles'), floor('stone_square_tiles')],
    wall: [strip('wall_brick_earthy'), strip('wall_brick_')],
    door: [door('door_wood_red'), door('door_wood')],
    window: [window('window_small_wood_red'), window('window_small_wood')],
    stairs: [STONE_STAIRS, WOOD_STAIRS],
    roof: [roof('roof_texture_tile_red'), roof('roof_texture_tile')],
    roofKind: 'tiles',
    chimney: [chimney('chimney_stone_redrock'), chimney('chimney_stone')],
    drawn: { floor: 'stone', upperFloor: 'wood', cellarFloor: 'stone' },
  },
  {
    id: 'shack',
    name: 'Wooden shack',
    hint: 'plank walls, plank floors, thatch',
    floor: [WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    hardFloor: [],
    wall: [strip('shack_wall_wood_a_ashen'), strip('wall_wood_ashen'), strip('wall_wood_')],
    door: [door('door_wood_ashen'), door('door_wood')],
    window: [window('shack_window'), window('window_small_wood')],
    stairs: [stairs('stairs_wood_ashen'), stairs('stairs_wood')],
    roof: [roof('roof_texture_hay'), roof('thatch'), roof('roof_texture')],
    roofKind: 'thatch',
    chimney: [],
    drawn: { floor: 'wood', upperFloor: 'wood', cellarFloor: 'dirt' },
  },
  {
    id: 'desert',
    name: 'Desert adobe',
    hint: 'adobe walls, stone tile floors, flat roof',
    floor: [tiles('stone_tile_medium_sandstone'), tiles('stone_tile_small_sandstone'), STONE_FLOOR],
    upperFloor: [tiles('stone_tile_small_terracotta'), tiles('stone_tile_small'), WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    hardFloor: [tiles('stone_tile_small_terracotta'), tiles('stone_tile_small'), STONE_FLOOR],
    wall: [strip('wall_adobe_sandstone_wide'), strip('wall_adobe_'), strip('wall_mudbrick_')],
    door: [door('door_wood_light'), door('door_wood')],
    window: [window('/window_wood_light'), window('/window_wood_'), window('window_small_wood')],
    stairs: [STONE_STAIRS, WOOD_STAIRS],
    roof: [roof('roof_texture_tile_tan'), roof('roof_texture_tile')],
    roofKind: 'flat',
    chimney: [chimney('chimney_stone_sandstone'), chimney('chimney_stone')],
    drawn: { floor: 'stone', upperFloor: 'stone', cellarFloor: 'stone' },
  },
  {
    id: 'dwarven',
    name: 'Dwarven hall',
    hint: 'carved stone walls, stone tiles, slate roof',
    floor: [tiles('dwarven_stone'), STONE_FLOOR],
    upperFloor: [tiles('dwarven_stone'), STONE_FLOOR],
    cellarFloor: [tiles('dwarven_stone'), CELLAR_FLOOR],
    hardFloor: [],
    wall: [strip('dwarven_wall_stone_slate'), strip('dwarven_wall_'), strip('wall_stone_')],
    door: [door('door_stone_slate'), door('door_stone_')],
    window: [window('window_small_metal'), window('window_small_wood')],
    stairs: [stairs('stairs_stone_slate'), stairs('stairs_stone')],
    roof: [roof('roof_texture_slate')],
    roofKind: 'slate',
    chimney: [chimney('chimney_stone_slate'), chimney('chimney_stone')],
    drawn: { floor: 'stone', upperFloor: 'stone', cellarFloor: 'stone' },
  },
  {
    id: 'drow',
    name: 'Drow',
    hint: 'dark stone and metal walls, patterned tiles',
    floor: [tiles('drow_stone_patterned_tiles'), STONE_FLOOR],
    upperFloor: [tiles('drow_stone_patterned_tiles'), STONE_FLOOR],
    cellarFloor: [tiles('drow_stone_patterned_tiles'), CELLAR_FLOOR],
    hardFloor: [],
    wall: [
      strip('drow_wall_stone_purple'),
      strip('drow_wall_stone_volcanic'),
      strip('drow_wall_stone'),
    ],
    door: [door('door_stone_volcanic'), door('door_stone_')],
    window: [window('window_small_metal')],
    stairs: [stairs('stairs_stone_volcanic'), stairs('stairs_stone')],
    roof: [roof('roof_texture_slate')],
    roofKind: 'slate',
    chimney: [],
    drawn: { floor: 'stone', upperFloor: 'stone', cellarFloor: 'stone' },
  },
  {
    id: 'arctic',
    name: 'Arctic',
    hint: 'frosty plank walls and floors, snowy roof',
    floor: [tiles('shack_floor_wood_frosty'), WOOD_FLOOR],
    upperFloor: [tiles('shack_floor_wood_frosty'), WOOD_FLOOR],
    cellarFloor: [CELLAR_FLOOR],
    hardFloor: [STONE_FLOOR],
    wall: [strip('shack_wall_wood_a_frosty'), strip('shack_wall_wood')],
    door: [door('shack_door_wood_frosty'), door('door_wood')],
    window: [window('shack_window_wood_frosty'), window('window_small_wood')],
    stairs: [WOOD_STAIRS],
    roof: [roof('roof_texture_slate_snowy'), roof('roof_texture_wood_snowy'), roof('roof_texture')],
    roofKind: 'slate',
    chimney: [chimney('chimney_stone_slate'), chimney('chimney_stone')],
    drawn: { floor: 'wood', upperFloor: 'wood', cellarFloor: 'stone' },
  },
  {
    id: 'industrial',
    name: 'Industrial',
    hint: 'metal walls, metal panel floors, corrugated roof',
    floor: [tiles('metal_square_panels'), tiles('metal_floor'), STONE_FLOOR],
    upperFloor: [tiles('metal_rectangle_panels'), tiles('metal_square_panels'), WOOD_FLOOR],
    cellarFloor: [tiles('metal_floor'), CELLAR_FLOOR],
    hardFloor: [tiles('metal_floor'), tiles('metal_rectangle_panels')],
    wall: [strip('wall_metal_gray'), strip('wall_metal_'), strip('wall_stonemetal')],
    door: [door('door_metal_gray'), door('door_metal')],
    window: [window('window_small_metal_gray'), window('window_small_metal')],
    stairs: [STONE_STAIRS, WOOD_STAIRS],
    roof: [roof('corrugated_metal_gray'), roof('corrugated_metal'), roof('roof_texture_slate')],
    roofKind: 'flat',
    chimney: [],
    drawn: { floor: 'stone', upperFloor: 'stone', cellarFloor: 'stone' },
  },
  {
    id: 'rust',
    name: 'Rust',
    hint: 'rusty metal walls, grating and panel floors, corrugated roof (Rust & Sunfire)',
    floor: [tiles('metal_square_panels'), tiles('metal_floor'), WOOD_FLOOR],
    upperFloor: [tiles('metal_rectangle_panels'), tiles('metal_square_panels'), WOOD_FLOOR],
    cellarFloor: [tiles('metal_floor'), CELLAR_FLOOR],
    hardFloor: [tiles('metal_floor')],
    wall: [strip('wall_metal_rusty'), strip('wall_stonemetal_earthy_rusty'), strip('wall_metal_')],
    door: [door('door_metal_rusty'), door('door_metal')],
    window: [window('window_small_metal')],
    stairs: [WOOD_STAIRS, STONE_STAIRS],
    roof: [roof('corrugated_metal_rusty'), roof('corrugated_metal'), roof('roof_texture')],
    roofKind: 'flat',
    chimney: [],
    drawn: { floor: 'stone', upperFloor: 'wood', cellarFloor: 'stone' },
  },
  {
    id: 'heliark',
    name: 'Heliark ruins',
    hint: 'old stone and metal walls, stone tiles, ruined (Rust & Sunfire)',
    floor: [tiles('dwarven_stone'), tiles('stone_square_tiles'), STONE_FLOOR],
    upperFloor: [tiles('metal_square_panels'), STONE_FLOOR],
    cellarFloor: [tiles('dwarven_stone'), CELLAR_FLOOR],
    hardFloor: [tiles('metal_floor'), tiles('metal_square_panels')],
    wall: [
      strip('wall_stonemetal_earthy_gray'),
      strip('wall_stonemetal'),
      ruinedStrip('dwarven_wall_stone_earthy_f_ruined'),
      strip('wall_stone_'),
    ],
    door: [door('door_stone_earthy'), door('door_stone_')],
    window: [window('window_small_metal')],
    stairs: [stairs('stairs_stone_earthy'), stairs('stairs_stone')],
    roof: [roof('roof_texture_slate'), roof('corrugated_metal_gray')],
    roofKind: 'flat',
    chimney: [],
    condition: 'ruined',
    drawn: { floor: 'stone', upperFloor: 'stone', cellarFloor: 'stone' },
  },
  {
    id: 'cave',
    name: 'Cave',
    hint: 'rough cave walls, a cave or dirt floor',
    floor: [
      { cats: ['floors', 'terrain'], words: ['cave'], not: ['overlay'] },
      { cats: ['terrain'], words: ['dirt'], not: ['overlay', 'gravel'] },
    ],
    upperFloor: [],
    cellarFloor: [],
    hardFloor: [],
    // A cave cliff strip round the caverns, as the Room tool's caves.
    wall: [{ cats: ['cliffs'], words: ['cave', '_path'], not: ['stalagmite'] }],
    door: [],
    window: [],
    stairs: [],
    roof: [],
    roofKind: 'flat',
    chimney: [],
    drawn: { floor: 'dirt', upperFloor: 'dirt', cellarFloor: 'dirt' },
  },
  {
    id: 'ship',
    name: 'Ship',
    hint: 'a plank deck, a wooden hull, masts and sails (the Aquatic pack)',
    floor: [WOOD_FLOOR],
    upperFloor: [WOOD_FLOOR],
    cellarFloor: [WOOD_FLOOR],
    hardFloor: [],
    wall: [
      { cats: ['vehicles'], words: ['ship_hull_wall_wood_walnut', '_path'] },
      { cats: ['vehicles'], words: ['ship_hull_wall', '_path'] },
    ],
    door: [door('door_wood_dark'), door('door_wood')],
    window: [],
    stairs: [WOOD_STAIRS],
    roof: [],
    roofKind: 'flat',
    chimney: [],
    parts: {
      innerWall: [
        { cats: ['vehicles'], words: ['/ship_wall/', '_path'], not: ['railing', 'hull'] },
      ],
      mast: [vehicle('/masts/mast_wood_walnut_a1'), vehicle('/masts/mast_wood_')],
      mastBase: [vehicle('/masts/mast_base_wood_walnut'), vehicle('/masts/mast_base_')],
      sail: [vehicle('sail_yard_ashen_white_b1'), vehicle('sail_yard_')],
      bowsprit: [vehicle('/bowsprits/bowsprit_wood_walnut'), vehicle('/bowsprits/')],
      rudder: [vehicle('/rudders/rudder_wood_walnut'), vehicle('/rudders/rudder_')],
      capstan: [vehicle('/capstans/capstan_wood_walnut'), vehicle('/capstans/')],
      anchor: [vehicle('anchor_large_metal_gray_wood_walnut'), vehicle('/anchors/')],
      lantern: [vehicle('/stern_lanterns/stern_lantern_metal_brass'), vehicle('/stern_lanterns/')],
      crowsNest: [vehicle('/crows_nests/crows_nest_wood_walnut'), vehicle('/crows_nests/')],
      cannon: [
        { cats: ['combat'], anyWords: ['cannon_metal_black_a1'] },
        { cats: ['combat'], anyWords: ['/cannons/cannon_metal_'] },
      ],
      cannonBase: [
        { cats: ['combat'], anyWords: ['cannon_base_wood_walnut_a_'] },
        { cats: ['combat'], anyWords: ['/cannons/cannon_base_'] },
      ],
      core: [{ cats: ['lights'], words: ['light_crystal', '_glowing'], not: ['wall_light'] }],
      rowboat: [vehicle('/boats/rowboat_wood_ashen_b1'), vehicle('/boats/rowboat_wood_')],
      canoe: [vehicle('/canoes/canoe_large_wood_ashen_a1'), vehicle('/canoes/canoe_')],
      raft: [{ cats: ['vehicles'], anyWords: ['raft_wood_'] }],
      boatMast: [vehicle('/boats/boat_mast_wood_')],
      boatSail: [vehicle('/boats/boat_sail_cloth_white'), vehicle('/boats/boat_sail_cloth_')],
    },
    drawn: { floor: 'wood', upperFloor: 'wood', cellarFloor: 'wood' },
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
  const asFloor = (w: readonly Wanted[]) => pick(w) as StylePalette['floor'] | undefined;
  const wall = pick(style.wall);
  const door = pick(style.door);
  const win = pick(style.window);
  const stair = pick(style.stairs);
  const roofTexture = pick(style.roof);
  const chimneyStamp = pick(style.chimney);
  const hard = asFloor(style.hardFloor);
  const parts: Record<string, string> = {};
  for (const [name, wanted] of Object.entries(style.parts ?? {})) {
    const ref = pick(wanted);
    if (ref) parts[name] = ref;
  }
  return {
    floor: asFloor(style.floor) ?? style.drawn.floor,
    upperFloor: asFloor(style.upperFloor) ?? style.drawn.upperFloor,
    cellarFloor: asFloor(style.cellarFloor) ?? style.drawn.cellarFloor,
    ...(hard ? { hardFloor: hard } : {}),
    ...(wall ? { wall } : {}),
    ...(door ? { door } : {}),
    ...(win ? { window: win } : {}),
    ...(stair ? { stairs: stair } : {}),
    ...(roofTexture ? { roof: roofTexture } : {}),
    ...(chimneyStamp ? { chimney: chimneyStamp } : {}),
    ...(Object.keys(parts).length > 0 ? { parts } : {}),
  };
}
