import { describe, expect, it } from 'vitest';
import { generateNames, makeName, styleFor } from './names';
import { generateNpc } from './npc';

describe('names', () => {
  it('give every builder species a fitting style', () => {
    expect(styleFor('High Elf')).toBe('elf');
    expect(styleFor('Duergar')).toBe('dwarf');
    expect(styleFor('Aven')).toBe('avian');
    expect(styleFor('Autognome')).toBe('construct');
    expect(styleFor('Forest Gnome')).toBe('gnome');
    expect(styleFor('Changeling')).toBe('human');
  });

  it('makes as many names as asked, of one species or of any', () => {
    const one = generateNames(20, ['Elf', 'Dwarf'], 'Tabaxi');
    expect(one).toHaveLength(20);
    expect(new Set(one.map((n) => n.species))).toEqual(new Set(['Tabaxi']));
    const any = generateNames(30, ['Elf', 'Dwarf']);
    expect(any.every((n) => ['Elf', 'Dwarf'].includes(n.species))).toBe(true);
    for (const n of any) expect(n.name.length).toBeGreaterThan(2);
    expect(makeName('Orc', 'woman', () => 0.5).length).toBeGreaterThan(2);
  });

  it('NPCs come from the species pool and vary', () => {
    const npcs = Array.from({ length: 40 }, () =>
      generateNpc(Math.random, undefined, ['Aven', 'Goliath']),
    );
    expect(npcs.every((n) => ['Aven', 'Goliath'].includes(n.species))).toBe(true);
    expect(
      new Set(npcs.map((n) => `${n.occupation}|${n.appearance}|${n.hook ?? ''}`)).size,
    ).toBeGreaterThan(35);
  });
});
