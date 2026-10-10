/**
 * Pure helpers for asset packs (Forgotten Adventures style zips): pictures live at
 * `<Biome>/<Set>/<Category>/<Name>_<W>x<H>.webp`, where W×H is the size in grid squares.
 */

export interface PackEntry {
  /** Id of the pack that holds it. */
  pack: string;
  /** Path inside the pack, without the zip's top folder: `Desert/Base/Decor/Pungi_1x1.webp`. */
  path: string;
  offset: number;
  compressed: number;
  size: number;
  method: number;
}

const PICTURE = /\.(webp|png|jpe?g|avif|gif)$/i;
export const isPackPicture = (name: string) => PICTURE.test(name);

/**
 * The first folder every file of a zip shares (`FA_Assets_Webp`), to leave off. Empty when the
 * files do not share one.
 */
export function commonRoot(names: readonly string[]): string {
  const first = names[0]?.split('/')[0];
  if (!first || !names.every((n) => n.startsWith(`${first}/`))) return '';
  return first;
}

/** The size in grid squares given by a file name's `_WxH` ending: `Tree_Oak_A1_2x2.webp`. */
export function squaresOf(path: string): { w: number; h: number } | null {
  const m = /_(\d{1,2})x(\d{1,2})(?:\.[a-z0-9]+)?$/i.exec(path);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}

/** A name to show: the file's, without `_WxH` and the extension, underscores as spaces. */
export function displayName(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/_\d{1,2}x\d{1,2}$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/** What a stamp is called in a map: `pack:<id>:<path>`. */
export const packRef = (pack: string, path: string) => `pack:${pack}:${path}`;
export const isPackRef = (ref: string) => ref.startsWith('pack:');
export function parsePackRef(ref: string): { pack: string; path: string } | null {
  if (!isPackRef(ref)) return null;
  const rest = ref.slice(5);
  const i = rest.indexOf(':');
  return i > 0 ? { pack: rest.slice(0, i), path: rest.slice(i + 1) } : null;
}

/** The folders directly under `prefix` (`''` for the top), with how many pictures each holds. */
export function foldersUnder(
  entries: readonly Pick<PackEntry, 'path'>[],
  prefix: string,
): { name: string; count: number }[] {
  const lead = prefix ? `${prefix}/` : '';
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!e.path.startsWith(lead)) continue;
    const rest = e.path.slice(lead.length);
    const slash = rest.indexOf('/');
    if (slash < 0) continue;
    const name = rest.slice(0, slash);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[\s_/-]+/)
    .filter(Boolean);

/**
 * Whether the letters of `word` appear in `hay` in order, not far apart: "oakt" finds "oak_tree",
 * "tre" finds "tree" and "forst" finds "forest".
 */
export function fuzzyIncludes(hay: string, word: string): boolean {
  if (hay.includes(word)) return true;
  if (word.length === 0) return true;
  for (
    let start = hay.indexOf(word[0] ?? '');
    start >= 0;
    start = hay.indexOf(word[0] ?? '', start + 1)
  ) {
    let at = start;
    let ok = true;
    for (let i = 1; i < word.length && ok; i++) {
      // Letters of one word stay close: a gap of more than 3 is another word.
      const next = hay.indexOf(word[i] ?? '', at + 1);
      if (next < 0 || next - at > 4) ok = false;
      else at = next;
    }
    if (ok) return true;
  }
  return false;
}

export interface FindOptions<E> {
  /** Letters in order rather than the exact word. */
  fuzzy?: boolean;
  /** Only these (the pictures the map uses). */
  only?: (entry: E) => boolean;
}

/**
 * Pictures under a folder (and below it) whose path has every word of the search. With no search,
 * only the pictures directly in the folder.
 */
export function findPackEntries<E extends Pick<PackEntry, 'path'>>(
  entries: readonly E[],
  prefix: string,
  query: string,
  limit: number,
  options: FindOptions<E> = {},
): { list: E[]; total: number } {
  const lead = prefix ? `${prefix}/` : '';
  const wanted = words(query);
  const list: E[] = [];
  let total = 0;
  for (const e of entries) {
    if (!e.path.startsWith(lead)) continue;
    if (options.only && !options.only(e)) continue;
    if (wanted.length === 0) {
      // A folder shows what is directly in it; the pictures a map uses show wherever they are.
      if (!options.only && e.path.slice(lead.length).includes('/')) continue;
    } else {
      const hay = e.path.slice(lead.length).toLowerCase();
      const match = options.fuzzy ? fuzzyIncludes : (h: string, w: string) => h.includes(w);
      if (!wanted.every((w) => match(hay, w))) continue;
    }
    total++;
    if (list.length < limit) list.push(e);
  }
  return { list, total };
}

/** A short id of a pack from what is in it, so the same pack imported twice is the same. */
export function packId(names: readonly string[], bytes: number): string {
  let h = 0x811c9dc5;
  for (const n of names)
    for (let i = 0; i < n.length; i++) h = Math.imul(h ^ n.charCodeAt(i), 0x01000193) >>> 0;
  return `${bytes.toString(36)}-${names.length.toString(36)}-${h.toString(36)}`;
}
