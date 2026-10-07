import { describe, expect, it } from 'vitest';
import {
  appliesTo,
  applyProperties,
  createSpecificVariant,
  evaluateExpression,
  generateSpecificVariants,
  isEditionMatch,
  SPECIFIC_VARIANT_FLAG,
} from './itemVariants';

const longsword = {
  name: 'Longsword',
  source: 'PHB',
  edition: 'classic',
  page: 149,
  type: 'M',
  weapon: true,
  sword: true,
  dmg1: '1d8',
  dmgType: 'S',
  property: ['V'],
  value: 1500,
  weight: 3,
};

const plusOne = {
  name: '+1 Weapon',
  source: 'DMG',
  edition: 'classic',
  requires: [{ weapon: true }],
  excludes: { net: true },
  inherits: {
    namePrefix: '+1 ',
    source: 'DMG',
    page: 213,
    rarity: 'uncommon',
    bonusWeapon: '+1',
    entries: [
      'You have a {=bonusWeapon} bonus to attack and damage rolls made with this magic weapon.',
    ],
  },
};

describe('specific item variants', () => {
  it('fills property templates with modifiers', () => {
    const values = { baseName: 'Longsword', bonusAc: '+2' };
    expect(applyProperties('a {=baseName/l} with {=bonusAc}', values)).toBe('a longsword with +2');
    expect(applyProperties('{=baseName/a} {=baseName/l}', { baseName: 'Axe' })).toBe('an axe');
    expect(applyProperties('{@item {=baseName}|phb}', values)).toBe('{@item Longsword|phb}');
  });

  it('follows the 5etools edition table', () => {
    const v = (edition?: string) => (edition ? { edition } : {});
    expect(isEditionMatch(v(), v())).toBe(true);
    expect(isEditionMatch(v('classic'), v())).toBe(false);
    expect(isEditionMatch(v('one'), v())).toBe(true);
    expect(isEditionMatch(v('classic'), v('classic'))).toBe(true);
    expect(isEditionMatch(v('one'), v('classic'))).toBe(false);
    expect(isEditionMatch(v(), v('one'))).toBe(true);
    expect(isEditionMatch(v('classic'), v('one'))).toBe(false);
  });

  it('applies requires and excludes', () => {
    expect(appliesTo(longsword, plusOne)).toBe(true);
    expect(appliesTo({ ...longsword, net: true }, plusOne)).toBe(false);
    expect(appliesTo({ ...longsword, weapon: undefined }, plusOne)).toBe(false);
    const swordsOnly = { ...plusOne, requires: [{ sword: true }], excludes: { property: ['2H'] } };
    expect(appliesTo(longsword, swordsOnly)).toBe(true);
    expect(appliesTo({ ...longsword, property: ['2H', 'H'] }, swordsOnly)).toBe(false);
    expect(appliesTo({ ...longsword, packContents: [] }, plusOne)).toBe(false);
  });

  it('creates the specific item from base and variant', () => {
    const item = createSpecificVariant(longsword, plusOne);
    expect(item).toMatchObject({
      name: '+1 Longsword',
      source: 'DMG',
      page: 213,
      rarity: 'uncommon',
      dmg1: '1d8',
      baseItem: 'Longsword|PHB',
      genericVariant: { name: '+1 Weapon', source: 'DMG' },
      [SPECIFIC_VARIANT_FLAG]: true,
    });
    expect(item.entries).toEqual([
      'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
    ]);
    // Magic items never keep the mundane value.
    expect(item.value).toBeUndefined();
    expect(
      generateSpecificVariants([longsword, { ...longsword, name: 'Net', net: true }], [plusOne]),
    ).toHaveLength(1);
  });

  it('evaluates value and weight expressions safely', () => {
    expect(evaluateExpression('[[baseItem.value]] * 4', { value: 1500 }, {})).toBe(6000);
    expect(evaluateExpression('[[baseItem.value]] + 50000', { value: 10 }, {})).toBe(50010);
    expect(evaluateExpression('([[baseItem.weight]] + 1) * 2', { weight: 3 }, {})).toBe(8);
    expect(evaluateExpression('[[baseItem.value]] * 2', {}, {})).toBeNull();
    expect(evaluateExpression('alert(1)', {}, {})).toBeNull();
  });
});
