import { describe, expect, it } from 'vitest';
import { endFactor, hasSoftEnds, piecesAlong } from './pathEnds';

describe('path ends', () => {
  it('hard ends keep the full width and opacity', () => {
    expect(endFactor(0, 'hard', 'hard')).toEqual({ width: 1, alpha: 1 });
    expect(endFactor(1, 'hard', 'hard')).toEqual({ width: 1, alpha: 1 });
  });

  it('a faded end loses opacity, not width', () => {
    const f = endFactor(0, 'fade', 'hard');
    expect(f.alpha).toBe(0);
    expect(f.width).toBe(1);
    expect(endFactor(0.5, 'fade', 'hard').alpha).toBe(1);
  });

  it('a grown end gains width, not opacity, and each end is its own', () => {
    const start = endFactor(0, 'grow', 'fade');
    expect(start.width).toBeLessThan(0.1);
    expect(start.alpha).toBe(1);
    const end = endFactor(1, 'grow', 'fade');
    expect(end.width).toBe(1);
    expect(end.alpha).toBe(0);
  });

  it('knows when a path has soft ends', () => {
    expect(hasSoftEnds(undefined, undefined)).toBe(false);
    expect(hasSoftEnds('hard', 'grow')).toBe(true);
  });

  it('cuts a line into whole pieces with their place along it', () => {
    const pieces = piecesAlong([0, 0, 100, 0], 25);
    expect(pieces.length).toBeGreaterThanOrEqual(1);
    const line = piecesAlong([0, 0, 10, 0, 20, 0, 30, 0, 40, 0], 15);
    expect(line[0]?.points.slice(0, 2)).toEqual([0, 0]);
    expect(line.at(-1)?.points.slice(-2)).toEqual([40, 0]);
    expect(line.every((p) => p.t >= 0 && p.t <= 1)).toBe(true);
    expect(piecesAlong([5, 5], 10)).toEqual([]);
  });
});
