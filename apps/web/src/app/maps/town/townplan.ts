import { hash01, type DistrictGeo } from '../city';
import { pointInPolygon } from '../polygon';
import { nearestOnPolyline } from '../spline';
import type { DistrictStyleId } from '../cityDoc';
import type { TownLook } from './looks';

/**
 * A town of whole buildings, planned from a district's lots: each lot gets the biggest rectangle
 * of whole grid squares that fits in it, and a building chosen by where it stands (zoning). The
 * middle of the town (round its square) has the shops, the inn and tavern, the guildhall and the
 * temple, built tall and in the town's best stone; the streets round it houses with a smithy or a
 * warehouse; the edge farmhouses, warehouses and low, worn houses. Every building faces its
 * street. Styles are mixed by the town's look; the same district, look and seed always give the
 * same town. Pure.
 */

export interface TownLot {
  /** The district lot it stands on (`column,row,lot`): the first of `keys`. */
  key: string;
  /** Every lot it stands on (two for a hall: a tavern, a temple). */
  keys: string[];
  /** The rectangle of whole squares, in map pixels: x0, y0, x1, y1 as an outline. */
  footprint: number[];
  /** Squares across and down. */
  w: number;
  h: number;
  archetype: string;
  style: string;
  name: string;
  upper: number;
  cellar: boolean;
  rooms: number;
  dressing: 'bare' | 'lived-in' | 'cluttered';
  condition: 'kept' | 'worn' | 'ruined';
  /** The way to its street (a unit vector). */
  facing: { x: number; y: number };
  /** 0 the middle of the town, 1 its edge. */
  ring: number;
}

export interface TownOptions {
  look: TownLook;
  /** The district's style (a noble quarter has manors, a market more shops). */
  district: DistrictStyleId;
  seed: number;
  /** The grid's square (map pixels). */
  cell: number;
  /** Most buildings (the biggest lots nearest the middle first). */
  max: number;
  /** Smallest building side, in squares. */
  minSide?: number;
}

/** Each zone's buildings and how often each comes up. */
type Weights = Record<string, number>;

const CORE: Weights = { shop: 4, tavern: 2, house: 2, guildhall: 1, temple: 1, manor: 1 };
const MIDDLE: Weights = { house: 6, shop: 2, smithy: 1, tavern: 1, warehouse: 1 };
const EDGE: Weights = { house: 5, farmhouse: 2, warehouse: 2, smithy: 1, barracks: 0.5 };

/** Buildings that need a big lot (a common room, a nave, a hall): five squares across at least. */
const BIG = ['tavern', 'guildhall', 'temple', 'manor', 'warehouse', 'barracks'];

/** About how many squares each room of a building takes (14 when not listed). */
const SQUARES_PER_ROOM: Record<string, number> = {
  tavern: 28,
  temple: 40,
  warehouse: 30,
  guildhall: 22,
  barracks: 26,
  smithy: 18,
};

/** Only one of each in a town. */
const UNIQUE = new Set(['guildhall', 'temple', 'barracks', 'keep']);

/** What each district style adds to its zones. */
const BY_DISTRICT: Partial<Record<DistrictStyleId, Weights>> = {
  noble: { manor: 6, temple: 1, house: 1 },
  market: { shop: 5, tavern: 2, warehouse: 1 },
  dense: { house: 3, shop: 2 },
  ward: { barracks: 2, smithy: 2, warehouse: 2 },
};

/** Names for the inns and taverns: "The Gilded Stag". */
const TAVERN_FIRST = [
  'Gilded',
  'Prancing',
  'Rusty',
  'Sleeping',
  'Drunken',
  'Laughing',
  'Old',
  'Silver',
  'Crooked',
  'Wandering',
  'Red',
  'Salty',
];
const TAVERN_SECOND = [
  'Stag',
  'Pony',
  'Anchor',
  'Dragon',
  'Goose',
  'Barrel',
  'Lantern',
  'Griffin',
  'Kettle',
  'Boar',
  'Crown',
  'Mermaid',
];
const NAMES: Record<string, string> = {
  house: 'House',
  shop: 'Shop',
  smithy: 'Smithy',
  warehouse: 'Warehouse',
  farmhouse: 'Farmhouse',
  temple: 'Temple',
  manor: 'Manor',
  guildhall: 'Guildhall',
  barracks: 'Barracks',
};

/** A weighted pick with a number from 0 to 1. */
function pick(weights: Weights, r: number): string {
  const list = Object.entries(weights).filter(([, w]) => w > 0);
  const total = list.reduce((s, [, w]) => s + w, 0);
  let at = r * total;
  for (const [id, w] of list) {
    at -= w;
    if (at < 0) return id;
  }
  return list[list.length - 1]?.[0] ?? 'house';
}

