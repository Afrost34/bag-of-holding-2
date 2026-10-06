import { describe, expect, it } from 'vitest';
import {
  average,
  evaluate,
  hasD20,
  MissingInputError,
  parse,
  parseAlternatives,
  requiredInputs,
  secureRng,
  sequenceRng,
  DiceSyntaxError,
} from './index';

const roll = (src: string, values: number[], opts: Parameters<typeof evaluate>[1] = {}) =>
  evaluate(parse(src), { rng: sequenceRng(values), ...opts });

describe('parse + evaluate', () => {
  it.each([
    ['1d20 + 5', [14], 19],
    ['d20', [7], 7],
    ['D6', [4], 4],
    ['4d10 + 6', [1, 2, 3, 4], 16],
    ['1d4 - 1', [1], 0],
    ['1d4+1', [3], 4],
    ['2d4 × 10', [2, 3], 50],
    ['6d4 x 100', [1, 1, 1, 1, 1, 1], 600],
    ['3d6 * 5', [1, 2, 3], 30],
    ['2d4 × 1,000', [1, 1], 2000],
    ['(1d6 + 6) × 10', [4], 100],
    ['(1d4 + 1) × 10,000', [1], 20000],
    ['d12 + d8', [5, 3], 8],
    ['5 + 2d10', [10, 10], 25],
    ['10 + 2 + 2 + 5', [], 19],
    ['1d10 × 1d10', [3, 4], 12],
    ['+ 1d6', [6], 6],
    ['1d6 +2', [1], 3],
    ['d%', [42], 42],
    ['4d6kh3', [1, 6, 5, 4], 15],
    ['4d6dl1', [1, 6, 5, 4], 15],
    ['2d20kl1', [17, 3], 3],
    ['1d8 − 1', [5], 4],
  ])('%s', (src, values, total) => {
    expect(roll(src, values).total).toBe(total);
  });

  it('resolves variables case-insensitively', () => {
    const expr = parse('1d8 + 3 + summonSpellLevel');
    expect(requiredInputs(expr).variables).toEqual(['summonSpellLevel']);
    expect(
      roll('1d8 + 3 + summonSpellLevel', [8], { variables: { SUMMONSPELLLEVEL: 4 } }).total,
    ).toBe(15);
    expect(
      roll('(summonSpellLevel - 4)d4 + 3', [2, 2], { variables: { summonSpellLevel: 6 } }).total,
    ).toBe(7);
    expect(roll('1d10 + PB', [5], { variables: { pb: 3 } }).inputs).toEqual({ PB: 3 });
  });

  it('asks for missing variables and prompts', () => {
    expect(() => roll('1d10 + PB', [5])).toThrow(MissingInputError);
    const src = 'ceil(#$prompt_number:title=Enter a Size$# / 5)';
    const expr = parse(src);
    expect(requiredInputs(expr).prompts).toEqual([{ title: 'Enter a Size' }]);
    expect(() => evaluate(expr)).toThrow(MissingInputError);
    expect(evaluate(expr, { prompts: { 'Enter a Size': 12 } }).total).toBe(3);
  });

  it('uses prompt defaults and parses min/max', () => {
    const expr = parse('d20 + #$prompt_number:default=0,min=0,max=5,title=Enter +5 if bribed$#');
    expect(requiredInputs(expr).prompts[0]).toEqual({
      title: 'Enter +5 if bribed',
      default: 0,
      min: 0,
      max: 5,
    });
    expect(evaluate(expr, { rng: sequenceRng([9]) }).total).toBe(9);
  });

  it('splits alternatives', () => {
    expect(parseAlternatives('d6;d8').map((e) => e.source)).toEqual(['d6', 'd8']);
  });

  it('rejects malformed input with a position', () => {
    expect(() => parse('1d')).toThrow(DiceSyntaxError);
    expect(() => parse('2 +')).toThrow(DiceSyntaxError);
    expect(() => parse('(1d6')).toThrow(DiceSyntaxError);
    expect(() => parse('1d6 $')).toThrow(/at 4/);
    expect(() => parse('')).toThrow(DiceSyntaxError);
  });

  it('refuses absurd dice', () => {
    expect(() => roll('5000d6', [])).toThrow(RangeError);
    expect(() => roll('1d0', [])).toThrow(RangeError);
  });
});

describe('advantage and disadvantage', () => {
  it('turns the d20 into 2d20 keep highest / lowest', () => {
    const adv = roll('1d20 + 5', [4, 17], { mode: 'advantage' });
    expect(adv.total).toBe(22);
    expect(adv.terms[0]?.dice).toEqual([
      { value: 4, kept: false },
      { value: 17, kept: true },
    ]);
    expect(adv.breakdown).toBe('1d20 + 5 → [~~4~~, 17] + 5 = 22');
    expect(roll('1d20 + 5', [4, 17], { mode: 'disadvantage' }).total).toBe(9);
  });

  it('leaves rolls without a single d20 unchanged', () => {
    expect(hasD20(parse('2d6 + 3'))).toBe(false);
    expect(hasD20(parse('d20 + 2'))).toBe(true);
    expect(roll('2d6 + 3', [1, 1, 6, 6], { mode: 'advantage' }).total).toBe(5);
  });
});

describe('breakdown and averages', () => {
  it('shows every die', () => {
    expect(roll('2d6 + 1d4 + 3', [1, 6, 2]).breakdown).toBe(
      '2d6 + 1d4 + 3 → [1, 6] + [2] + 3 = 12',
    );
  });

  it('computes averages', () => {
    expect(average(parse('2d8 + 4'))).toBe(13);
    expect(average(parse('4d10 + 6'))).toBe(28);
  });
});

describe('secureRng', () => {
  it('stays in range and covers every face', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = secureRng(6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });
});
