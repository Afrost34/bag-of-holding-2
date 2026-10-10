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
 */
export function stripSegments(
  points: readonly number[],
  closed: boolean,
  thickness: number,
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
    const back = thickness / 2;
    out.push({
      x: ax - Math.cos(angle) * back,
      y: ay - Math.sin(angle) * back,
      angle,
      length: length + thickness,
    });
  }
  return out;
}

/** The pack pictures that are wall strips: `…/Wall_Stone_Earthy_B1_Straight_Path.webp`. */
export const isWallStrip = (path: string): boolean => /Straight_Path\.[a-z0-9]+$/i.test(path);
