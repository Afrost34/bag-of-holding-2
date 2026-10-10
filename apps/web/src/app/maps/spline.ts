/**
 * Curves for terrain shapes, roads and rivers: control points (x0, y0, x1, y1…) become a smooth
 * line (Catmull-Rom), plus the measuring and offsetting the drawing and the scatter tools need.
 * Pure functions, no drawing.
 */

export interface P {
  x: number;
  y: number;
}

const at = (points: readonly number[], i: number): P => ({
  x: points[i * 2] ?? 0,
  y: points[i * 2 + 1] ?? 0,
});
export const countPoints = (points: readonly number[]) => Math.floor(points.length / 2);

/**
 * The line through the control points, rounded. `smooth` 0 keeps straight segments, 1 is a full
 * Catmull-Rom curve; between, the curve is blended with the polygon. Closed lines wrap round.
 */
export function splinePoints(points: readonly number[], closed: boolean, smooth: number): number[] {
  const n = countPoints(points);
  if (n < 3 || smooth <= 0) return [...points];
  const steps = 8;
  const out: number[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(points, closed ? (i - 1 + n) % n : Math.max(0, i - 1));
    const p1 = at(points, i);
    const p2 = at(points, closed ? (i + 1) % n : i + 1);
    const p3 = at(points, closed ? (i + 2) % n : Math.min(n - 1, i + 2));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const lin = (b: number, c: number) => b + (c - b) * t;
      out.push(
        lin(p1.x, p2.x) * (1 - smooth) + cr(p0.x, p1.x, p2.x, p3.x) * smooth,
        lin(p1.y, p2.y) * (1 - smooth) + cr(p0.y, p1.y, p2.y, p3.y) * smooth,
      );
    }
  }
  if (!closed) out.push(...points.slice(-2));
  return out;
}

export function bounds(points: readonly number[]): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < countPoints(points); i++) {
    const p = at(points, i);
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

export function polylineLength(points: readonly number[], closed = false): number {
  const n = countPoints(points);
  let total = 0;
  for (let i = 1; i < n; i++) {
    const a = at(points, i - 1);
    const b = at(points, i);
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (closed && n > 2) {
    const a = at(points, n - 1);
    const b = at(points, 0);
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** The point at `d` along a polyline, with the direction (radians) there. */
export function pointAlong(points: readonly number[], d: number): P & { angle: number } {
  const n = countPoints(points);
  let left = d;
  for (let i = 1; i < n; i++) {
    const a = at(points, i - 1);
    const b = at(points, i);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || i === n - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    left -= len;
  }
  return { ...at(points, 0), angle: 0 };
}

/** The closest point of a polyline to `p`: where, how far along (0–1) and how far away. */
export function nearestOnPolyline(
  points: readonly number[],
  p: P,
): { x: number; y: number; t: number; dist: number } {
  const n = countPoints(points);
  const total = polylineLength(points) || 1;
  let best = { x: p.x, y: p.y, t: 0, dist: Infinity };
  let walked = 0;
  for (let i = 1; i < n; i++) {
    const a = at(points, i - 1);
    const b = at(points, i);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const u =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const x = a.x + dx * u;
    const y = a.y + dy * u;
    const dist = Math.hypot(p.x - x, p.y - y);
    const seg = Math.sqrt(len2);
    if (dist < best.dist) best = { x, y, t: (walked + seg * u) / total, dist };
    walked += seg;
  }
  return best;
}

/** The signed area of a polygon: positive when it runs clockwise on screen (y down). */
export function polygonArea(points: readonly number[]): number {
  const n = countPoints(points);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = at(points, i);
    const b = at(points, (i + 1) % n);
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * A line moved sideways by `d` (positive: to the right of its direction on screen), vertex by
 * vertex along the bisector. Corners are limited so they do not spike.
 */
export function offsetLine(points: readonly number[], d: number, closed: boolean): number[] {
  const n = countPoints(points);
  if (n < 2) return [...points];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = at(points, closed ? (i - 1 + n) % n : Math.max(0, i - 1));
    const cur = at(points, i);
    const next = at(points, closed ? (i + 1) % n : Math.min(n - 1, i + 1));
    const a = Math.atan2(cur.y - prev.y, cur.x - prev.x);
    const b = Math.atan2(next.y - cur.y, next.x - cur.x);
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    const na = hasPrev ? a : b;
    const nb = hasNext ? b : a;
    // The normal of each side; their average, stretched so the offset stays `d` from both
    // sides (limited, so sharp corners do not spike).
    const nx = -Math.sin(na) - Math.sin(nb);
    const ny = Math.cos(na) + Math.cos(nb);
    const len = Math.hypot(nx, ny) || 1;
    const half = Math.cos((nb - na) / 2);
    const scale = Math.min(3, 1 / Math.max(0.3, Math.abs(half)));
    out.push(cur.x + (nx / len) * d * scale, cur.y + (ny / len) * d * scale);
  }
  return out;
}

/**
 * A ribbon around a line whose width follows `widthAt(t)` (t: 0 at the start, 1 at the end): the
 * polygon of a river that widens downstream.
 */
export function ribbon(points: readonly number[], widthAt: (t: number) => number): number[] {
  const n = countPoints(points);
  if (n < 2) return [];
  const total = polylineLength(points) || 1;
  const left: number[] = [];
  const right: number[] = [];
  let walked = 0;
  for (let i = 0; i < n; i++) {
    const cur = at(points, i);
    if (i > 0) {
      const prev = at(points, i - 1);
      walked += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    }
    const prev = at(points, Math.max(0, i - 1));
    const next = at(points, Math.min(n - 1, i + 1));
    const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
    const half = widthAt(walked / total) / 2;
    left.push(cur.x - Math.sin(angle) * half, cur.y + Math.cos(angle) * half);
    right.unshift(cur.x + Math.sin(angle) * half, cur.y - Math.cos(angle) * half);
  }
  return [...left, ...right];
}

/** A closed shape grown (positive `d`) or shrunk (negative) all round, whichever way it runs. */
export function growPolygon(points: readonly number[], d: number): number[] {
  // Clockwise on screen: the right-hand side is the inside.
  return offsetLine(points, polygonArea(points) > 0 ? -d : d, true);
}
