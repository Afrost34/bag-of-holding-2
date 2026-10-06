import { categoryById, type Category, type ListRow } from '@boh/data5e';
import { describe, expect, it } from 'vitest';
import {
  cellText,
  filterRows,
  searchFromState,
  sortRows,
  stateFromSearch,
  valueCounts,
  type ListState,
} from './listModel';

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing test fixture');
  return value;
}

const spells: Category = must(categoryById('spells'));

function row(name: string, source: string, f: ListRow['f']): ListRow {
  return {
    key: `spell:${name.toLowerCase()}@${source.toLowerCase()}`,
    type: 'spell',
    name,
    source,
    edition: '2024',
    page: null,
    f,
  };
}

const rows = [
  row('Fireball', 'XPHB', {
    level: 3,
    school: 'Evocation',
    classes: ['Sorcerer', 'Wizard'],
    concentration: false,
  }),
  row('Fire Bolt', 'XPHB', {
    level: 0,
    school: 'Evocation',
    classes: ['Sorcerer', 'Wizard'],
    concentration: false,
  }),
  row('Bless', 'XPHB', {
    level: 1,
    school: 'Enchantment',
    classes: ['Cleric', 'Paladin'],
    concentration: true,
  }),
  row('Fireball', 'PHB', {
    level: 3,
    school: 'Evocation',
    classes: ['Wizard'],
    concentration: false,
  }),
];

const base: ListState = { q: '', filters: {}, sort: 'level', dir: 'asc', sel: null };

describe('list model', () => {
  it('round-trips state through the URL', () => {
    const state: ListState = {
      q: 'fire',
      filters: { level: ['1', '3'], classes: ['Wizard'] },
      sort: 'name',
      dir: 'desc',
      sel: 'spell:fireball@xphb',
    };
    const search = searchFromState(state, spells);
    expect(search).toEqual({
      q: 'fire',
      'f.level': '1~3',
      'f.classes': 'Wizard',
      sort: 'name',
      dir: 'desc',
      sel: 'spell:fireball@xphb',
    });
    expect(stateFromSearch(search, spells)).toEqual(state);
    expect(searchFromState(base, spells)).toEqual({});
  });

  it('filters by text, fields (OR within, AND across) and disabled sources', () => {
    const names = (s: ListState, off: string[] = []) =>
      filterRows(rows, s, new Set(off)).map((r) => `${r.name}@${r.source}`);
    expect(names({ ...base, q: 'fire' })).toEqual([
      'Fireball@XPHB',
      'Fire Bolt@XPHB',
      'Fireball@PHB',
    ]);
    expect(names({ ...base, filters: { level: ['0', '1'] } })).toEqual([
      'Fire Bolt@XPHB',
      'Bless@XPHB',
    ]);
    expect(names({ ...base, filters: { classes: ['Wizard'], level: ['3'] } })).toEqual([
      'Fireball@XPHB',
      'Fireball@PHB',
    ]);
    expect(names({ ...base, filters: { concentration: ['yes'] } })).toEqual(['Bless@XPHB']);
    expect(names(base, ['phb'])).toHaveLength(3);
  });

  it('sorts by field, then name; blanks last', () => {
    const sorted = sortRows([...rows], base, spells).map((r) => r.name);
    expect(sorted).toEqual(['Fire Bolt', 'Bless', 'Fireball', 'Fireball']);
    const desc = sortRows([...rows], { ...base, sort: 'name', dir: 'desc' }, spells).map(
      (r) => r.name,
    );
    expect(desc[0]).toBe('Fireball');
  });

  it('counts values in display order', () => {
    const level = spells.fields.find((f) => f.id === 'level');
    expect(level && valueCounts(rows, level)).toEqual([
      ['0', 1],
      ['1', 1],
      ['3', 2],
    ]);
    const classes = spells.fields.find((f) => f.id === 'classes');
    expect(classes && valueCounts(rows, classes)[0]).toEqual(['Cleric', 1]);
  });

  it('formats cells', () => {
    const level = spells.fields.find((f) => f.id === 'level');
    const conc = spells.fields.find((f) => f.id === 'concentration');
    expect(level && cellText(must(rows[1]), level)).toBe('Cantrip');
    expect(conc && cellText(must(rows[2]), conc)).toBe('✓');
  });
});
