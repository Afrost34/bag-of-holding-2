import { centroid, clipToConvex, insetPolygon, longestEdge, splitPolygon } from './polyclip';
import { pointInPolygon } from './polygon';
import { blocked, type Obstacles } from './scatter';
import { bounds, polygonArea } from './spline';

/**
 * A district of a town, made from its outline: a street grid (rotated, a little irregular) cuts
 * it into blocks, each block is divided into lots and each lot gets a building. Everything is
 * worked out from the seed and from positions on the map's own grid, so reshaping the outline
 * keeps the streets and most buildings where they were, and the same seed always gives the same
 * town. Pure: no drawing.
 */

export interface DistrictSpec {
  /** The outline, rounded, as x, y pairs. */
  outline: readonly number[];
  seed: number;
  /** Distance between streets. */
  blockSize: number;
  streetWidth: number;
  /** The most area a lot has before it is divided again. */
  lotArea: number;
  /** Space between buildings. */
  gap: number;
  /** Chance a lot is built on. */
  density: number;
  /** 0 a regular grid, 1 a crooked one. */
  jitter: number;
  /** Direction of the streets, in degrees. */
  angle: number;
  /** An open square in the middle: its radius as a fraction of the district's (0 none). */
  plaza: number;
  /** Most buildings made. */
  maxBuildings: number;
  /** How the streets run (a plain grid when absent). */
  layout?: StreetLayout;
}

/**
 * blocks, long blocks along a main street, or platform rings (Rust & Sunfire's tower-top cities:
 * rows of buildings round a hub, crossed by a few spokes only).
 * blocks, or long blocks along a main street.
 */
export type StreetLayout = 'grid' | 'radial' | 'organic' | 'linear' | 'ring';

export interface GeneratedBuilding {
  /** Stable while the streets stay: `column,row,lot`. */
  key: string;
  poly: number[];
  /** 0–1, to pick a colour. */
  tone: number;
}

export interface DistrictGeo {
  /** The built-on parts of each block (inside the streets), for the ground. */
  blocks: number[][];
  buildings: GeneratedBuilding[];
  plaza?: { x: number; y: number; r: number };
}

/** A repeatable number from 0 to 1 for up to four integers. */
export function hash01(a: number, b: number, c = 0, d = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 16), 3266489917) ^ Math.imul(d | 0, 668265263);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const areaOf = (poly: readonly number[]) => Math.abs(polygonArea(poly));

/** A lot divided across its longest side until each piece is small enough. */
function subdivide(lot: number[], maxArea: number, seedA: number, seedB: number): number[][] {
  const out: number[][] = [];
  const stack: { poly: number[]; depth: number; id: number }[] = [{ poly: lot, depth: 0, id: 1 }];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) break;
    const area = areaOf(cur.poly);
    if (area <= maxArea * 1.15 || cur.depth >= 6) {
      out.push(cur.poly);
      continue;
    }
    const edge = longestEdge(cur.poly);
    const c = centroid(cur.poly);
    // Cut across the long side, near the middle, so lots come out about as deep as wide.
    const shift = (hash01(seedA, seedB, cur.id, 7) - 0.5) * 0.25 * edge.length;
    const p = {
      x: c.x + Math.cos(edge.angle) * shift,
      y: c.y + Math.sin(edge.angle) * shift,
    };
    const [a, b] = splitPolygon(cur.poly, p, edge.angle + Math.PI / 2);
    if (areaOf(a) < maxArea * 0.12 || areaOf(b) < maxArea * 0.12) {
      out.push(cur.poly);
      continue;
    }
    stack.push({ poly: b, depth: cur.depth + 1, id: cur.id * 2 + 1 });
    stack.push({ poly: a, depth: cur.depth + 1, id: cur.id * 2 });
  }
  return out;
}

/** One block before the streets are cut from it: a convex outline and where it is in the layout. */
interface Cell {
  poly: number[];
  k: number;
  m: number;
}

