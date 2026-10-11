import { pointInPolygon } from '../polygon';
import { nearestOnPolyline } from '../spline';
import { seeded } from '../terrain';
import { cellBounds, cellKey, cellsInPolygon, components, parseCell } from './cells';

/**
 * The plan of one floor of a building: its footprint cut into rooms of whole grid cells, with a
 * stairwell in the same cells on every floor, doors between rooms (every room reachable, a few
 * loops), a front door on the ground floor, and windows on the outer walls. Rooms the user locked
 * (or split, merged, retyped) are kept as they are; the rest of the floor is cut again. Pure:
 * the same footprint, seed and locks give the same plan.
 */

export interface PlanRoom {
  /** Its number on this floor (stable while it is locked). */
  id: number;
  /** Its cells, `"cx,cy"`, sorted. */
  cells: string[];
  /** What it is for (`common-room`, `kitchen`, `stairs`…; `room` until a programme says). */
  type: string;
  /** The seed its furniture is laid from. */
  seed: number;
  locked?: boolean;
}

/** A doorway: where it is on the map, the direction the wall runs there, and if it leads out. */
export interface PlanDoor {
  x: number;
  y: number;
  angle: number;
  outer: boolean;
  /** The rooms it joins (by index in `rooms`): one for a door to the outside. */
  rooms: number[];
}

export interface PlanWindow {
  x: number;
  y: number;
  angle: number;
}

export interface FloorPlan {
  rooms: PlanRoom[];
  doors: PlanDoor[];
  windows: PlanWindow[];
  /** The stairwell's cells (the same on every floor), or none. */
  stairs: string[];
  /** Walls between rooms, as segments `[x0, y0, x1, y1]` inside the footprint. */
  walls: number[][];
}

export interface FloorRequest {
  /** The outer outline (map pixels). */
  footprint: readonly number[];
  cell: number;
  /** The building's seed (its rooms, with `floor`). */
  seed: number;
  /** The stairwell's seed (`seed` when absent): the stairs stay when the rooms are rolled again. */
  stairSeed?: number;
  floor: number;
  /** How many rooms to aim for, the stairwell besides. */
  rooms: number;
  /** Rooms kept as they are. */
  locked?: readonly PlanRoom[];
  stairs: boolean;
  /** A door to the outside (the ground floor). */
  entrance: boolean;
  windows: boolean;
}

/** Smallest room: 2 × 2 cells. */
const MIN_SIDE = 2;

// region Stairwell

/**
 * A stairwell of 1 × 3 cells (2 × 3 in a big building), inside the footprint, as near its middle
 * as the seed allows: the same cells on every floor.
 */
export function stairwell(cells: ReadonlySet<string>, seed: number): string[] {
  const all = [...cells].map(parseCell);
  if (all.length < 12) return [];
  const mx = all.reduce((s, c) => s + c[0], 0) / all.length;
  const my = all.reduce((s, c) => s + c[1], 0) / all.length;
  const rand = seeded(seed ^ 0x51a1);
  const wide = all.length >= 60 ? 2 : 1;
  let best: { cells: string[]; score: number } | null = null;
  for (const [cx, cy] of all)
    for (const across of [true, false]) {
      const w = across ? 3 : wide;
      const h = across ? wide : 3;
      const block: string[] = [];
      let fits = true;
      for (let y = cy; y < cy + h && fits; y++)
        for (let x = cx; x < cx + w && fits; x++) {
          const key = cellKey(x, y);
          if (!cells.has(key)) fits = false;
          block.push(key);
        }
      if (!fits) continue;
      // Near the middle, not against the outer wall, with a little chance.
      const bx = cx + w / 2;
      const by = cy + h / 2;
      let outside = 0;
      for (const key of block) {
        const [x, y] = parseCell(key);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const)
          if (!cells.has(cellKey(x + dx, y + dy)) && !block.includes(cellKey(x + dx, y + dy)))
            outside++;
      }
      const score = Math.hypot(bx - mx, by - my) + outside * 0.4 + rand() * 1.5;
      if (!best || score < best.score) best = { cells: block.sort(), score };
    }
  return best?.cells ?? [];
}

// endregion

// region Cutting the floor into rooms

/** Whether a group of cells is big enough for a room: 2 × 2 and four cells at least. */
const roomy = (group: readonly string[]): boolean => {
  if (group.length < MIN_SIDE * MIN_SIDE) return false;
  const b = cellBounds(group);
  return b.w >= MIN_SIDE && b.h >= MIN_SIDE;
};

