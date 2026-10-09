import { describe, expect, it } from 'vitest';
import { measurePath, measurePoint } from './measure';
import type { Grid } from './model';

const grid: Grid = { type: 'square', size: 50, offsetX: 0, offsetY: 0, feet: 5, opacity: 1 };

describe('measuring a path', () => {
  it('adds up every leg, in feet on a grid', () => {
    const at = (x: number, y: number) => measurePoint({ x, y }, { grid });
    expect(at(60, 70)).toEqual({ x: 75, y: 75 });
    expect(measurePath([at(10, 10)], { grid })).toBeNull();
    // 3 cells right, then 2 cells down: 15 + 10 ft.
    expect(measurePath([at(10, 10), at(160, 10), at(160, 110)], { grid })).toBe('25 ft');
  });

  it('says how far and how long on a map with a scale', () => {
    const basis = {
      grid: { ...grid, type: 'none' as const },
      scale: { unit: 'km' as const, perPixel: 10 },
      travel: [{ name: 'Skiff', perDay: 100 }],
    };
    expect(measurePoint({ x: 3, y: 4 }, basis)).toEqual({ x: 3, y: 4 });
    expect(
      measurePath(
        [
          { x: 0, y: 0 },
          { x: 3, y: 4 },
          { x: 3, y: 14 },
        ],
        basis,
      ),
    ).toBe('150 km · Skiff: 1.5 days');
  });
});
