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
  /** The file name (lower case, without the extension) must match. */
  file?: RegExp;
}

function matches(e: Pickable, w: Wanted): boolean {
  if (!w.cats.includes(e.cat)) return false;
  const p = e.path.toLowerCase();
  if (w.words && !w.words.every((x) => p.includes(x))) return false;
  if (w.anyWords && !w.anyWords.some((x) => p.includes(x))) return false;
  if (w.not?.some((x) => p.includes(x))) return false;
  if (w.file && !w.file.test((p.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/, ''))) return false;
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
  { cats: ['terrain'], file: /^grass_[a-z]_\d/, not: ['overlay'] },
  { cats: ['terrain'], file: /^dirt_[a-z]_\d/, not: ['overlay'] },
  { cats: ['terrain'], file: /^rock_texture/, not: ['overlay'] },
  { cats: ['terrain'], file: /sand/, not: ['overlay', 'rock'] },
  { cats: ['water'], file: /^water_(still_)?[a-z]_\d/, not: ['overlay', 'opaque'] },
  { cats: ['terrain'], file: /^snow/, not: ['overlay'] },
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

/** The door the Portal tool starts with: a wooden door of the packs, else any door. */
export function defaultDoor(
  entries: readonly Pickable[],
): { ref: string; path: string } | undefined {
  const e =
    pickOne(entries, { cats: ['doors'], words: ['door', 'wood'], not: ['open', 'portcullis'] }) ??
    pickOne(entries, { cats: ['doors'] });
  return e ? { ref: refOf(e), path: e.path } : undefined;
}

/** The roof texture a new building starts with: a tiled roof of the packs. */
export function defaultRoof(entries: readonly Pickable[]): string | undefined {
  const e =
    pickOne(entries, { cats: ['roofs'], file: /^roof_texture_tile_brown_b1$/ }) ??
    pickOne(entries, { cats: ['roofs'], words: ['roof_texture_tile'] }) ??
    pickOne(entries, { cats: ['roofs'] });
  return e ? refOf(e) : undefined;
}

/**
 * The roof textures the buildings of a district style are covered with: a few of the packs'
 * seamless tiles of the right kind (thatch for crowded quarters, slate for wards and nobles…).
 */
export function districtRoofs(entries: readonly Pickable[], style: string): string[] {
  const kinds: Record<string, string[]> = {
    town: ['roof_texture_tile_brown', 'roof_texture_tile_red'],
    dense: ['roof_texture_hay'],
    noble: ['roof_texture_slate_blue', 'roof_texture_slate_black'],
    market: ['roof_texture_tile_red', 'roof_texture_tile_brown'],
    ward: ['roof_texture_slate_black', 'roof_texture_slate_mossy'],
  };
  const out: string[] = [];
  for (const kind of kinds[style] ?? []) {
    const fit = pickMany(entries, { cats: ['roofs'], words: [kind] }, 3, false);
    for (const e of fit) if (!out.includes(refOf(e))) out.push(refOf(e));
  }
  return out;
}

/** The floor and the wall a new room starts with: cobblestone and a grey stone wall strip. */
export function defaultRoomStyle(entries: readonly Pickable[]): { floor?: string; wall?: string } {
  const floor =
    pickOne(entries, { cats: ['floors'], words: ['cobblestone'], not: ['overlay'] }) ??
    pickOne(entries, { cats: ['floors'], not: ['overlay'] });
  const wall =
    pickOne(entries, { cats: ['walls'], words: ['wall_stone_earthy'] }) ??
    pickOne(entries, { cats: ['walls'], words: ['wall_stone_'] }) ??
    pickOne(entries, { cats: ['walls'] });
  return {
    ...(floor ? { floor: refOf(floor) } : {}),
    ...(wall ? { wall: refOf(wall) } : {}),
  };
}

/** A cave's rim: a cave cliff strip (`Burrows_Cave_Stone_Earthy_Path_A1`), if the packs have one. */
export function defaultCaveWall(entries: readonly Pickable[]): string | undefined {
  const e = pickOne(entries, { cats: ['cliffs'], words: ['cave', '_path'], not: ['stalagmite'] });
  return e ? refOf(e) : undefined;
}

/** An open-air cliff strip of the packs (not a cave's), for cliffs along a contour; none without packs. */
export function defaultCliff(entries: readonly Pickable[]): string | undefined {
  const e = pickOne(entries, { cats: ['cliffs'], words: ['_path'], not: ['cave', 'burrow'] });
  return e ? refOf(e) : undefined;
}

/** The first water texture of the packs, for the water brush; none without packs. */
export function defaultWater(entries: readonly Pickable[]): string | undefined {
  const e = pickOne(entries, { cats: ['water'], words: ['water'], not: ['overlay', 'opaque'] });
  return e ? refOf(e) : undefined;
}

/** A rock or gravel texture for the material brush (a bordered organic material). */
export function defaultMaterial(entries: readonly Pickable[]): string | undefined {
  const e =
    pickOne(entries, { cats: ['terrain'], anyWords: ['rock_texture'], not: ['overlay'] }) ??
    pickOne(entries, { cats: ['terrain'], anyWords: ['rock', 'gravel'], not: ['overlay'] });
  return e ? refOf(e) : undefined;
}

/** The floor of a cave: a cave floor texture if there is one, else dirt. */
export function defaultCaveFloor(entries: readonly Pickable[]): string | undefined {
  const e =
    pickOne(entries, { cats: ['floors', 'terrain'], words: ['cave'], not: ['overlay'] }) ??
    pickOne(entries, { cats: ['terrain'], words: ['dirt'], not: ['overlay', 'gravel'] });
  return e ? refOf(e) : undefined;
}

/** The order a library lists pictures in: Woodlands and the core first, then the other biomes. */
export function libraryOrder(a: { path: string }, b: { path: string }): number {
  const ra = biomeRank(a as Pickable);
  const rb = biomeRank(b as Pickable);
  return ra - rb || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
