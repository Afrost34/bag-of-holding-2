import { describe, expect, it } from 'vitest';
import { arcLayout, dashSegments, dotsAlong } from './lettering';

const round = (n: number) => Math.round(n * 100) / 100;

describe('region lettering', () => {
  it('sets letters in a line, centred, spaced apart', () => {
    expect(arcLayout([10, 10, 10], 5, 0)).toEqual([
      { x: -15, y: 0, angle: 0 },
      { x: 0, y: 0, angle: 0 },
      { x: 15, y: 0, angle: 0 },
    ]);
  });

  it('bends them into an arch or a bowl, turned along it', () => {
    const arch = arcLayout([10, 10, 10], 5, 100);
    // Half a circle of length 40: radius 40/π; the middle letter stays put.
    expect(arch[1]).toEqual({ x: 0, y: 0, angle: 0 });
    const r = 40 / Math.PI;
    expect(round(arch[0]?.x ?? 0)).toBe(round(r * Math.sin(-15 / r)));
    expect(arch[0]?.y).toBeGreaterThan(0);
    expect(arch[2]?.angle).toBeGreaterThan(0);
    const bowl = arcLayout([10, 10, 10], 5, -100);
    expect(bowl[0]?.y).toBeLessThan(0);
    expect(bowl[2]?.angle).toBeLessThan(0);
  });
});

describe('route patterns', () => {
  it('cuts a line into dashes, running on round corners', () => {
    // An L of 10 + 10: dashes of 4, gaps of 2.
    const dashes = dashSegments([0, 0, 10, 0, 10, 10], 4, 2).map((d) => d.map(round));
    expect(dashes).toEqual([
      [0, 0, 4, 0],
      [6, 0, 10, 0],
      [10, 2, 10, 6],
      [10, 8, 10, 10],
    ]);
  });

  it('puts dots at even steps along it', () => {
    expect(dotsAlong([0, 0, 10, 0, 10, 10], 4).map((p) => [round(p.x), round(p.y)])).toEqual([
      [0, 0],
      [4, 0],
      [8, 0],
      [10, 2],
      [10, 6],
      [10, 10],
    ]);
  });
});
