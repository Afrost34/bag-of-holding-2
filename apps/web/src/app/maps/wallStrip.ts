/**
 * Walls made of a pack's "Straight_Path" picture: a seamless strip, one square tall, repeated along
 * every segment of the wall. Pure geometry: where each strip lies.
 */

export interface StripSegment {
  /** Where the strip starts (already pushed back so neighbouring strips overlap at a corner). */
  x: number;
  y: number;
  /** Radians. */
  angle: number;
  length: number;
}

/**
 * The segments of a wall (x, y pairs; `closed` joins the last to the first), each stretched by half
 * the wall's `thickness` at both ends so that two strips meeting at a right angle make a clean corner.
 * A vertex in `trims` has a piece of the set standing on it: the strips there are shortened by that
 * distance (0 to meet it exactly) instead of stretched.
 */
export function stripSegments(
  points: readonly number[],
  closed: boolean,
  thickness: number,
  trims: ReadonlyMap<number, number> = new Map(),
): StripSegment[] {
  const out: StripSegment[] = [];
  const n = Math.floor(points.length / 2);
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const ax = points[i * 2] ?? 0;
    const ay = points[i * 2 + 1] ?? 0;
    const j = (i + 1) % n;
    const bx = points[j * 2] ?? 0;
    const by = points[j * 2 + 1] ?? 0;
    const length = Math.hypot(bx - ax, by - ay);
    if (length < 0.5) continue;
    const angle = Math.atan2(by - ay, bx - ax);
    // Positive: the strip starts (or ends) before the vertex; negative: short of it.
    const startTrim = trims.get(i);
    const endTrim = trims.get(j);
    const back = startTrim === undefined ? thickness / 2 : -startTrim;
    const forward = endTrim === undefined ? thickness / 2 : -endTrim;
    const total = length + back + forward;
    if (total <= 0) continue;
    out.push({
      x: ax - Math.cos(angle) * back,
      y: ay - Math.sin(angle) * back,
      angle,
      length: total,
    });
  }
  return out;
}

/** The pack pictures that are wall strips: `…/Wall_Stone_Earthy_B1_Straight_Path.webp`. */
export const isWallStrip = (path: string): boolean => /_path(_[a-z0-9]+)?\.[a-z0-9]+$/i.test(path);
