import { sequenceRng } from '@boh/dice';
import { describe, expect, it } from 'vitest';
import {
  addLink,
  addRow,
  creaturesOf,
  describeLink,
  encounterLink,
  formatRange,
  moveRow,
  newTable,
  noteLink,
  parseTable,
  priceOfValue,
  removeLink,
  removeRow,
  rollTable,
  rowRanges,
  serializeTable,
  tableDie,
  tablePath,
  tablesLinkedTo,
  updateRow,
  validCount,
  type RollTable,
} from './model';

const NOW = '2026-10-08T10:00:00.000Z';

function goblinTable(): RollTable {
  let t = newTable('Forest road', 'encounter', [], NOW);
  t = addRow(t, { key: 'monster:goblin@xphb', count: '1d4+1' });
  t = addRow(t, { key: 'monster:wolf@xphb', count: '2' });
  t = addRow(t, { text: 'A merchant with a broken wheel' });
  const [a, b] = t.rows;
  t = updateRow(t, a?.id ?? '', { weight: 3 });
  t = updateRow(t, b?.id ?? '', { weight: 2 });
  return t;
}

describe('roll tables', () => {
  it('keeps campaign tables inside the campaign', () => {
    expect(tablePath('abc', 'rust')).toBe('campaigns/rust/tables/abc.json');
    expect(tablePath('abc')).toBe('tables/abc.json');
  });

  it('names new tables after their kind when left blank', () => {
    expect(newTable(' ', 'shop', [], NOW).name).toBe('Shop');
    expect(newTable('Smithy', 'shop', [], NOW).name).toBe('Smithy');
  });

  it('gives each row numbers on the die by weight', () => {
    const t = goblinTable();
    expect(tableDie(t)).toBe(6);
    expect(rowRanges(t).map(formatRange)).toEqual(['1–3', '4–5', '6']);
  });

  it('rolls the row the die lands on, and its count', () => {
    const t = goblinTable();
    // d6 → 2 (goblins), then 1d4 → 3: 3 + 1 goblins.
    const roll = rollTable(t, sequenceRng([2, 3]));
    expect(roll?.row.key).toBe('monster:goblin@xphb');
    expect(roll?.number).toBe(2);
    expect(roll?.count).toBe(4);
    expect(roll?.countRoll).toContain('= 4');
    const wolves = rollTable(t, sequenceRng([5]));
    expect(wolves?.row.key).toBe('monster:wolf@xphb');
    expect(wolves?.count).toBe(2);
    expect(wolves?.countRoll).toBeUndefined();
    expect(rollTable(t, sequenceRng([6]))?.row.text).toBe('A merchant with a broken wheel');
    expect(rollTable(newTable('', 'loot', [], NOW))).toBeNull();
  });

  it('turns rolls into the creatures of an encounter', () => {
    const t = goblinTable();
    const rolls = [rollTable(t, sequenceRng([1, 1])), rollTable(t, sequenceRng([6]))].flatMap(
      (r) => (r ? [r] : []),
    );
    expect(creaturesOf(rolls)).toEqual(['monster:goblin@xphb', 'monster:goblin@xphb']);
  });

  it('cleans rows as they change, and moves them', () => {
    let t = goblinTable();
    const id = t.rows[0]?.id ?? '';
    t = updateRow(t, id, { weight: 0, count: '  ', text: ' leader ' });
    expect(t.rows[0]).toEqual({ id, weight: 1, key: 'monster:goblin@xphb', text: 'leader' });
    t = moveRow(t, id, 1);
    expect(t.rows[1]?.id).toBe(id);
    expect(moveRow(t, t.rows[0]?.id ?? '', -1)).toBe(t);
    t = removeRow(t, id);
    expect(t.rows.map((r) => r.id)).not.toContain(id);
  });

  it('checks counts with the dice roller', () => {
    expect(validCount('2d6*10')).toBe(true);
    expect(validCount('3')).toBe(true);
    expect(validCount('lots')).toBe(false);
  });

  it('links tables to notes, encounters and creatures', () => {
    let t = goblinTable();
    t = addLink(t, noteLink('Locations/Forest.md'));
    t = addLink(t, noteLink('Locations/Forest.md'));
    t = addLink(t, encounterLink('e1'));
    t = addLink(t, 'monster:goblin@xphb');
    expect(t.links).toHaveLength(3);
    expect(t.links.map(describeLink)).toEqual([
      { kind: 'note', path: 'Locations/Forest.md' },
      { kind: 'encounter', id: 'e1' },
      { kind: 'entity', key: 'monster:goblin@xphb' },
    ]);
    const other = { ...newTable('A loot', 'loot', [t.id], NOW), links: [encounterLink('e1')] };
    expect(tablesLinkedTo([t, other], encounterLink('e1')).map((x) => x.name)).toEqual([
      'A loot',
      'Forest road',
    ]);
    t = removeLink(t, encounterLink('e1'));
    expect(tablesLinkedTo([t], encounterLink('e1'))).toEqual([]);
  });

  it('round-trips through its file, without the campaign', () => {
    const t = { ...addLink(goblinTable(), noteLink('A.md')), campaign: 'rust', notes: 'Night' };
    const text = serializeTable(t);
    expect(text).not.toContain('rust');
    expect(parseTable(text, t.id, 'rust')).toEqual(t);
  });

  it('reads damaged files as far as it can', () => {
    expect(parseTable('nope', 'x')).toBeNull();
    const t = parseTable(
      JSON.stringify({ kind: 'what', rows: [{ weight: -2, text: 'Gold' }, { count: '2' }, 4] }),
      'x',
    );
    expect(t?.kind).toBe('loot');
    expect(t?.rows).toEqual([{ id: 'r0', weight: 1, text: 'Gold' }]);
    expect(t?.links).toEqual([]);
  });

  it('prices items from their value in copper', () => {
    expect(priceOfValue(1500)).toBe('15 gp');
    expect(priceOfValue(50)).toBe('5 sp');
    expect(priceOfValue(2)).toBe('2 cp');
    expect(priceOfValue(undefined)).toBeUndefined();
  });
});