/** A polygon cut by the half plane `nx·x + ny·y <= d` (a Voronoi cell is cut by the lines half way to its neighbours). */
function clipHalfPlane(poly: readonly number[], nx: number, ny: number, d: number): number[] {
  const out: number[] = [];
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = poly[i * 2] ?? 0;
    const ay = poly[i * 2 + 1] ?? 0;
    const bx = poly[((i + 1) % n) * 2] ?? 0;
    const by = poly[((i + 1) % n) * 2 + 1] ?? 0;
    const da = nx * ax + ny * ay - d;
    const db = nx * bx + ny * by - d;
    if (da <= 0) out.push(ax, ay);
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db);
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return out;
}

/** Blocks of a grid, a little crooked with `jitter`; `along` makes them that many times longer along the streets. */
function gridCells(spec: DistrictSpec, box: ReturnType<typeof bounds>, along: number): Cell[] {
  const theta = (spec.angle * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const sizeU = spec.blockSize * along;
  const sizeV = spec.blockSize;
  const seed = spec.seed | 0;
  // Grid space → map, with each grid corner nudged a little so streets are not ruler-straight.
  const corner = (k: number, m: number): [number, number] => {
    const u = k * sizeU + (hash01(seed, k, 0, 1) - 0.5) * sizeU * 0.3 * spec.jitter;
    const v = m * sizeV + (hash01(seed, m, 0, 2) - 0.5) * sizeV * 0.3 * spec.jitter;
    const du = (hash01(seed, k, m, 3) - 0.5) * sizeU * 0.2 * spec.jitter;
    const dv = (hash01(seed, k, m, 4) - 0.5) * sizeV * 0.2 * spec.jitter;
    return [(u + du) * cos - (v + dv) * sin, (u + du) * sin + (v + dv) * cos];
  };
  // Which grid cells the outline can touch.
  let kMin = Infinity;
  let kMax = -Infinity;
  let mMin = Infinity;
  let mMax = -Infinity;
  for (let i = 0; i + 1 < spec.outline.length; i += 2) {
    const x = spec.outline[i] ?? 0;
    const y = spec.outline[i + 1] ?? 0;
    const u = x * cos + y * sin;
    const v = -x * sin + y * cos;
    kMin = Math.min(kMin, u / sizeU);
    kMax = Math.max(kMax, u / sizeU);
    mMin = Math.min(mMin, v / sizeV);
    mMax = Math.max(mMax, v / sizeV);
  }
  const k0 = Math.floor(kMin) - 1;
  const k1 = Math.ceil(kMax) + 1;
  const m0 = Math.floor(mMin) - 1;
  const m1 = Math.ceil(mMax) + 1;
  if ((k1 - k0) * (m1 - m0) > 5000) return [];
  const cells: Cell[] = [];
  for (let k = k0; k < k1; k++)
    for (let m = m0; m < m1; m++) {
      const poly = [
        ...corner(k, m),
        ...corner(k + 1, m),
        ...corner(k + 1, m + 1),
        ...corner(k, m + 1),
      ];
      const cb = bounds(poly);
      if (cb.x1 < box.x0 || cb.x0 > box.x1 || cb.y1 < box.y0 || cb.y0 > box.y1) continue;
      cells.push({ poly, k, m });
    }
  return cells;
}

/** Rings round the middle of the outline cut into blocks by spokes: a hub with streets running out. */
function radialCells(spec: DistrictSpec, box: ReturnType<typeof bounds>): Cell[] {
  const c = centroid(spec.outline);
  const size = spec.blockSize;
  const seed = spec.seed | 0;
  const theta = (spec.angle * Math.PI) / 180;
  let far = 0;
  for (let i = 0; i + 1 < spec.outline.length; i += 2)
    far = Math.max(far, Math.hypot((spec.outline[i] ?? 0) - c.x, (spec.outline[i + 1] ?? 0) - c.y));
  const rings = Math.ceil(far / size) + 1;
  if (rings > 60) return [];
  const at = (r: number, a: number): [number, number] => [
    c.x + r * Math.cos(a),
    c.y + r * Math.sin(a),
  ];
  const cells: Cell[] = [];
  for (let i = 0; i < rings; i++) {
    const r0 = size * (0.5 + i);
    const r1 = r0 + size;
    // Wider rings get more spokes, so blocks stay about as wide as they are deep.
    const n = Math.max(6, 2 * Math.round((Math.PI * (r0 + r1)) / (size * 2.6)));
    for (let j = 0; j < n; j++) {
      const wobble = (hash01(seed, i, j, 11) - 0.5) * 0.25 * spec.jitter;
      const a0 = theta + ((j + wobble) * 2 * Math.PI) / n;
      const a1 = theta + ((j + 1 + wobble) * 2 * Math.PI) / n;
      const r0j = r0 + (hash01(seed, i, j, 12) - 0.5) * size * 0.2 * spec.jitter;
      const r1j = r1 + (hash01(seed, i, j, 13) - 0.5) * size * 0.2 * spec.jitter;
      const poly = [...at(r0j, a0), ...at(r1j, a0), ...at(r1j, a1), ...at(r0j, a1)];
      const cb = bounds(poly);
      if (cb.x1 < box.x0 || cb.x0 > box.x1 || cb.y1 < box.y0 || cb.y0 > box.y1) continue;
      cells.push({ poly, k: i, m: j });
    }
  }
  return cells;
}

/**
 * Platform rings: rows of buildings round a hub, ring roads between the rows and only a few
 * spokes (the same ones through every ring). Each row between two spokes is cut in short blocks
 * (so they stay convex on the curve) that reach half a street past their neighbours, so the
 * street inset leaves no alley between them: only the spokes and ring roads are streets.
 */
function ringCells(spec: DistrictSpec, box: ReturnType<typeof bounds>): Cell[] {
  const c = centroid(spec.outline);
  const size = spec.blockSize;
  const seed = spec.seed | 0;
  const theta = (spec.angle * Math.PI) / 180;
  let far = 0;
  for (let i = 0; i + 1 < spec.outline.length; i += 2)
    far = Math.max(far, Math.hypot((spec.outline[i] ?? 0) - c.x, (spec.outline[i + 1] ?? 0) - c.y));
  const rings = Math.ceil(far / size) + 1;
  if (rings > 60) return [];
  const spokes = 4 + Math.floor(hash01(seed, 0, 0, 31) * 3);
  const at = (r: number, a: number): [number, number] => [
    c.x + r * Math.cos(a),
    c.y + r * Math.sin(a),
  ];
  const cells: Cell[] = [];
  for (let i = 0; i < rings; i++) {
    const r0 = size * (0.6 + i);
    const r1 = r0 + size;
    const mid = (r0 + r1) / 2;
    // Half a street, as an angle on this row: how far a block reaches past its neighbour.
    const reach = spec.streetWidth / 2 / mid;
    for (let s = 0; s < spokes; s++) {
      const s0 = theta + (s * 2 * Math.PI) / spokes;
      const span = (2 * Math.PI) / spokes;
      const parts = Math.max(1, Math.round((span * mid) / (size * 1.4)));
      for (let p = 0; p < parts; p++) {
        // Each boundary between two blocks is moved once, so both blocks meet on it.
        const edge = (q: number) =>
          q === 0
            ? 0
            : q === parts
              ? 1
              : (q + (hash01(seed, i, s * 64 + q, 32) - 0.5) * 0.3 * spec.jitter) / parts;
        const f0 = edge(p);
        const f1 = edge(p + 1);
        // Joined to the next block of the row (not at a spoke): reach over the alley.
        const a0 = s0 + f0 * span - (p > 0 ? reach : 0);
        const a1 = s0 + f1 * span + (p < parts - 1 ? reach : 0);
        const poly = [...at(r0, a0), ...at(r1, a0), ...at(r1, a1), ...at(r0, a1)];
        const cb = bounds(poly);
        if (cb.x1 < box.x0 || cb.x0 > box.x1 || cb.y1 < box.y0 || cb.y0 > box.y1) continue;
        cells.push({ poly, k: i, m: s * 64 + p });
      }
    }
  }
  return cells;
}

/** Irregular blocks: the cells nearest each of a loose scatter of points, as in a grown-up old town. */
function organicCells(spec: DistrictSpec, box: ReturnType<typeof bounds>): Cell[] {
  const size = spec.blockSize;
  const seed = spec.seed | 0;
  const spread = 0.35 + spec.jitter * 0.45;
  const point = (i: number, j: number): [number, number] => [
    (i + 0.5 + (hash01(seed, i, j, 21) - 0.5) * spread * 2) * size,
    (j + 0.5 + (hash01(seed, i, j, 22) - 0.5) * spread * 2) * size,
  ];
  const i0 = Math.floor(box.x0 / size) - 1;
  const i1 = Math.ceil(box.x1 / size) + 1;
  const j0 = Math.floor(box.y0 / size) - 1;
  const j1 = Math.ceil(box.y1 / size) + 1;
  if ((i1 - i0) * (j1 - j0) > 5000) return [];
  const cells: Cell[] = [];
  for (let i = i0; i < i1; i++)
    for (let j = j0; j < j1; j++) {
      const [px, py] = point(i, j);
      let poly: number[] = [
        px - size * 3,
        py - size * 3,
        px + size * 3,
        py - size * 3,
        px + size * 3,
        py + size * 3,
        px - size * 3,
        py + size * 3,
      ];
      for (let di = -2; di <= 2 && poly.length >= 6; di++)
        for (let dj = -2; dj <= 2 && poly.length >= 6; dj++) {
          if (di === 0 && dj === 0) continue;
          const [qx, qy] = point(i + di, j + dj);
          poly = clipHalfPlane(poly, qx - px, qy - py, (qx * qx + qy * qy - px * px - py * py) / 2);
        }
      if (poly.length < 6) continue;
      const cb = bounds(poly);
      if (cb.x1 < box.x0 || cb.x0 > box.x1 || cb.y1 < box.y0 || cb.y0 > box.y1) continue;
      cells.push({ poly, k: i, m: j });
    }
  return cells;
}

export function generateDistrict(
  spec: DistrictSpec,
  obstacles: Obstacles,
  allowed: (x: number, y: number) => boolean = () => true,
): DistrictGeo {
  const geo: DistrictGeo = { blocks: [], buildings: [] };
  if (spec.outline.length < 6 || spec.blockSize < 12) return geo;
  const size = spec.blockSize;
  const seed = spec.seed | 0;
  const box = bounds(spec.outline);
  const middle = centroid(spec.outline);
  const radius = Math.sqrt(areaOf(spec.outline) / Math.PI);
  if (spec.plaza > 0) geo.plaza = { x: middle.x, y: middle.y, r: radius * spec.plaza };
  const minLot = spec.lotArea * 0.15;
  const layout = spec.layout ?? 'grid';
  const cells =
    layout === 'ring'
      ? ringCells(spec, box)
      : layout === 'radial'
        ? radialCells(spec, box)
        : layout === 'organic'
          ? organicCells(spec, box)
          : gridCells(spec, box, layout === 'linear' ? 2.6 : 1);

  for (const { poly: cell, k, m } of cells) {
    const part = clipToConvex(spec.outline, cell);
    if (part.length < 6 || areaOf(part) < size * size * 0.05) continue;
    const lot = insetPolygon(part, spec.streetWidth / 2);
    if (!lot) continue;
    geo.blocks.push(lot);
    const lots = subdivide(lot, spec.lotArea, k, m);
    for (let n = 0; n < lots.length; n++) {
      if (geo.buildings.length >= spec.maxBuildings) break;
      const piece = lots[n];
      if (!piece) continue;
      const key = `${String(k)},${String(m)},${String(n)}`;
      if (hash01(seed, k, m, 100 + n) > spec.density) continue;
      const house = insetPolygon(piece, spec.gap / 2);
      if (!house || areaOf(house) < minLot) continue;
      const c = centroid(house);
      if (geo.plaza && Math.hypot(c.x - geo.plaza.x, c.y - geo.plaza.y) < geo.plaza.r) continue;
      if (!pointInPolygon(c, spec.outline)) continue;
      if (blocked(c.x, c.y, obstacles, 0) || !allowed(c.x, c.y)) continue;
      geo.buildings.push({ key, poly: house, tone: hash01(seed, k, m, 200 + n) });
    }
  }
  return geo;
}
