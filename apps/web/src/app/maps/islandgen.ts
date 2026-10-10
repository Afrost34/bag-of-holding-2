import { seeded } from './terrain';
import { bounds, countPoints, polygonArea } from './spline';

/**
 * A random island, as control points of a closed shape: a circle whose radius is pushed in and
 * out by smooth noise (coarse swells and, with ruggedness, finer bays and headlands), stretched
 * and turned. The same seed always gives the same island.
 */

export interface IslandOptions {
  x: number;
  y: number;
  /** Mean radius in map pixels. */
  radius: number;
  seed: number;
  /** 0 smooth blob, 1 jagged coast with bays. */
  ruggedness: number;
  /** 0 round, 1 long and thin. */
  elongation: number;
}

/** One octave of smooth periodic noise sampled at `t` in 0–1 (cosine-interpolated values). */
function octave(values: readonly number[], t: number): number {
  const n = values.length;
  const x = t * n;
  const i = Math.floor(x) % n;
  const j = (i + 1) % n;
  const f = x - Math.floor(x);
  const u = (1 - Math.cos(f * Math.PI)) / 2;
  return (values[i] ?? 0) * (1 - u) + (values[j] ?? 0) * u;
}

export function generateIsland(o: IslandOptions): number[] {
  const rand = seeded(o.seed);
  const points = 40 + Math.round(o.ruggedness * 24);
  // Octaves of growing frequency: the finer ones count for more as ruggedness rises.
  const octaves = [3, 6, 12, 24].map((count, k) => ({
    values: Array.from({ length: count }, () => rand() * 2 - 1),
    weight: k === 0 ? 0.32 : 0.32 * o.ruggedness * 0.55 ** (k - 1) + (k === 1 ? 0.06 : 0),
  }));
  const stretch = 1 + o.elongation * 1.6;
  const turn = rand() * Math.PI;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / points;
    const angle = t * Math.PI * 2;
    let r = 1;
    for (const { values, weight } of octaves) r += octave(values, t) * weight;
    r = Math.max(0.25, r);
    const px = Math.cos(angle) * r * stretch;
    const py = (Math.sin(angle) * r) / Math.sqrt(stretch);
    out.push(
      Math.round(o.x + (px * Math.cos(turn) - py * Math.sin(turn)) * o.radius),
      Math.round(o.y + (px * Math.sin(turn) + py * Math.cos(turn)) * o.radius),
    );
  }
  return out;
}

/**
 * A main island with smaller ones around it, none overlapping: `count` islands in all, the
 * first the biggest.
 */
export function generateArchipelago(o: IslandOptions & { count: number }): number[][] {
  const rand = seeded(o.seed ^ 0x9e3779b9);
  const islands: number[][] = [generateIsland(o)];
  const circles = [{ x: o.x, y: o.y, r: o.radius * (1.2 + o.elongation * 1.2) }];
  for (let k = 1; k < o.count; k++) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const r = o.radius * (0.18 + rand() * 0.3);
      const angle = rand() * Math.PI * 2;
      const dist = o.radius * (1.6 + rand() * 1.8) + r;
      const c = { x: o.x + Math.cos(angle) * dist, y: o.y + Math.sin(angle) * dist, r: r * 1.5 };
      if (circles.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < q.r + c.r)) continue;
      circles.push(c);
      islands.push(
        generateIsland({
          x: c.x,
          y: c.y,
          radius: r,
          seed: o.seed + k * 7919,
          ruggedness: Math.min(1, o.ruggedness + 0.1),
          elongation: o.elongation * 0.6,
        }),
      );
      break;
    }
  }
  return islands;
}

export const islandSize = (points: readonly number[]) => {
  const b = bounds(points);
  return {
    width: b.x1 - b.x0,
    height: b.y1 - b.y0,
    area: Math.abs(polygonArea(points)),
    points: countPoints(points),
  };
};
