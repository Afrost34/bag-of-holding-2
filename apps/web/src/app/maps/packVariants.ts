import { displayName } from './packModel';

/**
 * Pictures that are the same thing in another colour or material (`Tree_Green_B1_5x5`,
 * `Tree_Red_B1_5x5`; `Door_Wood_Dark_A_1x1`, `Door_Wood_Brown_A_1x1`) are one stamp with
 * variations, so a library lists the stamp once and offers its variations when it is picked.
 * Two pictures of the same folder are variations of each other when their names are the same
 * except for one word (never the first, which says what the thing is, and never a letter-and-
 * number code such as `A1`, which says it is another shape). Pure.
 */

export interface Variant<E> {
  entry: E;
  /** The word that sets it apart ("Red", "Walnut"). */
  label: string;
}

export interface VariantGroup<E> {
  /** The picture the group is shown as. */
  head: E;
  /** Every picture of the group, the head among them, in order. */
  variants: Variant<E>[];
  /** What the picture is called without the word that varies ("Tree B1"). */
  name: string;
}

interface Pathed {
  path: string;
  pack: string;
}

/** The words of a picture's file name, without its extension. */
const wordsOf = (path: string): string[] =>
  (path.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '').split('_');

/** A word that can be what varies: a colour, a wood, a metal; not a code (A1, 01) or a size (2x2). */
const varying = (word: string): boolean =>
  /^[A-Za-z]{3,}\d?$/.test(word) && !/^[A-Z]\d+$/.test(word);

/** The folder of a picture with its pack, so pictures of two packs are never mixed. */
const folderOf = (e: Pathed): string => e.pack + ':' + e.path.slice(0, e.path.lastIndexOf('/') + 1);

/**
 * The entries as stamps with variations: groups of two or more variations, and single pictures as
 * groups of one. The order of the entries is kept (a group stands where its first picture does).
 */
export function groupVariants<E extends Pathed>(entries: readonly E[]): VariantGroup<E>[] {
  // Every way two pictures could be one: the same folder, the same words but one.
  const candidates = new Map<string, { at: number; members: number[] }>();
  entries.forEach((e, index) => {
    const words = wordsOf(e.path);
    for (let at = 1; at < words.length; at++) {
      if (!varying(words[at] ?? '')) continue;
      const key = `${folderOf(e)}|${String(at)}|${words.map((w, i) => (i === at ? '*' : w)).join('_')}`;
      const found = candidates.get(key);
      if (found) found.members.push(index);
      else candidates.set(key, { at, members: [index] });
    }
  });
  // The biggest groups first; a picture goes to the first group that takes it.
  const taken = new Map<number, { key: string; at: number }>();
  const groups = [...candidates.entries()]
    .filter(([, g]) => g.members.length > 1)
    .sort((a, b) => b[1].members.length - a[1].members.length);
  for (const [key, g] of groups) {
    const free = g.members.filter((m) => !taken.has(m));
    if (free.length < 2) continue;
    for (const m of free) taken.set(m, { key, at: g.at });
  }
  const out: VariantGroup<E>[] = [];
  const placed = new Map<string, VariantGroup<E>>();
  entries.forEach((e, index) => {
    const joined = taken.get(index);
    if (!joined) {
      out.push({ head: e, variants: [{ entry: e, label: '' }], name: displayName(e.path) });
      return;
    }
    const label = wordsOf(e.path)[joined.at] ?? '';
    const existing = placed.get(joined.key);
    if (existing) {
      existing.variants.push({ entry: e, label });
      return;
    }
    const words = wordsOf(e.path).filter((_, i) => i !== joined.at);
    const group: VariantGroup<E> = {
      head: e,
      variants: [{ entry: e, label }],
      name: displayName(words.join('_') + '.webp'),
    };
    placed.set(joined.key, group);
    out.push(group);
  });
  return out;
}
