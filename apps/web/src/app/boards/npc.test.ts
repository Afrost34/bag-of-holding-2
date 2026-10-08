import { describe, expect, it } from 'vitest';
import { generateNpc, NPC_SPECIES, npcName } from './npc';

/** Repeats the given numbers in [0, 1). */
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe('npc generator', () => {
  it('makes a whole NPC, the same one for the same rolls', () => {
    const a = generateNpc(seq([0.1, 0.5, 0.9, 0.3]));
    const b = generateNpc(seq([0.1, 0.5, 0.9, 0.3]));
    expect(a).toEqual(b);
    for (const v of Object.values(a) as string[]) expect(v.length).toBeGreaterThan(0);
  });

  it('keeps the species asked for, and gives every species a name', () => {
    expect(generateNpc(Math.random, 'Dwarf').species).toBe('Dwarf');
    for (const s of NPC_SPECIES) expect(npcName(s, 'woman', seq([0.2])).length).toBeGreaterThan(2);
  });
});
