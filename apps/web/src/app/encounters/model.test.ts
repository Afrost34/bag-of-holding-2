import { describe, expect, it } from 'vitest';
import {
  addMonsters,
  creatureCount,
  newEncounter,
  parseEncounter,
  serializeEncounter,
  setCount,
} from './model';

describe('encounters', () => {
  it('counts monsters by kind', () => {
    let e = newEncounter('Ambush', [], '2026-10-08T00:00:00Z');
    e = addMonsters(e, ['monster:goblin@xphb', 'monster:goblin@xphb', 'monster:bugbear@xphb']);
    expect(e.monsters).toEqual([
      { key: 'monster:goblin@xphb', count: 2 },
      { key: 'monster:bugbear@xphb', count: 1 },
    ]);
    expect(creatureCount(e)).toBe(3);
    e = setCount(e, 'monster:goblin@xphb', 5);
    expect(creatureCount(e)).toBe(6);
    e = setCount(e, 'monster:bugbear@xphb', 0);
    expect(e.monsters).toHaveLength(1);
  });

  it('reads back what it writes', () => {
    const e = {
      ...addMonsters(newEncounter('A', [], 'x'), ['monster:goblin@xphb']),
      party: [3, 3],
    };
    const text = serializeEncounter({ ...e, campaign: 'c' });
    expect(text).not.toContain('"campaign"');
    expect(parseEncounter(text, e.id, 'c')).toEqual({ ...e, campaign: 'c' });
    expect(parseEncounter('{', 'x')).toBeNull();
  });
});
