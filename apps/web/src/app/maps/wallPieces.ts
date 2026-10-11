/**
 * The corner, diagonal and ending pieces that go with a wall strip, and where on a wall they stand.
 * Two families of Forgotten Adventures walls are known:
 *
 * - stone and the like: beside `<Set>_Straight_Path.webp` sit `<Set>_Corner_A_1x1` (an L whose arms
 *   run east and south), `<Set>_Ending_A_1x1` (a cap, wall to the east), `Joint_B` (a T with arms west,
 *   east and south) and `Joint_A` (a cross), all one square;
 * - wood: beside `<Set>_<Colour>_A1_Path.webp` sit `<Set>_<Colour>_Corner_A1_2x2` (arms north and
 *   east), `..._Diagonal_A1_2x2` (arms west and north-east) and `..._End_A1_1x1` (wall to the west,
 *   the cap a fifth of a square past the middle).
 *
 * Every piece has the wall's middle at the middle of its picture. Pure.
 */

/** A piece: its file, its size in squares, the directions its arms point to as drawn (degrees, clockwise from east). */
export interface PieceSpec {
  file: string;
  squares: number;
  arms: readonly number[];
  /** How far, in squares, it sits towards the wall from the end (a cap that sticks out). */
  shift?: number;
}

export interface WallPieces {
  corner?: PieceSpec;
  diagonal?: PieceSpec;
  ending?: PieceSpec;
  /** The T piece (arms west, east and south) and the cross, where walls meet. */
  tee?: string;
  cross?: string;
}

/** The pieces of the set a strip belongs to, from the file names beside it. */
export function piecesFor(stripFile: string, siblings: readonly string[]): WallPieces {
  const stone = /^(.*_)Straight_Path\.[a-z0-9]+$/i.exec(stripFile);
  if (stone?.[1]) {
    const prefix = stone[1];
    const mine = siblings.filter((f) => f.startsWith(prefix)).sort();
    const rest = (re: RegExp) => mine.find((f) => re.test(f.slice(prefix.length)));
    const corner = rest(/^Corner_[A-E]_1x1\./i);
    const ending = rest(/^Ending_[A-Z]\d?_1x1\./i);
    const tee = rest(/^Joint_B_1x1\./i);
    const cross = rest(/^Joint_A_1x1\./i);
    return {
      ...(corner ? { corner: { file: corner, squares: 1, arms: [0, 90] } } : {}),
      ...(ending ? { ending: { file: ending, squares: 1, arms: [0] } } : {}),
      ...(tee ? { tee } : {}),
      ...(cross ? { cross } : {}),
    };
  }
  const wood = /^(.*_)([A-C]\d)_Path\.[a-z0-9]+$/i.exec(stripFile);
  if (wood?.[1] && wood[2]) {
    const prefix = wood[1];
    const variant = wood[2];
    const find = (name: string) =>
      siblings.find((f) => f.startsWith(`${prefix}${name}_${variant}_`));
    const corner = find('Corner');
    const diagonal = find('Diagonal');
    const ending = find('End');
    return {
      ...(corner ? { corner: { file: corner, squares: 2, arms: [270, 0] } } : {}),
      ...(diagonal ? { diagonal: { file: diagonal, squares: 2, arms: [180, 315] } } : {}),
      ...(ending ? { ending: { file: ending, squares: 1, arms: [180], shift: 0.2 } } : {}),
    };
  }
  return {};
}

export interface PiecePlace {
  kind: 'corner' | 'diagonal' | 'ending' | 'tee' | 'cross';
  x: number;
  y: number;
  /** Degrees, clockwise, from the picture as drawn. */
  rotation: number;
  /** For an ending: the direction towards the wall, a unit vector (the piece may sit a little along it). */
  along?: { x: number; y: number };
}

/** The cardinal direction (0 east, 1 south, 2 west, 3 north) a vector points to, or null if it is off by over 12°. */
function cardinal(dx: number, dy: number): number | null {
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  const k = Math.round(a / 90);
  if (Math.abs(a - k * 90) > 12) return null;
  return ((k % 4) + 4) % 4;
}

const mod360 = (a: number) => ((a % 360) + 360) % 360;

/** The turn that puts a piece's two arms on two directions (degrees), or null if they do not fit. */
function alignArms(base: readonly number[], first: number, second: number): number | null {
  const [b0, b1] = base;
  if (b0 === undefined || b1 === undefined) return null;
  const sweep = mod360(b1 - b0);
  const close = (x: number) => Math.min(x, 360 - x) <= 12;
  if (close(Math.abs(mod360(second - first) - sweep))) return mod360(first - b0);
  if (close(Math.abs(mod360(first - second) - sweep))) return mod360(second - b0);
  return null;
}

/**
 * Where the pieces of a set go on a wall: a corner at a turn of a right angle, a diagonal at a turn
 * of 45°, an ending at each end of an open wall.
 */
