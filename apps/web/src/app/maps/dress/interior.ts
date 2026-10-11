import type { DressRule } from '../model';
import { pointInPolygon } from '../polygon';
import { pickIndex, type Instance } from '../scatter';

/**
 * Furniture in a room: placements that know walls, corners, doors and each other. Pure.
 *
 * Forgotten Adventures furniture faces down: a chair's back and a wardrobe's back are at the top
 * of the picture. So "back to the wall" turns the picture's top towards the wall, and "facing the
 * table" turns its bottom towards the table.
 *
 * Every piece is a box (centre, width, height, angle); boxes never overlap other pieces (pieces
 * `around` or `on` an anchor may overlap that anchor), never block a doorway, and stay inside the
 * floor (the room's outline, already in from its walls).
 */

/** A piece on the map as a turned rectangle: centre, width and height, angle in radians. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

/** A placed piece and its box. */
export interface Placed {
  inst: Instance;
  box: Box;
  /** Lies flat on the floor (a rug): other pieces may stand on it. */
  soft?: boolean;
  /** Stands back to a wall or in a corner (not in the room, where people walk round it). */
  onWall?: boolean;
}

export interface InteriorContext {
  /** The floor, in from the walls. */
  outline: readonly number[];
  /** Doorways (on the room's walls), kept clear by about a square. */
  doors: readonly { x: number; y: number }[];
  /** The grid's square. */
  cell: number;
  rand: () => number;
  /** The width and height of a piece of a rule, at the size given. */
  boxOf: (rule: DressRule, piece: number, size: number) => { w: number; h: number };
  /** Every piece placed so far, by the rule that placed it. */
  placed: readonly (readonly Placed[])[];
}

// region Geometry

const axes = (b: Box) => {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return { ux: c, uy: s, vx: -s, vy: c };
};

/** Whether two turned rectangles overlap (separating axes), shrunk by `pad` each side. */
export function boxesOverlap(a: Box, b: Box, pad = 0): boolean {
  const A = axes(a);
  const B = axes(b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ha = { w: Math.max(0, a.w / 2 - pad), h: Math.max(0, a.h / 2 - pad) };
  const hb = { w: Math.max(0, b.w / 2 - pad), h: Math.max(0, b.h / 2 - pad) };
  for (const [ax, ay] of [
    [A.ux, A.uy],
    [A.vx, A.vy],
    [B.ux, B.uy],
    [B.vx, B.vy],
  ] as const) {
    const dist = Math.abs(dx * ax + dy * ay);
    const ra = ha.w * Math.abs(A.ux * ax + A.uy * ay) + ha.h * Math.abs(A.vx * ax + A.vy * ay);
    const rb = hb.w * Math.abs(B.ux * ax + B.uy * ay) + hb.h * Math.abs(B.vx * ax + B.vy * ay);
    if (dist >= ra + rb) return false;
  }
  return true;
}

/** How far a point is from a turned rectangle (0 inside it). */
export function distanceToBox(p: { x: number; y: number }, b: Box): number {
  const A = axes(b);
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const lx = Math.max(0, Math.abs(dx * A.ux + dy * A.uy) - b.w / 2);
  const ly = Math.max(0, Math.abs(dx * A.vx + dy * A.vy) - b.h / 2);
  return Math.hypot(lx, ly);
}

/** The corners of a box. */
export function boxCorners(b: Box): { x: number; y: number }[] {
  const A = axes(b);
  const out: { x: number; y: number }[] = [];
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const)
    out.push({
      x: b.x + A.ux * sx * (b.w / 2) + A.vx * sy * (b.h / 2),
      y: b.y + A.uy * sx * (b.w / 2) + A.vy * sy * (b.h / 2),
    });
  return out;
}

/** How far a box reaches from its centre in the direction (ux, uy) (a unit vector). */
const extent = (b: Box, ux: number, uy: number): number => {
  const A = axes(b);
  return (Math.abs(ux * A.ux + uy * A.uy) * b.w) / 2 + (Math.abs(ux * A.vx + uy * A.vy) * b.h) / 2;
};

