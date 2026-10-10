import { describe, expect, it } from 'vitest';
import { generateArchipelago, generateIsland, islandSize } from './islandgen';
import {
  growPolygon,
  nearestOnPolyline,
  offsetLine,
  pointAlong,
  polygonArea,
  polylineLength,
  ribbon,
  splinePoints,
} from './spline';

const square = [0, 0, 100, 0, 100, 100, 0, 100];

describe('splines', () => {
  it('keep the control points when not smooth, and round the corners when smooth', () => {
    expect(splinePoints(square, true, 0)).toEqual(square);
    const round = splinePoints(square, true, 1);
    expect(round.length).toBeGreaterThan(square.length * 4);
    // The curve passes through the control points.
    expect(round.slice(0, 2)).toEqual([0, 0]);
    // An open line ends where it ends.
    const open = splinePoints([0, 0, 50, 40, 100, 0], false, 1);
    expect(open.slice(-2)).toEqual([100, 0]);
  });

  it('measure a line and find the nearest point of it', () => {
    expect(polylineLength([0, 0, 30, 40])).toBe(50);
    expect(polylineLength(square, true)).toBe(400);
    const near = nearestOnPolyline([0, 0, 100, 0], { x: 40, y: 30 });
    expect([near.x, near.y, near.dist, near.t]).toEqual([40, 0, 30, 0.4]);
    const mid = pointAlong([0, 0, 100, 0], 25);
    expect([mid.x, mid.y, mid.angle]).toEqual([25, 0, 0]);
  });

  it('offset a closed shape outward and make a ribbon that widens', () => {
    expect(Math.abs(polygonArea(square))).toBe(10000);
    expect(Math.abs(polygonArea(growPolygon(square, 10)))).toBeGreaterThan(10000);
    expect(Math.abs(polygonArea(growPolygon(square, -10)))).toBeLessThan(10000);
    // Whichever way it was drawn.
    const reversed = [0, 100, 100, 100, 100, 0, 0, 0];
    expect(Math.abs(polygonArea(growPolygon(reversed, 10)))).toBeGreaterThan(10000);
    expect(offsetLine([0, 0, 100, 0], 10, false)).toEqual([0, 10, 100, 10]);
    const river = ribbon([0, 0, 100, 0], (t) => 10 + t * 30);
    // Left side: (0,5) → (100,20); right side back: (100,-20) → (0,-5).
    expect(river).toEqual([0, 5, 100, 20, 100, -20, 0, -5]);
  });
});

describe('islands', () => {
  const base = { x: 500, y: 500, radius: 200, seed: 7, ruggedness: 0.5, elongation: 0.2 };

  it('are the same for the same seed and differ for another', () => {
    expect(generateIsland(base)).toEqual(generateIsland(base));
    expect(generateIsland({ ...base, seed: 8 })).not.toEqual(generateIsland(base));
  });

  it('stay around their centre and size, rougher ones with more points', () => {
    const calm = islandSize(generateIsland({ ...base, ruggedness: 0 }));
    const rough = islandSize(generateIsland({ ...base, ruggedness: 1 }));
    expect(rough.points).toBeGreaterThan(calm.points);
    expect(calm.width).toBeGreaterThan(150);
    expect(calm.width).toBeLessThan(900);
  });

  it('come as an archipelago whose islands do not overlap', () => {
    const many = generateArchipelago({ ...base, count: 5 });
    expect(many.length).toBeGreaterThan(1);
    expect(many.length).toBeLessThanOrEqual(5);
    const [first, ...rest] = many.map(islandSize);
    for (const r of rest) expect(r.area).toBeLessThan(first?.area ?? 0);
  });
});