export function placePieces(
  points: readonly number[],
  closed: boolean,
  pieces: WallPieces,
): PiecePlace[] {
  const n = Math.floor(points.length / 2);
  const out: PiecePlace[] = [];
  const at = (i: number) => ({ x: points[(i % n) * 2] ?? 0, y: points[(i % n) * 2 + 1] ?? 0 });
  const angle = (from: { x: number; y: number }, to: { x: number; y: number }) =>
    mod360((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
  for (let i = 0; i < n; i++) {
    const here = at(i);
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    const prev = at((i - 1 + n) % n);
    const next = at(i + 1);
    if (hasPrev && hasNext) {
      const toPrev = angle(here, prev);
      const toNext = angle(here, next);
      for (const kind of ['corner', 'diagonal'] as const) {
        const spec = pieces[kind];
        if (!spec) continue;
        const turn = alignArms(spec.arms, toPrev, toNext);
        if (turn === null) continue;
        out.push({ kind, x: here.x, y: here.y, rotation: Math.round(turn) });
        break;
      }
    } else if ((hasPrev || hasNext) && pieces.ending) {
      const other = hasNext ? next : prev;
      const toBody = angle(here, other);
      const base = pieces.ending.arms[0] ?? 0;
      const len = Math.hypot(other.x - here.x, other.y - here.y) || 1;
      out.push({
        kind: 'ending',
        x: here.x,
        y: here.y,
        rotation: Math.round(mod360(toBody - base)),
        along: { x: (other.x - here.x) / len, y: (other.y - here.y) / len },
      });
    }
  }
  return out;
}

/** A wall for finding where walls meet. */
export interface WallLine {
  id: string;
  points: readonly number[];
  closed: boolean;
}

/**
 * Where walls meet: a T (three arms) or a cross (four) at a corner of one wall that another wall
 * ends on or runs through, along the axes. Each junction belongs to the wall with the smallest id
 * among those meeting there, so it is drawn once. Keyed by wall id.
 */
export function junctionPieces(walls: readonly WallLine[], reach = 4): Map<string, PiecePlace[]> {
  const out = new Map<string, PiecePlace[]>();
  const spots: { x: number; y: number; owner: string }[] = [];
  for (const w of walls) {
    const n = Math.floor(w.points.length / 2);
    for (let i = 0; i < n; i++) {
      const x = w.points[i * 2] ?? 0;
      const y = w.points[i * 2 + 1] ?? 0;
      if (!spots.some((s) => Math.hypot(s.x - x, s.y - y) <= reach))
        spots.push({ x, y, owner: w.id });
    }
  }
  // Walls that cross each other in the middle of their segments meet there too.
  const segs = walls.flatMap((w) => {
    const n = Math.floor(w.points.length / 2);
    const count = w.closed ? n : n - 1;
    return Array.from({ length: Math.max(0, count) }, (_, i) => {
      const j = (i + 1) % n;
      return {
        id: w.id,
        ax: w.points[i * 2] ?? 0,
        ay: w.points[i * 2 + 1] ?? 0,
        bx: w.points[j * 2] ?? 0,
        by: w.points[j * 2 + 1] ?? 0,
      };
    });
  });
  for (let i = 0; i < segs.length; i++)
    for (let k = i + 1; k < segs.length; k++) {
      const p = segs[i];
      const q = segs[k];
      if (!p || !q || p.id === q.id) continue;
      const d = (p.bx - p.ax) * (q.by - q.ay) - (p.by - p.ay) * (q.bx - q.ax);
      if (Math.abs(d) < 1e-6) continue;
      const t = ((q.ax - p.ax) * (q.by - q.ay) - (q.ay - p.ay) * (q.bx - q.ax)) / d;
      const u = ((q.ax - p.ax) * (p.by - p.ay) - (q.ay - p.ay) * (p.bx - p.ax)) / d;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      const x = p.ax + t * (p.bx - p.ax);
      const y = p.ay + t * (p.by - p.ay);
      if (!spots.some((s) => Math.hypot(s.x - x, s.y - y) <= reach))
        spots.push({ x, y, owner: p.id });
    }
  for (const spot of spots) {
    const arms = new Set<number>();
    const touching: string[] = [];
    for (const w of walls) {
      const n = Math.floor(w.points.length / 2);
      const count = w.closed ? n : n - 1;
      let touches = false;
      for (let i = 0; i < count; i++) {
        const ax = w.points[i * 2] ?? 0;
        const ay = w.points[i * 2 + 1] ?? 0;
        const j = (i + 1) % n;
        const bx = w.points[j * 2] ?? 0;
        const by = w.points[j * 2 + 1] ?? 0;
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1) continue;
        const u = Math.max(0, Math.min(1, ((spot.x - ax) * dx + (spot.y - ay) * dy) / len2));
        if (Math.hypot(spot.x - (ax + dx * u), spot.y - (ay + dy * u)) > reach) continue;
        touches = true;
        // The segment's arms from the spot: towards each end that is not the spot itself.
        for (const [ex, ey] of [
          [ax, ay],
          [bx, by],
        ] as const) {
          if (Math.hypot(ex - spot.x, ey - spot.y) <= reach) continue;
          const c = cardinal(ex - spot.x, ey - spot.y);
          if (c !== null) arms.add(c);
        }
      }
      if (touches) touching.push(w.id);
    }
    if (touching.length < 2 || arms.size < 3) continue;
    const owner = [...touching].sort()[0] ?? spot.owner;
    let place: PiecePlace;
    if (arms.size === 4) place = { kind: 'cross', x: spot.x, y: spot.y, rotation: 0 };
    else {
      // The T's arms are west, east and south: turn it until the missing arm is the one missing here.
      const missing = [0, 1, 2, 3].find((a) => !arms.has(a)) ?? 3;
      place = { kind: 'tee', x: spot.x, y: spot.y, rotation: ((((missing - 3) % 4) + 4) % 4) * 90 };
    }
    const list = out.get(owner) ?? [];
    list.push(place);
    out.set(owner, list);
  }
  return out;
}
