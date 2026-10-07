import { describe, expect, it } from 'vitest';
import { abilityText } from './speciesFacts';

describe('species facts', () => {
  it('describes fixed and chosen ability increases', () => {
    expect(abilityText([{ dex: 2 }])).toBe('Dexterity +2');
    expect(abilityText([{ str: 2, cha: 1 }])).toBe('Strength +2, Charisma +1');
    expect(abilityText([{ cha: 2, choose: { from: ['str', 'dex'], count: 2 } }])).toBe(
      'Charisma +2, +1 to 2 of Strength, Dexterity',
    );
    expect(
      abilityText([
        {
          choose: {
            weighted: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], weights: [2, 1] },
          },
        },
      ]),
    ).toBe('+2 and +1 to different abilities');
    expect(abilityText([{ str: 2 }, { dex: 2 }])).toBe('Strength +2; or Dexterity +2');
    expect(abilityText(undefined)).toBe('');
  });
});
