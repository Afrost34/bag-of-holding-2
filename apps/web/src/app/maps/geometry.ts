import type { Grid, TemplateShape } from './model';

/**
 * Grid and template geometry for maps, in map pixels. Hex grids are "pointy-top": rows of hexes,
 * every other row shifted by half a hex; `grid.size` is the distance between neighbouring
 * centres.
 */

export interface Point {
  x: number;
  y: number;
}

const SQRT3 = Math.sqrt(3);

/** A hex's corner radius for a grid size (centre-to-centre distance). */
export const hexRadius = (size: number) => size / SQRT3;

/** Axial coordinates of the hex containing a point. */
function hexAt(p: Point, grid: Grid): { q: number; r: number } {
  const radius = hexRadius(grid.size);
  const x = p.x - grid.offsetX;
  const y = p.y - grid.offsetY;
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / radius;
  const r = ((2 / 3) * y) / radius;
  // Cube rounding.
  let rx = Math.round(q);
  let rz = Math.round(r);
  const ry = Math.round(-q - r);
  const dx = Math.abs(rx - q);
  const dy = Math.abs(ry - (-q - r));
  const dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (!(dy > dz)) rz = -rx - ry;
  return { q: rx, r: rz };
}

export function hexCentre(q: number, r: number, grid: Grid): Point {
  const radius = hexRadius(grid.size);
  return {
    x: grid.offsetX + radius * SQRT3 * (q + r / 2),
    y: grid.offsetY + radius * 1.5 * r,
  };
}

/** The hex's six corners, clockwise from the top. */
export function hexCorners(centre: Point, grid: Grid): Point[] {
  const radius = hexRadius(grid.size);
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return { x: centre.x + radius * Math.cos(a), y: centre.y + radius * Math.sin(a) };
  });
}

/** The centre of the cell a point is in (the point itself without a grid). */
export function snapToCell(p: Point, grid: Grid): Point {
  if (grid.type === 'none') return p;
  if (grid.type === 'hex') {
    const { q, r } = hexAt(p, grid);
    return hexCentre(q, r, grid);
  }
  const s = grid.size;
  return {
    x: grid.offsetX + (Math.floor((p.x - grid.offsetX) / s) + 0.5) * s,
    y: grid.offsetY + (Math.floor((p.y - grid.offsetY) / s) + 0.5) * s,
  };
}

/** The nearest grid corner (square grids; cell centres on hex grids). */
export function snapToCorner(p: Point, grid: Grid): Point {
  if (grid.type !== 'square') return snapToCell(p, grid);
  const s = grid.size;
  return {
    x: grid.offsetX + Math.round((p.x - grid.offsetX) / s) * s,
    y: grid.offsetY + Math.round((p.y - grid.offsetY) / s) * s,
  };
}

/**
 * Distance in feet, as the rules count it on this grid: squares (each step, straight or
 * diagonal, is one cell), hexes, or straight-line without a grid.
 */
export function distanceFeet(a: Point, b: Point, grid: Grid): number {
  if (grid.type === 'square') {
    const cells = Math.max(
      Math.abs(
        Math.floor((b.x - grid.offsetX) / grid.size) - Math.floor((a.x - grid.offsetX) / grid.size),
      ),
      Math.abs(
        Math.floor((b.y - grid.offsetY) / grid.size) - Math.floor((a.y - grid.offsetY) / grid.size),
      ),
    );
    return cells * grid.feet;
  }
  if (grid.type === 'hex') {
    const h1 = hexAt(a, grid);
    const h2 = hexAt(b, grid);
    const dq = h1.q - h2.q;
    const dr = h1.r - h2.r;
    const cells = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
    return cells * grid.feet;
  }
  return Math.round((Math.hypot(b.x - a.x, b.y - a.y) / grid.size) * grid.feet);
}

/** Feet to map pixels on this grid. */
export const feetToPx = (feet: number, grid: Grid) => (feet / grid.feet) * grid.size;

/**
 * A spell template's outline: a cone (as wide at its end as it is long), a sphere's circle, a
 * cube with one face's middle at the origin, or a 5-foot-wide line.
 */
export function templateOutline(
  shape: TemplateShape,
  origin: Point,
  feet: number,
  angle: number,
  grid: Grid,
): { circle?: { x: number; y: number; r: number }; polygon?: Point[] } {
  const len = feetToPx(feet, grid);
  const a = (angle * Math.PI) / 180;
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const side = { x: -dir.y, y: dir.x };
  const at = (along: number, across: number): Point => ({
    x: origin.x + dir.x * along + side.x * across,
    y: origin.y + dir.y * along + side.y * across,
  });
  switch (shape) {
    case 'sphere':
      return { circle: { x: origin.x, y: origin.y, r: len } };
    case 'cone':
      return { polygon: [origin, at(len, len / 2), at(len, -len / 2)] };
    case 'cube':
      return { polygon: [at(0, len / 2), at(len, len / 2), at(len, -len / 2), at(0, -len / 2)] };
    case 'line': {
      const half = feetToPx(5, grid) / 2;
      return { polygon: [at(0, half), at(len, half), at(len, -half), at(0, -half)] };
    }
  }
}

/** A polyline (x0, y0, x1, y1…) with extra points so no two are further apart than `step`. */
export function densify(points: readonly number[], step: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i] ?? 0;
    const y = points[i + 1] ?? 0;
    if (i >= 2) {
      const px = points[i - 2] ?? 0;
      const py = points[i - 1] ?? 0;
      const n = Math.floor(Math.hypot(x - px, y - py) / step);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1);
        out.push(px + (x - px) * t, py + (y - py) * t);
      }
    }
    out.push(x, y);
  }
  return out;
}

/**
 * What is left of a brush stroke after the eraser went over it: the stroke's points within
 * `radius` of the eraser's path are taken out, and the stroke falls apart into the runs left
 * between them. A stroke the eraser does not touch comes back as it was (one run, same points).
 */
export function eraseStroke(
  points: readonly number[],
  eraser: readonly number[],
  radius: number,
): number[][] {
  const path = densify(eraser, Math.max(1, radius / 2));
  const hit = (x: number, y: number) => {
    for (let j = 0; j + 1 < path.length; j += 2)
      if (Math.hypot(x - (path[j] ?? 0), y - (path[j + 1] ?? 0)) <= radius) return true;
    return false;
  };
  const dense = densify(points, Math.max(1, radius / 3));
  let touched = false;
  const runs: number[][] = [];
  let run: number[] = [];
  for (let i = 0; i + 1 < dense.length; i += 2) {
    const x = dense[i] ?? 0;
    const y = dense[i + 1] ?? 0;
    if (hit(x, y)) {
      touched = true;
      if (run.length >= 4) runs.push(run);
      run = [];
    } else run.push(x, y);
  }
  if (!touched) return [[...points]];
  if (run.length >= 4) runs.push(run);
  return runs;
}

/** Whether a point is inside a polygon given as x0, y0, x1, y1… */
export function pointInPolygon(p: Point, points: readonly number[]): boolean {
  let inside = false;
  const n = points.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i * 2] ?? 0;
    const yi = points[i * 2 + 1] ?? 0;
    const xj = points[j * 2] ?? 0;
    const yj = points[j * 2 + 1] ?? 0;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
