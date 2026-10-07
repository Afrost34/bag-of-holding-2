import { describe, expect, it } from 'vitest';
import { crOf, encounterDifficulty, encounterMultiplier, xpForCr } from './encounter';

describe('encounter difficulty', () => {
  it('reads challenge ratings as 5etools writes them', () => {
    expect(crOf('1/4')).toBe('1/4');
    expect(crOf({ cr: '10', lair: '11' })).toBe('10');
    expect(xpForCr('1/4')).toBe(50);
    expect(xpForCr({ cr: '5' })).toBe(1800);
    expect(xpForCr(undefined)).toBe(0);
  });

  it('uses the 2014 multipliers, shifted for small and large parties', () => {
    expect(encounterMultiplier(1, 4)).toBe(1);
    expect(encounterMultiplier(2, 4)).toBe(1.5);
    expect(encounterMultiplier(4, 4)).toBe(2);
    expect(encounterMultiplier(8, 4)).toBe(2.5);
    expect(encounterMultiplier(12, 4)).toBe(3);
    expect(encounterMultiplier(15, 4)).toBe(4);
    expect(encounterMultiplier(1, 2)).toBe(1.5);
    expect(encounterMultiplier(15, 2)).toBe(5);
    expect(encounterMultiplier(1, 6)).toBe(0.5);
  });

  it('rates the DMG 2014 example: four 3rd-level characters against a bugbear and three hobgoblins', () => {
    // Bugbear CR 1 (200) + 3 hobgoblins CR 1/2 (100 each) = 500 XP × 2 = 1000: deadly is 1600, hard 900.
    const d = encounterDifficulty(['1', '1/2', '1/2', '1/2'], [3, 3, 3, 3], '2014');
    expect(d.baseXp).toBe(500);
    expect(d.multiplier).toBe(2);
    expect(d.xp).toBe(1000);
    expect(d.bands.map((b) => b.xp)).toEqual([300, 600, 900, 1600]);
    expect(d.rating).toBe('Hard');
    expect(d.xpPerCharacter).toBe(125);
  });

  it('uses the 2024 budget without multipliers', () => {
    // Four 5th-level characters: low 2000, moderate 3000, high 4400.
    const d = encounterDifficulty(['5', '1', '1'], [5, 5, 5, 5], '2024');
    expect(d.bands.map((b) => [b.label, b.xp])).toEqual([
      ['Low', 2000],
      ['Moderate', 3000],
      ['High', 4400],
    ]);
    expect(d.xp).toBe(2200);
    expect(d.rating).toBe('Low');
    expect(encounterDifficulty(['1/8'], [5], '2024').rating).toBe('Trivial');
  });
});
