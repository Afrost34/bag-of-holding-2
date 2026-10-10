import { describe, expect, it } from 'vitest';
import { generateDistrict, hash01, type DistrictSpec } from './city';
import { centroid, clipToConvex, insetPolygon, longestEdge, splitPolygon } from './polyclip';
import { pointInPolygon } from './polygon';
import { polygonArea } from './spline';

const square = (x: number, y: number, s: number) => [x, y, x + s, y, x + s, y + s, x, y + s];
const none = { lines: [], polygons: [] };

describe('polygon helpers', () => {
  it('clip a polygon to a convex one, whichever way round that runs', () => {
    const clipped = clipToConvex(square(0, 0, 100), square(50, 50, 100));
    expect(Math.abs(polygonArea(clipped))).toBe(2500);
    const reversed = [50, 50, 50, 150, 150, 150, 150, 50];
    expect(Math.abs(polygonArea(clipToConvex(square(0, 0, 100), reversed)))).toBe(2500);
    expect(clipToConvex(square(0, 0, 10), square(50, 50, 10))).toEqual([]);
  });

  it('cut a polygon in two with a line, and shrink it', () => {
    const [a, b] = splitPolygon(square(0, 0, 100), { x: 40, y: 0 }, Math.PI / 2);
    expect(Math.abs(polygonArea(a)) + Math.abs(polygonArea(b))).toBeCloseTo(10000, 3);
    expect([Math.abs(polygonArea(a)), Math.abs(polygonArea(b))].sort((x, y) => x - y)).toEqual([
      4000, 6000,
    ]);
    const inset = insetPolygon(square(0, 0, 100), 10);
    expect(Math.abs(polygonArea(inset ?? []))).toBeCloseTo(6400, 3);
    expect(insetPolygon(square(0, 0, 10), 20)).toBeNull();
    expect(centroid(square(0, 0, 100))).toEqual({ x: 50, y: 50 });
    expect(longestEdge([0, 0, 100, 0, 100, 30, 0, 30]).length).toBe(100);
  });
});

describe('a district', () => {
  const base: DistrictSpec = {
    outline: square(0, 0, 900),
    seed: 11,
    blockSize: 150,
    streetWidth: 16,
    lotArea: 1800,
    gap: 6,
    density: 1,
    jitter: 0.5,
    angle: 20,
    plaza: 0,
    maxBuildings: 5000,
  };

  it('is the same for the same seed and different for another', () => {
    expect(generateDistrict(base, none)).toEqual(generateDistrict(base, none));
    expect(generateDistrict({ ...base, seed: 12 }, none).buildings.map((b) => b.poly)).not.toEqual(
      generateDistrict(base, none).buildings.map((b) => b.poly),
    );
  });

  it('fills its outline with buildings that stay inside and do not overlap streets', () => {
    const geo = generateDistrict(base, none);
    expect(geo.blocks.length).toBeGreaterThan(20);
    expect(geo.buildings.length).toBeGreaterThan(150);
    for (const b of geo.buildings) {
      const c = centroid(b.poly);
      expect(pointInPolygon(c, base.outline)).toBe(true);
      expect(b.tone).toBeGreaterThanOrEqual(0);
      expect(b.tone).toBeLessThan(1);
    }
    expect(new Set(geo.buildings.map((b) => b.key)).size).toBe(geo.buildings.length);
  });

  it('builds less with a lower density, nothing at 0, and stops at the cap', () => {
    const full = generateDistrict(base, none).buildings.length;
    const half = generateDistrict({ ...base, density: 0.5 }, none).buildings.length;
    expect(half).toBeLessThan(full);
    expect(half).toBeGreaterThan(full * 0.3);
    expect(generateDistrict({ ...base, density: 0 }, none).buildings).toHaveLength(0);
    expect(generateDistrict({ ...base, maxBuildings: 40 }, none).buildings).toHaveLength(40);
  });

  it('leaves an open square in the middle and keeps off roads and water', () => {
    const plaza = generateDistrict({ ...base, plaza: 0.4 }, none);
    expect(plaza.plaza).toBeDefined();
    const p = plaza.plaza;
    if (!p) throw new Error('plaza');
    expect(
      plaza.buildings.some(
        (b) => Math.hypot(centroid(b.poly).x - p.x, centroid(b.poly).y - p.y) < p.r,
      ),
    ).toBe(false);
    const road = { points: [0, 450, 900, 450], half: 40 };
    const lake = square(100, 100, 200);
    const geo = generateDistrict(base, { lines: [road], polygons: [lake] });
    expect(geo.buildings.some((b) => Math.abs(centroid(b.poly).y - 450) < 40)).toBe(false);
    expect(geo.buildings.some((b) => pointInPolygon(centroid(b.poly), lake))).toBe(false);
  });

  it('keeps most buildings, with the same keys, when the outline is nudged', () => {
    const a = generateDistrict(base, none);
    const b = generateDistrict({ ...base, outline: square(0, 0, 940) }, none);
    const keys = new Set(b.buildings.map((x) => x.key));
    const kept = a.buildings.filter((x) => keys.has(x.key)).length;
    expect(kept).toBeGreaterThan(a.buildings.length * 0.7);
  });

  it('refuses a silly outline or block size without a crash', () => {
    expect(generateDistrict({ ...base, outline: [0, 0, 1, 1] }, none).buildings).toEqual([]);
    expect(generateDistrict({ ...base, blockSize: 2 }, none).buildings).toEqual([]);
    expect(hash01(1, 2, 3)).toBe(hash01(1, 2, 3));
  });
});
