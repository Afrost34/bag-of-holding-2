import { describe, expect, it } from 'vitest';
import { diceParts, SCREEN_SECTIONS, screenTables } from './dmScreen';

describe('DM screen tables', () => {
  it('has as many cells in each row as columns, in both editions', () => {
    for (const edition of ['2014', '2024'] as const)
      for (const { id } of SCREEN_SECTIONS)
        for (const table of screenTables(id, edition))
          for (const row of table.rows) expect(row, table.title).toHaveLength(table.columns.length);
  });

  it('follows the edition where the rules differ', () => {
    const travel = (e: '2014' | '2024') =>
      screenTables('exploration', e).find((t) => t.title === 'Travel pace')?.rows[0]?.[4];
    expect(travel('2014')).toBe('−5 to passive Perception');
    expect(travel('2024')).toBe('Disadvantage on Perception');
  });

  it('finds the dice in a cell', () => {
    expect(diceParts('5 (2d4)')).toEqual([
      { text: '5 (' },
      { text: '2d4', dice: true },
      { text: ')' },
    ]);
    expect(diceParts('11')).toEqual([{ text: '11' }]);
  });
});
