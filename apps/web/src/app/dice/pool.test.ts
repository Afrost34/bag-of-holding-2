import { evaluate, parse, sequenceRng } from '@boh/dice';
import { describe, expect, it } from 'vitest';
import {
  addDie,
  clearFaces,
  countOf,
  EMPTY_POOL,
  poolExpression,
  poolLabel,
  removeDie,
  type Pool,
} from './pool';

describe('dice tray pool', () => {
  it('groups dice largest first and adds the modifier', () => {
    let pool: Pool = EMPTY_POOL;
    pool = addDie(pool, 6);
    pool = addDie(pool, 20);
    pool = addDie(pool, 6);
    pool = { ...pool, modifier: 3 };
    expect(poolExpression(pool)).toBe('1d20 + 2d6 + 3');
    expect(countOf(pool, 6)).toBe(2);
  });

  it('rolls advantage and disadvantage d20s as their own groups', () => {
    let pool: Pool = EMPTY_POOL;
    pool = addDie(pool, 20, 'advantage');
    pool = addDie(pool, 20);
    pool = addDie(pool, 20, 'disadvantage');
    pool = addDie(pool, 8, 'advantage'); // ignored for non-d20s
    expect(poolExpression(pool)).toBe('2d20kh1 + 2d20kl1 + 1d20 + 1d8');
    expect(poolLabel(pool)).toBe('d20 (adv) + d20 (dis) + 1d20 + 1d8');
    const result = evaluate(parse(poolExpression(pool)), {
      rng: sequenceRng([3, 17, 3, 17, 10, 5]),
    });
    expect(result.total).toBe(17 + 3 + 10 + 5);
  });

  it('removes and clears dice', () => {
    let pool: Pool = EMPTY_POOL;
    pool = addDie(pool, 4);
    pool = addDie(pool, 4);
    pool = removeDie(pool, 4);
    expect(countOf(pool, 4)).toBe(1);
    expect(removeDie(pool, 12)).toBe(pool);
    pool = clearFaces(addDie(pool, 4), 4);
    expect(pool.dice).toEqual([]);
    expect(poolExpression({ dice: [], modifier: -2 })).toBe('-2');
  });
});
