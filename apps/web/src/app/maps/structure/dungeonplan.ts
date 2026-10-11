import { seeded } from '../terrain';
import { cellKey, cellsInPolygon, components, parseCell } from './cells';
import { cutRooms, joinRooms, type FloorPlan, type PlanRoom } from './floorplan';

/**
 * Dungeons as plans on grid cells, the same shape as a building floor's (`floorplan.ts`), so a
 * dungeon is a one-floor structure: its rooms get types from a programme, furniture, locks and
 * Roll again like any building. Four layouts:
 *
 * - `rooms`: rooms apart from each other, joined by corridors two cells wide (each room to the
 *   next, and a few more for loops);
 * - `packed`: the whole area cut into rooms that touch, doors between them;
 * - `facility` (the Heliark ruins): a spine corridor down the long side with cross corridors every
 *   few cells, the blocks between them cut into rooms;
 * - `caves`: caverns grown by a cellular automaton, split into a few areas that open into each
 *   other (no walls or doors between them).
 *
 * Corridors are rooms of type `corridor`. Pure: the same area, seed and locks give the same plan.
 */

export type DungeonLayout = 'rooms' | 'packed' | 'facility' | 'caves';

export interface DungeonRequest {
  footprint: readonly number[];
  cell: number;
  seed: number;
  /** How many rooms (caverns) to aim for. */
  rooms: number;
  layout: DungeonLayout;
  locked?: readonly PlanRoom[];
}

type Cell = [number, number];

const neighbours4 = ([x, y]: Cell): Cell[] => [
  [x + 1, y],
  [x - 1, y],
  [x, y + 1],
  [x, y - 1],
];

function bbox(cells: Iterable<string>) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const k of cells) {
    const [x, y] = parseCell(k);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

/** Rooms of 3–7 by 3–6 cells with a cell clear round them, and the corridors joining them. */
function roomsAndCorridors(
  free: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  target: number,
  rand: () => number,
): { rooms: string[][]; corridor: Set<string> } {
  const box = bbox(free);
  const rooms: string[][] = [];
  const used = new Set(blocked);
  const centres: Cell[] = [];
  for (let attempt = 0; attempt < target * 60 && rooms.length < target; attempt++) {
    const w = 3 + Math.floor(rand() * 5);
    const h = 3 + Math.floor(rand() * 4);
    const gx = box.x0 + 1 + Math.floor(rand() * Math.max(1, box.x1 - box.x0 - w));
    const gy = box.y0 + 1 + Math.floor(rand() * Math.max(1, box.y1 - box.y0 - h));
    const cells: string[] = [];
    let ok = true;
    for (let x = gx - 1; x <= gx + w && ok; x++)
      for (let y = gy - 1; y <= gy + h && ok; y++) {
        const k = cellKey(x, y);
        const inside = x >= gx && x < gx + w && y >= gy && y < gy + h;
        if (inside && !free.has(k)) ok = false;
        // A cell of margin all round: rooms never touch (corridors join them).
        if (used.has(k)) ok = false;
        if (inside) cells.push(k);
      }
    if (!ok) continue;
    rooms.push(cells.sort());
    for (const k of cells) used.add(k);
    centres.push([gx + Math.floor(w / 2), gy + Math.floor(h / 2)]);
  }
  // Each room to the next from left to right, and about a quarter more for loops.
  const order = centres.map((c, i) => ({ c, i })).sort((a, b) => a.c[0] - b.c[0]);
  const pairs: [Cell, Cell][] = [];
  for (let n = 0; n + 1 < order.length; n++) {
    const a = order[n];
    const b = order[n + 1];
    if (a && b) pairs.push([a.c, b.c]);
  }
  for (let k = 0; k < Math.floor(order.length / 4); k++) {
    const a = order[Math.floor(rand() * order.length)];
    const b = order[Math.floor(rand() * order.length)];
    if (a && b && a !== b) pairs.push([a.c, b.c]);
  }
  const inRoom = new Set(rooms.flat());
  const corridor = new Set<string>();
  const lay = (x: number, y: number) => {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      const k = cellKey(x + dx, y + dy);
      if (free.has(k) && !inRoom.has(k) && !blocked.has(k)) corridor.add(k);
    }
  };
  for (const [a, b] of pairs) {
    // Along x first, then along y (or the other way round, at random).
    const xFirst = rand() < 0.5;
    const corner: Cell = xFirst ? [b[0], a[1]] : [a[0], b[1]];
    for (const [p, q] of [
      [a, corner],
      [corner, b],
    ] as const) {
      const steps = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
      for (let s = 0; s <= steps; s++)
        lay(p[0] + Math.sign(q[0] - p[0]) * s, p[1] + Math.sign(q[1] - p[1]) * s);
    }
  }
  return { rooms, corridor };
}

/** A spine corridor down the long side, cross corridors every 7 cells, the blocks cut into rooms. */
function facility(
  free: ReadonlySet<string>,
  target: number,
  rand: () => number,
): { rooms: string[][]; corridor: Set<string> } {
  const box = bbox(free);
  const wide = box.x1 - box.x0 >= box.y1 - box.y0;
  const corridor = new Set<string>();
  const mid = wide ? Math.floor((box.y0 + box.y1) / 2) : Math.floor((box.x0 + box.x1) / 2);
  const offset = Math.floor(rand() * 3);
  for (const k of free) {
    const [x, y] = parseCell(k);
    const across = wide ? y : x;
    const along = wide ? x : y;
    const spine = across === mid || across === mid + 1;
    const cross = (along - (wide ? box.x0 : box.y0) - offset) % 7 === 0;
    if (spine || cross) corridor.add(k);
  }
  const blocks = components(new Set([...free].filter((k) => !corridor.has(k))));
  const per = Math.max(4, free.size / Math.max(1, target));
  const rooms = blocks.flatMap((b) =>
    cutRooms(new Set(b), Math.max(1, Math.round(b.length / per)), rand),
  );
  return { rooms, corridor };
}

