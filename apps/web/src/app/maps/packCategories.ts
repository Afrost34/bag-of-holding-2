/**
 * Sorts the pictures of an asset pack into the categories the map tools need (ground textures,
 * floors, walls, doors, trees, furniture…), from their folder and file names. Pure.
 *
 * It is written for the Forgotten Adventures layout, checked against the real packs:
 *
 *   !Core_Settlements/<Furniture|Decor|Clutter|Structures|Textures|…>/<Group>/…
 *   <Biome>/!Wilderness/<Flora|Decor|Elevation|Textures|Water|Paths|…>/<Group>/…
 *   <Biome>/<Name>_Settlement/<the same folders as !Core_Settlements>/…
 *   !Effects/<Fire|Magic|Smoke|…>/…
 *
 * Other packs fall back on the words in their folders; what nothing matches is `other`.
 */

/** Changes when the sorting rules do: packs sorted by an older version are sorted again. */
export const SORTER_VERSION = 1;

export type CategoryId =
  | 'terrain'
  | 'water'
  | 'floors'
  | 'roofs'
  | 'overlays'
  | 'walls'
  | 'wallpieces'
  | 'doors'
  | 'windows'
  | 'paths'
  | 'cliffs'
  | 'trees'
  | 'bushes'
  | 'plants'
  | 'rocks'
  | 'waterfx'
  | 'furniture'
  | 'clutter'
  | 'decor'
  | 'lights'
  | 'buildings'
  | 'rubble'
  | 'vehicles'
  | 'workplace'
  | 'combat'
  | 'graves'
  | 'gore'
  | 'effects'
  | 'other';

export type CategoryGroup = 'Terrain' | 'Structures' | 'Nature' | 'Interior' | 'Effects' | 'Other';

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  group: CategoryGroup;
  /** What it holds, for the page that shows how a pack was sorted. */
  about: string;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  {
    id: 'terrain',
    name: 'Ground textures',
    group: 'Terrain',
    about: 'Grass, dirt, sand, snow, rock: seamless tiles to paint the ground with.',
  },
  {
    id: 'water',
    name: 'Water textures',
    group: 'Terrain',
    about: 'Water, lava, acid and marsh tiles.',
  },
  {
    id: 'overlays',
    name: 'Texture overlays',
    group: 'Terrain',
    about: 'See-through patterns to lay over the ground (leaves, frost, cracks).',
  },
  {
    id: 'floors',
    name: 'Floors',
    group: 'Structures',
    about: 'Stone, wood, tile and carpet floors for rooms.',
  },
  {
    id: 'roofs',
    name: 'Roof textures',
    group: 'Structures',
    about: 'Tiles, hay and shingles for roofs.',
  },
  {
    id: 'walls',
    name: 'Walls',
    group: 'Structures',
    about: 'Wall strips: a wall is drawn along the line you click.',
  },
  {
    id: 'wallpieces',
    name: 'Wall pieces',
    group: 'Structures',
    about: 'Corners, endings and joints of walls, placed by hand.',
  },
  {
    id: 'doors',
    name: 'Doors',
    group: 'Structures',
    about: 'Doors, gates and frames; they snap onto walls.',
  },
  {
    id: 'windows',
    name: 'Windows',
    group: 'Structures',
    about: 'Windows and arrow slits; they snap onto walls.',
  },
  {
    id: 'buildings',
    name: 'Building parts',
    group: 'Structures',
    about: 'Pillars, stairs, fences, shelters, bridges, statues and the rest of the structures.',
  },
  { id: 'rubble', name: 'Rubble', group: 'Structures', about: 'Broken walls, debris and ruins.' },
  {
    id: 'paths',
    name: 'Paths and roads',
    group: 'Terrain',
    about: 'Strips for trails, roads and tracks.',
  },
  {
    id: 'cliffs',
    name: 'Cliffs and ridges',
    group: 'Terrain',
    about: 'Cliff, ridge and bank strips for height changes.',
  },
  { id: 'trees', name: 'Trees', group: 'Nature', about: 'Trees, their branches and shadows.' },
  { id: 'bushes', name: 'Bushes', group: 'Nature', about: 'Bushes and shrubs.' },
  {
    id: 'plants',
    name: 'Plants',
    group: 'Nature',
    about: 'Flowers, grass, weeds, mushrooms, vines, moss and leaves.',
  },
  {
    id: 'rocks',
    name: 'Rocks',
    group: 'Nature',
    about: 'Boulders, stones, ore, crystals and stalagmites.',
  },
  {
    id: 'waterfx',
    name: 'Water features',
    group: 'Nature',
    about: 'Foam, waves, waterfalls and ripples.',
  },
  {
    id: 'furniture',
    name: 'Furniture',
    group: 'Interior',
    about: 'Tables, chairs, beds, shelves, cupboards.',
  },
  {
    id: 'decor',
    name: 'Decor',
    group: 'Interior',
    about: 'Rugs, pots, signs, wall hangings, storage.',
  },
  {
    id: 'clutter',
    name: 'Clutter',
    group: 'Interior',
    about: 'Small things: food, books, tools, treasure.',
  },
  {
    id: 'lights',
    name: 'Light sources',
    group: 'Interior',
    about: 'Candles, lamps, torches, campfires.',
  },
  {
    id: 'workplace',
    name: 'Workshops',
    group: 'Interior',
    about: 'Forge, alchemy, farming and craft equipment.',
  },
  {
    id: 'combat',
    name: 'Weapons and siege',
    group: 'Interior',
    about: 'Weapons, armour, siege engines, targets.',
  },
  { id: 'graves', name: 'Graves', group: 'Interior', about: 'Coffins, tombstones, sarcophagi.' },
  { id: 'vehicles', name: 'Vehicles', group: 'Interior', about: 'Carts, wagons and boats.' },
  { id: 'gore', name: 'Gore', group: 'Effects', about: 'Blood, bones and horror decor.' },
  {
    id: 'effects',
    name: 'Effects',
    group: 'Effects',
    about: 'Fire, smoke, lightning, magic and webs.',
  },
  {
    id: 'other',
    name: 'Not sorted',
    group: 'Other',
    about: 'Pictures no rule matched. If many are here, tell me which folders.',
  },
];

