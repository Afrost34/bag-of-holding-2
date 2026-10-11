import { biomeOf, type CategoryId } from './packCategories';
import { packRef, type PackEntry } from './packModel';

/**
 * What the tools start with when packs are imported: the terrain slots (grass, dirt, stone…) and
 * the scatter presets (a forest, rocks, flowers…) are picked from the packs by their folders and
 * names, so nobody has to dig through thousands of pictures first. Pure.
 */

type Pickable = Pick<PackEntry, 'path' | 'pack' | 'cat'>;

const refOf = (e: Pickable) => packRef(e.pack, e.path);

/** A small stable number from a string, to spread picks without randomness. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Where the pictures a new map should use come from first. */
const BIOME_ORDER = ['Woodlands', 'Core settlements', 'Mountain', 'Desert', 'Arctic'];
const biomeRank = (e: Pickable) => {
  const i = BIOME_ORDER.indexOf(biomeOf(e.path));
  return i < 0 ? BIOME_ORDER.length : i;
};

export interface Wanted {
  cats: readonly CategoryId[];
  /** Every word must be in the path (lower case). */
  words?: readonly string[];
  /** Any one of these must be (lower case). */
  anyWords?: readonly string[];
  /** None of these may be. */
  not?: readonly string[];
}

function matches(e: Pickable, w: Wanted): boolean {
  if (!w.cats.includes(e.cat)) return false;
  const p = e.path.toLowerCase();
  if (w.words && !w.words.every((x) => p.includes(x))) return false;
  if (w.anyWords && !w.anyWords.some((x) => p.includes(x))) return false;
  if (w.not?.some((x) => p.includes(x))) return false;
  return true;
}

/** The first picture that fits, from the favourite biome, the same one every time. */
export function pickOne<E extends Pickable>(entries: readonly E[], w: Wanted): E | undefined {
  let best: E | undefined;
  for (const e of entries) {
    if (!matches(e, w)) continue;
    if (
      !best ||
      biomeRank(e) < biomeRank(best) ||
      (biomeRank(e) === biomeRank(best) && e.path < best.path)
    )
      best = e;
  }
  return best;
}

/** Up to `max` pictures that fit, spread over the whole set (not all of one folder). */
export function pickMany<E extends Pickable>(
  entries: readonly E[],
  w: Wanted,
  max: number,
  favourite = true,
): E[] {
  const fit = entries.filter((e) => matches(e, w));
  const rank = favourite ? Math.min(...fit.map(biomeRank)) : 0;
  const pool = favourite ? fit.filter((e) => biomeRank(e) === rank) : fit;
  return [...pool].sort((a, b) => hash(a.path) - hash(b.path)).slice(0, max);
}

/** The ground textures a new device starts with. */
export const TERRAIN_STARTERS: readonly Wanted[] = [
  { cats: ['terrain'], words: ['grass'], not: ['overlay', 'dead', 'dry'] },
  { cats: ['terrain'], words: ['dirt'], not: ['overlay', 'rocky', 'gravel'] },
  { cats: ['terrain'], anyWords: ['rock_texture', 'gravel', 'stone'], not: ['overlay'] },
  { cats: ['terrain'], anyWords: ['sand'], not: ['overlay', 'rock'] },
  { cats: ['water'], words: ['water'], not: ['overlay', 'opaque'] },
  { cats: ['terrain'], anyWords: ['snow'], not: ['overlay'] },
];

/** The terrain slots to start with, or none when the packs hold no ground textures. */
export function defaultSlots(entries: readonly Pickable[]): string[] {
  const refs: string[] = [];
  for (const w of TERRAIN_STARTERS) {
    const e = pickOne(entries, w);
    if (e && !refs.includes(refOf(e))) refs.push(refOf(e));
  }
  return refs;
}

export interface PackPreset {
  id: string;
  name: string;
  hint: string;
  want: Wanted;
  /** How many different pictures to mix. */
  max: number;
  /** Spacing as a multiple of the typical picture's size on the grid. */
  spacing: number;
  mode: 'area' | 'along';
}

