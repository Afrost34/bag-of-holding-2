import { describe, expect, it } from 'vitest';
import { ordinal, signed, titleWords } from './format';

describe('text formats', () => {
  it('signs bonuses, orders numbers and capitalises words', () => {
    expect([signed(2), signed(0), signed(-1)]).toEqual(['+2', '+0', '-1']);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st',
    ]); // prettier-ignore
    expect(titleWords('sleight of hand')).toBe('Sleight Of Hand');
  });
});