const OTHER: CategoryInfo = {
  id: 'other',
  name: 'Not sorted',
  group: 'Other',
  about: 'Pictures no rule matched.',
};
const INFO = new Map(CATEGORIES.map((c) => [c.id, c]));
export const categoryInfo = (id: CategoryId): CategoryInfo => INFO.get(id) ?? OTHER;

/** Categories whose pictures are seamless tiles (painted, not placed one by one). */
export const TEXTURE_CATEGORIES: readonly CategoryId[] = ['terrain', 'water', 'floors', 'roofs'];
export const isTextureCategory = (id: CategoryId): boolean => TEXTURE_CATEGORIES.includes(id);

/** What a texture picker lists unless told otherwise: the ground, water and floor tiles. */
export const GROUND_CATEGORIES: readonly CategoryId[] = ['terrain', 'water', 'floors'];

/** Categories whose pictures are strips drawn along a line. */
export const STRIP_CATEGORIES: readonly CategoryId[] = ['walls', 'paths', 'cliffs'];

const FLOOR_FOLDERS =
  /^(stone_floors|wooden_floors|stone_.*tiles|marble|brick|grates|rugs?|rug_and_carpets|glass|wood|cultivated_soil|crops|hay|misc)$/;
const WATER_WORDS = /^(water|lava|acid|marsh|coral)$/;

/** The path split in lower-case folders and the file name. */
const parts = (path: string): string[] => path.toLowerCase().split('/');

const has = (folders: readonly string[], ...wanted: string[]) =>
  wanted.some((w) => folders.includes(w));

