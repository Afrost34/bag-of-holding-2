import { CLIFF } from './dress/ground';
import { heightsOf, type Elevation } from './elevation';

/**
 * Roads that follow the land: the way between two points over a map's elevation that a road
 * builder would take. A* over the elevation's cells (eight ways), where a step costs its length
 * times how steep it is (squared, so a gentle detour beats a climb straight up: roads wind round
 * hills, take the passes and zig-zag up slopes), cliffs steeper than `maxSlope` cannot be crossed
 * and the sea is avoided. The way found is thinned to its turning points. Pure.
 */

export interface LandRouteOptions {
  /** How much steepness costs (0: the shortest way, whatever the hills). */
  climb: number;
  /** Steeper than this (0–1, 1 a cliff) cannot be crossed. */
  maxSlope: number;
}

export const DEFAULT_LAND_ROUTE: LandRouteOptions = { climb: 30, maxSlope: 0.8 };

interface Point {
  x: number;
  y: number;
}

/** A binary heap of cell indices by cost, smallest first. */
class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, key: number): void {
    const a = this.items;
    const k = this.keys;
    a.push(item);
    k.push(key);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((k[p] ?? 0) <= key) break;
      a[i] = a[p] ?? 0;
      k[i] = k[p] ?? 0;
      i = p;
    }
    a[i] = item;
    k[i] = key;
  }
  pop(): number {
    const a = this.items;
    const k = this.keys;
    const top = a[0] ?? 0;
    const lastItem = a.pop() ?? 0;
    const lastKey = k.pop() ?? 0;
    if (a.length === 0) return top;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      let mk = lastKey;
      if (l < a.length && (k[l] ?? 0) < mk) {
        m = l;
        mk = k[l] ?? 0;
      }
      if (r < a.length && (k[r] ?? 0) < mk) m = r;
      if (m === i) break;
      a[i] = a[m] ?? 0;
      k[i] = k[m] ?? 0;
      i = m;
    }
    a[i] = lastItem;
    k[i] = lastKey;
    return top;
  }
}

const STEPS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * The turning points of the cheapest way from one point to another (cell centres, map pixels),
 * or null when there is none (walled in by cliffs or sea).
 */
function cellPath(
  e: Elevation,
  heights: Uint8Array,
  from: Point,
  to: Point,
  options: LandRouteOptions,
): Point[] | null {
  const cellOf = (p: Point) => ({
    x: Math.max(0, Math.min(e.w - 1, Math.floor(p.x / e.cell))),
    y: Math.max(0, Math.min(e.h - 1, Math.floor(p.y / e.cell))),
  });
  const a = cellOf(from);
  const b = cellOf(to);
  const start = a.y * e.w + a.x;
  const goal = b.y * e.w + b.x;
  const height = (i: number) => heights[i] ?? 0;
  // The ends may be in the sea (a harbour road); only the cells between avoid it.
  const wet = (i: number) => height(i) <= e.sea && i !== start && i !== goal;
  const cost = new Float64Array(e.w * e.h).fill(Infinity);
  const came = new Int32Array(e.w * e.h).fill(-1);
  const done = new Uint8Array(e.w * e.h);
  const heap = new Heap();
  cost[start] = 0;
  heap.push(start, 0);
  const guess = (i: number) => Math.hypot((i % e.w) - b.x, Math.floor(i / e.w) - b.y);
  while (heap.size > 0) {
    const i = heap.pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === goal) break;
    const x = i % e.w;
    const y = Math.floor(i / e.w);
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= e.w || ny >= e.h) continue;
      const n = ny * e.w + nx;
      if (done[n] || wet(n)) continue;
      const length = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
      const slope = Math.abs(height(n) - height(i)) / (CLIFF * length);
      if (slope > options.maxSlope) continue;
      const next = (cost[i] ?? 0) + length * (1 + options.climb * slope * slope);
      if (next < (cost[n] ?? Infinity)) {
        cost[n] = next;
        came[n] = i;
        heap.push(n, next + guess(n));
      }
    }
  }
  if (!done[goal]) return null;
  const cells: Point[] = [];
  for (let i = goal; i !== -1; i = came[i] ?? -1) {
    cells.push({ x: ((i % e.w) + 0.5) * e.cell, y: (Math.floor(i / e.w) + 0.5) * e.cell });
    if (i === start) break;
  }
  cells.reverse();
  // A straight stretch is clear when every cell it crosses is dry and no step on it is a cliff.
  const index = (p: Point) => cellOf(p).y * e.w + cellOf(p).x;
  const clear = (p: Point, q: Point): boolean => {
    const n = Math.max(1, Math.ceil((Math.hypot(q.x - p.x, q.y - p.y) / e.cell) * 3));
    let last = index(p);
    for (let k = 1; k <= n; k++) {
      const i = index({ x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n });
      if (i === last) continue;
      if (wet(i)) return false;
      const step = Math.hypot(
        (i % e.w) - (last % e.w),
        Math.floor(i / e.w) - Math.floor(last / e.w),
      );
      if (Math.abs(height(i) - height(last)) / (CLIFF * step) > options.maxSlope) return false;
      last = i;
    }
    return true;
  };
  return thinLine(cells, e.cell * 0.75, clear);
}

/**
 * Ramer–Douglas–Peucker: the turning points of a line, none further than `tolerance` off it. A
 * stretch that `clear` says may not be straightened (it would cut through the sea or over a cliff)
 * keeps its farthest point however close it is.
 */
export function thinLine(
  points: readonly Point[],
  tolerance: number,
  clear: (a: Point, b: Point) => boolean = () => true,
): Point[] {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [s, t] = stack.pop() ?? [0, 0];
    const p = points[s];
    const q = points[t];
    if (!p || !q) continue;
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    let far = -1;
    let farDist = -1;
    for (let i = s + 1; i < t; i++) {
      const m = points[i];
      if (!m) continue;
      const d = Math.abs((q.x - p.x) * (p.y - m.y) - (p.x - m.x) * (q.y - p.y)) / len;
      if (d > farDist) {
        far = i;
        farDist = d;
      }
    }
    if (far >= 0 && farDist <= tolerance && clear(p, q)) far = -1;
    if (far >= 0) {
      keep[far] = 1;
      stack.push([s, far], [far, t]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * A road through the clicked points (flat list, map pixels) that follows the land between each
 * pair: the clicked points stay, the way between them is found. A stretch with no way across
 * (cliffs, sea) stays straight. Returns a flat list of points.
 */
export function routeOverLand(
  e: Elevation,
  points: readonly number[],
  options: LandRouteOptions = DEFAULT_LAND_ROUTE,
): number[] {
  const heights = heightsOf(e);
  const stops: Point[] = [];
  for (let i = 0; i + 1 < points.length; i += 2)
    stops.push({ x: points[i] ?? 0, y: points[i + 1] ?? 0 });
  const out: Point[] = [];
  for (let k = 0; k + 1 < stops.length; k++) {
    const from = stops[k];
    const to = stops[k + 1];
    if (!from || !to) continue;
    const turns = cellPath(e, heights, from, to, options);
    // The clicked points themselves, and the way's turning points between them.
    const inner = turns ? turns.slice(1, -1) : [];
    if (k === 0) out.push(from);
    out.push(...inner, to);
  }
  return out.flatMap((p) => [Math.round(p.x), Math.round(p.y)]);
}
