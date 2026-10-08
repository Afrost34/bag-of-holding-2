import { noteType } from '@boh/journal';
import { describe, expect, it } from 'vitest';
import { filterRows } from './listModel';
import { FOLDER_FIELD, noteCategory, noteRows, propField, TAGS_FIELD } from './notesList';

const note = (props: string) => `---\n${props}\n---\nBody.\n`;
const notes = new Map([
  [
    'NPCs/Rustcrown/Clank.md',
    note(
      'type: npc\ntags:\n  - npc\n  - crew\nrole: Fixer\nlocation: "[[The Rusty Anchor]]"\nstatus: Alive',
    ),
  ],
  ['NPCs/Dargo.md', note('type: npc\nrole: Boss\nlocation: "[[Rustcrown]]"\nstatus: Alive')],
  ['Locations/Rustcrown.md', note('type: location')],
]);

describe('note lists', () => {
  it('makes one row per note of the kind, with its properties as text', () => {
    const rows = noteRows(notes, 'npc');
    expect(rows.map((r) => r.name)).toEqual(['Clank', 'Dargo']);
    const clank = rows[0];
    expect(clank?.f[propField('location')]).toBe('The Rusty Anchor');
    expect(clank?.f[FOLDER_FIELD]).toBe('NPCs/Rustcrown');
    expect(clank?.f[TAGS_FIELD]).toEqual(['crew']);
    expect(clank?.sub).toBe('Rustcrown');
  });

  it('offers the kind’s columns, filters on properties, folders and tags', () => {
    const type = noteType('npc');
    if (!type) throw new Error('no npc kind');
    const rows = noteRows(notes, 'npc');
    const category = noteCategory(type, rows);
    const ids = category.fields.map((f) => f.id);
    expect(ids).toContain(propField('role'));
    expect(category.fields.find((f) => f.id === propField('location'))?.filter).toBe('main');
    expect(ids).toContain(FOLDER_FIELD);
    expect(ids).toContain(TAGS_FIELD);
    const state = { q: '', sort: 'name', dir: 'asc' as const, sel: null };
    const found = filterRows(
      rows,
      { ...state, filters: { [propField('role')]: ['Boss'] } },
      new Set(),
    );
    expect(found.map((r) => r.name)).toEqual(['Dargo']);
  });
});