interface Wall {
  ax: number;
  ay: number;
  /** Along the wall, a unit vector. */
  ux: number;
  uy: number;
  /** Into the room, a unit vector. */
  nx: number;
  ny: number;
  length: number;
}

/** The sides of the floor, each with the direction into the room. */
export function wallsOf(outline: readonly number[]): Wall[] {
  const n = Math.floor(outline.length / 2);
  const out: Wall[] = [];
  for (let i = 0; i < n; i++) {
    const ax = outline[i * 2] ?? 0;
    const ay = outline[i * 2 + 1] ?? 0;
    const bx = outline[((i + 1) % n) * 2] ?? 0;
    const by = outline[((i + 1) % n) * 2 + 1] ?? 0;
    const length = Math.hypot(bx - ax, by - ay);
    if (length < 1) continue;
    const ux = (bx - ax) / length;
    const uy = (by - ay) / length;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    // The normal that points inside: test a step to one side.
    const inside = pointInPolygon({ x: mx - uy * 2, y: my + ux * 2 }, outline);
    out.push({ ax, ay, ux, uy, nx: inside ? -uy : uy, ny: inside ? ux : -ux, length });
  }
  return out;
}

/** The angle that turns a picture's top towards (dx, dy): its back to a wall that way. */
export const backTowards = (dx: number, dy: number): number => Math.atan2(dx, -dy);

/** The angle that turns a picture's bottom (its front) towards (dx, dy). */
export const faceTowards = (dx: number, dy: number): number => Math.atan2(-dx, dy);

/** The middle of an outline (the average of its corners). */
function middleOf(outline: readonly number[]): { x: number; y: number } {
  const n = Math.max(1, Math.floor(outline.length / 2));
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += outline[i * 2] ?? 0;
    y += outline[i * 2 + 1] ?? 0;
  }
  return { x: x / n, y: y / n };
}

// endregion

const sizeOf = (rule: DressRule) => (rule.sizeMin + rule.sizeMax) / 2;

/** A small random turn off square, from the rule's `loose` (degrees). */
const looseTurn = (rule: DressRule, rand: () => number) =>
  rule.loose ? ((rand() * 2 - 1) * rule.loose * Math.PI) / 180 : 0;

/** Whether a box may stand: inside the floor, clear of doorways and of other pieces. */
interface FitOptions {
  /** Boxes it may overlap (the table a seat is tucked under). */
  ignore?: readonly Box[];
  /** How much two boxes may overlap at their edges (pixels each side). */
  pad?: number;
  /** A way to walk: this much room kept round the pieces `clearOf` picks… */
  clear?: number;
  clearOf?: (p: Placed) => boolean;
  /** …and this much from the walls. */
  edge?: number;
}

function fits(box: Box, ctx: InteriorContext, options: FitOptions = {}): boolean {
  const { ignore = [], pad = 0.5, clear = 0, clearOf = () => true, edge = 0 } = options;
  // A piece may touch the wall: its corners are tested a pixel in (or `edge` out).
  const grow = edge > 0 ? edge * 2 : -2;
  const tested = { ...box, w: Math.max(0, box.w + grow), h: Math.max(0, box.h + grow) };
  if (!boxCorners(tested).every((c) => pointInPolygon(c, ctx.outline))) return false;
  if (ctx.doors.some((d) => distanceToBox(d, box) < ctx.cell * 1.1)) return false;
  for (const list of ctx.placed)
    for (const p of list) {
      if (p.soft || ignore.includes(p.box)) continue;
      const room = clear > 0 && clearOf(p) ? -clear / 2 : pad;
      if (boxesOverlap(box, p.box, room)) return false;
    }
  return true;
}

/** The pieces placed so far in this call count as taken too. */
function withMine(ctx: InteriorContext, mine: Placed[]): InteriorContext {
  return { ...ctx, placed: [...ctx.placed, mine] };
}

function pickPiece(rule: DressRule, rand: () => number): number {
  return pickIndex(
    rule.pieces.map((p) => p.weight),
    rand(),
  );
}

