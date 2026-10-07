import type { EntityDetail, RawEntity } from '@boh/data5e';
import { describe, expect, it } from 'vitest';
import { buildCharacter, newCharacter, type CharacterDecisions, type RulesData } from './build';

/** A tiny in-memory data set: one class with an ASI at level 4, a species and a background. */
function fakeData(entities: [string, string, RawEntity, '2014' | '2024'][]): RulesData {
  const map = new Map<string, EntityDetail>(
    entities.map(([key, type, data, edition]) => [
      key,
      {
        key,
        type,
        name: String(data.name),
        source: String(data.source),
        edition,
        page: null,
        layer: '5etools',
        data,
      },
    ]),
  );
  return {
    get: (key) => map.get(key),
    withKeySuffix: (type, suffix) =>
      [...map.values()].filter((e) => e.type === type && e.key.includes(suffix)),
    featureData: () => undefined,
  };
}

const data = fakeData([
  [
    'class:fighter@phb',
    'class',
    {
      name: 'Fighter',
      source: 'PHB',
      proficiency: ['str', 'con'],
      classFeatures: ['Ability Score Improvement|Fighter||4'],
      startingProficiencies: { skills: [{ choose: { from: ['athletics', 'history'], count: 1 } }] },
    },
    '2014',
  ],
  [
    'classfeature:ability score improvement|fighter|phb|4@phb',
    'classFeature',
    { name: 'Ability Score Improvement', source: 'PHB', className: 'Fighter', level: 4 },
    '2014',
  ],
  [
    'race:dwarf@xphb',
    'race',
    { name: 'Dwarf', source: 'XPHB', size: ['M'], entries: [{ name: 'Darkvision', entries: [] }] },
    '2024',
  ],
]);

const fighter = (levels: number, choices: Record<string, string[]> = {}): CharacterDecisions => ({
  ...newCharacter('2014'),
  classes: [{ class: 'class:fighter@phb', levels }],
  choices,
});

describe('buildCharacter', () => {
  it('lists what is still to choose, and applies what is chosen', () => {
    const open = buildCharacter(data, fighter(1));
    expect(open.pending.map((c) => c.id)).toEqual(['class:fighter@phb/level:1/skill']);
    const done = buildCharacter(
      data,
      fighter(1, { 'class:fighter@phb/level:1/skill': ['history'] }),
    );
    expect(done.pending).toEqual([]);
    expect(done.grants).toContainEqual({
      kind: 'skill',
      value: 'history',
      from: 'class:fighter@phb',
      choice: 'class:fighter@phb/level:1/skill',
    });
  });

  it('ignores picks that are not offered, and says so', () => {
    const built = buildCharacter(
      data,
      fighter(1, { 'class:fighter@phb/level:1/skill': ['arcana'] }),
    );
    expect(built.pending).toHaveLength(1);
    expect(built.warnings.map((w) => w.kind)).toEqual(['invalid']);
  });

  it('keeps decisions for levels the character no longer has, as orphans', () => {
    const asi = 'classfeature:ability score improvement|fighter|phb|4@phb/asi';
    const decisions = fighter(3, { [asi]: ['plus2'] });
    const built = buildCharacter(data, decisions);
    expect(built.warnings).toEqual([expect.objectContaining({ kind: 'orphan', ref: asi })]);
    expect(decisions.choices[asi]).toEqual(['plus2']);
  });

  it('offers a feat for an Ability Score Improvement only where feats are allowed', () => {
    const asi = 'classfeature:ability score improvement|fighter|phb|4@phb/asi';
    const decisions = fighter(4, { [asi]: ['feat'] });
    expect(buildCharacter(data, decisions).pending.map((c) => c.kind)).toContain('feat');
    expect(
      buildCharacter(data, decisions, { feats: false }).pending.map((c) => c.kind),
    ).not.toContain('feat');
  });

  it('points out options from the other edition', () => {
    const built = buildCharacter(data, { ...fighter(1), species: 'race:dwarf@xphb' });
    expect(built.warnings).toContainEqual(
      expect.objectContaining({ kind: 'edition', ref: 'race:dwarf@xphb' }),
    );
    expect(built.features.map((f) => f.name)).toContain('Darkvision');
  });

  it('gives 2024 characters Common and two languages of their choice', () => {
    const built = buildCharacter(data, { ...fighter(1), edition: '2024' });
    expect(built.pending.map((c) => c.id)).toContain('character/languages');
    expect(built.grants).toContainEqual(
      expect.objectContaining({ kind: 'language', value: 'common' }),
    );
  });
});
