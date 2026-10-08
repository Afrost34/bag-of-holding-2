import { afterEach, describe, expect, it } from 'vitest';
import {
  allNoteTypes,
  newNoteText,
  noteType,
  noteTypeId,
  parseNoteTypeDefs,
  setCustomNoteTypes,
} from './noteTypes';
import { parseFrontmatter } from './syntax';

const ships = {
  id: 'ship',
  label: 'Ship',
  plural: 'Ships',
  icon: 'anchor',
  fields: [
    { key: 'captain', kind: 'link' as const, linkType: 'npc' },
    { key: 'crew', kind: 'number' as const },
    { key: 'class', kind: 'text' as const, options: ['Sloop', 'Galleon'] },
  ],
};

afterEach(() => {
  setCustomNoteTypes([]);
});

describe('custom kinds of notes', () => {
  it('reads what is stored, skipping what is malformed or clashes with a built-in kind', () => {
    expect(
      parseNoteTypeDefs([ships, { id: 'npc', label: 'Mine' }, { label: 'No id' }, 'x']),
    ).toEqual([ships]);
    expect(parseNoteTypeDefs({})).toEqual([]);
  });

  it('works like a built-in kind once set', () => {
    setCustomNoteTypes([ships]);
    const ship = noteType('ship');
    expect(ship?.folder).toBe('Ships');
    // Folder names are matched as words ("03_Ships" is read as "03 Ships").
    expect(ship?.folderMatch.test('03 Ships')).toBe(true);
    expect(ship?.columns).toEqual(['captain', 'crew', 'class']);
    expect(allNoteTypes().some((t) => t.id === 'npc')).toBe(true);
    if (!ship) throw new Error('no ship');
    const text = newNoteText(ship, 'Sea Hag');
    expect(parseFrontmatter(text).data).toMatchObject({ type: 'ship', crew: null });
  });

  it('makes ids from names', () => {
    expect(noteTypeId('Sea Ship', [])).toBe('sea-ship');
    expect(noteTypeId('Sea Ship', ['sea-ship'])).toBe('sea-ship-2');
    expect(noteTypeId('NPC', [])).toBe('npc-2');
  });
});
