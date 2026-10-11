import { describe, expect, it } from 'vitest';
import { polygonArea } from './spline';
import { fitRoofTexture, roofPlanes } from './roofPlanes';

const rect = (w: number, h: number) => [0, 0, w, 0, w, h, 0, h];

describe('roof planes', () => {
  it('splits a gabled roof along the ridge, each half sloping away from it', () => {
    const planes = roofPlanes(rect(200, 100), true);
    expect(planes).toHaveLength(2);
    // The ridge runs along the long side (x), through the middle (y = 50).
    const [a, b] = planes;
    expect(a?.down.y).toBeCloseTo(-(b?.down.y ?? 0));
    expect(Math.abs(a?.down.x ?? 1)).toBeCloseTo(0);
    expect(a?.depth).toBeCloseTo(50);
    expect(b?.depth).toBeCloseTo(50);
    const total = planes.reduce((n, p) => n + Math.abs(polygonArea(p.poly)), 0);
    expect(total).toBeCloseTo(200 * 100);
  });

  it('makes one slope of a flat roof, from its far edge to the near one', () => {
    const planes = roofPlanes(rect(200, 100), false);
    expect(planes).toHaveLength(1);
    expect(planes[0]?.depth).toBeCloseTo(100);
  });

  it('has no roof for less than a triangle', () => {
    expect(roofPlanes([0, 0, 5, 5], true)).toEqual([]);
  });
});

describe('a roof texture on a slope', () => {
  const plane = { poly: rect(200, 50), origin: { x: 0, y: 50 }, down: { x: 0, y: 1 }, depth: 50 };

  it('fits a whole number of rows from the ridge to the eave', () => {
    const fit = fitRoofTexture(plane, 800, 20);
    expect(fit.rows).toBe(3);
    // 800 pixels of tile times the scale, times the rows, is the slope's depth.
    expect(Math.hypot(fit.c, fit.d) * 800 * fit.rows).toBeCloseTo(50);
  });

  it('keeps the tile of a shallow slope at its own size, hem on the eave', () => {
    const fit = fitRoofTexture(plane, 800, 500);
    expect(fit.rows).toBe(1);
    // The tile is 500 pixels high on the map; the slope only 50 deep, so it is not squeezed.
    expect(Math.hypot(fit.c, fit.d) * 800).toBeCloseTo(500);
    // Its bottom (800 pixels down) lands on the eave, 50 below the ridge.
    expect(fit.ty + fit.d * 800).toBeCloseTo(plane.origin.y + 50);
    expect(Math.hypot(fit.a, fit.b)).toBeCloseTo(Math.hypot(fit.c, fit.d));
  });

  it('turns the picture so its bottom faces the eave', () => {
    // Down on the screen: the picture's own down (y) maps to the slope's down.
    const south = fitRoofTexture(plane, 800, 50);
    expect(south.d).toBeGreaterThan(0);
    expect(south.c).toBeCloseTo(0);
    // A slope that falls to the east: the picture's down points east.
    const east = fitRoofTexture({ ...plane, down: { x: 1, y: 0 } }, 800, 50);
    expect(east.c).toBeGreaterThan(0);
    expect(east.d).toBeCloseTo(0);
    // The picture is turned, never mirrored.
    expect(east.a * east.d - east.b * east.c).toBeGreaterThan(0);
  });
});
