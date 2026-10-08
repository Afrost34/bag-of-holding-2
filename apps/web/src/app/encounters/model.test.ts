import { describe, expect, it } from 'vitest';
import {
  addMonsters,
  addNpc,
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

describe('NPCs in encounters', () => {
  it('are their own lines, named, fighting with their stat block, and kept through a save', () => {
    let e = newEncounter('Ambush', [], '2026-01-01');
    e = addMonsters(e, ['monster:guard@xmm']);
    const clank = { note: 'NPCs/Clank.md', name: 'Clank', statBlock: 'monster:spy@xmm' };
    e = addNpc(e, clank);
    e = addNpc(e, clank);
    // A plain Spy added later is a separate line from Clank.
    e = addMonsters(e, ['monster:spy@xmm']);
    expect(e.monsters).toEqual([
      { key: 'monster:guard@xmm', count: 1 },
      { key: 'monster:spy@xmm', count: 2, npc: 'NPCs/Clank.md', name: 'Clank' },
      { key: 'monster:spy@xmm', count: 1 },
    ]);
    expect(creatureCount(e)).toBe(4);
    e = setCount(e, 'NPCs/Clank.md', 0);
    expect(e.monsters.map((m) => m.npc ?? m.key)).toEqual(['monster:guard@xmm', 'monster:spy@xmm']);
    const back = parseEncounter(serializeEncounter(addNpc(e, clank)), e.id);
    expect(back?.monsters.at(-1)).toEqual({
      key: 'monster:spy@xmm',
      count: 1,
      npc: 'NPCs/Clank.md',
      name: 'Clank',
    });
  });
});
