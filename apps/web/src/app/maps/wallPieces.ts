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
}

/** The pieces of the set a strip belongs to, from the file names beside it. */
export function piecesFor(stripFile: string, siblings: readonly string[]): WallPieces {
  const m = /^(.*_)Straight_Path\.[a-z0-9]+$/i.exec(stripFile);
  const prefix = m?.[1];
  if (!prefix) return {};
  const mine = siblings.filter((f) => f.startsWith(prefix)).sort();
  const corner = mine.find((f) => /^Corner_[A-E]_1x1\./i.test(f.slice(prefix.length)));
  const ending = mine.find((f) => /^Ending_[A-Z]\d?_1x1\./i.test(f.slice(prefix.length)));
  return { ...(corner ? { corner } : {}), ...(ending ? { ending } : {}) };
}

export interface PiecePlace {
  kind: 'corner' | 'ending';
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