/** One cut of a region across its longer side, or null when no cut leaves two rooms. */
function cut(region: readonly string[], rand: () => number): string[][] | null {
  const b = cellBounds(region);
  const across = b.w >= b.h;
  const span = across ? b.w : b.h;
  if (span < MIN_SIDE * 2) return null;
  // Near the middle, a little to one side.
  const lo = MIN_SIDE;
  const hi = span - MIN_SIDE;
  const tries = [Math.round(span / 2 + (rand() - 0.5) * span * 0.3)];
  for (let k = lo; k <= hi; k++) tries.push(k);
  for (const at of tries) {
    if (at < lo || at > hi) continue;
    const line = (across ? b.x0 : b.y0) + at;
    const a = region.filter((key) => parseCell(key)[across ? 0 : 1] < line);
    const c = region.filter((key) => parseCell(key)[across ? 0 : 1] >= line);
    const parts = [...components(new Set(a)), ...components(new Set(c))];
    if (parts.every(roomy)) return parts;
  }
  return null;
}

/** The free cells cut into about `target` rooms, the biggest region cut first. */
function cutRooms(free: ReadonlySet<string>, target: number, rand: () => number): string[][] {
  let regions = components(free);
  // Scraps too small for a room join the room they touch most, later.
  const scraps = regions.filter((r) => !roomy(r));
  regions = regions.filter(roomy);
  const stuck = new Set<number>();
  while (regions.length < target) {
    let pick = -1;
    for (let i = 0; i < regions.length; i++)
      if (!stuck.has(i) && (pick < 0 || (regions[i]?.length ?? 0) > (regions[pick]?.length ?? 0)))
        pick = i;
    if (pick < 0) break;
    const region = regions[pick];
    if (!region) break;
    const parts = cut(region, rand);
    if (!parts) {
      stuck.add(pick);
      continue;
    }
    regions = [...regions.slice(0, pick), ...parts, ...regions.slice(pick + 1)];
    stuck.clear();
  }
  for (const scrap of scraps) {
    // The neighbouring region it shares the most sides with.
    let best = -1;
    let most = 0;
    regions.forEach((r, i) => {
      const set = new Set(r);
      let n = 0;
      for (const key of scrap) {
        const [x, y] = parseCell(key);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const)
          if (set.has(cellKey(x + dx, y + dy))) n++;
      }
      if (n > most) {
        most = n;
        best = i;
      }
    });
    const into = regions[best];
    if (into) regions[best] = [...into, ...scrap];
  }
  return regions.map((r) => [...r].sort());
}

// endregion

// region Walls, doors and windows

/** A side between two cells, as the map points at its ends; `horizontal` runs along x. */
interface Side {
  a: number;
  b: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  horizontal: boolean;
}

/** Every side between two different rooms (by room index), and every side facing outside. */
function sides(roomOf: ReadonlyMap<string, number>, cell: number) {
  const inner: Side[] = [];
  const outer: (Side & { room: number })[] = [];
  for (const [key, a] of roomOf) {
    const [cx, cy] = parseCell(key);
    // Right and bottom sides between rooms (each once); every side facing outside.
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ] as const) {
      const b = roomOf.get(cellKey(cx + dx, cy + dy));
      const x0 = dx === 1 ? (cx + 1) * cell : dx === -1 ? cx * cell : cx * cell;
      const y0 = dy === 1 ? (cy + 1) * cell : dy === -1 ? cy * cell : cy * cell;
      const horizontal = dy !== 0;
      const side = {
        x0,
        y0,
        x1: horizontal ? x0 + cell : x0,
        y1: horizontal ? y0 : y0 + cell,
        horizontal,
      };
      if (b === undefined) outer.push({ ...side, a, b: -1, room: a });
      else if (b !== a && (dx === 1 || dy === 1)) inner.push({ ...side, a, b });
    }
  }
  return { inner, outer };
}

