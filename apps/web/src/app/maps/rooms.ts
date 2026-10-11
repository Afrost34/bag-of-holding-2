import { generateIsland } from './islandgen';
import { nearestOnPolyline, splinePoints } from './spline';

/**
 * Rooms for battle maps: a footprint with a floor and walls, doors cut through the walls, and
 * a cave outline (dungeons are planned in `structure/dungeonplan.ts`).
 * Pure geometry; drawing is in `roomView.ts`.
 */

/** `gap`: an opening with nothing drawn in it (a pack's door picture stands there instead). */
export type DoorKind = 'door' | 'arch' | 'secret' | 'portcullis' | 'gap';

export interface Door {
  x: number;
  y: number;
  /** Radians: the direction the wall runs there (the door lies along it). */
  angle: number;
  kind: DoorKind;
}

export const DOOR_KINDS: { id: DoorKind; name: string }[] = [
  { id: 'door', name: 'Door' },
  { id: 'arch', name: 'Archway' },
  { id: 'secret', name: 'Secret door' },
  { id: 'portcullis', name: 'Portcullis' },
];

/** A room's outline, rounded, as x, y pairs. */
export const roomOutline = (points: readonly number[], smooth: number): number[] =>
  splinePoints(points, true, smooth);

/**
 * Where a door goes when you click near a wall: the closest point on the outline, with the
 * direction of the wall there; null when no wall is within `within`.
 */
export function doorOnWall(
  outline: readonly number[],
  at: { x: number; y: number },
  within: number,
  isClosed = true,
): { x: number; y: number; angle: number } | null {
  const closed = isClosed ? [...outline, outline[0] ?? 0, outline[1] ?? 0] : [...outline];
  if (closed.length < 4) return null;
  const near = nearestOnPolyline(closed, at);
  if (near.dist > within) return null;
  // The direction of the segment nearest to the point.
  let best = { angle: 0, dist: Infinity };
  for (let i = 0; i + 3 < closed.length; i += 2) {
    const ax = closed[i] ?? 0;
    const ay = closed[i + 1] ?? 0;
    const bx = closed[i + 2] ?? 0;
    const by = closed[i + 3] ?? 0;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const u =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((near.x - ax) * dx + (near.y - ay) * dy) / len2));
    const d = Math.hypot(near.x - (ax + dx * u), near.y - (ay + dy * u));
    if (d < best.dist) best = { angle: Math.atan2(dy, dx), dist: d };
  }
  return { x: Math.round(near.x), y: Math.round(near.y), angle: best.angle };
}

/** Where a point lies on a closed outline: which wall (segment) and how far along it (0–1). */
function placeOnOutline(
  outline: readonly number[],
  at: { x: number; y: number },
): { index: number; t: number; dist: number } {
  const n = Math.floor(outline.length / 2);
  let best = { index: 0, t: 0, dist: Infinity };
  for (let i = 0; i < n; i++) {
    const ax = outline[i * 2] ?? 0;
    const ay = outline[i * 2 + 1] ?? 0;
    const bx = outline[((i + 1) % n) * 2] ?? 0;
    const by = outline[((i + 1) % n) * 2 + 1] ?? 0;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((at.x - ax) * dx + (at.y - ay) * dy) / len2));
    const dist = Math.hypot(at.x - (ax + dx * t), at.y - (ay + dy * t));
    if (dist < best.dist) best = { index: i, t, dist };
  }
  return best;
}

/**
 * The doors of a room put back on its walls after the walls moved. A door stays on the same wall
 * at the same fraction of its length (when the outline has the same number of walls); otherwise
 * it goes to the nearest point of the new outline. A door keeps its kind and turns along the wall.
 */
export function reattachDoors(
  doors: readonly Door[],
  before: readonly number[],
  after: readonly number[],
): Door[] {
  const same = before.length === after.length;
  const n = Math.floor(after.length / 2);
  return doors.map((d) => {
    if (same && n >= 2) {
      const spot = placeOnOutline(before, d);
      const ax = after[spot.index * 2] ?? 0;
      const ay = after[spot.index * 2 + 1] ?? 0;
      const bx = after[((spot.index + 1) % n) * 2] ?? 0;
      const by = after[((spot.index + 1) % n) * 2 + 1] ?? 0;
      return {
        ...d,
        x: Math.round(ax + (bx - ax) * spot.t),
        y: Math.round(ay + (by - ay) * spot.t),
        angle: Math.atan2(by - ay, bx - ax),
      };
    }
    const on = doorOnWall(after, d, Infinity);
    return on ? { ...d, x: on.x, y: on.y, angle: on.angle } : d;
  });
}

/** A rectangle with sides along the axes, as four corners. */
export const rectPolygon = (x: number, y: number, w: number, h: number): number[] => [
  x,
  y,
  x + w,
  y,
  x + w,
  y + h,
  x,
  y + h,
];

/** A cave: a ragged, rounded outline around a middle. */
export function generateCave(x: number, y: number, radius: number, seed: number): number[] {
  return generateIsland({ x, y, radius, seed, ruggedness: 0.9, elongation: 0.3 });
}
