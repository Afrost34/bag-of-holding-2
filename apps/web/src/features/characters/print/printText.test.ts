import { describe, expect, it } from 'vitest';
import { pageRows, shortCast, shortRange } from './printText';

describe('pageRows', () => {
  it('fills the first page, then the next ones', () => {
    expect(pageRows([1, 2, 3, 4, 5, 6], 2, 3)).toEqual([[1, 2], [3, 4, 5], [6]]);
    expect(pageRows([], 2, 3)).toEqual([[]]);
    expect(pageRows([1, 2], 2, 3)).toEqual([[1, 2]]);
  });
});

describe('spell table cells', () => {
  it('shortens casting times and ranges', () => {
    expect(
      shortCast({
        time: [
          { number: 1, unit: 'bonus', condition: 'which you take after hitting {@variantrule X}' },
        ],
      }),
    ).toBe('Bonus action');
    expect(shortCast({ time: [{ number: 1, unit: 'reaction' }] })).toBe('Reaction');
    expect(shortCast({ time: [{ number: 10, unit: 'minute' }] })).toBe('10 minutes');
    expect(shortRange({ range: { type: 'point', distance: { type: 'feet', amount: 120 } } })).toBe(
      '120 feet',
    );
    expect(shortRange({ range: { type: 'point', distance: { type: 'self' } } })).toBe('Self');
    expect(shortRange({ range: { type: 'radius', distance: { type: 'feet', amount: 10 } } })).toBe(
      '10 feet',
    );
  });
});
