import { arr, isObj, text, type Obj } from './json';
import { stripTagsPlain } from './lists/strip';

/**
 * Books and adventures: table-of-contents metadata (books.json / adventures.json) plus chapter
 * text (book-*.json / adventure-*.json). Chapter `i` of the contents is `data[i]` of the text.
 */

export type BookKind = 'book' | 'adventure' | 'quickref';

export interface TocHeader {
  /** Header text as written in the contents (may carry tags). */
  header: string;
  /** Nesting depth below the chapter (0 = top). */
  depth: number;
  /** Which occurrence when several entries in the chapter share the name (0-based). */
  index: number;
}

export interface TocChapter {
  name: string;
  /** e.g. `Chapter 3`, `Appendix A`, or empty. */
  ordinal: string;
  headers: TocHeader[];
}

export interface BookSummary {
  kind: 'book' | 'adventure';
  id: string;
  name: string;
  source: string;
  group: string;
  published?: string;
  coverPath?: string;
  storyline?: string;
  levels?: string;
}

export interface BookContent {
  kind: BookKind;
  id: string;
  name: string;
  source: string;
  toc: TocChapter[];
  /** Chapter entries (usually `section` entries), aligned with `toc`. */
  chapters: unknown[];
}

const ORDINAL_TYPES: Record<string, string> = {
  chapter: 'Chapter', appendix: 'Appendix', part: 'Part', episode: 'Episode', level: 'Level',
  section: 'Section',
}; // prettier-ignore

export function tocFromContents(contents: unknown): TocChapter[] {
  return arr(contents)
    .filter(isObj)
    .map((c) => {
      const ord = isObj(c.ordinal) ? c.ordinal : null;
      const ordinal = ord
        ? `${ORDINAL_TYPES[text(ord.type)] ?? text(ord.type)} ${text(ord.identifier)}`.trim()
        : '';
      return {
        name: text(c.name),
        ordinal,
        headers: arr(c.headers).map((h): TocHeader => {
          if (typeof h === 'string') return { header: h, depth: 0, index: 0 };
          const o = isObj(h) ? h : {};
          return {
            header: text(o.header),
            depth: typeof o.depth === 'number' ? o.depth : 0,
            index: typeof o.index === 'number' ? o.index : 0,
          };
        }),
      };
    });
}

export function bookSummary(kind: 'book' | 'adventure', meta: Obj): BookSummary {
  const cover = isObj(meta.cover) ? text(meta.cover.path) : '';
  const level = isObj(meta.level) ? meta.level : null;
  return {
    kind,
    id: text(meta.id),
    name: text(meta.name),
    source: text(meta.source) || text(meta.id),
    group: text(meta.group) || (kind === 'adventure' ? 'adventure' : 'other'),
    ...(text(meta.published) ? { published: text(meta.published) } : {}),
    ...(cover ? { coverPath: cover } : {}),
    ...(text(meta.storyline) ? { storyline: text(meta.storyline) } : {}),
    ...(level ? { levels: `${text(level.start)}–${text(level.end)}` } : {}),
  };
}

/** Normalised header text for matching contents entries to entry names. */
export function headerKey(value: string): string {
  return stripTagsPlain(value)
    .toLowerCase()
    .replace(/[‐-―−]/g, '-') // en/em dashes and minus signs as hyphens
    .replace(/\s+/g, ' ')
    .replace(/[.:,;!]+$/, '')
    .trim();
}

/** Keys a contents header can match: as written, and without a leading "Class: " style prefix. */
export function headerKeys(value: string): string[] {
  const key = headerKey(value);
  const unprefixed = key.replace(/^[a-z ]+: /, '');
  return unprefixed === key ? [key] : [key, unprefixed];
}

/** Every named entry in a chapter, in document order (what a contents header can point at). */
export function namedEntries(chapter: unknown): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (!isObj(v)) return;
    if (typeof v.name === 'string') out.push(headerKey(v.name));
    for (const [k, child] of Object.entries(v)) if (k !== 'name') visit(child);
  };
  visit(chapter);
  return out;
}

/** Ids of entries (used by `{@area}` links) mapped to the chapter that holds them. */
export function areaIndex(chapters: readonly unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  chapters.forEach((chapter, i) => {
    const visit = (v: unknown): void => {
      if (Array.isArray(v)) {
        v.forEach(visit);
        return;
      }
      if (!isObj(v)) return;
      if (typeof v.id === 'string' && !map.has(v.id)) map.set(v.id, i);
      Object.values(v).forEach(visit);
    };
    visit(chapter);
  });
  return map;
}
