import { describe, expect, it } from 'vitest';
import { crLabel, isEligibleForm, wildShapeLimits } from './wildShape';

describe('Wild Shape', () => {
  it('follows the 2024 Beast Shapes table and Circle Forms', () => {
    expect(wildShapeLimits(1, '2024')).toBeNull();
    expect(wildShapeLimits(2, '2024')).toEqual({ known: 4, maxCr: 0.25, fly: false, swim: true });
    expect(wildShapeLimits(4, '2024')).toMatchObject({ known: 6, maxCr: 0.5, fly: false });
    expect(wildShapeLimits(8, '2024')).toMatchObject({ known: 8, maxCr: 1, fly: true });
    // Circle of the Moon: druid level / 3 from level 3.
    expect(wildShapeLimits(2, '2024', true)?.maxCr).toBe(0.25);
    expect(wildShapeLimits(3, '2024', true)?.maxCr).toBe(1);
    expect(wildShapeLimits(9, '2024', true)).toMatchObject({ known: 8, maxCr: 3, fly: true });
  });

  it('follows the 2014 tables, with the Moon circle from level 2', () => {
    expect(wildShapeLimits(2, '2014')).toEqual({
      known: null,
      maxCr: 0.25,
      fly: false,
      swim: false,
    });
    expect(wildShapeLimits(4, '2014')).toMatchObject({ maxCr: 0.5, swim: true, fly: false });
    expect(wildShapeLimits(2, '2014', true)?.maxCr).toBe(1);
    expect(wildShapeLimits(6, '2014', true)?.maxCr).toBe(2);
  });

  it('takes Beasts within the limits, not swarms', () => {
    const limits = wildShapeLimits(4, '2024');
    if (!limits) throw new Error('no limits');
    const beast = (name: string, cr: number, speeds = ['Walk']) => ({
      name,
      type: 'Beast',
      cr,
      speeds,
    });
    expect(isEligibleForm(beast('Wolf', 0.25), limits)).toBe(true);
    expect(isEligibleForm(beast('Crocodile', 0.5, ['Walk', 'Swim']), limits)).toBe(true);
    expect(isEligibleForm(beast('Brown Bear', 1), limits)).toBe(false);
    expect(isEligibleForm(beast('Giant Owl', 0.25, ['Walk', 'Fly']), limits)).toBe(false);
    expect(isEligibleForm(beast('Swarm of Rats', 0.25), limits)).toBe(false);
    expect(isEligibleForm({ ...beast('Goblin', 0.25), type: 'Humanoid' }, limits)).toBe(false);
    expect([0.125, 0.25, 0.5, 1, 2].map(crLabel)).toEqual(['1/8', '1/4', '1/2', '1', '2']);
  });
});
