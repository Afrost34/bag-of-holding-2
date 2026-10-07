import { describe, expect, it } from 'vitest';
import {
  attackText,
  averageOf,
  creatureToForm,
  emptyCreature,
  formToCreature,
  passivePerception,
} from './creatures';

const goblin = {
  ...emptyCreature('Rust Goblin'),
  size: 'S' as const,
  typeTags: 'goblinoid',
  alignment: 'Neutral Evil',
  ac: 15,
  acFrom: 'leather armor, shield',
  hpFormula: '2d6',
  scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  saves: ['dex' as const],
  skills: { stealth: 2 as const, perception: 1 as const },
  senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
  languages: 'Common, Goblin',
  traits: [{ name: 'Nimble Escape', text: 'It can Disengage or Hide as a bonus action.' }],
  actions: [
    {
      name: 'Scimitar',
      text: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
    },
  ],
};

describe('creature arithmetic', () => {
  it('averages dice like a statblock', () => {
    expect(averageOf('2d6')).toBe(7);
    expect(averageOf('4d8 + 4')).toBe(22);
    expect(averageOf('1d10 - 1')).toBe(4);
    expect(averageOf('lots')).toBeNull();
  });

  it('works out saves, skills, senses and hit points', () => {
    const c = formToCreature(goblin, '2014');
    expect(c).toMatchObject({
      size: ['S'],
      type: { type: 'humanoid', tags: ['goblinoid'] },
      alignment: ['N', 'E'],
      ac: [{ ac: 15, from: ['leather armor', 'shield'] }],
      hp: { average: 7, formula: '2d6' },
      save: { dex: '+4' },
      skill: { stealth: '+6', perception: '+1' },
      senses: ['darkvision 60 ft.'],
      passive: 11,
      languages: ['Common', 'Goblin'],
      cr: '1/4',
    });
    expect(passivePerception(goblin)).toBe(11);
    expect(c.action).toEqual([
      {
        name: 'Scimitar',
        entries: [
          '{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) slashing damage.',
        ],
      },
    ]);
  });

  it('writes attacks in each edition’s words', () => {
    const spec = {
      kind: 'melee' as const,
      ability: 'dex' as const,
      reach: '5',
      range: '',
      damage: '1d6',
      damageType: 'slashing',
      extraDamage: '',
      extraType: '',
    };
    expect(attackText(goblin, spec, '2014')).toBe(
      'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
    );
    expect(
      attackText(
        goblin,
        { ...spec, kind: 'both', range: '20/60', extraDamage: '1d4', extraType: 'poison' },
        '2024',
      ),
    ).toBe(
      'Melee or Ranged Attack Roll: +4, reach 5 ft. or range 20/60 ft. Hit: 5 (1d6 + 2) Slashing damage plus 2 (1d4) Poison damage.',
    );
  });

  it('round-trips a creature through the form, keeping other fields', () => {
    const made = {
      ...formToCreature(goblin, '2014'),
      source: 'RS',
      page: 12,
      environment: ['urban'],
    };
    const form = creatureToForm(made);
    expect(form).toMatchObject({
      size: 'S',
      typeTags: 'goblinoid',
      alignment: 'Neutral Evil',
      skills: { stealth: 2, perception: 1 },
      saves: ['dex'],
      actions: goblin.actions,
    });
    expect(formToCreature(form, '2014', made)).toEqual(made);
  });

  it('adds spellcasting with its DC and attack bonus', () => {
    const c = formToCreature(
      {
        ...goblin,
        scores: { ...goblin.scores, int: 16 },
        spellcasting: {
          on: true,
          ability: 'int',
          atWill: 'Mage Hand, Minor Illusion',
          perDay: { 1: 'Fireball', 2: '', 3: '' },
        },
      },
      '2024',
    );
    expect(c.spellcasting).toEqual([
      {
        type: 'spellcasting',
        name: 'Spellcasting',
        headerEntries: [
          'Rust Goblin casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save {@dc 13}, {@hit 5} to hit with spell attacks):',
        ],
        will: ['{@spell mage hand}', '{@spell minor illusion}'],
        daily: { '1e': ['{@spell fireball}'] },
        ability: 'int',
        displayAs: 'action',
      },
    ]);
  });
});
