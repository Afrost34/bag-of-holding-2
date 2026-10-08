import { sequenceRng } from '@boh/dice';
import { describe, expect, it } from 'vitest';
import {
  kindForRows,
  rowsFromCompendium,
  cellRange,
  newTable,
  withRows,
  rowRanges,
  formatRange,
} from './model';
import {
  byLevelType,
  crNumber,
  formatCoins,
  lootTables,
  plainName,
  rollTreasure,
  tableForCr,
  treasureText,
  type TreasureTables,
} from './treasure';

const HOARDS = lootTables([
  {
    name: 'Challenge 0-4',
    source: 'DMG',
    crMin: 0,
    crMax: 4,
    coins: { cp: '6d6*100', gp: '2d6*10' },
    table: [
      { min: 1, max: 50 },
      {
        min: 51,
        max: 100,
        gems: { type: 10, amount: '2' },
        magicItems: [{ type: 'A', amount: '1' }],
      },
    ],
  },
  { name: 'Challenge 5-10', source: 'DMG', crMin: 5, crMax: 10, table: [] },
  {
    name: 'Challenge 0-4',
    source: 'XDMG',
    crMin: 0,
    crMax: 4,
    table: [{ min: 1, max: 100, magicItems: [{ type: 'randomByLevel', amount: '1' }] }],
  },
  { broken: true },
]);

const TABLES: TreasureTables = {
  valuables: (kind, value) =>
    kind === 'gems' && value === 10 ? ['{@item Azurite}', 'Hematite'] : undefined,
  magic: (type) =>
    type === 'A'
      ? [
          { min: 1, max: 60, item: '{@item Potion of Healing}' },
          { min: 61, max: 100, choose: { fromItems: ['Bag of Holding', 'Driftglobe'] } },
        ]
      : type === 'byLevel.1-4'
        ? [{ min: 1, max: 100, choose: { fromMatching: { rarity: 'common' } } }]
        : undefined,
  ofRarity: (rarity) => (rarity === 'common' ? ['item:cloak of billowing@xdmg'] : []),
};

describe('treasure by challenge rating', () => {
  it('reads the tables it can and picks one by CR and book', () => {
    expect(HOARDS).toHaveLength(3);
    expect(tableForCr(HOARDS, 3, '2014')?.name).toBe('Challenge 0-4');
    expect(tableForCr(HOARDS, 7, '2014')?.name).toBe('Challenge 5-10');
    expect(tableForCr(HOARDS, 25, '2014')?.name).toBe('Challenge 5-10');
    expect(tableForCr(HOARDS, 0.25, '2024')?.source).toBe('XDMG');
  });

  it('rolls coins, gems and magic items', () => {
    const table = tableForCr(HOARDS, 1, '2014');
    if (!table) throw new Error('no table');
    // 6d6 → all 1s (×100), 2d6 → 1s (×10), d100 → 80, gems 2: picks 1 and 2, magic d100 → 30.
    const t = rollTreasure(table, TABLES, sequenceRng([1, 1, 1, 1, 1, 1, 1, 1, 80, 1, 2, 30]));
    expect(t.coins).toEqual({ cp: 600, gp: 20 });
    expect(t.valuables).toEqual([
      { found: { text: '{@item Azurite}' }, value: 10 },
      { found: { text: 'Hematite' }, value: 10 },
    ]);
    expect(t.magicItems).toEqual([{ text: '{@item Potion of Healing}' }]);
    expect(formatCoins(t.coins)).toBe('20 gp, 600 cp');
    expect(treasureText(t, plainName)).toBe(
      'Treasure — Challenge 0-4 (DMG)\nCoins: 20 gp, 600 cp\n• Azurite (10 gp)\n• Hematite (10 gp)\n• Potion of Healing',
    );
  });

  it('picks one of a row’s items, and any item of a rarity in 2024 hoards', () => {
    const dmg = tableForCr(HOARDS, 1, '2014');
    if (!dmg) throw new Error('no table');
    const t = rollTreasure(dmg, TABLES, sequenceRng([1, 1, 1, 1, 1, 1, 1, 1, 80, 1, 1, 70, 2]));
    expect(t.magicItems).toEqual([{ text: '{@item Driftglobe}' }]);
    const xdmg = tableForCr(HOARDS, 1, '2024');
    if (!xdmg) throw new Error('no table');
    expect(byLevelType(xdmg.crMin)).toBe('byLevel.1-4');
    expect(rollTreasure(xdmg, TABLES, sequenceRng([50, 50, 1])).magicItems).toEqual([
      { key: 'item:cloak of billowing@xdmg' },
    ]);
  });

  it('reads challenge ratings', () => {
    expect(crNumber('1/4')).toBe(0.25);
    expect(crNumber({ cr: '5' })).toBe(5);
    expect(crNumber(undefined)).toBe(0);
  });
});

describe('compendium tables as roll tables', () => {
  it('reads dice cells', () => {
    expect(cellRange('01–04')).toEqual({ from: 1, to: 4 });
    expect(cellRange('00')).toEqual({ from: 100, to: 100 });
    expect(cellRange({ type: 'cell', roll: { exact: 3 } })).toEqual({ from: 3, to: 3 });
    expect(cellRange('Goblins')).toBeNull();
  });

  it('turns dice ranges into weights and the other columns into text', () => {
    const rows = rowsFromCompendium({
      colLabels: ['{@dice d6}', 'Encounter', 'Where'],
      rows: [
        ['1–4', '{@creature Goblin|MM} scouts', 'Road'],
        ['5', '{@creature Wolf|MM}', ''],
        ['', 'a sub-row', ''],
        ['6', 'Nothing', 'Anywhere'],
      ],
    });
    expect(rows).toEqual([
      { weight: 4, text: '{@creature Goblin|MM} scouts — Road' },
      { weight: 1, text: '{@creature Wolf|MM}' },
      { weight: 1, text: 'Nothing — Anywhere' },
    ]);
    expect(kindForRows(rows)).toBe('encounter');
    const table = withRows(newTable('Road', 'encounter', [], ''), rows);
    expect(rowRanges(table).map(formatRange)).toEqual(['1–4', '5', '6']);
  });

  it('reads magic item tables, gemstones and tables without dice', () => {
    expect(
      rowsFromCompendium({ table: [{ min: 1, max: 50, item: '{@item Potion of Healing}' }] }),
    ).toEqual([{ weight: 50, text: '{@item Potion of Healing}' }]);
    expect(rowsFromCompendium({ table: ['Azurite'] })).toEqual([{ weight: 1, text: 'Azurite' }]);
    const plain = rowsFromCompendium({ colLabels: ['Name', 'Deity'], rows: [['Ana', 'Pelor']] });
    expect(plain).toEqual([{ weight: 1, text: 'Ana — Pelor' }]);
    expect(kindForRows(plain)).toBe('loot');
  });
});
