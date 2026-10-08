import { describe, expect, it } from 'vitest';
import { densify, eraseStroke } from './geometry';

describe('the eraser', () => {
  it('adds points along long segments', () => {
    expect(densify([0, 0, 10, 0], 4).map((v) => Math.round(v * 100) / 100)).toEqual([
      0, 0, 3.33, 0, 6.67, 0, 10, 0,
    ]);
  });

  it('cuts a stroke in two where it passes, and leaves others alone', () => {
    const line = [0, 0, 100, 0];
    const runs = eraseStroke(line, [50, -20, 50, 20], 5);
    expect(runs).toHaveLength(2);
    const [left, right] = runs;
    expect(Math.max(...(left ?? []).filter((_, i) => i % 2 === 0))).toBeLessThan(46);
    expect(Math.min(...(right ?? []).filter((_, i) => i % 2 === 0))).toBeGreaterThan(54);
    expect(eraseStroke(line, [50, 30, 60, 30], 5)).toEqual([line]);
  });

  it('removes a stroke it covers', () => {
    expect(eraseStroke([0, 0, 4, 0], [2, 0], 10)).toEqual([]);
  });
});