const preset = (
  id: string,
  name: string,
  hint: string,
  want: Wanted,
  max: number,
  spacing: number,
  mode: 'area' | 'along' = 'area',
): PackPreset => ({ id, name, hint, want, max, spacing, mode });

const NOT_TREE_PARTS = ['shadow', 'branch', 'bare', 'dead', 'stump'];

export const PACK_PRESETS: readonly PackPreset[] = [
  preset(
    'forest',
    'Forest',
    'trees and bushes',
    { cats: ['trees', 'bushes'], not: NOT_TREE_PARTS },
    14,
    0.7,
  ),
  preset('trees', 'Trees', 'trees only', { cats: ['trees'], not: NOT_TREE_PARTS }, 12, 0.9),
  preset('bushes', 'Bushes', 'shrubs and hedges', { cats: ['bushes'] }, 12, 1),
  preset(
    'rocks',
    'Rocks',
    'boulders and stones',
    { cats: ['rocks'], not: ['stalagmite', 'crystal', 'ore'] },
    16,
    1.2,
  ),
  preset(
    'flowers',
    'Flowers',
    'blooms in the grass',
    { cats: ['plants'], anyWords: ['flower'] },
    14,
    1.4,
  ),
  preset(
    'grass',
    'Tall grass',
    'tufts and weeds',
    { cats: ['plants'], anyWords: ['grass', 'weed'] },
    14,
    1.2,
  ),
  preset('mushrooms', 'Mushrooms', 'fungi', { cats: ['plants'], anyWords: ['mushroom'] }, 12, 1.2),
  preset(
    'vines',
    'Vines',
    'creepers and roots',
    { cats: ['plants'], anyWords: ['vine', 'root'] },
    12,
    1,
  ),
  preset(
    'cacti',
    'Desert plants',
    'cacti and scrub',
    { cats: ['plants', 'bushes', 'trees'], anyWords: ['cact', 'agave', 'yucca', 'palm'] },
    12,
    1,
  ),
  preset(
    'crystals',
    'Crystals',
    'crystals and ore',
    { cats: ['rocks'], anyWords: ['crystal', 'ore'] },
    14,
    1,
  ),
  preset('rubble', 'Rubble', 'debris and ruins', { cats: ['rubble'] }, 14, 1.2),
  preset(
    'puddles',
    'Puddles',
    'standing water',
    { cats: ['decor'], anyWords: ['puddle'] },
    12,
    1.6,
  ),
  preset(
    'leaves',
    'Fallen leaves',
    'leaf litter',
    { cats: ['plants'], anyWords: ['leaves', 'leaf'] },
    14,
    1.2,
  ),
  preset('clutter', 'Clutter', 'small things on the floor', { cats: ['clutter'] }, 18, 1.6),
  preset(
    'fence',
    'Fence line',
    'posts and rails along a line',
    { cats: ['buildings'], anyWords: ['fence', 'railing', 'palisade'] },
    10,
    1,
    'along',
  ),
];

/** The pictures a preset mixes, or an empty list when the packs have none of its kind. */
export function presetRefs(entries: readonly Pickable[], p: PackPreset): string[] {
  return pickMany(entries, p.want, p.max).map(refOf);
}

/** The presets the imported packs can fill (at least three pictures). */
export function availablePresets(entries: readonly Pickable[]): PackPreset[] {
  return PACK_PRESETS.filter((p) => pickMany(entries, p.want, 3).length >= 3);
}

/** The floor and the wall a new room starts with: cobblestone and a grey stone wall strip. */
export function defaultRoomStyle(entries: readonly Pickable[]): { floor?: string; wall?: string } {
  const floor =
    pickOne(entries, { cats: ['floors'], words: ['cobblestone'], not: ['overlay'] }) ??
    pickOne(entries, { cats: ['floors'], not: ['overlay'] });
  const wall =
    pickOne(entries, { cats: ['walls'], words: ['wall_stone'] }) ??
    pickOne(entries, { cats: ['walls'] });
  return {
    ...(floor ? { floor: refOf(floor) } : {}),
    ...(wall ? { wall: refOf(wall) } : {}),
  };
}
