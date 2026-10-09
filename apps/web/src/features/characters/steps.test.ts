import type { AnsweredChoice, HeldGrant } from '@boh/rules';
import { describe, expect, it } from 'vitest';
import { choicesByStep, featureOf, hitPointLevels, inBookOrder, pickName, rootOf } from './steps';

describe('pick names', () => {
  it('reads plain values, entity keys and groups', () => {
    expect(pickName('sleight of hand')).toBe('Sleight Of Hand');
    expect(pickName('subclass:lore|bard|phb@phb')).toBe('Lore');
    expect(pickName('spell:mind sliver@xphb')).toBe('Mind Sliver');
    expect(pickName('pool:artisanTool')).toBe('Any artisan tool');
  });
});

const choice = (
  id: string,
  from: string,
  kind: AnsweredChoice['kind'] = 'skill',
): AnsweredChoice => ({
  id,
  from,
  kind,
  count: 1,
  label: id,
  picks: [],
});

const grants: HeldGrant[] = [
  { kind: 'feat', key: 'feat:skilled@xphb', from: 'background:charlatan@xphb' },
];

describe('builder steps', () => {
  it('follows feats back to what gave them', () => {
    expect(rootOf('feat:skilled@xphb', grants)).toBe('background:charlatan@xphb');
    expect(rootOf('class:bard@xphb', grants)).toBe('class:bard@xphb');
  });

  it('puts each choice on its step', () => {
    const steps = choicesByStep(
      [
        choice('class:bard@xphb/level:1/skill', 'class:bard@xphb'),
        choice('class:bard@xphb/cantrips', 'class:bard@xphb', 'spell'),
        choice('class:bard@xphb/level:1/equipment/0', 'class:bard@xphb', 'alternative'),
        choice('feat:skilled@xphb/skillToolLanguage', 'feat:skilled@xphb'),
        choice('background:charlatan@xphb/ability', 'background:charlatan@xphb', 'alternative'),
        choice('race:goblin@mpmm/size', 'race:goblin@mpmm', 'size'),
        choice('character/languages', 'character', 'language'),
      ],
      grants,
    );
    expect(
      Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v.map((c) => c.id)])),
    ).toEqual({
      home: [],
      class: ['class:bard@xphb/level:1/skill', 'class:bard@xphb/cantrips'],
      species: ['race:goblin@mpmm/size'],
      background: [
        'feat:skilled@xphb/skillToolLanguage',
        'background:charlatan@xphb/ability',
        'character/languages',
      ],
      abilities: [],
      equipment: ['class:bard@xphb/level:1/equipment/0'],
      sheet: [],
    });
  });
});

describe('hit point levels', () => {
  it('skips the first level of the first class', () => {
    expect(
      hitPointLevels(
        [
          { faces: 10, count: 2 },
          { faces: 6, count: 1 },
        ],
        [
          { name: 'Fighter', levels: 2 },
          { name: 'Wizard', levels: 1 },
        ],
      ),
    ).toEqual([
      { label: 'Fighter 2', faces: 10 },
      { label: 'Wizard 1', faces: 6 },
    ]);
  });
});

describe('feature of a choice', () => {
  it('follows a feat back to the feature it was picked in', () => {
    const asi = 'classfeature:ability score improvement|fighter|xphb|4@xphb';
    const pickFeat: AnsweredChoice = {
      ...choice(`${asi}/feats`, 'class:fighter@xphb', 'feat'),
      via: asi,
    };
    const inFeat = choice('feat:skilled@xphb/skillToolLanguage', 'feat:skilled@xphb');
    const held: HeldGrant[] = [
      { kind: 'feat', key: 'feat:skilled@xphb', from: 'class:fighter@xphb', choice: pickFeat.id },
    ];
    expect(featureOf(inFeat, [pickFeat, inFeat], held)).toBe(asi);
    expect(featureOf(choice('x', 'class:fighter@xphb'), [], held)).toBeUndefined();
  });
});

describe('book order', () => {
  it('puts other picks first, then spells from cantrips upward', () => {
    const spell = (id: string, filter: string): AnsweredChoice => ({
      id,
      from: 'feat:magic initiate@xphb',
      kind: 'spell',
      count: 1,
      label: '',
      picks: [],
      filter: { type: 'spell', filter },
    });
    const ability: AnsweredChoice = {
      id: 'ability',
      from: 'feat:magic initiate@xphb',
      kind: 'spellAbility',
      count: 1,
      label: '',
      picks: [],
    };
    const list = [
      spell('level1', 'level=1|class=Cleric'),
      ability,
      spell('cantrips', 'level=0|class=Cleric'),
    ];
    expect(inBookOrder(list).map((c) => c.id)).toEqual(['ability', 'cantrips', 'level1']);
  });
});