/** The category of a picture, from its path inside the pack (the zip's top folder already cut). */
export function classify(path: string): CategoryId {
  const all = parts(path);
  const file = all[all.length - 1] ?? '';
  const folders = all.slice(0, -1);
  const stem = file.replace(/\.[a-z0-9]+$/, '');

  // Textures: seamless tiles, or see-through overlays.
  const t = folders.indexOf('textures');
  if (t >= 0) {
    const sub = folders.slice(t + 1);
    if (sub.some((f) => f === 'roof' || f === 'hay')) return 'roofs';
    // Only the .jpg tiles are seamless; anything else in a Textures folder has see-through parts.
    if (folders.some((f) => f.includes('overlay')) || stem.includes('overlay')) return 'overlays';
    if (!/\.jpe?g$/.test(file)) return 'overlays';
    const settlement = folders.some((f) => f.startsWith('!core') || f.endsWith('_settlement'));
    if (sub.some((f) => WATER_WORDS.test(f))) return 'water';
    if (settlement && sub.some((f) => FLOOR_FOLDERS.test(f))) return 'floors';
    if (settlement && sub.length === 0) return 'floors';
    return 'terrain';
  }
  if (has(folders, 'texture_overlays')) return 'overlays';

  if (has(folders, 'walls_and_curbs', 'walls')) {
    if (stem.includes('broken_wall_ending')) return 'wallpieces';
    if (/(rubble|crack|broken|ruin)/.test(stem)) return 'rubble';
    // A strip ends in _Path (Straight_Path, or Shack_Wall_Wood_Ashen_A1_Path, _A1_Path…).
    return /_path(_[a-z0-9]+)?$/.test(stem) ? 'walls' : 'wallpieces';
  }
  // Handles, fallen doors, cellar doors, trapdoors and the like are objects, not portals.
  if (
    has(
      folders,
      'addons',
      'fallen',
      'cellar_doors',
      'manholes',
      'trapdoors',
      'vault_doors',
      'cannon_hatches',
      'window_sills',
      'shutters',
    )
  )
    return 'buildings';
  if (has(folders, 'doors', 'double_doors', 'large_doors', 'door_frames')) return 'doors';
  if (has(folders, 'windows')) return 'windows';

  if (has(folders, 'elevation')) return 'cliffs';
  // Animal and boot tracks are stamps; the Paths folders hold the strips.
  if (has(folders, 'tracks')) return 'decor';
  if (has(folders, 'paths', 'misc_paths', 'shadow_paths')) return 'paths';
  if (has(folders, 'water')) return 'waterfx';

  if (has(folders, 'flora')) {
    if (has(folders, 'trees')) return 'trees';
    if (has(folders, 'bushes', 'shrubs')) return 'bushes';
    return 'plants';
  }
  if (has(folders, 'gore')) return 'gore';
  if (has(folders, 'rocks', 'stones', 'stalagmites', 'boulders', 'ore', 'crystals', 'cairns'))
    return 'rocks';

  if (has(folders, '!effects')) return 'effects';
  if (has(folders, 'lightsources')) return 'lights';
  if (has(folders, 'furniture')) return 'furniture';
  if (has(folders, 'clutter')) return 'clutter';
  if (has(folders, 'workplace_equipment')) return 'workplace';
  if (has(folders, 'combat')) return 'combat';
  if (has(folders, 'burial_and_graves')) return 'graves';
  if (has(folders, 'vehicles')) return 'vehicles';
  if (has(folders, 'rubble')) return 'rubble';
  if (has(folders, 'structures', 'pillars')) return 'buildings';
  if (has(folders, 'decor', 'natural_decor')) return 'decor';

  // Packs that are not Forgotten Adventures: the words of the path.
  const words = all.join('/');
  if (/\b(tree|trees|pine|oak)\b/.test(words)) return 'trees';
  if (/\b(bush|bushes|shrub)\b/.test(words)) return 'bushes';
  if (/\b(rock|rocks|stone|boulder)\b/.test(words)) return 'rocks';
  if (/\b(door|doors)\b/.test(words)) return 'doors';
  if (/\b(window|windows)\b/.test(words)) return 'windows';
  if (/\b(table|chair|bed|shelf)\b/.test(words)) return 'furniture';
  return 'other';
}

/** The biome or set a picture belongs to: `Woodlands`, `Desert`, `Core settlements`. */
export function biomeOf(path: string): string {
  const first = path.split('/')[0] ?? '';
  if (first.toLowerCase().startsWith('!core')) return 'Core settlements';
  if (first.startsWith('!')) return first.slice(1).replace(/_/g, ' ');
  return first.replace(/_/g, ' ');
}

/** How many pictures each category holds. */
export function categoryCounts(entries: readonly { cat: CategoryId }[]): Map<CategoryId, number> {
  const counts = new Map<CategoryId, number>();
  for (const e of entries) counts.set(e.cat, (counts.get(e.cat) ?? 0) + 1);
  return counts;
}

/**
 * How many grid squares one tile of a texture covers: the Forgotten Adventures art is drawn at
 * 200 pixels to the square, so a 1000 px tile is five squares wide.
 */
export const PIXELS_PER_SQUARE = 200;
export const tileSquares = (pixelWidth: number): number =>
  Math.max(1, pixelWidth / PIXELS_PER_SQUARE);

/** The categories of things placed one at a time, in the order the library offers them. */
export const OBJECT_CATEGORIES: readonly CategoryId[] = [
  'trees',
  'bushes',
  'plants',
  'rocks',
  'furniture',
  'decor',
  'clutter',
  'lights',
  'buildings',
  'rubble',
  'wallpieces',
  'workplace',
  'combat',
  'graves',
  'vehicles',
  'waterfx',
  'gore',
  'effects',
];
