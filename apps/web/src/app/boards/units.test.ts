import { describe, expect, it } from 'vitest';
import { convert, round, toFeet } from './units';

const as = (value: number, unit: Parameters<typeof convert>[1]) =>
  Object.fromEntries(convert(value, unit).map((c) => [c.unit, c]));

describe('distance units', () => {
  it('converts the table way: 5 feet a square, 1.5 metres a square', () => {
    const thirty = as(30, 'ft');
    expect(thirty.sq?.value).toBe(6);
    expect(thirty.m).toEqual({ unit: 'm', value: 9, exact: 9.14 });
    expect(as(9, 'm').ft?.value).toBe(30);
    expect(as(6, 'sq').ft?.value).toBe(30);
    expect(as(3, 'sq').m?.value).toBe(4.5);
  });

  it('handles long distances', () => {
    expect(as(1, 'mi').km?.value).toBe(1.61);
    expect(as(10, 'km').mi?.value).toBe(6.21);
    expect(toFeet(1, 'mi')).toBe(5280);
    expect(round(1234.56)).toBe(1235);
  });
});