/** Pieces with their backs to the walls, side by side, leaving doorways and corners free. */
function alongWalls(rule: DressRule, ctx: InteriorContext): Placed[] {
  const out: Placed[] = [];
  const max = rule.count ?? Infinity;
  const walls = wallsOf(ctx.outline);
  if (walls.length === 0) return out;
  // Start at a random wall, so a count of one does not always pick the same one.
  const start = Math.floor(ctx.rand() * walls.length);
  for (let k = 0; k < walls.length && out.length < max; k++) {
    const wall = walls[(start + k) % walls.length];
    if (!wall) continue;
    let t = ctx.cell * 0.25;
    while (t < wall.length && out.length < max) {
      const piece = pickPiece(rule, ctx.rand);
      const size = sizeOf(rule);
      const { w, h } = ctx.boxOf(rule, piece, size);
      if (t + w > wall.length) break;
      const along = t + w / 2;
      const box: Box = {
        x: wall.ax + wall.ux * along + wall.nx * (h / 2),
        y: wall.ay + wall.uy * along + wall.ny * (h / 2),
        w,
        h,
        angle: backTowards(-wall.nx, -wall.ny),
      };
      const skip = rule.fill !== undefined && ctx.rand() > rule.fill;
      // Back to the wall, it keeps a way free in front of what stands in the room.
      const roomy = { clear: ctx.cell * 0.5, clearOf: (p: Placed) => !p.onWall };
      if (!skip && fits(box, withMine(ctx, out), roomy)) {
        out.push({
          inst: { x: box.x, y: box.y, angle: box.angle, size, piece },
          box,
          onWall: true,
        });
        t += w + rule.spacing;
      } else t += Math.max(ctx.cell * 0.5, rule.spacing);
    }
  }
  return out;
}

/** One piece in each free corner, squared to one of its walls. */
function inCorners(rule: DressRule, ctx: InteriorContext): Placed[] {
  const out: Placed[] = [];
  const max = rule.count ?? Infinity;
  const walls = wallsOf(ctx.outline);
  const n = walls.length;
  const order = walls.map((_, i) => i).sort(() => ctx.rand() - 0.5);
  for (const i of order) {
    if (out.length >= max) break;
    const prev = walls[(i - 1 + n) % n];
    const next = walls[i];
    if (!prev || !next) continue;
    const piece = pickPiece(rule, ctx.rand);
    const size = sizeOf(rule);
    const { w, h } = ctx.boxOf(rule, piece, size);
    // Back to the wall that starts here; snug against the one before it.
    const box: Box = {
      x: next.ax + next.ux * (w / 2) + next.nx * (h / 2),
      y: next.ay + next.uy * (w / 2) + next.ny * (h / 2),
      w,
      h,
      angle: backTowards(-next.nx, -next.ny) + looseTurn(rule, ctx.rand),
    };
    if (fits(box, withMine(ctx, out), { clear: ctx.cell * 0.5, clearOf: (p) => !p.onWall }))
      out.push({
        inst: { x: box.x, y: box.y, angle: box.angle, size, piece },
        box,
        onWall: true,
      });
  }
  return out;
}

