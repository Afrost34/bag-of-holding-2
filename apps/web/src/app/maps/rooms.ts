import { generateIsland } from './islandgen';
import { bounds, nearestOnPolyline, splinePoints } from './spline';
import { seeded } from './terrain';

/**
 * Rooms for battle maps: a footprint with a floor and walls, doors cut through the walls, and
 * generators for a dungeon (rooms joined by corridors, with doors where they meet) and a cave.
 * Pure geometry; drawing is in `roomView.ts`.
 */

export type DoorKind = 'door' | 'arch' | 'secret' | 'portcullis';

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

export interface PlannedRoom {
  points: number[];
  doors: Door[];
  /** Corridors have a floor of their own (stone) and no walls drawn between them and rooms. */
  corridor: boolean;
}

export interface DungeonRequest {
  /** The area to fill. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Grid cell size: rooms and corridors are whole cells. */
  cell: number;
  rooms: number;
  seed: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const centreOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Where a segment that starts inside a rectangle leaves it; null if it stays inside. */
function leaves(r: Rect, from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const edges: [number, number, number, boolean][] = [
    [r.x, from.x, dx, true],
    [r.x + r.w, from.x, dx, true],
    [r.y, from.y, dy, false],
    [r.y + r.h, from.y, dy, false],
  ];
  let best: { t: number; vertical: boolean } | null = null;
  for (const [edge, origin, delta, vertical] of edges) {
    if (delta === 0) continue;
    const u = (edge - origin) / delta;
    if (u > 0 && u <= 1 && (!best || u < best.t)) best = { t: u, vertical };
  }
  if (!best) return null;
  return {
    x: from.x + dx * best.t,
    y: from.y + dy * best.t,
    angle: best.vertical ? Math.PI / 2 : 0,
  };
}

/** Where a path that starts inside a rectangle first leaves it. */
function exitAlong(r: Rect, path: readonly { x: number; y: number }[]) {
  for (let i = 0; i + 1 < path.length; i++) {
    const from = path[i];
    const to = path[i + 1];
    if (!from || !to) continue;
    const hit = leaves(r, from, to);
    if (hit) return hit;
  }
  return null;
}

/**
 * A dungeon: rooms of whole cells placed without touching, each joined to the next (left to
 * right) by an L-shaped corridor, a few extra corridors for loops, and a door where each
 * corridor meets a room.
 */
export function generateDungeon(req: DungeonRequest): PlannedRoom[] {
  const rand = seeded(req.seed);
  const c = req.cell;
  const rooms: Rect[] = [];
  const cols = Math.max(4, Math.floor(req.width / c));
  const rows = Math.max(4, Math.floor(req.height / c));
  for (let attempt = 0; attempt < req.rooms * 40 && rooms.length < req.rooms; attempt++) {
    const w = 3 + Math.floor(rand() * 6);
    const h = 3 + Math.floor(rand() * 5);
    if (w + 2 > cols || h + 2 > rows) continue;
    const gx = 1 + Math.floor(rand() * (cols - w - 1));
    const gy = 1 + Math.floor(rand() * (rows - h - 1));
    const room: Rect = { x: req.x + gx * c, y: req.y + gy * c, w: w * c, h: h * c };
    // A cell of margin all round, so rooms and their walls never touch.
    const clear = rooms.every(
      (o) =>
        room.x + room.w + c <= o.x ||
        o.x + o.w + c <= room.x ||
        room.y + room.h + c <= o.y ||
        o.y + o.h + c <= room.y,
    );
    if (clear) rooms.push(room);
  }
  rooms.sort((a, b) => a.x - b.x);
  const out: PlannedRoom[] = rooms.map((r) => ({
    points: rectPolygon(r.x, r.y, r.w, r.h),
    doors: [],
    corridor: false,
  }));
  const link = (a: number, b: number) => {
    const ra = rooms[a];
    const rb = rooms[b];
    const pa = out[a];
    const pb = out[b];
    if (!ra || !rb || !pa || !pb) return;
    const ca = centreOf(ra);
    const cb = centreOf(rb);
    const width = c * 2;
    // Along x from the first room, then along y to the second.
    const corner = { x: cb.x, y: ca.y };
    const snap = (v: number) => req.x + Math.round((v - req.x) / c) * c;
    const horizontal: Rect = {
      x: Math.min(ca.x, corner.x),
      y: snap(ca.y) - c,
      w: Math.abs(corner.x - ca.x) + width / 2,
      h: width,
    };
    const vertical: Rect = {
      x: snap(cb.x) - c,
      y: Math.min(ca.y, cb.y),
      w: width,
      h: Math.abs(cb.y - ca.y) + width / 2,
    };
    for (const r of [horizontal, vertical])
      if (r.w > 0 && r.h > 0)
        out.push({ points: rectPolygon(r.x, r.y, r.w, r.h), doors: [], corridor: true });
    const doorA = exitAlong(ra, [ca, corner, cb]);
    const doorB = exitAlong(rb, [cb, corner, ca]);
    if (doorA) pa.doors.push({ ...doorA, kind: 'door' });
    if (doorB) pb.doors.push({ ...doorB, kind: 'door' });
  };
  for (let i = 0; i + 1 < rooms.length; i++) link(i, i + 1);
  // A few loops: other rooms joined too.
  for (let k = 0; k < Math.floor(rooms.length / 4); k++) {
    const a = Math.floor(rand() * rooms.length);
    const b = Math.floor(rand() * rooms.length);
    if (Math.abs(a - b) > 1) link(Math.min(a, b), Math.max(a, b));
  }
  return out;
}

/** A cave: a ragged, rounded outline around a middle. */
export function generateCave(x: number, y: number, radius: number, seed: number): number[] {
  return generateIsland({ x, y, radius, seed, ruggedness: 0.9, elongation: 0.3 });
}

/** The area a list of rooms covers (for placing the generated dungeon where you look). */
export const planBounds = (rooms: readonly PlannedRoom[]) => bounds(rooms.flatMap((r) => r.points));