/**
 * The biggest rectangle of whole squares inside a polygon (map pixels): every corner of every
 * square in it is inside. Null when not even one square fits.
 */
export function largestRect(
  poly: readonly number[],
  cell: number,
): { x: number; y: number; w: number; h: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < poly.length; i += 2) {
    x0 = Math.min(x0, poly[i] ?? 0);
    x1 = Math.max(x1, poly[i] ?? 0);
    y0 = Math.min(y0, poly[i + 1] ?? 0);
    y1 = Math.max(y1, poly[i + 1] ?? 0);
  }
  if (!Number.isFinite(x0)) return null;
  const cx0 = Math.ceil(x0 / cell);
  const cy0 = Math.ceil(y0 / cell);
  const cols = Math.floor(x1 / cell) - cx0;
  const rows = Math.floor(y1 / cell) - cy0;
  if (cols < 1 || rows < 1) return null;
  // Which grid corners are inside (on the edge counts), then which squares have all four.
  const ring = [...poly, poly[0] ?? 0, poly[1] ?? 0];
  const corner = (i: number, j: number) => {
    const p = { x: (cx0 + i) * cell, y: (cy0 + j) * cell };
    return pointInPolygon(p, poly) || nearestOnPolyline(ring, p).dist < 1e-6;
  };
  const across = cols + 1;
  const inside = new Uint8Array(across * (rows + 1));
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) inside[j * across + i] = corner(i, j) ? 1 : 0;
  const at = (i: number, j: number) => inside[j * across + i] === 1;
  const full = (i: number, j: number) =>
    at(i, j) && at(i + 1, j) && at(i, j + 1) && at(i + 1, j + 1);
  // The largest rectangle in a histogram, row by row.
  const heights = new Array<number>(cols).fill(0);
  let best: { x: number; y: number; w: number; h: number } | null = null;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) heights[i] = full(i, j) ? (heights[i] ?? 0) + 1 : 0;
    const stack: number[] = [];
    for (let i = 0; i <= cols; i++) {
      const h = i < cols ? (heights[i] ?? 0) : 0;
      while (stack.length > 0 && (heights[stack[stack.length - 1] ?? 0] ?? 0) >= h) {
        const top = stack.pop() ?? 0;
        const height = heights[top] ?? 0;
        const left = stack.length > 0 ? (stack[stack.length - 1] ?? 0) + 1 : 0;
        const width = i - left;
        // The biggest area; of two the same, the squarer.
        if (
          height > 0 &&
          (!best ||
            width * height > best.w * best.h ||
            (width * height === best.w * best.h &&
              Math.min(width, height) > Math.min(best.w, best.h)))
        )
          best = { x: cx0 + left, y: cy0 + j - height + 1, w: width, h: height };
      }
      stack.push(i);
    }
  }
  return best;
}

/** The middle of an outline. */
function middleOf(line: readonly number[]): { x: number; y: number } {
  const n = Math.max(1, Math.floor(line.length / 2));
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < line.length; i += 2) {
    x += line[i] ?? 0;
    y += line[i + 1] ?? 0;
  }
  return { x: x / n, y: y / n };
}

const closed = (line: readonly number[]) => [...line, line[0] ?? 0, line[1] ?? 0];

/** The way from a point to the nearest street: out through the nearest edge of its block. */
function towardsStreet(
  p: { x: number; y: number },
  blocks: readonly number[][],
): { x: number; y: number } {
  const block = blocks.find((b) => pointInPolygon(p, b)) ?? blocks[0];
  if (!block) return { x: 0, y: 1 };
  const near = nearestOnPolyline(closed(block), p);
  const dx = near.x - p.x;
  const dy = near.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 1 };
  // Square on: the front door goes on a wall, and walls run along the grid.
  return Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A place to build: one lot, or two joined (a hall). */
interface Site {
  keys: string[];
  r: Rect;
  mid: { x: number; y: number };
  dist: number;
  hall: boolean;
}

/** A joined hall: at least this many squares across, and in all. */
const HALL_SIDE = 7;
const HALL_AREA = 56;

/** What the joined lots become, in turn. */
const HALLS = ['tavern', 'temple', 'guildhall', 'tavern', 'manor', 'warehouse', 'tavern'];

/** The block a lot is in (its key without the lot's own number). */
const blockOf = (key: string) => key.split(',').slice(0, 2).join(',');