/** Pieces in rows down the middle of the room, along its longest side. */
function inMiddle(rule: DressRule, ctx: InteriorContext): Placed[] {
  const out: Placed[] = [];
  const max = rule.count ?? Infinity;
  const walls = wallsOf(ctx.outline);
  const longest = walls.reduce<Wall | undefined>(
    (a, b) => (!a || b.length > a.length ? b : a),
    undefined,
  );
  if (!longest) return out;
  const { ux, uy } = longest;
  const vx = -uy;
  const vy = ux;
  const mid = middleOf(ctx.outline);
  // The floor's extent along and across the long side.
  let a0 = Infinity;
  let a1 = -Infinity;
  let b0 = Infinity;
  let b1 = -Infinity;
  for (let i = 0; i + 1 < ctx.outline.length; i += 2) {
    const dx = (ctx.outline[i] ?? 0) - mid.x;
    const dy = (ctx.outline[i + 1] ?? 0) - mid.y;
    const a = dx * ux + dy * uy;
    const b = dx * vx + dy * vy;
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    b0 = Math.min(b0, b);
    b1 = Math.max(b1, b);
  }
  const size = sizeOf(rule);
  const ca = (a0 + a1) / 2;
  const cb = (b0 + b1) / 2;
  // A way round each piece: almost a square from everything else, and from the walls a square
  // and a half (room for the seats round a table and a way behind them). A rug keeps off the walls.
  const edge = rule.floor ? ctx.cell * 0.5 : ctx.cell * 1.5;
  /** Rows of one kind of piece (the tables of a tavern match). */
  const layout = (piece: number): Placed[] => {
    const mine: Placed[] = [];
    const raw = ctx.boxOf(rule, piece, size);
    // The piece lies with its long side along the room.
    const turned = raw.h > raw.w;
    const len = turned ? raw.h : raw.w;
    const dep = turned ? raw.w : raw.h;
    // Room to walk round each piece, and for a row of seats on each side between two rows.
    const stepA = len + Math.max(rule.spacing, ctx.cell * 1.5);
    const stepB = dep + Math.max(rule.spacing, ctx.cell * 2);
    const usableA = a1 - a0 - edge * 2;
    const usableB = b1 - b0 - edge * 2;
    const cols = Math.max(1, Math.floor((usableA + stepA - len) / stepA));
    const rows = Math.max(1, Math.floor((usableB + stepB - dep) / stepB));
    const angle = Math.atan2(uy, ux) + (turned ? Math.PI / 2 : 0);
    for (let r = 0; r < rows && mine.length < max; r++)
      for (let c = 0; c < cols && mine.length < max; c++) {
        const a = ca + (c - (cols - 1) / 2) * stepA;
        const b = cb + (r - (rows - 1) / 2) * stepB;
        const box: Box = {
          x: mid.x + ux * a + vx * b,
          y: mid.y + uy * a + vy * b,
          w: raw.w,
          h: raw.h,
          angle: angle + looseTurn(rule, ctx.rand),
        };
        if (fits(box, withMine(ctx, mine), { clear: ctx.cell * 0.9, edge }))
          mine.push({ inst: { x: box.x, y: box.y, angle: box.angle, size, piece }, box });
      }
    return mine;
  };
  // The piece drawn first, else the others in turn: a room too small for the big table takes a
  // smaller one.
  const first = pickPiece(rule, ctx.rand);
  const order = [first, ...rule.pieces.map((_, i) => i).filter((i) => i !== first)];
  for (const piece of order) {
    const placed = layout(piece);
    if (placed.length > 0) return placed;
  }
  return out;
}

/** Pieces round each anchor, facing it: chairs round a table, along its long sides. */
function aroundAnchors(rule: DressRule, ctx: InteriorContext): Placed[] {
  const out: Placed[] = [];
  const anchors = rule.anchor !== undefined ? (ctx.placed[rule.anchor] ?? []) : [];
  const size = sizeOf(rule);
  for (const anchor of anchors) {
    const t = anchor.box;
    const long = t.w >= t.h;
    // The sides to sit at: both long sides, and the ends of a long table.
    const A = axes(t);
    const sideLen = long ? t.w : t.h;
    const sideDepth = long ? t.h : t.w;
    const along = long ? { x: A.ux, y: A.uy } : { x: A.vx, y: A.vy };
    const across = long ? { x: A.vx, y: A.vy } : { x: A.ux, y: A.uy };
    const seats: { x: number; y: number; face: { x: number; y: number } }[] = [];
    const probe = ctx.boxOf(rule, 0, size);
    const seatW = Math.max(probe.w, ctx.cell * 0.6);
    const perSide = Math.max(1, Math.floor(sideLen / (seatW + rule.spacing)));
    for (const side of [-1, 1])
      for (let k = 0; k < perSide; k++) {
        const s = (k - (perSide - 1) / 2) * (sideLen / perSide);
        const off = sideDepth / 2 + probe.h * 0.35;
        seats.push({
          x: t.x + along.x * s + across.x * side * off,
          y: t.y + along.y * s + across.y * side * off,
          face: { x: -across.x * side, y: -across.y * side },
        });
      }
    if (sideLen >= seatW * 2.5)
      for (const end of [-1, 1]) {
        const off = sideLen / 2 + probe.h * 0.35;
        seats.push({
          x: t.x + along.x * end * off,
          y: t.y + along.y * end * off,
          face: { x: -along.x * end, y: -along.y * end },
        });
      }
    let count = 0;
    for (const seat of seats) {
      if (rule.count !== undefined && count >= rule.count) break;
      const piece = pickPiece(rule, ctx.rand);
      const { w, h } = ctx.boxOf(rule, piece, size);
      const box: Box = {
        x: seat.x,
        y: seat.y,
        w,
        h,
        angle: faceTowards(seat.face.x, seat.face.y) + looseTurn(rule, ctx.rand),
      };
      if (fits(box, withMine(ctx, out), { ignore: [t], pad: 1 })) {
        out.push({ inst: { x: box.x, y: box.y, angle: box.angle, size, piece }, box });
        count++;
      }
    }
  }
  return out;
}

