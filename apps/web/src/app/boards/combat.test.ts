import { sequenceRng } from '@boh/dice';
import { describe, expect, it } from 'vitest';
import {
  advanceTurn,
  changeHp,
  joinCombat,
  LAIR,
  monsterStats,
  previousTurn,
  removeCombatant,
  startCombat,
  turnOrder,
  type Combatant,
  type CombatState,
} from './combat';

const goblin = {
  dex: 14,
  ac: [{ ac: 15, from: ['leather armor'] }],
  hp: { average: 7 },
  cr: '1/4',
};
const dragon = {
  dex: 10,
  ac: [18],
  hp: { average: 178 },
  cr: '14',
  legendary: [{}],
  legendaryGroup: { name: 'Black Dragon', source: 'MM' },
};

describe('combat', () => {
  it('reads a monster’s numbers', () => {
    expect(monsterStats(goblin)).toEqual({ ac: 15, hp: 7, initBonus: 2, lair: false });
    expect(monsterStats(dragon)).toMatchObject({ ac: 18, hp: 178, legendary: 3, lair: true });
    // 2024: proficiency added to initiative (CR 14: +5).
    expect(monsterStats({ ...dragon, initiative: { proficiency: 1 } }).initBonus).toBe(5);
  });

  it('starts combat with numbered monsters and the characters, in initiative order', () => {
    const state = startCombat(
      [
        { key: 'monster:goblin@mm', count: 2, data: goblin },
        { key: 'monster:adult black dragon@mm', count: 1, data: dragon },
      ],
      [{ id: 'lia', name: 'Lia', ac: 13, hp: 20, initBonus: 3 }],
      sequenceRng([10, 18, 5, 12]),
    );
    expect(state.combatants.map((c) => [c.key ?? c.name, c.n, c.initiative])).toEqual([
      ['monster:goblin@mm', 2, 20],
      ['Lia', undefined, 15],
      ['monster:goblin@mm', 1, 12],
      ['monster:adult black dragon@mm', undefined, 5],
    ]);
    expect(state.turn).toBeNull();
    // The dragon's lair acts at 20, after the goblin who rolled 20.
    const order = turnOrder(state.combatants);
    expect(order.indexOf(LAIR)).toBe(1);
  });

  it('goes round the table, restoring legendary actions on the creature’s turn', () => {
    const a: Combatant = {
      id: 'a',
      initiative: 15,
      initBonus: 0,
      hp: 5,
      maxHp: 5,
      ac: 10,
      conditions: [],
    };
    const b: Combatant = {
      ...a,
      id: 'b',
      initiative: 10,
      legendary: { max: 3, used: 2 },
    };
    let s: CombatState = { combatants: [b, a], turn: null, round: 1 };
    s = advanceTurn(s);
    expect([s.turn, s.round]).toEqual(['a', 1]);
    s = advanceTurn(s);
    expect([s.turn, s.round]).toEqual(['b', 1]);
    expect(s.combatants.find((c) => c.id === 'b')?.legendary?.used).toBe(0);
    s = advanceTurn(s);
    expect([s.turn, s.round]).toEqual(['a', 2]);
    s = previousTurn(s);
    expect([s.turn, s.round]).toEqual(['b', 1]);
    // Removing whoever's turn it is passes the turn on.
    s = removeCombatant(s, 'b');
    expect(s.turn).toBe('a');
    expect(s.combatants).toHaveLength(1);
  });

  it('takes damage from temporary hit points first and heals up to the maximum', () => {
    const c: Combatant = {
      id: 'x',
      initiative: 1,
      initBonus: 0,
      hp: 10,
      maxHp: 12,
      tempHp: 4,
      ac: 10,
      conditions: [],
    };
    expect(changeHp(c, -3)).toMatchObject({ hp: 10, tempHp: 1 });
    const hit = changeHp(c, -6);
    expect(hit.hp).toBe(8);
    expect(hit.tempHp).toBeUndefined();
    expect(changeHp(c, -50).hp).toBe(0);
    expect(changeHp(c, 5).hp).toBe(12);
  });
});

describe('joining a combat', () => {
  it('adds creatures numbered with their kind, and characters only once', () => {
    const lia = { id: 'lia', name: 'Lia', ac: 13, hp: 20, initBonus: 3 };
    const first = joinCombat(
      { combatants: [], turn: null, round: 1 },
      [{ key: 'monster:goblin@mm', count: 1, data: goblin }],
      [lia],
      sequenceRng([10, 18]),
    );
    expect(first.combatants.map((c) => c.n)).toEqual([undefined, undefined]);
    const started = advanceTurn(first);
    const more = joinCombat(
      started,
      [{ key: 'monster:goblin@mm', count: 2, data: goblin }],
      [lia],
      sequenceRng([1, 2]),
    );
    expect(more.turn).toBe(started.turn);
    expect(more.combatants.filter((c) => c.character === 'lia')).toHaveLength(1);
    const goblins = more.combatants.filter((c) => c.key === 'monster:goblin@mm');
    expect(goblins.map((c) => c.n).sort()).toEqual([1, 2, 3]);
    // The goblin already fighting is Goblin 1.
    expect(goblins.find((c) => c.initiative === 12)?.n).toBe(1);
    expect(new Set(more.combatants.map((c) => c.id)).size).toBe(4);
  });
});
