import { describe, expect, it } from 'vitest';
import { parseBase, runView } from './bases/base';
import { baseFor, baseListsType, NOTE_TYPES, newNoteText, noteType } from './noteTypes';
import { parseFrontmatter } from './syntax';

describe('note types', () => {
  it('start notes with their type, tag and empty fields', () => {
    const npc = noteType('NPC');
    if (!npc) throw new Error('no npc type');
    const text = newNoteText(npc, 'Mother Tibia');
    const { data, bodyStart } = parseFrontmatter(text);
    expect(data.type).toBe('npc');
    expect(data.tags).toEqual(['npc']);
    expect(data.status).toBe('Alive');
    expect(data).toHaveProperty('location', null);
    expect(text).toContain('\nrole:\n');
    expect(text.slice(bodyStart)).toContain('## Personality');
  });

  it('have bases that list them, and embedded bases that read', () => {
    for (const type of NOTE_TYPES) {
      const base = parseBase(baseFor(type));
      expect(base.error).toBeUndefined();
      expect(baseListsType(baseFor(type), type)).toBe(true);
      const view = base.views[0];
      if (!view) throw new Error('no view');
      const note = {
        path: `${type.plural}/A.md`,
        properties: { type: type.id },
        tags: [],
        links: [],
      };
      expect(runView(base, view, [note], { resolve: () => null }).total).toBe(1);
      const body = newNoteText(type, 'A');
      for (const m of body.matchAll(/```base\n([\s\S]*?)```/g)) {
        expect(parseBase(m[1] ?? '').views.length).toBeGreaterThan(0);
      }
    }
  });

  it('recognise bases from an existing vault', () => {
    const npc = noteType('npc');
    if (!npc) throw new Error('no npc type');
    expect(baseListsType('filters:\n  and:\n    - type = "npc"', npc)).toBe(true);
    expect(baseListsType('type == "npcs"', npc)).toBe(false);
  });
});

describe('wizard steps', () => {
  it('cover every field of every kind exactly once', () => {
    for (const type of NOTE_TYPES) {
      const keys = type.steps.flatMap((s) => s.keys);
      expect([...keys].sort()).toEqual(type.fields.map((f) => f.key).sort());
    }
  });
});