/** Sides on one line, end to end, joined into runs. */
function runs<S extends Side>(list: readonly S[]): S[][] {
  const groups = new Map<string, S[]>();
  for (const s of list) {
    const key = `${s.horizontal ? 'h' : 'v'}${String(s.horizontal ? s.y0 : s.x0)}|${String(s.a)}|${String(s.b)}`;
    const g = groups.get(key);
    if (g) g.push(s);
    else groups.set(key, [s]);
  }
  const out: S[][] = [];
  for (const g of groups.values()) {
    g.sort((p, q) => (p.horizontal ? p.x0 - q.x0 : p.y0 - q.y0));
    let run: S[] = [];
    for (const s of g) {
      const last = run[run.length - 1];
      if (last && (last.x1 !== s.x0 || last.y1 !== s.y0)) {
        out.push(run);
        run = [];
      }
      run.push(s);
    }
    if (run.length > 0) out.push(run);
  }
  return out;
}

/** The middle of a run, kept a side away from its ends when the run is long enough. */
function doorAt<S extends Side>(run: readonly S[], rand: () => number): S | undefined {
  if (run.length <= 2) return run[Math.floor(run.length / 2)];
  const inside = run.slice(1, -1);
  return inside[Math.floor(rand() * inside.length)];
}

const middle = (s: Side) => ({ x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2 });
const along = (s: Side) => (s.horizontal ? 0 : Math.PI / 2);

/** A point moved onto the nearest outer wall (the footprint may have angled sides). */
function onWall(footprint: readonly number[], p: { x: number; y: number }) {
  const ring = [...footprint, footprint[0] ?? 0, footprint[1] ?? 0];
  const near = nearestOnPolyline(ring, p);
  // The direction of the wall there.
  const n = Math.floor(ring.length / 2) - 1;
  let angle = 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const ax = ring[i * 2] ?? 0;
    const ay = ring[i * 2 + 1] ?? 0;
    const bx = ring[i * 2 + 2] ?? 0;
    const by = ring[i * 2 + 3] ?? 0;
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = Math.max(
      0,
      Math.min(1, ((near.x - ax) * (bx - ax) + (near.y - ay) * (by - ay)) / len2),
    );
    const d = Math.hypot(ax + (bx - ax) * t - near.x, ay + (by - ay) * t - near.y);
    if (d < best) {
      best = d;
      angle = Math.atan2(by - ay, bx - ax);
    }
  }
  return { x: near.x, y: near.y, angle };
}

/** A segment clipped to a polygon: the parts inside it. */
export function clipSegment(seg: readonly number[], poly: readonly number[]): number[][] {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = seg;
  const ts = [0, 1];
  const n = Math.floor(poly.length / 2);
  for (let i = 0; i < n; i++) {
    const ax = poly[i * 2] ?? 0;
    const ay = poly[i * 2 + 1] ?? 0;
    const bx = poly[((i + 1) % n) * 2] ?? 0;
    const by = poly[((i + 1) % n) * 2 + 1] ?? 0;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const ex = bx - ax;
    const ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - x0) * ey - (ay - y0) * ex) / den;
    const u = ((ax - x0) * dy - (ay - y0) * dx) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const out: number[][] = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const ta = ts[i] ?? 0;
    const tb = ts[i + 1] ?? 0;
    if (tb - ta < 1e-6) continue;
    const tm = (ta + tb) / 2;
    if (!pointInPolygon({ x: x0 + (x1 - x0) * tm, y: y0 + (y1 - y0) * tm }, poly)) continue;
    const piece = [
      x0 + (x1 - x0) * ta,
      y0 + (y1 - y0) * ta,
      x0 + (x1 - x0) * tb,
      y0 + (y1 - y0) * tb,
    ];
    // Joined to the piece before when they touch.
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs((last[2] ?? 0) - (piece[0] ?? 0)) < 1e-6 &&
      Math.abs((last[3] ?? 0) - (piece[1] ?? 0)) < 1e-6
    ) {
      last[2] = piece[2] ?? 0;
      last[3] = piece[3] ?? 0;
    } else out.push(piece);
  }
  return out;
}

// endregion

