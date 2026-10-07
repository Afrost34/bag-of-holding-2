import { describe, expect, it } from 'vitest';
import { searchNotes } from './search';

const notes = new Map([
  [
    'NPCs/Mother_Tibia.md',
    '---\ntitle: Mother Tibia\ntype: npc\nlocation: "[[Rustcrown]]"\n---\nA **priestess** of the Many.',
  ],
  [
    'Places/Rustcrown.md',
    '---\ntype: location\n---\n# Rustcrown\nThe rusted city, home of the priestess.',
  ],
  ['Sessions/Session 1.md', 'We met [[Mother_Tibia|Tibia]] in #rustcrown.'],
]);

describe('searchNotes', () => {
  it('ranks names first, then tags and properties, then text', () => {
    expect(searchNotes(notes, 'rust').map((h) => h.path)).toEqual([
      'Places/Rustcrown.md',
      'Sessions/Session 1.md',
      'NPCs/Mother_Tibia.md',
    ]);
  });

  it('needs every word, and shows a clean line of text', () => {
    const hits = searchNotes(notes, 'priestess many');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({
      path: 'NPCs/Mother_Tibia.md',
      name: 'Mother Tibia',
      type: 'npc',
      snippet: 'A priestess of the Many.',
    });
    expect(searchNotes(notes, '')).toEqual([]);
  });
});
