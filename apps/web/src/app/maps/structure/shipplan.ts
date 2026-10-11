import type { BuildingSpec, MapItem } from '../model';
import { parsePackRef, squaresOf } from '../packModel';
import { cellsInPolygon, parseCell } from './cells';
import { joinRooms, planFloor, stairwell, type FloorPlan, type PlanRoom } from './floorplan';
import { seeded } from '../terrain';

/**
 * Ships for sea and sky, built from the Aquatic pack's parts. A ship is a structure (one item per
 * deck, ADR 0015) whose footprint is its hull: a flat stern, straight sides and a bow curving to a
 * point. The main deck has a captain's cabin at the stern (bigger ships), masts with their sails
 * on yards (shown with the map's roofs), cannons along both sides, a capstan, an anchor (sea only),
 * a bowsprit, a rudder and stern lanterns; the lower deck is cut into a hold, crew quarters, a gun
 * deck or (sky ships) an engine room round a shard core, with a ladder in the same cells on both
 * decks. Small boats are one picture (a rowboat, a canoe, a raft, a sailboat). Pure.
 *
 * Facts checked on the real pictures: ships and boats point up (bow at the top), cannon muzzles
 * point down, sails on yards lie across, bowsprits run fore and aft.
 */

export interface ShipClass {
  /** Lengthwise places of the masts, 0 at the stern, 1 at the bow. */
  masts: number[];
  /** Cannons on each side of the main deck. */
  guns: number;
  /** A captain's cabin at the stern of the main deck. */
  cabin: boolean;
  /** A small boat: one picture, no decks. */
  boat?: 'rowboat' | 'canoe' | 'raft' | 'sailboat';
}

export const SHIP_CLASSES: Record<string, ShipClass> = {
  rowboat: { masts: [], guns: 0, cabin: false, boat: 'rowboat' },
  canoe: { masts: [], guns: 0, cabin: false, boat: 'canoe' },
  raft: { masts: [], guns: 0, cabin: false, boat: 'raft' },
  sailboat: { masts: [], guns: 0, cabin: false, boat: 'sailboat' },
  sloop: { masts: [0.55], guns: 0, cabin: false },
  skiff: { masts: [0.33, 0.66], guns: 2, cabin: true },
  corsair: { masts: [0.3, 0.62], guns: 4, cabin: true },
  warship: { masts: [0.24, 0.5, 0.75], guns: 7, cabin: true },
};

export const shipClassOf = (archetype: string): ShipClass | undefined => SHIP_CLASSES[archetype];

type Heading = NonNullable<BuildingSpec['ship']>['heading'];

/** Where a ship lies: its middle, the way its bow points and its right side (unit vectors), its size. */
export interface ShipFrame {
  cx: number;
  cy: number;
  fx: number;
  fy: number;
  rx: number;
  ry: number;
  /** Bow to stern and side to side (map pixels). */
  length: number;
  beam: number;
}

const FORWARD: Record<Heading, [number, number]> = {
  0: [0, -1],
  90: [1, 0],
  180: [0, 1],
  270: [-1, 0],
};

/** The frame of a ship filling a box, its bow pointing `heading` degrees clockwise from up. */
export function boxFrame(
  box: { x0: number; y0: number; x1: number; y1: number },
  heading: Heading,
): ShipFrame {
  const [fx, fy] = FORWARD[heading];
  const across = heading === 0 || heading === 180;
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  return {
    cx: (box.x0 + box.x1) / 2,
    cy: (box.y0 + box.y1) / 2,
    fx,
    fy,
    rx: -fy,
    ry: fx,
    length: across ? h : w,
    beam: across ? w : h,
  };
}

/** A point of the ship: `t` from stern (0) to bow (1), `s` pixels to the right of the middle line. */
export const shipPoint = (f: ShipFrame, t: number, s: number): [number, number] => [
  f.cx + f.fx * (t - 0.5) * f.length + f.rx * s,
  f.cy + f.fy * (t - 0.5) * f.length + f.ry * s,
];

