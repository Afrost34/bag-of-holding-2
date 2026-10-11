import { pointInPolygon } from '../polygon';

/**
 * Grid cells for the building planner: which squares a footprint covers, which cells touch, and
 * the outline round a set of cells. Cells are named by their column and row on the map's grid
 * (`"3,5"` is the square from 3 × cell to 4 × cell across). Pure.
 */

export const cellKey = (cx: number, cy: number): string => `${String(cx)},${String(cy)}`;

export function parseCell(key: string): [number, number] {
  const [a, b] = key.split(',');
  return [Number(a), Number(b)];
}

/** The cells whose middle is inside a polygon (map pixels). */
export function cellsInPolygon(points: readonly number[], cell: number): Set<string> {
  const out = new Set<string>();
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
  if (!Number.isFinite(x0)) return out;
  for (let cy = Math.floor(y0 / cell); cy <= Math.ceil(y1 / cell); cy++)
    for (let cx = Math.floor(x0 / cell); cx <= Math.ceil(x1 / cell); cx++)
      if (pointInPolygon({ x: (cx + 0.5) * cell, y: (cy + 0.5) * cell }, points))
        out.add(cellKey(cx, cy));
  return out;
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The groups of cells that touch side to side. */
export function components(cells: ReadonlySet<string>): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of cells) {
    if (seen.has(start)) continue;
    const group: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const key = queue.pop();
      if (key === undefined) break;
      group.push(key);
      const [cx, cy] = parseCell(key);
      for (const [dx, dy] of STEPS) {
        const next = cellKey(cx + dx, cy + dy);
        if (cells.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    out.push(group.sort());
  }
  return out;
}

/**
 * The outline round a set of touching cells (map pixels), clockwise on screen, corners only. A
 * set with a hole gives its outer outline; separate groups give the outline of the largest.
 */
export function traceCells(cells: ReadonlySet<string>, cell: number): number[] {
  // Every side of a cell with no cell beyond it, walked with the inside on the right.
  const next = new Map<string, string>();
  const corner = (x: number, y: number) => cellKey(x, y);
  for (const key of cells) {
    const [cx, cy] = parseCell(key);
    if (!cells.has(cellKey(cx, cy - 1))) next.set(corner(cx, cy), corner(cx + 1, cy));
    if (!cells.has(cellKey(cx + 1, cy))) next.set(corner(cx + 1, cy), corner(cx + 1, cy + 1));
    if (!cells.has(cellKey(cx, cy + 1))) next.set(corner(cx + 1, cy + 1), corner(cx, cy + 1));
    if (!cells.has(cellKey(cx - 1, cy))) next.set(corner(cx, cy + 1), corner(cx, cy));
  }
  // Loops of sides; the longest is the outer outline.
  let best: string[] = [];
  const used = new Set<string>();
  for (const start of next.keys()) {
    if (used.has(start)) continue;
    const loop: string[] = [];
    let at: string | undefined = start;
    while (at !== undefined && !used.has(at)) {
      used.add(at);
      loop.push(at);
      at = next.get(at);
    }
    if (loop.length > best.length) best = loop;
  }
  // Corners only: drop points in the middle of a straight side.
  const pts = best.map(parseCell);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length];
    const b = pts[i];
    const c = pts[(i + 1) % pts.length];
    if (!a || !b || !c) continue;
    const straight = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) === 0;
    if (!straight) out.push(b[0] * cell, b[1] * cell);
  }
  return out;
}

/** The cells of a set of rectangles of whole cells (x, y, w, h in cells). */
export function cellsOfRects(rects: readonly { x: number; y: number; w: number; h: number }[]) {
  const out = new Set<string>();
  for (const r of rects)
    for (let cy = r.y; cy < r.y + r.h; cy++)
      for (let cx = r.x; cx < r.x + r.w; cx++) out.add(cellKey(cx, cy));
  return out;
}

/** The bounding box of some cells, in cells. */
export function cellBounds(cells: Iterable<string>) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const key of cells) {
    const [cx, cy] = parseCell(key);
    x0 = Math.min(x0, cx);
    y0 = Math.min(y0, cy);
    x1 = Math.max(x1, cx);
    y1 = Math.max(y1, cy);
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
