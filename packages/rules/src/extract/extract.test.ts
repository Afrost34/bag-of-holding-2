import { describe, expect, it } from 'vitest';
import { ignoreIssues, type Issues } from '../model';
import { readClassLevel, maxSpellLevel, progressionDelta } from './classes';
import { readEntity } from './entity';
import { readFeature } from './features';
import { parseSpellFilter } from './spells';

const strict = (): Issues & { found: string[] } => {
  const found: string[] = [];
  return { found, add: (w, m) => found.push(`${w}: ${m}`) };
};

describe('proficiency blocks', () => {
  it('reads grants, picks from a list and picks from a group', () => {
    const issues = strict();
    const ex = readEntity(
      {
        skillProficiencies: [
          { deception: true, choose: { from: ['insight', 'stealth'], count: 1 } },
        ],
        languageProficiencies: [{ common: true, anyStandard: 2 }],
        toolProficiencies: [{ anyMusicalInstrument: 3 }],
      },
      'x',
      issues,
    );
    expect(issues.found).toEqual([]);
    expect(ex.grants).toEqual([
      { kind: 'skill', value: 'deception' },
      { kind: 'language', value: 'common' },
    ]);
    expect(ex.choices).toEqual([
      {
        id: 'x/skill',
        kind: 'skill',
        count: 1,
        label: 'Choose 1 skill',
        options: ['insight', 'stealth'],
      },
      {
        id: 'x/tool',
        kind: 'tool',
        count: 3,
        label: 'Choose 3 musical instruments',
        filter: { type: 'pool', pool: 'musicalInstrument' },
      },
      {
        id: 'x/language',
        kind: 'language',
        count: 2,
        label: 'Choose 2 standard languages',
        filter: { type: 'pool', pool: 'standardLanguage' },
      },
    ]);
  });

  it('turns several entries into one pick between bundles', () => {
    const ex = readEntity(
      { skillToolLanguageProficiencies: [{ anyLanguage: 2 }, { anyLanguage: 1, anyTool: 1 }] },
      'bg',
      ignoreIssues,
    );
    const [alt] = ex.choices;
    expect(alt).toMatchObject({
      id: 'bg/skillToolLanguage',
      kind: 'alternative',
      options: ['0', '1'],
    });
    expect(alt?.branches?.[1]?.choices.map((c) => c.id)).toEqual([
      'bg/skillToolLanguage/1',
      'bg/skillToolLanguage/1/1',
    ]);
  });

  it('reports what it does not understand', () => {
    const issues = strict();
    readEntity({ skillProficiencies: [{ anyWeird: 'x' }] }, 'x', issues);
    expect(issues.found).toEqual(['x/skill skillProficiencies: unknown skill entry anyWeird="x"']);
  });
});

describe('ability scores', () => {
  it('reads the 2024 background +2/+1 or +1/+1/+1', () => {
    const ex = readEntity(
      {
        ability: [
          { choose: { weighted: { from: ['dex', 'con', 'cha'], weights: [2, 1] } } },
          { choose: { weighted: { from: ['dex', 'con', 'cha'], weights: [1, 1, 1] } } },
        ],
      },
      'background:charlatan@xphb',
      ignoreIssues,
    );
    const [alt] = ex.choices;
    expect(alt?.branches?.map((b) => b.label)).toEqual(['+2/+1', '+1/+1/+1']);
    expect(alt?.branches?.[0]?.choices[0]).toMatchObject({
      kind: 'ability',
      count: 2,
      options: ['dex', 'con', 'cha'],
      amounts: [2, 1],
    });
  });

  it('gives custom-lineage species a free +2/+1', () => {
    const ex = readEntity({ lineage: 'VRGR', size: ['S'] }, 'race:goblin@mpmm', ignoreIssues);
    expect(ex.choices[0]?.branches?.[0]?.choices[0]?.options).toHaveLength(6);
    expect(ex.grants).toEqual([{ kind: 'size', value: 'Small' }]);
  });
});

describe('spells', () => {
  it('reads lineages as alternatives with spell picks and innate uses', () => {
    const ex = readEntity(
      {
        additionalSpells: [
          {
            name: 'High Elf',
            ability: { choose: ['int', 'wis', 'cha'] },
            known: { '1': { _: [{ choose: 'level=0|class=Wizard' }] } },
            innate: { '3': { daily: { '1': ['detect magic|xphb'] } } },
          },
          { name: 'Wood Elf', known: { '1': ['druidcraft|xphb#c'] } },
        ],
      },
      'race:elf@xphb',
      ignoreIssues,
    );
    const high = ex.choices[0]?.branches?.[0];
    expect(high?.label).toBe('High Elf');
    expect(high?.grants).toEqual([
      {
        kind: 'spell',
        key: 'spell:detect magic@xphb',
        mode: 'innate',
        level: 3,
        uses: { per: 'daily', count: 1 },
      },
    ]);
    expect(high?.choices.map((c) => [c.kind, c.filter ?? c.options])).toEqual([
      ['spellAbility', ['int', 'wis', 'cha']],
      ['spell', { type: 'spell', filter: 'level=0|class=Wizard' }],
    ]);
    expect(ex.choices[0]?.branches?.[1]?.grants[0]).toMatchObject({ key: 'spell:druidcraft@xphb' });
  });

  it('parses spell filters', () => {
    expect(parseSpellFilter('level=0;1|class=Cleric;Wizard')).toEqual({
      level: ['0', '1'],
      class: ['cleric', 'wizard'],
    });
  });
});