/** Pieces on top of each anchor, near its middle (candles, food, papers). */
function onAnchors(rule: DressRule, ctx: InteriorContext): Placed[] {
  const out: Placed[] = [];
  const anchors = rule.anchor !== undefined ? (ctx.placed[rule.anchor] ?? []) : [];
  const size = sizeOf(rule);
  for (const anchor of anchors) {
    const t = anchor.box;
    const A = axes(t);
    const count = rule.count ?? 1;
    const mine: Box[] = [];
    if (rule.fit) {
      // As wide as its anchor, on its middle: a tree's shadow.
      const piece = pickPiece(rule, ctx.rand);
      const own = ctx.boxOf(rule, piece, size);
      const k = Math.max(t.w, t.h) / Math.max(1, own.w);
      const box: Box = {
        x: t.x,
        y: t.y,
        w: own.w * k,
        h: own.h * k,
        angle: ctx.rand() * Math.PI * 2,
      };
      out.push({ inst: { x: box.x, y: box.y, angle: box.angle, size: size * k, piece }, box });
      continue;
    }
    for (let k = 0; k < count * 3 && mine.length < count; k++) {
      const piece = pickPiece(rule, ctx.rand);
      const { w, h } = ctx.boxOf(rule, piece, size);
      const sx = (ctx.rand() * 2 - 1) * Math.max(0, t.w / 2 - w / 2) * 0.5;
      const sy = (ctx.rand() * 2 - 1) * Math.max(0, t.h / 2 - h / 2) * 0.5;
      const box: Box = {
        x: t.x + A.ux * sx + A.vx * sy,
        y: t.y + A.uy * sx + A.vy * sy,
        w,
        h,
        angle: ctx.rand() * Math.PI * 2,
      };
      if (mine.some((m) => boxesOverlap(m, box, 1))) continue;
      mine.push(box);
      out.push({ inst: { x: box.x, y: box.y, angle: box.angle, size, piece }, box });
    }
  }
  return out;
}

/**
 * A place setting in front of each seat: the seats are the anchor rule's pieces, the table is
 * the anchor of that rule. The plate goes on the table's edge facing the seat.
 */
function settings(rule: DressRule, ctx: InteriorContext, rules: readonly DressRule[]): Placed[] {
  const out: Placed[] = [];
  if (rule.anchor === undefined) return out;
  const seats = ctx.placed[rule.anchor] ?? [];
  const seatRule = rules[rule.anchor];
  const tables = seatRule?.anchor !== undefined ? (ctx.placed[seatRule.anchor] ?? []) : [];
  if (tables.length === 0) return out;
  const size = sizeOf(rule);
  for (const seat of seats) {
    let table = tables[0];
    let best = Infinity;
    for (const t of tables) {
      const d = distanceToBox(seat.box, t.box);
      if (d < best) {
        best = d;
        table = t;
      }
    }
    if (!table) continue;
    const t = table.box;
    const dx = seat.box.x - t.x;
    const dy = seat.box.y - t.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const piece = pickPiece(rule, ctx.rand);
    const { w, h } = ctx.boxOf(rule, piece, size);
    // A third of a square in from the table's edge (a plate's picture is mostly empty around it).
    const reach = Math.max(0, extent(t, ux, uy) - ctx.cell * 0.33);
    const box: Box = {
      x: t.x + ux * reach,
      y: t.y + uy * reach,
      w,
      h,
      angle: faceTowards(ux, uy) + looseTurn(rule, ctx.rand),
    };
    out.push({ inst: { x: box.x, y: box.y, angle: box.angle, size, piece }, box });
  }
  return out;
}

