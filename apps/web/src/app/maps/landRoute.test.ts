import { describe, expect, it } from 'vitest';
import { encodeHeights, heightAt, heightsOf, type Elevation } from './elevation';
import { routeOverLand, thinLine } from './landRoute';

const W = 60;
const H = 40;
const CELL = 10;

/** An elevation of W×H cells from a height function (cell coordinates). */
function land(height: (x: number, y: number) => number): Elevation {
  const heights = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) heights[y * W + x] = Math.max(0, Math.min(255, height(x, y)));
  return {
    w: W,
    h: H,
    cell: CELL,
    data: encodeHeights(heights),
    sea: 60,
    strength: 0.5,
    tint: false,
  };
}

const pairs = (flat: readonly number[]) => {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i] ?? 0, y: flat[i + 1] ?? 0 });
  return out;
};

/** Every point along a polyline, a pixel apart. */
function along(flat: readonly number[]): { x: number; y: number }[] {
  const pts = pairs(flat);
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) continue;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let k = 0; k <= n; k++)
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

const FROM_TO = [25, 205, 575, 205];

describe('roads that follow the land', () => {
  it('run straight over flat ground', () => {
    expect(
      routeOverLand(
        land(() => 120),
        FROM_TO,
      ),
    ).toEqual(FROM_TO);
  });

  it('go round a hill rather than over it', () => {
    // A steep round hill in the middle of the way.
    const e = land((x, y) => 120 + Math.max(0, 130 - 14 * Math.hypot(x - 30, y - 20)));
    const road = routeOverLand(e, FROM_TO);
    expect(road.slice(0, 2)).toEqual(FROM_TO.slice(0, 2));
    expect(road.slice(-2)).toEqual(FROM_TO.slice(2));
    const heights = heightsOf(e);
    const highest = Math.max(...along(road).map((p) => heightAt(e, heights, p.x, p.y)));
    expect(highest).toBeLessThan(180);
    // Caring nothing for the climb, it goes straight over the top.
    expect(routeOverLand(e, FROM_TO, { climb: 0, maxSlope: 1 })).toEqual(FROM_TO);
  });

  it('take the pass through a wall of cliffs', () => {
    // A ridge across the map, a sheer wall, with a gap near the bottom.
    const e = land((x, y) => (x >= 29 && x <= 31 && !(y >= 32 && y <= 35) ? 250 : 120));
    const road = routeOverLand(e, [100, 50, 500, 50]);
    const through = along(road).filter((p) => p.x >= 290 && p.x <= 320);
    expect(through.length).toBeGreaterThan(0);
    for (const p of through) expect(p.y).toBeGreaterThanOrEqual(310);
  });

  it('keep out of the sea, and stay straight when there is no way across', () => {
    // A bay in the middle of the way: the road goes round it.
    const bay = land((x, y) => (Math.hypot(x - 30, y - 12) < 10 ? 20 : 120));
    const heights = heightsOf(bay);
    const road = routeOverLand(bay, [100, 120, 500, 120]);
    for (const p of along(road)) expect(heightAt(bay, heights, p.x, p.y)).toBeGreaterThan(60);
    // The sea cuts the map in two: no way, so the stretch stays as drawn.
    const strait = land((x) => (x >= 28 && x <= 32 ? 20 : 120));
    expect(routeOverLand(strait, FROM_TO)).toEqual(FROM_TO);
  });

  it('keep every clicked point', () => {
    const e = land((x, y) => 120 + Math.max(0, 130 - 14 * Math.hypot(x - 30, y - 20)));
    const clicks = [25, 25, 300, 380, 575, 25];
    const road = pairs(routeOverLand(e, clicks));
    for (const c of pairs(clicks)) expect(road).toContainEqual(c);
  });
});

describe('thinning a line', () => {
  it('keeps only the turning points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0.1 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 5 },
    ];
    expect(thinLine(pts, 0.5)).toEqual([pts[0], pts[3], pts[4]]);
    expect(thinLine(pts.slice(0, 2), 0.5)).toEqual(pts.slice(0, 2));
  });
});