describe('feats', () => {
  it('reads a named version of a feat', () => {
    const ex = readEntity({ feats: [{ 'magic initiate; cleric|xphb': true }] }, 'b', ignoreIssues);
    expect(ex.grants).toEqual([
      { kind: 'feat', key: 'feat:magic initiate@xphb', version: 'magic initiate; cleric' },
    ]);
  });
});

describe('classes', () => {
  const bard = {
    name: 'Bard',
    source: 'XPHB',
    proficiency: ['dex', 'cha'],
    casterProgression: 'full',
    cantripProgression: [2, 2, 2, 3],
    preparedSpellsProgression: [4, 5, 6, 7],
    subclassTitle: 'Bard Subclass',
    classFeatures: [
      'Bardic Inspiration|Bard|XPHB|1',
      { classFeature: 'Bard Subclass|Bard|XPHB|3', gainSubclassFeature: true },
    ],
    startingProficiencies: {
      skills: [{ any: 3 }],
      weapons: ['simple'],
      armor: ['light'],
      armorProficiencies: [{ light: true }],
    },
    startingEquipment: {
      defaultData: [
        { A: [{ item: 'dagger|xphb', quantity: 2 }, { value: 1900 }], B: [{ value: 9000 }] },
      ],
    },
    multiclassing: {
      proficienciesGained: { skills: [{ choose: { from: ['arcana'], count: 1 } }] },
    },
  };
  const key = 'class:bard@xphb';

  it('asks for skills, cantrips, spells and equipment at level 1 of the first class', () => {
    const issues = strict();
    const ex = readClassLevel(bard, key, 1, { first: true, edition: '2024' }, issues);
    expect(issues.found).toEqual([]);
    expect(ex.grants).toEqual([
      { kind: 'save', value: 'dex' },
      { kind: 'save', value: 'cha' },
      { kind: 'armor', value: 'light' },
      { kind: 'weapon', value: 'simple' },
    ]);
    expect(ex.choices.map((c) => [c.id, c.count])).toEqual([
      ['class:bard@xphb/level:1/skill', 3],
      ['class:bard@xphb/level:1/equipment/0', 1],
      ['class:bard@xphb/level:1/cantrips', 2],
      ['class:bard@xphb/level:1/spells', 4],
    ]);
    expect(ex.choices[3]?.filter).toEqual({ type: 'spell', filter: 'level=1|class=Bard' });
  });

  it('asks a multiclass only for its multiclass proficiencies', () => {
    const ex = readClassLevel(bard, key, 1, { first: false, edition: '2024' }, ignoreIssues);
    expect(ex.grants).toEqual([]);
    expect(ex.choices[0]).toMatchObject({ kind: 'skill', options: ['arcana'] });
  });

  it('asks for the subclass and new spells at level 3', () => {
    const ex = readClassLevel(bard, key, 3, { first: true, edition: '2024' }, ignoreIssues);
    expect(ex.choices.map((c) => c.id)).toEqual([
      'class:bard@xphb/level:3/subclass',
      'class:bard@xphb/level:3/spells',
    ]);
    expect(ex.choices[1]?.filter).toEqual({ type: 'spell', filter: 'level=1;2|class=Bard' });
  });

  it('knows spell levels and progression steps', () => {
    expect(maxSpellLevel('full', 3, '2024')).toBe(2);
    expect(maxSpellLevel('1/2', 1, '2014')).toBe(0);
    expect(maxSpellLevel('1/2', 1, '2024')).toBe(1);
    expect(maxSpellLevel('1/3', 7, '2014')).toBe(2);
    expect(maxSpellLevel('pact', 9, '2014')).toBe(5);
    expect(progressionDelta({ '3': 3, '7': 5 }, 7)).toBe(2);
    expect(progressionDelta([2, 2, 3], 3)).toBe(1);
  });
});

describe('features', () => {
  it('offers 2014 Ability Score Improvements as +2, +1/+1 or a feat', () => {
    const ex = readFeature(
      { name: 'Ability Score Improvement', className: 'Fighter' },
      'cf',
      { edition: '2014' },
      ignoreIssues,
    );
    expect(ex.choices[0]?.options).toEqual(['plus2', 'plus1', 'feat']);
    expect(ex.choices[0]?.branches?.[0]?.choices[0]).toMatchObject({
      kind: 'ability',
      amounts: [2],
    });
  });

  it('offers 2024 Ability Score Improvements as a General feat', () => {
    const ex = readFeature(
      { name: 'Ability Score Improvement' },
      'cf',
      { edition: '2024' },
      ignoreIssues,
    );
    expect(ex.choices[0]).toMatchObject({
      kind: 'feat',
      filter: { type: 'feat', categories: ['G'] },
    });
  });

  it('reads Foundry choices and "choose one of the following" options', () => {
    const ex = readFeature(
      {
        name: 'Totem Spirit',
        entries: [
          {
            type: 'options',
            count: 1,
            entries: [
              { type: 'refSubclassFeature', subclassFeature: 'Bear|Barbarian||Totem Warrior||3' },
              { type: 'refSubclassFeature', subclassFeature: 'Eagle|Barbarian||Totem Warrior||3' },
            ],
          },
        ],
      },
      'sf',
      { edition: '2014', entryData: { expertise: [{ anyProficientSkill: 2 }] } },
      ignoreIssues,
    );
    expect(ex.choices.map((c) => [c.kind, c.options?.[0] ?? c.filter])).toEqual([
      ['feature', 'subclassfeature:bear|barbarian|phb|totem warrior|phb|3@phb'],
      ['expertise', { type: 'pool', pool: 'proficientSkill' }],
    ]);
  });
});
