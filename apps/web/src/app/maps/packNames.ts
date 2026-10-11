import { squaresOf } from './packModel';

/**
 * What a pack picture's file name says, read the Forgotten Adventures way, and the pictures of the
 * same folder that are the same thing in another shape or colour. Pure.
 *
 *   Scissor_Chair_Wood_Ashen_A1_1x1.webp
 *   └ words ─────────────────┘ │  └ size in squares
 *                              └ code: set A, shape 1 (A2, A3… are other shapes of the same chair)
 *
 * A colour or material is one word that differs between two names of a folder (`Ashen`,
 * `Walnut`); it is never the first word (what the thing is) nor the code or the size.
 */

export interface NameParts {
  /** The folder, with its trailing `/`. */
  folder: string;
  /** The words of the file name without its extension, in order (code and size among them). */
  words: string[];
  /** The letter-and-number code and where it is in `words`. */
  code: { set: string; n: number; at: number } | null;
  size: { w: number; h: number } | null;
}

const CODE = /^([A-Z])(\d{1,3})$/;
const SIZE = /^\d{1,2}x\d{1,2}$/i;

export function nameParts(path: string): NameParts {
  const cut = path.lastIndexOf('/') + 1;
  const words = path
    .slice(cut)
    .replace(/\.[a-z0-9]+$/i, '')
    .split('_');
  let code: NameParts['code'] = null;
  // The last code wins: names put it just before the size.
  words.forEach((w, at) => {
    const m = CODE.exec(w);
    if (m) code = { set: m[1] ?? '', n: Number(m[2]), at };
  });
  return { folder: path.slice(0, cut), words, code, size: squaresOf(path) };
}

/** A word that can be a colour or a material: letters (and one digit at most), not a code or a size. */
const varying = (word: string): boolean =>
  /^[A-Za-z]{3,}\d?$/.test(word) && !CODE.test(word) && !SIZE.test(word);

/** The file names of every folder of every pack: `pack:folder/` → names. */
export type FolderIndex = ReadonlyMap<string, readonly string[]>;

const indexes = new WeakMap<readonly object[], FolderIndex>();

/** The folder index of a list of pack entries, made once per list. */
export function folderIndex(entries: readonly { pack: string; path: string }[]): FolderIndex {
  const known = indexes.get(entries);
  if (known) return known;
  const map = new Map<string, string[]>();
  for (const e of entries) {
    const cut = e.path.lastIndexOf('/') + 1;
    const key = e.pack + ':' + e.path.slice(0, cut);
    const list = map.get(key);
    if (list) list.push(e.path.slice(cut));
    else map.set(key, [e.path.slice(cut)]);
  }
  indexes.set(entries, map);
  return map;
}

const filesBeside = (index: FolderIndex, pack: string, path: string): readonly string[] =>
  index.get(pack + ':' + path.slice(0, path.lastIndexOf('/') + 1)) ?? [];

/**
 * The other shapes of the same thing (A1 → A2, A3…): the same words, the same set letter and the
 * same size in squares, so a swap keeps the stamp's place and size. The picture itself comes first.
 */
export function shapeVariants(index: FolderIndex, pack: string, path: string): string[] {
  const me = nameParts(path);
  const out = [path];
  if (!me.code) return out;
  const code = me.code;
  for (const file of filesBeside(index, pack, path)) {
    const other = nameParts(me.folder + file);
    if (other.words.length !== me.words.length || !other.code) continue;
    if (other.code.at !== code.at || other.code.set !== code.set || other.code.n === code.n)
      continue;
    if (!sameSize(other.size, me.size)) continue;
    if (other.words.every((w, i) => i === code.at || w === me.words[i])) out.push(me.folder + file);
  }
  return out;
}

const sameSize = (a: NameParts['size'], b: NameParts['size']) =>
  a === b || (a !== null && b !== null && a.w === b.w && a.h === b.h);

export interface ColourVariant {
  path: string;
  /** The word that sets it apart (`Walnut`); empty for the picture itself. */
  label: string;
  /** Which word of the name it is (a chair can vary in its wood and in its cushion). */
  at: number;
}

/**
 * The same thing in other colours or materials: names of the folder equal but for one word that
 * is a colour or material in both. The picture itself comes first, with an empty label.
 */
export function colourVariants(index: FolderIndex, pack: string, path: string): ColourVariant[] {
  const me = nameParts(path);
  const out: ColourVariant[] = [{ path, label: '', at: -1 }];
  for (const file of filesBeside(index, pack, path)) {
    const other = nameParts(me.folder + file);
    if (other.words.length !== me.words.length || file === path.slice(me.folder.length)) continue;
    let diff = -1;
    for (let i = 0; i < me.words.length; i++) {
      if (other.words[i] === me.words[i]) continue;
      if (diff >= 0) {
        diff = -2;
        break;
      }
      diff = i;
    }
    if (diff <= 0) continue;
    const a = me.words[diff] ?? '';
    const b = other.words[diff] ?? '';
    if (!varying(a) || !varying(b)) continue;
    out.push({ path: me.folder + file, label: b, at: diff });
  }
  return out;
}