/** The pieces of an interior rule. */
export function placeInterior(
  rule: DressRule,
  ctx: InteriorContext,
  rules: readonly DressRule[],
): Placed[] {
  switch (rule.place) {
    case 'wall':
      return alongWalls(rule, ctx);
    case 'corner':
      return inCorners(rule, ctx);
    case 'centre':
      return inMiddle(rule, ctx);
    case 'around':
      return aroundAnchors(rule, ctx);
    case 'on':
      return onAnchors(rule, ctx);
    case 'setting':
      return settings(rule, ctx, rules);
    default:
      return [];
  }
}

export const INTERIOR_PLACES = new Set<DressRule['place']>([
  'wall',
  'corner',
  'centre',
  'around',
  'on',
  'setting',
]);

/**
 * Whether someone can walk from every doorway to the middle of the room, round the pieces: a
 * flood over half squares of the floor. For tests and for checking a furnishing.
 */
export function walkable(
  outline: readonly number[],
  doors: readonly { x: number; y: number }[],
  boxes: readonly Box[],
  cell: number,
): boolean {
  const step = cell / 2;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < outline.length; i += 2) {
    x0 = Math.min(x0, outline[i] ?? 0);
    x1 = Math.max(x1, outline[i] ?? 0);
    y0 = Math.min(y0, outline[i + 1] ?? 0);
    y1 = Math.max(y1, outline[i + 1] ?? 0);
  }
  const cols = Math.ceil((x1 - x0) / step);
  const rows = Math.ceil((y1 - y0) / step);
  const free = (cx: number, cy: number) => {
    const p = { x: x0 + (cx + 0.5) * step, y: y0 + (cy + 0.5) * step };
    return pointInPolygon(p, outline) && boxes.every((b) => distanceToBox(p, b) > step * 0.3);
  };
  const cellOf = (p: { x: number; y: number }) => ({
    cx: Math.min(cols - 1, Math.max(0, Math.floor((p.x - x0) / step))),
    cy: Math.min(rows - 1, Math.max(0, Math.floor((p.y - y0) / step))),
  });
  /** The free cell nearest a point (a doorway sits on the wall, just outside the floor). */
  const nearestFree = (p: { x: number; y: number }) => {
    let best: { cx: number; cy: number } | null = null;
    let bestD = Infinity;
    for (let cy = 0; cy < rows; cy++)
      for (let cx = 0; cx < cols; cx++) {
        if (!free(cx, cy)) continue;
        const d = Math.hypot(x0 + (cx + 0.5) * step - p.x, y0 + (cy + 0.5) * step - p.y);
        if (d < bestD) {
          bestD = d;
          best = { cx, cy };
        }
      }
    return best;
  };
  const target = nearestFree(middleOf(outline)) ?? cellOf(middleOf(outline));
  for (const d of doors) {
    const start = nearestFree(d);
    if (!start) return false;
    const seen = new Set<number>([start.cy * cols + start.cx]);
    const queue = [start];
    let found = false;
    while (queue.length > 0 && !found) {
      const c = queue.shift();
      if (!c) break;
      if (c.cx === target.cx && c.cy === target.cy) found = true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = c.cx + dx;
        const ny = c.cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const k = ny * cols + nx;
        if (seen.has(k) || !free(nx, ny)) continue;
        seen.add(k);
        queue.push({ cx: nx, cy: ny });
      }
    }
    if (!found) return false;
  }
  return true;
}
