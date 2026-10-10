import { countPoints, polygonArea } from './spline';

/**
 * Polygon helpers for the city generator: clip a polygon to a convex one or to a half-plane,
 * cut it in two with a line, shrink it, find its middle. Polygons are x0, y0, x1, y1… and the
 * results of clipping may have collinear points; callers check the area.
 */

type Pt = [number, number];

const toPts = (poly: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < poly.length; i += 2) out.push([poly[i] ?? 0, poly[i + 1] ?? 0]);
  return out;
};
const flat = (pts: readonly Pt[]): number[] => pts.flatMap((p) => p);

/** Keeps the part of the polygon on the left of the line a→b (Sutherland–Hodgman, one edge). */
function clipEdge(subject: readonly Pt[], a: Pt, b: Pt): Pt[] {
  const inside = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
  const cross = (p: Pt, q: Pt): Pt => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const denom = dx * ey - dy * ex;
    const t = denom === 0 ? 0 : ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / denom;
    return [p[0] + dx * t, p[1] + dy * t];
  };
  const out: Pt[] = [];
  for (let i = 0; i < subject.length; i++) {
    const cur = subject[i];
    const prev = subject[(i + subject.length - 1) % subject.length];
    if (!cur || !prev) continue;
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross(prev, cur));
      out.push(cur);
    } else if (inside(prev)) out.push(cross(prev, cur));
  }
  return out;
}

/**
 * The part of `subject` inside `clip` (which must be convex). `clip` may run either way round;
 * it is turned to run the way the edges expect.
 */
export function clipToConvex(subject: readonly number[], clip: readonly number[]): number[] {
  let result = toPts(subject);
  const c = toPts(clip);
  // Edges must have the inside on their left: a polygon with a positive area (see polygonArea).
  if (polygonArea(clip) < 0) c.reverse();
  for (let i = 0; i < c.length && result.length > 0; i++) {
    const a = c[i];
    const b = c[(i + 1) % c.length];
    if (a && b) result = clipEdge(result, a, b);
  }
  return flat(result);
}

/** The two parts of a polygon either side of the line through `p` at `angle` (radians). */
export function splitPolygon(
  poly: readonly number[],
  p: { x: number; y: number },
  angle: number,
): [number[], number[]] {
  const a: Pt = [p.x, p.y];
  const b: Pt = [p.x + Math.cos(angle), p.y + Math.sin(angle)];
  const pts = toPts(poly);
  return [flat(clipEdge(pts, a, b)), flat(clipEdge(pts, b, a))];
}

export function centroid(poly: readonly number[]): { x: number; y: number } {
  const n = countPoints(poly);
  if (n === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += poly[i * 2] ?? 0;
    y += poly[i * 2 + 1] ?? 0;
  }
  return { x: x / n, y: y / n };
}

/**
 * The polygon moved in by `d` all round (vertex by vertex along the bisector); null when it
 * would vanish or turn inside out. Meant for convex and nearly convex pieces.
 */
export function insetPolygon(poly: readonly number[], d: number): number[] | null {
  const pts = toPts(poly);
  const n = pts.length;
  if (n < 3) return null;
  const clockwise = polygonArea(poly) > 0;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    if (!prev || !cur || !next) return null;
    const a = Math.atan2(cur[1] - prev[1], cur[0] - prev[0]);
    const b = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
    // Right-hand normal: inward for a clockwise polygon on screen.
    const sign = clockwise ? 1 : -1;
    const nx = (-Math.sin(a) - Math.sin(b)) * sign;
    const ny = (Math.cos(a) + Math.cos(b)) * sign;
    const len = Math.hypot(nx, ny);
    if (len < 1e-6) return null;
    const half = Math.cos((b - a) / 2);
    const scale = Math.min(3, 1 / Math.max(0.3, Math.abs(half)));
    out.push([cur[0] + (nx / len) * d * scale, cur[1] + (ny / len) * d * scale]);
  }
  const result = flat(out);
  const before = Math.abs(polygonArea(poly));
  const after = polygonArea(result);
  // Gone, or turned inside out (a shrunk polygon is smaller, and runs the same way round).
  if (
    Math.sign(after) !== Math.sign(polygonArea(poly)) ||
    Math.abs(after) < before * 0.03 ||
    Math.abs(after) >= before
  )
    return null;
  return result;
}

/** The longest edge's direction (radians) and length: the way a building's ridge runs. */
export function longestEdge(poly: readonly number[]): { angle: number; length: number } {
  const n = countPoints(poly);
  let best = { angle: 0, length: 0 };
  for (let i = 0; i < n; i++) {
    const ax = poly[i * 2] ?? 0;
    const ay = poly[i * 2 + 1] ?? 0;
    const j = (i + 1) % n;
    const bx = poly[j * 2] ?? 0;
    const by = poly[j * 2 + 1] ?? 0;
    const length = Math.hypot(bx - ax, by - ay);
    if (length > best.length) best = { angle: Math.atan2(by - ay, bx - ax), length };
  }
  return best;
}
