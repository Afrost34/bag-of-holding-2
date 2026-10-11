/**
 * The corner and ending pieces that go with a wall strip, and where on a wall they stand. A set of
 * Forgotten Adventures walls has, beside `<Set>_Straight_Path.webp`, files like `<Set>_Corner_A_1x1`
 * (an L whose arms run east and south) and `<Set>_Ending_A_1x1` (a cap whose wall runs east), all
 * one square, with the wall's middle at the middle of the picture. Pure.
 */

export interface WallPieces {
  /** File name of the corner piece, if the set has one. */
  corner?: string;
  /** File name of the ending piece, if the set has one. */
  ending?: string;
  /** The T piece (arms west, east and south) and the cross, where walls meet. */
  tee?: string;
  cross?: string;
}

/** The pieces of the set a strip belongs to, from the file names beside it. */
export function piecesFor(stripFile: string, siblings: readonly string[]): WallPieces {
  const m = /^(.*_)Straight_Path\.[a-z0-9]+$/i.exec(stripFile);
  const prefix = m?.[1];
  if (!prefix) return {};
  const mine = siblings.filter((f) => f.startsWith(prefix)).sort();
  const corner = mine.find((f) => /^Corner_[A-E]_1x1\./i.test(f.slice(prefix.length)));
  const ending = mine.find((f) => /^Ending_[A-Z]\d?_1x1\./i.test(f.slice(prefix.length)));
  const tee = mine.find((f) => /^Joint_B_1x1./i.test(f.slice(prefix.length)));
  const cross = mine.find((f) => /^Joint_A_1x1./i.test(f.slice(prefix.length)));
  return {
    ...(corner ? { corner } : {}),
    ...(ending ? { ending } : {}),
    ...(tee ? { tee } : {}),
    ...(cross ? { cross } : {}),
  };
}

export interface PiecePlace {
  kind: 'corner' | 'ending' | 'tee' | 'cross';
  x: number;
  y: number;
  /** Degrees, clockwise, from the picture as drawn (arms east and south; ending's wall east). */
  rotation: number;
}

/** The cardinal direction (0 east, 1 south, 2 west, 3 north) a vector points to, or null if it is off by over 12°. */
function cardinal(dx: number, dy: number): number | null {
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  const k = Math.round(a / 90);
  if (Math.abs(a - k * 90) > 12) return null;
  return ((k % 4) + 4) % 4;
}

/**
 * Where corners and endings go on a wall: a corner at every right-angle turn along the axes, an
 * ending at each end of an open wall.
 */
export function placePieces(points: readonly number[], closed: boolean): PiecePlace[] {
  const n = Math.floor(points.length / 2);
  const out: PiecePlace[] = [];
  const at = (i: number) => ({ x: points[(i % n) * 2] ?? 0, y: points[(i % n) * 2 + 1] ?? 0 });
  for (let i = 0; i < n; i++) {
    const here = at(i);
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    const prev = at((i - 1 + n) % n);
    const next = at(i + 1);
    if (hasPrev && hasNext) {
      const a = cardinal(prev.x - here.x, prev.y - here.y);
      const b = cardinal(next.x - here.x, next.y - here.y);
      if (a === null || b === null || a === b || (a + 2) % 4 === b) continue;
      // The picture's arms are east (0) and south (1): turn it until they are a and b.
      for (let k = 0; k < 4; k++)
        if ((k === a && (k + 1) % 4 === b) || (k === b && (k + 1) % 4 === a)) {
          out.push({ kind: 'corner', x: here.x, y: here.y, rotation: k * 90 });
          break;
        }
    } else if (hasPrev || hasNext) {
      const other = hasNext ? next : prev;
      const angle = (Math.atan2(other.y - here.y, other.x - here.x) * 180) / Math.PI;
      out.push({ kind: 'ending', x: here.x, y: here.y, rotation: Math.round(angle) });
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
