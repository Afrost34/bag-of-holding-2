import { describe, expect, it } from 'vitest';
import {
  backgroundToForm,
  classToForm,
  featToForm,
  formToBackground,
  formToClass,
  formToFeat,
  formToSpecies,
  speciesToForm,
} from './characterOptions';

describe('homebrew feats, backgrounds, species and classes', () => {
  it('writes a feat as 5etools does, and reads it back', () => {
    const form = {
      name: 'Sea Legs',
      category: 'G',
      level: 4,
      prerequisite: '',
      repeatable: false,
      abilityFrom: ['dex' as const, 'con' as const],
      text: 'You never fall on a moving deck.\n\nYou swim at your walking speed.',
    };
    const feat = formToFeat(form, '2024');
    expect(feat).toMatchObject({
      category: 'G',
      edition: 'one',
      prerequisite: [{ level: 4 }],
      ability: [{ choose: { from: ['dex', 'con'], amount: 1 } }],
      entries: ['You never fall on a moving deck.', 'You swim at your walking speed.'],
    });
    expect(featToForm(feat)).toEqual(form);
  });

  it('writes a 2024 background with its abilities, skills and feat', () => {
    const form = {
      name: 'Deckhand',
      skills: ['athletics', 'perception'],
      tool: "navigator's tools",
      languages: 1,
      abilities: ['str' as const, 'dex' as const, 'con' as const],
      feat: 'tough|xphb',
      equipment: '50 feet of rope, 10 GP',
      text: 'You grew up at sea.',
    };
    const bg = formToBackground(form, '2024');
    expect(bg).toMatchObject({
      skillProficiencies: [{ athletics: true, perception: true }],
      toolProficiencies: [{ "navigator's tools": true }],
      languageProficiencies: [{ anyStandard: 1 }],
      feats: [{ 'tough|xphb': true }],
    });
    expect(bg.ability).toEqual([
      { choose: { weighted: { from: ['str', 'dex', 'con'], weights: [2, 1] } } },
      { choose: { weighted: { from: ['str', 'dex', 'con'], weights: [1, 1, 1] } } },
    ]);
    expect(backgroundToForm(bg)).toEqual(form);
  });

  it('writes species with their traits', () => {
    const form = {
      name: 'Tidekin',
      size: 'M' as const,
      speed: 30,
      darkvision: 60,
      traits: [{ name: 'Amphibious', text: 'You can breathe air and water.' }],
    };
    const race = formToSpecies(form, '2014');
    expect(race).toMatchObject({ size: ['M'], darkvision: 60, creatureTypes: ['humanoid'] });
    expect(speciesToForm(race)).toEqual(form);
  });

  it('writes a class and its features in 5etools’ two lists', () => {
    const form = {
      name: 'Corsair',
      hitDie: 10 as const,
      primary: 'dex' as const,
      saves: ['dex' as const, 'cha' as const],
      armor: ['light'],
      weapons: ['simple', 'martial'],
      skillsFrom: ['acrobatics', 'athletics', 'deception'],
      skillCount: 2,
      caster: 'half' as const,
      spellAbility: 'cha' as const,
      spellList: 'Bard',
      subclassTitle: 'Corsair Crew',
      features: [
        { level: 2, name: 'Boarding Action', text: 'Deal 1d6 slashing damage more.' },
        { level: 1, name: 'Sea Dog', text: 'You know ships.' },
      ],
    };
    const { cls, features } = formToClass(form, '2024', 'RS');
    expect(cls).toMatchObject({
      hd: { number: 1, faces: 10 },
      casterProgression: 'artificer',
      spellList: 'Bard',
      classFeatures: ['Sea Dog|Corsair|RS|1', 'Boarding Action|Corsair|RS|2'],
    });
    expect(features[1]).toMatchObject({
      className: 'Corsair',
      classSource: 'RS',
      level: 2,
      entries: ['Deal {@damage 1d6} slashing damage more.'],
    });
    const back = classToForm(cls, features);
    expect(back).toEqual({ ...form, features: [form.features[1], form.features[0]] });
    expect(formToClass({ ...form, caster: 'half' }, '2014', 'RS').cls.casterProgression).toBe(
      '1/2',
    );
  });
});
