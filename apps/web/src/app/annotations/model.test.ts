import { describe, expect, it } from 'vitest';
import {
  chapterNoteId,
  EMPTY_ANNOTATIONS,
  parseAnnotations,
  serializeAnnotations,
  setNote,
  toggleBookmark,
} from './model';

const NOW = '2026-10-07T10:00:00.000Z';

describe('annotations', () => {
  it('toggles bookmarks, newest first', () => {
    let a = toggleBookmark(EMPTY_ANNOTATIONS, '/compendium/a', 'A', NOW);
    a = toggleBookmark(a, '/compendium/b', 'B', NOW);
    expect(a.bookmarks.map((b) => b.label)).toEqual(['B', 'A']);
    a = toggleBookmark(a, '/compendium/a', 'A', NOW);
    expect(a.bookmarks.map((b) => b.label)).toEqual(['B']);
  });

  it('sets and clears notes', () => {
    let a = setNote(EMPTY_ANNOTATIONS, 'spell:fireball@xphb', 'Big boom', NOW);
    expect(a.notes['spell:fireball@xphb']).toEqual({ text: 'Big boom', updatedAt: NOW });
    a = setNote(a, 'spell:fireball@xphb', '   ', NOW);
    expect(a.notes).toEqual({});
  });

  it('round-trips through the file and tolerates bad content', () => {
    const a = setNote(toggleBookmark(EMPTY_ANNOTATIONS, '/x', 'X', NOW), 'k', 'text', NOW);
    expect(parseAnnotations(serializeAnnotations(a))).toEqual(a);
    expect(parseAnnotations(null)).toEqual(EMPTY_ANNOTATIONS);
    expect(parseAnnotations('not json')).toEqual(EMPTY_ANNOTATIONS);
    expect(
      parseAnnotations(
        JSON.stringify({ bookmarks: [{ path: 1 }, { path: '/ok', label: 'Ok' }], notes: { a: 5 } }),
      ),
    ).toEqual({ version: 1, bookmarks: [{ path: '/ok', label: 'Ok', addedAt: '' }], notes: {} });
  });

  it('names chapter notes', () => {
    expect(chapterNoteId('book', 'XPHB', 3)).toBe('book:xphb@ch3');
  });
});