/** The convex hull of points (x, y pairs), as an outline. */
export function convexHull(points: readonly number[]): number[] {
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < points.length; i += 2) pts.push([points[i] ?? 0, points[i + 1] ?? 0]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts.flat();
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2] ?? p, out[out.length - 1] ?? p, p) <= 0)
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())].flat();
}

/** Whether a rectangle of squares reaches into any lot but its own. */
function intrudes(
  r: Rect,
  cell: number,
  lots: readonly { key: string; poly: number[] }[],
  own: readonly string[],
): boolean {
  const x0 = r.x * cell;
  const y0 = r.y * cell;
  const x1 = (r.x + r.w) * cell;
  const y1 = (r.y + r.h) * cell;
  for (const lot of lots) {
    if (own.includes(lot.key)) continue;
    let lx0 = Infinity;
    let ly0 = Infinity;
    let lx1 = -Infinity;
    let ly1 = -Infinity;
    for (let i = 0; i + 1 < lot.poly.length; i += 2) {
      lx0 = Math.min(lx0, lot.poly[i] ?? 0);
      lx1 = Math.max(lx1, lot.poly[i] ?? 0);
      ly0 = Math.min(ly0, lot.poly[i + 1] ?? 0);
      ly1 = Math.max(ly1, lot.poly[i + 1] ?? 0);
    }
    if (lx1 <= x0 || lx0 >= x1 || ly1 <= y0 || ly0 >= y1) continue;
    for (let j = 0; j < r.h; j++)
      for (let i = 0; i < r.w; i++)
        if (pointInPolygon({ x: x0 + (i + 0.5) * cell, y: y0 + (j + 0.5) * cell }, lot.poly))
          return true;
  }
  return false;
}

