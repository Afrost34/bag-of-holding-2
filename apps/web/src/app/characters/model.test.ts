import { describe, expect, it } from 'vitest';
import {
  newCharacterFile,
  parseCharacter,
  addCoins,
  coinsFromCopper,
  pointsSpent,
  rollAbility,
  serializeCharacter,
  summaryLine,
  usesPool,
  STANDARD_ARRAY,
} from './model';

describe('character files', () => {
  it('round-trips a new character', () => {
    const c = newCharacterFile('  Glubs ', '2024', [], '2026-10-07T00:00:00Z', () => 0.5);
    expect(c).toMatchObject({ name: 'Glubs', abilityMethod: 'standard', summary: '' });
    expect(c.decisions).toMatchObject({ edition: '2024', classes: [], choices: {} });
    expect(parseCharacter(serializeCharacter(c), c.id)).toEqual(c);
  });

  it('reads damaged or older files safely', () => {
    expect(parseCharacter('not json', 'x')).toBeNull();
    expect(parseCharacter('{"name":"A"}', 'x')).toBeNull();
    const c = parseCharacter(
      '{"name":"A","decisions":{"edition":"2014","baseScores":{"str":17}}}',
      'x',
    );
    expect(c?.decisions.baseScores).toEqual({
      str: 17,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    });
    expect(c?.decisions.edition).toBe('2014');
  });
});

describe('ability scores', () => {
  it('counts point buy', () => {
    expect(pointsSpent({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(27);
    expect(pointsSpent({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBeGreaterThan(27);
  });

  it('checks that the standard array is used once each', () => {
    expect(usesPool({ str: 8, dex: 15, con: 14, int: 13, wis: 12, cha: 10 }, STANDARD_ARRAY)).toBe(
      true,
    );
    expect(usesPool({ str: 15, dex: 15, con: 14, int: 13, wis: 12, cha: 10 }, STANDARD_ARRAY)).toBe(
      false,
    );
  });

  it('rolls 4d6 and drops the lowest', () => {
    const dice = [1, 6, 4, 5];
    expect(rollAbility(() => dice.shift() ?? 1)).toBe(15);
  });
});

describe('summary line', () => {
  it('describes a character', () => {
    expect(summaryLine(3, 'Goblin', [{ name: 'Bard', levels: 3 }])).toBe('Level 3 Goblin Bard');
    expect(
      summaryLine(5, undefined, [
        { name: 'Fighter', levels: 3 },
        { name: 'Wizard', levels: 2 },
      ]),
    ).toBe('Level 5 Fighter 3 / Wizard 2');
    expect(summaryLine(0, undefined, [])).toBe('Not built yet');
  });
});

describe('coins', () => {
  it('turns copper into the fewest coins and adds purses', () => {
    expect(coinsFromCopper(1925)).toEqual({ pp: 0, gp: 19, ep: 0, sp: 2, cp: 5 });
    expect(addCoins(coinsFromCopper(100), coinsFromCopper(1500)).gp).toBe(16);
  });
});
