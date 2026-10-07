import type { ListRow, SourceInfo } from '@boh/data5e';
import { describe, expect, it } from 'vitest';
import { groupBySource, matchesNameOrSource } from './cardModel';

const row = (name: string, source: string, edition: '2014' | '2024' = '2014'): ListRow => ({
  key: `class:${name.toLowerCase()}@${source.toLowerCase()}`,
  type: 'class',
  name,
  source,
  edition,
  page: null,
  f: {},
});

const source = (
  id: string,
  name: string,
  group: string,
  published: string,
  edition: '2014' | '2024',
): SourceInfo => ({ id, name, kind: 'book', group, published, edition, playtest: false });

const SOURCES = [
  source('PHB', "Player's Handbook (2014)", 'core', '2014-08-19', '2014'),
  source('XPHB', "Player's Handbook (2024)", 'core', '2024-09-17', '2024'),
  source('TCE', "Tasha's Cauldron of Everything", 'supplement', '2020-11-17', '2014'),
  source('EFA', 'Eberron: Forge of the Artificer', 'supplement', '2025-08-01', '2024'),
];

describe('card pages', () => {
  it('orders groups: 2024 first, core first, then newest', () => {
    const groups = groupBySource(
      [
        row('Wizard', 'PHB'),
        row('Artificer', 'TCE'),
        row('Fighter', 'XPHB', '2024'),
        row('Bard', 'XPHB', '2024'),
        row('Artificer', 'EFA', '2024'),
      ],
      SOURCES,
    );
    expect(groups.map((g) => g.source)).toEqual(['XPHB', 'EFA', 'PHB', 'TCE']);
    expect(groups[0]?.rows.map((r) => r.name)).toEqual(['Bard', 'Fighter']);
    expect(groups[0]?.info?.name).toBe("Player's Handbook (2024)");
  });

  it('searches by name or source', () => {
    const fighter = row('Fighter', 'XPHB', '2024');
    expect(matchesNameOrSource(fighter, 'fight', SOURCES)).toBe(true);
    expect(matchesNameOrSource(fighter, 'xphb', SOURCES)).toBe(true);
    expect(matchesNameOrSource(fighter, "player's 2024", SOURCES)).toBe(true);
    expect(matchesNameOrSource(fighter, 'tasha', SOURCES)).toBe(false);
    expect(matchesNameOrSource(fighter, '  ', SOURCES)).toBe(true);
  });
});