/** The hull: a flat stern with rounded corners, straight sides, a bow curving to a point. */
export function hullOutline(f: ShipFrame): number[] {
  const half = f.beam / 2;
  const round = Math.min(f.beam / 4, f.length * 0.04);
  const straight = 0.55;
  const left: [number, number][] = [];
  // Up the left side from the stern, then round the bow.
  left.push([0, -half + round], [round / f.length, -half]);
  left.push([straight, -half]);
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    const t = straight + (1 - straight) * u;
    left.push([t, -half * (1 - Math.pow(u, 1.8))]);
  }
  const right = left.map(([t, s]) => [t, -s] as [number, number]).reverse();
  const ring = [...left, [1, 0] as [number, number], ...right];
  return ring.flatMap(([t, s]) => shipPoint(f, t, s).map((v) => Math.round(v)));
}

/** The frame of a ship structure, from its hull and heading. */
export function shipFrame(points: readonly number[], heading: Heading): ShipFrame {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    x0 = Math.min(x0, points[i] ?? 0);
    x1 = Math.max(x1, points[i] ?? 0);
    y0 = Math.min(y0, points[i + 1] ?? 0);
    y1 = Math.max(y1, points[i + 1] ?? 0);
  }
  return boxFrame({ x0, y0, x1, y1 }, heading);
}

/** How far along a ship (0 stern, 1 bow) a cell's middle is. */
const alongOf = (f: ShipFrame, key: string, cell: number) => {
  const [cx, cy] = parseCell(key);
  const x = (cx + 0.5) * cell - f.cx;
  const y = (cy + 0.5) * cell - f.cy;
  return (x * f.fx + y * f.fy) / f.length + 0.5;
};

export interface ShipRequest {
  hull: readonly number[];
  cell: number;
  seed: number;
  stairSeed?: number;
  floor: number;
  heading: Heading;
  rooms: number;
  lowerDeck: boolean;
  locked?: readonly PlanRoom[];
  cabin: boolean;
}

/**
 * A deck's plan. The main deck: the deck itself and a captain's cabin at the stern, the ladder's
 * cells kept clear. The lower deck: cut into rooms like a building's floor, the ladder in the
 * same cells.
 */
export function planShip(req: ShipRequest): FloorPlan {
  const cells = cellsInPolygon(req.hull, req.cell);
  const stairSeed = req.stairSeed ?? req.seed;
  if (req.floor < 0)
    return planFloor({
      footprint: req.hull,
      cell: req.cell,
      seed: req.seed,
      stairSeed,
      floor: req.floor,
      rooms: req.rooms,
      ...(req.locked ? { locked: req.locked } : {}),
      stairs: true,
      entrance: false,
      windows: false,
    });
  const f = shipFrame(req.hull, req.heading);
  const stairs = req.lowerDeck ? stairwell(cells, stairSeed) : [];
  const taken = new Set(stairs);
  const rand = seeded((req.seed * 31 + 3) >>> 0);
  const cabin = req.cabin
    ? [...cells].filter((k) => !taken.has(k) && alongOf(f, k, req.cell) < 0.2).sort()
    : [];
  const inCabin = new Set(cabin);
  const deck = [...cells].filter((k) => !taken.has(k) && !inCabin.has(k)).sort();
  const rooms: PlanRoom[] = [
    { id: 1, cells: deck, type: 'deck', seed: Math.floor(rand() * 2 ** 31) },
    ...(cabin.length >= 4
      ? [{ id: 2, cells: cabin, type: 'captain-cabin', seed: Math.floor(rand() * 2 ** 31) }]
      : []),
  ];
  const joined = joinRooms(rooms, req.cell, req.hull, seeded((req.seed * 31 + 7) >>> 0), {
    entrance: false,
    windows: false,
  });
  return { rooms, stairs, ...joined };
}

type Stamp = Extract<MapItem, { kind: 'stamp' }>;

/** The gold of solar sails (a multiply tint over the sail cloth). */
export const SOLAR = '#f2c45a';

/**
 * The main deck's fittings as stamps (ids `${id}~s…`): masts, cannons, capstan, anchor, bowsprit,
 * rudder, lanterns, and the sails and crow's nest while the roofs are shown. A small boat is its
 * picture (and a sailboat's mast and sail).
 */
