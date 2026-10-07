import { describe, expect, it } from 'vitest';
import { convertNote, linkReport, planImport } from './import';
import { resolveLinkPath } from './links';

describe('Obsidian import', () => {
  it('keeps notes, bases and media, and leaves Obsidian settings and scripts out', () => {
    const plan = planImport([
      'Rust & Sunfire/.obsidian/app.json',
      'Rust & Sunfire/.trash/Old.md',
      'Rust & Sunfire/R/00_Index.md',
      'Rust & Sunfire/R/99_DB/NPCs.base',
      'Rust & Sunfire/R/Assets/map.png',
      'Rust & Sunfire/R/tools/build.py',
      'Rust & Sunfire/R/Handout.pdf',
    ]);
    expect(plan.files).toEqual([
      'R/00_Index.md',
      'R/99_DB/NPCs.base',
      'R/Assets/map.png',
      'R/Handout.pdf',
    ]);
    expect(plan.skipped).toEqual(['R/tools/build.py']);
    expect(plan.hidden).toBe(2);
  });

  it('turns the old app links into compendium links', () => {
    expect(convertNote('Cast [[App:Spell:Shield|Shield]] and [[App:Spell:Misty Step]].')).toBe(
      'Cast [[spell:Shield|Shield]] and [[spell:Misty Step]].',
    );
    expect(convertNote('[[App:Spell:id:spell_fireball_phb|Fireball]]')).toBe(
      '[[spell:fireball@PHB|Fireball]]',
    );
    expect(convertNote('[[Rustcrown]] stays')).toBe('[[Rustcrown]] stays');
  });

  it('resolves relative links, and moved notes by name', () => {
    const paths = ['V/04_Factions/Red_Fangs.md', 'V/10_Players/Ryn/Ryn_GM.md', 'V/NPCs/Kael.md'];
    expect(
      resolveLinkPath('../../04_Factions/Red_Fangs', paths, 'V/10_Players/Ryn/Ryn_GM.md'),
    ).toBe('V/04_Factions/Red_Fangs.md');
    expect(
      resolveLinkPath('../../../../Red_Fangs', paths, 'V/10_Players/Ryn/Ryn_GM.md'),
    ).toBeNull();
    // `Old/Kael` was moved to NPCs/: found by its name.
    expect(resolveLinkPath('Old/Kael', paths, 'V/10_Players/Ryn/Ryn_GM.md')).toBe('V/NPCs/Kael.md');
  });

  it('reports links that lead nowhere', () => {
    const notes = new Map([
      ['A.md', '[[B]] [[Gone]] [[Gone]] ![[map.png]] [[spell:Fireball]]'],
      ['B.md', '[[A]]'],
    ]);
    const report = linkReport(notes, ['map.png']);
    expect(report).toEqual({
      total: 5,
      resolved: 3,
      dead: [{ from: 'A.md', target: 'Gone', count: 2 }],
    });
  });
});