/** The plan of one floor. */
export function planFloor(req: FloorRequest): FloorPlan {
  const cells = cellsInPolygon(req.footprint, req.cell);
  const rand = seeded((req.seed * 31 + req.floor * 7919) >>> 0);
  const stairs = req.stairs ? stairwell(cells, req.stairSeed ?? req.seed) : [];
  const taken = new Set(stairs);
  const locked = (req.locked ?? []).filter((r) =>
    r.cells.every((c) => cells.has(c) && !taken.has(c)),
  );
  for (const r of locked) for (const c of r.cells) taken.add(c);
  const free = new Set([...cells].filter((c) => !taken.has(c)));
  const target = Math.max(1, req.rooms - locked.length);
  const cutUp = free.size > 0 ? cutRooms(free, target, rand) : [];
  const usedIds = new Set(locked.map((r) => r.id));
  let nextId = 1;
  const freshId = () => {
    while (usedIds.has(nextId)) nextId++;
    usedIds.add(nextId);
    return nextId;
  };
  // In order of their numbers, and doors drawn from numbers of their own: a floor frozen as it
  // is (one room changed) keeps its doors.
  const rooms: PlanRoom[] = [
    ...locked.map((r) => ({ ...r, locked: true })),
    ...(stairs.length > 0 ? [{ id: 0, cells: stairs, type: 'stairs', seed: req.seed }] : []),
    ...cutUp.map((c) => ({
      id: freshId(),
      cells: c,
      type: 'room',
      seed: Math.floor(rand() * 2 ** 31),
    })),
  ].sort((a, b) => a.id - b.id);
  const doorRand = seeded((req.seed * 31 + req.floor * 7919 + 104729) >>> 0);
  const roomOf = new Map<string, number>();
  rooms.forEach((r, i) => {
    for (const c of r.cells) roomOf.set(c, i);
  });
  const { inner, outer } = sides(roomOf, req.cell);

  // Walls between rooms, clipped to the footprint.
  const walls: number[][] = [];
  for (const run of runs(inner)) {
    const first = run[0];
    const last = run[run.length - 1];
    if (!first || !last) continue;
    walls.push(...clipSegment([first.x0, first.y0, last.x1, last.y1], req.footprint));
  }

  // Doors: a tree over the rooms that touch (every room reachable), and a few more for loops.
  const links = runs(inner)
    .map((run) => ({ run, a: run[0]?.a ?? 0, b: run[0]?.b ?? 0, key: doorRand() }))
    .sort((p, q) => p.key - q.key);
  const parent = rooms.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] ?? r;
    return r;
  };
  const doors: PlanDoor[] = [];
  const linked = new Set<string>();
  const extra: typeof links = [];
  for (const link of links) {
    const ra = find(link.a);
    const rb = find(link.b);
    const pair = `${String(Math.min(link.a, link.b))}-${String(Math.max(link.a, link.b))}`;
    if (ra === rb) {
      if (!linked.has(pair)) extra.push(link);
      continue;
    }
    parent[ra] = rb;
    linked.add(pair);
    const side = doorAt(link.run, doorRand);
    if (side)
      doors.push({ ...middle(side), angle: along(side), outer: false, rooms: [link.a, link.b] });
  }
  for (const link of extra) {
    const pair = `${String(Math.min(link.a, link.b))}-${String(Math.max(link.a, link.b))}`;
    if (linked.has(pair) || doorRand() > 0.2) continue;
    linked.add(pair);
    const side = doorAt(link.run, doorRand);
    if (side)
      doors.push({ ...middle(side), angle: along(side), outer: false, rooms: [link.a, link.b] });
  }

  // The front door: on the longest outer side of the biggest room (not the stairwell).
  const outerRuns = runs(outer.map((s) => ({ ...s, b: -1 })));
  if (req.entrance) {
    const order = rooms
      .map((r, i) => ({ i, size: r.type === 'stairs' ? -1 : r.cells.length }))
      .sort((p, q) => q.size - p.size);
    for (const { i } of order) {
      const theirs = outerRuns.filter((run) => run[0]?.a === i).sort((p, q) => q.length - p.length);
      const run = theirs[0];
      const side = run ? doorAt(run, doorRand) : undefined;
      if (side) {
        doors.push({ ...onWall(req.footprint, middle(side)), outer: true, rooms: [i] });
        break;
      }
    }
  }

  // Windows: every few squares along the outer walls, clear of doors and corners.
  const windows: PlanWindow[] = [];
  if (req.windows)
    for (const run of outerRuns) {
      if (rooms[run[0]?.a ?? -1]?.type === 'stairs') continue;
      for (let k = 1; k < run.length - 1; k += 3) {
        const side = run[k];
        if (!side) continue;
        const at = middle(side);
        if (doors.some((d) => Math.hypot(d.x - at.x, d.y - at.y) < req.cell * 1.5)) continue;
        windows.push(onWall(req.footprint, at));
      }
    }

  return { rooms, doors, windows, stairs, walls };
}