/**
 * Caverns: cells left open by a cellular automaton (45% rock, smoothed four times), the biggest
 * cave kept, split into `target` areas grown from seeds spread over it.
 */
function caves(free: ReadonlySet<string>, target: number, rand: () => number): string[][] {
  const rockAround = (k: string, rock: ReadonlySet<string>) => {
    const [x, y] = parseCell(k);
    let around = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const n = cellKey(x + dx, y + dy);
        if (!free.has(n) || rock.has(n)) around++;
      }
    return around;
  };
  // Rock at the rim of the area, and about half of the rest.
  let rock = new Set([...free].filter((k) => rockAround(k, new Set()) > 0 || rand() < 0.47));
  // Rock stays rock with four rock cells round it, and open ground fills in with five.
  for (let step = 0; step < 5; step++) {
    const next = new Set<string>();
    for (const k of free) {
      const around = rockAround(k, rock);
      if (around >= 5 || (rock.has(k) && around >= 4)) next.add(k);
    }
    rock = next;
  }
  // Dead ends a cell wide are filled in (they read as notches in the wall).
  for (let step = 0; step < 2; step++)
    for (const k of free) {
      if (rock.has(k)) continue;
      const open = neighbours4(parseCell(k)).filter(([x, y]) => {
        const n = cellKey(x, y);
        return free.has(n) && !rock.has(n);
      }).length;
      if (open <= 1) rock.add(k);
    }
  const open = components(new Set([...free].filter((k) => !rock.has(k)))).sort(
    (a, b) => b.length - a.length,
  )[0];
  if (!open || open.length === 0) return [];
  // Seeds as far from each other as can be, then every cell to its nearest seed (by steps).
  const cells = open.map(parseCell);
  const start = cells[Math.floor(rand() * cells.length)] ?? cells[0];
  if (!start) return [];
  const seeds: Cell[] = [start];
  const count = Math.max(1, Math.min(target, Math.floor(open.length / 12)));
  while (seeds.length < count) {
    let best: Cell | null = null;
    let far = -1;
    for (const c of cells) {
      const d = Math.min(...seeds.map((s) => Math.abs(s[0] - c[0]) + Math.abs(s[1] - c[1])));
      if (d > far) {
        far = d;
        best = c;
      }
    }
    if (!best) break;
    seeds.push(best);
  }
  const owner = new Map<string, number>();
  const queue: [Cell, number][] = seeds.map((s, i) => [s, i]);
  const inside = new Set(open);
  for (const [s, i] of queue) owner.set(cellKey(s[0], s[1]), i);
  // Breadth first: the cells pushed while going are visited too.
  for (const [c, i] of queue) {
    for (const n of neighbours4(c)) {
      const k = cellKey(n[0], n[1]);
      if (!inside.has(k) || owner.has(k)) continue;
      owner.set(k, i);
      queue.push([n, i]);
    }
  }
  return seeds
    .map((_, i) => open.filter((k) => owner.get(k) === i).sort())
    .filter((g) => g.length > 0);
}

export function planDungeon(req: DungeonRequest): FloorPlan {
  const cells = cellsInPolygon(req.footprint, req.cell);
  const rand = seeded((req.seed * 31 + 17) >>> 0);
  const locked = (req.locked ?? []).filter((r) => r.cells.every((c) => cells.has(c)));
  const taken = new Set(locked.flatMap((r) => r.cells));
  const free = new Set([...cells].filter((c) => !taken.has(c)));
  const target = Math.max(1, req.rooms - locked.length);
  let cut: string[][] = [];
  let corridor = new Set<string>();
  if (free.size > 0) {
    if (req.layout === 'packed') cut = cutRooms(free, target, rand);
    else if (req.layout === 'caves') cut = caves(free, target, rand);
    else if (req.layout === 'facility') ({ rooms: cut, corridor } = facility(free, target, rand));
    else ({ rooms: cut, corridor } = roomsAndCorridors(free, taken, target, rand));
  }
  const usedIds = new Set(locked.map((r) => r.id));
  let nextId = 1;
  const freshId = () => {
    while (usedIds.has(nextId)) nextId++;
    usedIds.add(nextId);
    return nextId;
  };
  const rooms: PlanRoom[] = [
    ...locked.map((r) => ({ ...r, locked: true })),
    ...cut.map((c) => ({
      id: freshId(),
      cells: c,
      type: 'room',
      seed: Math.floor(rand() * 2 ** 31),
    })),
    ...components(corridor).map((c) => ({
      id: freshId(),
      cells: c.sort(),
      type: 'corridor',
      seed: Math.floor(rand() * 2 ** 31),
    })),
  ].sort((a, b) => a.id - b.id);
  // Caverns open into each other: no walls or doors between them.
  if (req.layout === 'caves') return { rooms, doors: [], windows: [], stairs: [], walls: [] };
  const joined = joinRooms(rooms, req.cell, req.footprint, seeded((req.seed * 31 + 104729) >>> 0), {
    entrance: false,
    windows: false,
  });
  return { rooms, stairs: [], ...joined };
}
