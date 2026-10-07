/**
 * Bookmarks and personal notes on compendium pages, as stored in `annotations.json` in the user's
 * data. Notes are keyed by page reference (an entity key such as `spell:fireball@xphb`, or a book
 * chapter such as `book:xphb@ch3`), never by copies of 5etools text. In M4 this file moves into
 * the campaign folder of the data repo (`campaigns/<id>/annotations.json`).
 */

export interface Bookmark {
  /** App path of the page, e.g. `/compendium/spell%3Afireball%40xphb`. */
  path: string;
  /** What the page was called when bookmarked, for the list. */
  label: string;
  addedAt: string;
}

export interface Note {
  text: string;
  updatedAt: string;
}

export interface Annotations {
  version: 1;
  bookmarks: Bookmark[];
  notes: Record<string, Note>;
}

export const EMPTY_ANNOTATIONS: Annotations = { version: 1, bookmarks: [], notes: {} };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads the stored file, keeping whatever is valid and dropping the rest. */
export function parseAnnotations(text: string | null): Annotations {
  if (!text) return EMPTY_ANNOTATIONS;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return EMPTY_ANNOTATIONS;
  }
  if (!isObj(raw)) return EMPTY_ANNOTATIONS;
  const bookmarks = (Array.isArray(raw.bookmarks) ? raw.bookmarks : []).flatMap((b): Bookmark[] =>
    isObj(b) && typeof b.path === 'string' && typeof b.label === 'string'
      ? [{ path: b.path, label: b.label, addedAt: typeof b.addedAt === 'string' ? b.addedAt : '' }]
      : [],
  );
  const notes: Record<string, Note> = {};
  for (const [id, n] of Object.entries(isObj(raw.notes) ? raw.notes : {})) {
    if (isObj(n) && typeof n.text === 'string' && n.text.trim() !== '') {
      notes[id] = { text: n.text, updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : '' };
    }
  }
  return { version: 1, bookmarks, notes };
}

export function serializeAnnotations(a: Annotations): string {
  return `${JSON.stringify(a, null, 2)}\n`;
}

/** Adds the page to bookmarks, or removes it when already there. Newest first. */
export function toggleBookmark(
  a: Annotations,
  path: string,
  label: string,
  now: string,
): Annotations {
  const exists = a.bookmarks.some((b) => b.path === path);
  return {
    ...a,
    bookmarks: exists
      ? a.bookmarks.filter((b) => b.path !== path)
      : [{ path, label, addedAt: now }, ...a.bookmarks],
  };
}

/** Sets a page's note; an empty note is removed. */
export function setNote(a: Annotations, id: string, text: string, now: string): Annotations {
  const notes = { ...a.notes };
  if (text.trim() === '') {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- notes is a fresh copy keyed by page
    delete notes[id];
  } else {
    notes[id] = { text, updatedAt: now };
  }
  return { ...a, notes };
}

/** The note id of a book or adventure chapter. */
export function chapterNoteId(kind: string, id: string, chapter: number): string {
  return `${kind}:${id}@ch${String(chapter)}`.toLowerCase();
}
