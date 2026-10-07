import { describe, expect, it } from 'vitest';
import { parseRange, rollableTable, rowForTotal } from './tableRoll';

describe('random tables', () => {
  it('parses row ranges', () => {
    expect(parseRange('1', 6)).toEqual([1, 1]);
    expect(parseRange('2–3', 6)).toEqual([2, 3]);
    expect(parseRange('01-05', 100)).toEqual([1, 5]);
    expect(parseRange('96–00', 100)).toEqual([96, 100]);
    expect(parseRange('00', 100)).toEqual([100, 100]);
    expect(parseRange('10+', 20)).toEqual([10, Number.MAX_SAFE_INTEGER]);
    expect(parseRange(4, 8)).toEqual([4, 4]);
    expect(parseRange({ type: 'cell', roll: { min: 3, max: 4 } }, 8)).toEqual([3, 4]);
    expect(parseRange('Goblin', 8)).toBeNull();
  });

  it('recognises rollable tables and finds the row for a roll', () => {
    const table = rollableTable({
      colLabels: ['{@dice d8}', 'Encounter'],
      rows: [
        ['1–4', 'Goblins'],
        ['5–7', 'Wolves'],
        ['8', 'Dragon'],
      ],
    });
    expect(table).toEqual({
      expression: '1d8',
      ranges: [
        [1, 4],
        [5, 7],
        [8, 8],
      ],
    });
    if (!table) throw new Error('expected a table');
    expect(rowForTotal(table, 6)).toBe(1);
    expect(rowForTotal(table, 9)).toBe(-1);
  });

  it('ignores tables that are not random tables', () => {
    expect(rollableTable({ colLabels: ['Level', 'Slots'], rows: [['1', '2']] })).toBeNull();
    expect(rollableTable({ colLabels: ['d6', 'Effect'], rows: [['one', 'x']] })).toBeNull();
  });
});
