import { pointInPolygon } from './polygon';
import { bounds, nearestOnPolyline, pointAlong, polygonArea, polylineLength } from './spline';
import { seeded } from './terrain';

/**
 * Scatter: places pieces (trees, rocks, mountains) over an area or along a line from a seed,
 * keeping them apart and clear of roads, rivers and water. Pure: the same inputs always give the
 * same instances, so a scatter is kept as a few numbers and re-made whenever what it avoids
 * changes.
 */

export interface ScatterSpec {
  /** Fill an area (`line` is its outline), or follow a line. */
  mode: 'area' | 'along';
  /** The outline of the area, or the line to follow, already rounded. */
  line: readonly number[];
  seed: number;
  /** Least distance between two pieces' centres. */
  spacing: number;
  /** Size of a piece (its width) between these. */
  sizeMin: number;
  sizeMax: number;
  /** Weight of each kind of piece, in order. */
  weights: readonly number[];
  rotation: 'none' | 'random' | 'along';
  /** 0 an even spread, 1 groves with clearings between. */
  cluster: number;
  /** Along a line: how far to the side(s) pieces stand. */
  offset: number;
  sides: 'center' | 'both' | 'left' | 'right';
  /** Along a line: how far a piece strays, as a fraction of the spacing. */
  jitter: number;
  /** Extra room kept round what is avoided. */
  clearance: number;
  /** Most pieces made, so a huge area stays quick. */
  max: number;
}

/** What scatter keeps clear of. */
export interface Obstacles {
  /** Lines with the half-width they take up (roads, rivers). */
  lines: readonly { points: readonly number[]; half: number }[];
  /** Areas (water, buildings), as outlines. */
  polygons: readonly (readonly number[])[];
}

export interface Instance {
  x: number;
  y: number;
  /** Radians. */
  angle: number;
  size: number;
  /** Which piece (an index into `weights`). */
  piece: number;
}

/** Smooth-ish noise from 0 to 1 at a point: bilinear interpolation of hashed lattice values. */
export function noise2(x: number, y: number, seed: number): number {
  const hash = (ix: number, iy: number) => {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0) * (1 - u) + hash(x0 + 1, y0) * u;
  const b = hash(x0, y0 + 1) * (1 - u) + hash(x0 + 1, y0 + 1) * u;
  return a * (1 - v) + b * v;
}

/** Whether a point is too near something to be avoided. */
export function blocked(x: number, y: number, o: Obstacles, clearance: number): boolean {
  for (const poly of o.polygons) if (pointInPolygon({ x, y }, poly)) return true;
  for (const line of o.lines) {
    const near = nearestOnPolyline(line.points, { x, y });
    if (near.dist <= line.half + clearance) return true;
  }
  return false;
}

const pick = (weights: readonly number[], r: number): number => {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return 0;
  let at = r * total;
  for (let i = 0; i < weights.length; i++) {
    at -= Math.max(0, weights[i] ?? 0);
    if (at <= 0) return i;
  }
  return weights.length - 1;
};

/**
 * The pieces of a scatter, back to front (top of the map first), so pieces lower down are drawn
 * over those behind them. `allowed` can rule out places (a tree on sand).
 */
export function scatterInstances(
  spec: ScatterSpec,
  obstacles: Obstacles,
  allowed: (x: number, y: number) => boolean = () => true,
): Instance[] {
  if (spec.line.length < 4 || spec.weights.length === 0 || spec.spacing < 2) return [];
  const rand = seeded(spec.seed);
  const out: Instance[] = [];
  const size = () => spec.sizeMin + rand() * Math.max(0, spec.sizeMax - spec.sizeMin);
  const okAt = (x: number, y: number) => allowed(x, y) && !blocked(x, y, obstacles, spec.clearance);

  if (spec.mode === 'along') {
    const length = polylineLength(spec.line);
    let d = spec.spacing * 0.5;
    let flip = false;
    while (d <= length && out.length < spec.max) {
      const p = pointAlong(spec.line, d);
      flip = !flip;
      const side =
        spec.sides === 'center'
          ? 0
          : spec.sides === 'both'
            ? flip
              ? 1
              : -1
            : spec.sides === 'left'
              ? -1
              : 1;
      const sideways = side * spec.offset + (rand() * 2 - 1) * spec.jitter * spec.spacing;
      const along = (rand() * 2 - 1) * spec.jitter * spec.spacing * 0.4;
      const x = p.x - Math.sin(p.angle) * sideways + Math.cos(p.angle) * along;
      const y = p.y + Math.cos(p.angle) * sideways + Math.sin(p.angle) * along;
      if (okAt(x, y))
        out.push({
          x,
          y,
          angle:
            spec.rotation === 'along'
              ? p.angle
              : spec.rotation === 'random'
                ? rand() * Math.PI * 2
                : 0,
          size: size(),
          piece: pick(spec.weights, rand()),
        });
      d += spec.spacing * (0.75 + rand() * 0.5);
    }
  } else {
    const b = bounds(spec.line);
    const area = Math.abs(polygonArea(spec.line));
    const tries = Math.min(
      spec.max * 6,
      Math.ceil((area / (spec.spacing * spec.spacing)) * 4) + 30,
    );
    const cell = spec.spacing;
    const grid = new Map<string, Instance[]>();
    const key = (cx: number, cy: number) => `${String(cx)},${String(cy)}`;
    const noiseScale = spec.spacing * 9;
    for (let i = 0; i < tries && out.length < spec.max; i++) {
      const x = b.x0 + rand() * (b.x1 - b.x0);
      const y = b.y0 + rand() * (b.y1 - b.y0);
      const roll = rand();
      if (!pointInPolygon({ x, y }, spec.line)) continue;
      if (
        spec.cluster > 0 &&
        noise2(x / noiseScale, y / noiseScale, spec.seed) < spec.cluster * 0.7
      )
        continue;
      if (!okAt(x, y)) continue;
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      let crowded = false;
      for (let gx = cx - 1; gx <= cx + 1 && !crowded; gx++)
        for (let gy = cy - 1; gy <= cy + 1 && !crowded; gy++)
          for (const o of grid.get(key(gx, gy)) ?? [])
            if (Math.hypot(o.x - x, o.y - y) < spec.spacing * (0.85 + roll * 0.3)) {
              crowded = true;
              break;
            }
      if (crowded) continue;
      const inst: Instance = {
        x,
        y,
        angle: spec.rotation === 'random' ? rand() * Math.PI * 2 : 0,
        size: size(),
        piece: pick(spec.weights, rand()),
      };
      out.push(inst);
      const k = key(cx, cy);
      const list = grid.get(k);
      if (list) list.push(inst);
      else grid.set(k, [inst]);
    }
  }
  return out.sort((a, b) => a.y - b.y);
}
