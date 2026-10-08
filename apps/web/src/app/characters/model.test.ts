import { describe, expect, it } from 'vitest';
import {
  newCharacterFile,
  carrying,
  DEFAULT_PREFERENCES,
  levelForXp,
  packItems,
  tableRules,
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

describe('companions', () => {
  it('keeps references to stat blocks and drops broken entries', () => {
    const c = parseCharacter(
      JSON.stringify({
        name: 'Wren',
        decisions: {},
        companions: [{ key: 'monster:owl@xmm', kind: 'familiar', name: 'Hoot' }, { kind: 'mount' }],
      }),
      'w',
      'rust',
    );
    expect(c?.companions).toEqual([{ key: 'monster:owl@xmm', kind: 'familiar', name: 'Hoot' }]);
    expect(c?.campaign).toBe('rust');
    if (c) expect(serializeCharacter(c)).not.toContain('rust');
  });
});

describe('table rules', () => {
  it('turns experience points into levels', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(6500)).toBe(5);
    expect(levelForXp(1_000_000)).toBe(20);
  });

  it('weighs what a character carries under each rule', () => {
    expect(carrying(10, 500, 'off')).toBeNull();
    expect(carrying(10, 140, 'standard')).toMatchObject({ capacity: 150, state: 'fine' });
    expect(carrying(10, 160, 'standard')?.state).toBe('over capacity');
    expect(carrying(10, 60, 'variant')).toMatchObject({ state: 'encumbered', speedPenalty: 10 });
    expect(carrying(10, 110, 'variant')).toMatchObject({
      state: 'heavily encumbered',
      speedPenalty: 20,
    });
  });

  it('follows the campaign, or the character outside campaigns', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      advancement: 'xp' as const,
      encumbrance: 'variant' as const,
    };
    const campaign = {
      rules: {
        advancement: 'milestone' as const,
        encumbrance: 'off' as const,
        optionalClassFeatures: true,
      },
    };
    expect(tableRules({ campaign: 'c', preferences: prefs }, campaign)).toEqual({
      advancement: 'milestone',
      encumbrance: 'off',
      fromCampaign: true,
    });
    expect(tableRules({ preferences: prefs }, undefined)).toMatchObject({
      advancement: 'xp',
      encumbrance: 'variant',
      fromCampaign: false,
    });
  });
});

describe('equipment packs', () => {
  it('unpacks into their contents', () => {
    const pack = {
      packContents: [
        'backpack|phb',
        { item: 'costume clothes|phb', quantity: 2 },
        { special: 'a little bag of sand' },
      ],
    };
    expect(packItems(pack, 2)).toEqual([
      { key: 'item:backpack@phb', quantity: 2 },
      { key: 'item:costume clothes@phb', quantity: 4 },
      { key: '', name: 'a little bag of sand', quantity: 2 },
    ]);
    expect(packItems({ name: 'Rope' })).toBeNull();
  });
});