/** The town's buildings, from the district's lots. */
export function planTown(
  geo: DistrictGeo,
  outline: readonly number[],
  options: TownOptions,
): TownLot[] {
  const { cell, look, seed } = options;
  const minSide = options.minSide ?? 3;
  const centre = geo.plaza ?? middleOf(outline);
  const distOf = (p: { x: number; y: number }) => Math.hypot(p.x - centre.x, p.y - centre.y);
  const site = (keys: string[], r: Rect, hall: boolean): Site => {
    const mid = { x: (r.x + r.w / 2) * cell, y: (r.y + r.h / 2) * cell };
    return { keys, r, mid, dist: distOf(mid), hall };
  };

  // Halls first: near the middle, two neighbouring lots of a block joined into one building big
  // enough for a common room or a nave (a single lot rarely is).
  const lotsFar = Math.max(1, ...geo.buildings.map((b) => distOf(middleOf(b.poly))));
  const wanted = Math.max(1, Math.round(geo.buildings.length / 20));
  const taken = new Set<string>();
  const halls: Site[] = [];
  const byDistance = [...geo.buildings].sort(
    (a, b) => distOf(middleOf(a.poly)) - distOf(middleOf(b.poly)),
  );
  for (const a of byDistance) {
    if (halls.length >= wanted || distOf(middleOf(a.poly)) / lotsFar > 0.6) break;
    if (taken.has(a.key)) continue;
    const block = blockOf(a.key);
    let best: Site | null = null;
    for (const b of geo.buildings) {
      if (b === a || taken.has(b.key) || blockOf(b.key) !== block) continue;
      const r = largestRect(convexHull([...a.poly, ...b.poly]), cell);
      if (!r || Math.min(r.w, r.h) < HALL_SIDE || r.w * r.h < HALL_AREA) continue;
      if (intrudes(r, cell, geo.buildings, [a.key, b.key])) continue;
      if (!best || r.w * r.h > best.r.w * best.r.h) best = site([a.key, b.key], r, true);
    }
    if (best) {
      halls.push(best);
      for (const k of best.keys) taken.add(k);
    }
  }
  const singles = geo.buildings.flatMap((b) => {
    if (taken.has(b.key)) return [];
    const r = largestRect(b.poly, cell);
    if (!r || Math.min(r.w, r.h) < minSide) return [];
    return [site([b.key], r, false)];
  });
  const rects = [...halls, ...singles];
  if (rects.length === 0) return [];
  const far = Math.max(1, ...rects.map((x) => x.dist));
  // The most buildings: the ones nearest the middle, the town thinning towards its edge.
  const chosen = [...rects].sort((a, b) => a.dist - b.dist).slice(0, Math.max(0, options.max));
  const extra = BY_DISTRICT[options.district] ?? {};
  const used = new Set<string>();
  const taverns = { n: 0 };
  // The halls first, then the biggest lots of each zone (the guildhall gets a big one).
  const zoneOf = (dist: number) => Math.min(2, Math.floor((dist / far) * 3));
  const order = [...chosen].sort(
    (a, b) =>
      Number(b.hall) - Number(a.hall) ||
      zoneOf(a.dist) - zoneOf(b.dist) ||
      b.r.w * b.r.h - a.r.w * a.r.h,
  );
  const plan = new Map<string, TownLot>();
  let hallCount = 0;
  order.forEach(({ keys, r, mid, dist, hall: joined }, index) => {
    const ring = dist / far;
    const h = (n: number) => hash01(seed, index, n, r.x * 7 + r.y);
    const zone = ring < 0.35 ? CORE : ring < 0.7 ? MIDDLE : EDGE;
    const weights: Weights = { ...zone };
    for (const [id, w] of Object.entries(extra)) weights[id] = (weights[id] ?? 0) + w;
    for (const id of used) if (UNIQUE.has(id)) weights[id] = 0;
    // Big buildings want big lots.
    const area = r.w * r.h;
    const short = Math.min(r.w, r.h);
    const roomy = short >= 5 && area >= 35;
    // A common room with tables down its middle and room to walk round them.
    const hall = short >= HALL_SIDE && area >= HALL_AREA;
    for (const id of BIG) if (!roomy && weights[id]) weights[id] = 0;
    if (!hall && weights.tavern) weights.tavern = 0;
    if (area < 12 && weights.shop) weights.shop = 0;
    let archetype = pick(weights, h(1));
    // The joined lots: a tavern first, then the temple, the guildhall, more taverns.
    if (joined) {
      const next = HALLS.slice(hallCount).find((id) => !UNIQUE.has(id) || !used.has(id));
      if (next) archetype = next;
      hallCount++;
    }
    // A town of a few streets has at least one tavern, near its middle, on a lot big enough.
    if (taverns.n === 0 && ring < 0.5 && hall && chosen.length >= 6) archetype = 'tavern';
    if (archetype === 'tavern') taverns.n++;
    used.add(archetype);
    // The style: the look's mix, and its best stone for the middle's grand buildings.
    const grand = ['temple', 'guildhall', 'manor'].includes(archetype) || ring < 0.2;
    const style =
      grand && look.core && h(2) < 0.75
        ? look.core
        : pick(Object.fromEntries(look.styles.map((s) => [s.style, s.weight])), h(3));
    // Taller in the middle, low at the edge; only buildings big enough for a stairwell.
    const tall = Math.min(r.w, r.h) >= 4 && area >= 20;
    const dense = options.district === 'dense' ? 1 : 0;
    const upper = !tall
      ? 0
      : Math.max(0, Math.min(3, Math.round((1 - ring) * 2.2 + dense + (h(4) - 0.5) * 1.2 - 0.3)));
    const cellar =
      tall &&
      h(5) <
        (['tavern', 'manor', 'shop', 'guildhall', 'warehouse'].includes(archetype) ? 0.6 : 0.2);
    // Halls want few, big rooms: a tavern's common room, a temple's nave.
    const rooms = Math.max(1, Math.min(8, Math.round(area / (SQUARES_PER_ROOM[archetype] ?? 14))));
    // Worn towards the edge; now and then a ruin there.
    const wear = h(6);
    const condition: TownLot['condition'] =
      ring > 0.75 && wear < 0.08 ? 'ruined' : wear < 0.1 + ring * 0.45 ? 'worn' : 'kept';
    const dressing: TownLot['dressing'] = h(7) < 0.15 + ring * 0.25 ? 'cluttered' : 'lived-in';
    const name =
      archetype === 'tavern'
        ? `The ${TAVERN_FIRST[Math.floor(h(8) * TAVERN_FIRST.length)] ?? 'Old'} ${TAVERN_SECOND[Math.floor(h(9) * TAVERN_SECOND.length)] ?? 'Stag'}`
        : (NAMES[archetype] ?? 'House');
    const x0 = r.x * cell;
    const y0 = r.y * cell;
    const x1 = (r.x + r.w) * cell;
    const y1 = (r.y + r.h) * cell;
    plan.set(keys[0] ?? '', {
      key: keys[0] ?? '',
      keys,
      footprint: [x0, y0, x1, y0, x1, y1, x0, y1],
      w: r.w,
      h: r.h,
      archetype,
      style,
      name,
      upper,
      cellar,
      rooms,
      dressing,
      condition,
      facing: towardsStreet(mid, geo.blocks),
      ring,
    });
  });
  // In the district's own order (stable as lots come and go).
  return geo.buildings.flatMap((b) => {
    const lot = plan.get(b.key);
    return lot ? [lot] : [];
  });
}