export function shipParts(
  id: string,
  spec: BuildingSpec,
  hull: readonly number[],
  unit: number,
  options: { sails: boolean },
): Stamp[] {
  const cls = shipClassOf(spec.archetype);
  const parts = spec.palette.parts ?? {};
  if (!cls) return [];
  const heading = spec.ship?.heading ?? 0;
  const sky = spec.ship?.medium === 'sky';
  const f = shipFrame(hull, heading);
  const out: Stamp[] = [];
  const put = (
    key: string,
    ref: string | undefined,
    [x, y]: [number, number],
    turn: number,
    size?: { w: number; h: number },
    tint?: string,
  ) => {
    if (!ref) return;
    const squares = squaresOf(parsePackRef(ref)?.path ?? '') ?? { w: 1, h: 1 };
    out.push({
      kind: 'stamp',
      id: `${id}~s${key}`,
      stamp: ref,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(size?.w ?? squares.w * unit),
      h: Math.round(size?.h ?? squares.h * unit),
      rotation: (((heading + turn) % 360) + 360) % 360,
      ...(tint ? { tint } : {}),
    });
  };
  /** A picture stretched to fill the ship's length (it points up, as the ship does). */
  const fill = (key: string, ref: string | undefined, tint?: string) => {
    if (!ref) return;
    const squares = squaresOf(parsePackRef(ref)?.path ?? '') ?? { w: 1, h: 1 };
    const k = f.length / (squares.h * unit);
    put(key, ref, [f.cx, f.cy], 0, { w: squares.w * unit * k, h: f.length }, tint);
  };
  if (cls.boat) {
    if (cls.boat === 'raft') put('boat', parts.raft, [f.cx, f.cy], 0);
    else if (cls.boat === 'canoe') fill('boat', parts.canoe);
    else {
      fill('boat', parts.rowboat);
      if (cls.boat === 'sailboat') {
        put('mast', parts.boatMast, [f.cx, f.cy], 0);
        if (options.sails)
          put('sail', parts.boatSail, shipPoint(f, 0.55, 0), 0, undefined, sky ? SOLAR : undefined);
      }
    }
    return out;
  }
  const cells = f.length / unit;
  const side = f.beam / 2;
  cls.masts.forEach((t, i) => {
    put(`base${String(i)}`, parts.mastBase, shipPoint(f, t, 0), 0);
    put(`mast${String(i)}`, parts.mast, shipPoint(f, t, 0), 0);
  });
  // Cannons along both sides, muzzles out (the picture's muzzle points down).
  for (let g = 0; g < cls.guns; g++) {
    const t = cls.guns === 1 ? 0.45 : 0.25 + (0.45 * g) / (cls.guns - 1);
    for (const [name, s, turn] of [
      ['r', side - unit * 1.1, 270],
      ['l', -side + unit * 1.1, 90],
    ] as const) {
      put(`cb${String(g)}${name}`, parts.cannonBase, shipPoint(f, t, s), turn);
      put(`cn${String(g)}${name}`, parts.cannon, shipPoint(f, t, s), turn);
    }
  }
  if (cells >= 16) put('capstan', parts.capstan, shipPoint(f, 0.8, 0), 0);
  if (!sky && cells >= 16) put('anchor', parts.anchor, shipPoint(f, 0.84, side - unit * 1.8), 0);
  // The bowsprit reaches past the bow; the rudder past the stern, fore and aft.
  put('bowsprit', parts.bowsprit, shipPoint(f, 1 + (unit * 2.5) / f.length, 0), 0);
  put('rudder', parts.rudder, shipPoint(f, -(unit * 0.6) / f.length, 0), 90);
  for (const [name, s] of [
    ['r', side - unit * 0.9],
    ['l', -side + unit * 0.9],
  ] as const)
    put(`lamp${name}`, parts.lantern, shipPoint(f, 0.04, s), 0);
  if (options.sails) {
    const middle = Math.floor(cls.masts.length / 2);
    cls.masts.forEach((t, i) => {
      const ref = parts.sail;
      const squares = squaresOf(parsePackRef(ref ?? '')?.path ?? '') ?? { w: 10, h: 2 };
      // Across the deck and past both sides; the masts away from the middle a little smaller.
      const w = (f.beam + unit * 4) * (i === middle ? 1 : 0.85);
      put(
        `sail${String(i)}`,
        ref,
        shipPoint(f, t, 0),
        0,
        { w, h: (w * squares.h) / squares.w },
        sky ? SOLAR : undefined,
      );
    });
    const main = cls.masts[middle];
    if (main !== undefined) put('nest', parts.crowsNest, shipPoint(f, main, 0), 0);
  }
  return out;
}
