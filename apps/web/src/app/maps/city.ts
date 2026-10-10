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
}

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

export function generateDistrict(
  spec: DistrictSpec,
  obstacles: Obstacles,
  allowed: (x: number, y: number) => boolean = () => true,
): DistrictGeo {
  const geo: DistrictGeo = { blocks: [], buildings: [] };
  if (spec.outline.length < 6 || spec.blockSize < 12) return geo;
  const theta = (spec.angle * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const size = spec.blockSize;
  const seed = spec.seed | 0;
  // Grid space → map, with each grid corner nudged a little so streets are not ruler-straight.
  const corner = (k: number, m: number): [number, number] => {
    const u = k * size + (hash01(seed, k, 0, 1) - 0.5) * size * 0.3 * spec.jitter;
    const v = m * size + (hash01(seed, m, 0, 2) - 0.5) * size * 0.3 * spec.jitter;
    const du = (hash01(seed, k, m, 3) - 0.5) * size * 0.2 * spec.jitter;
    const dv = (hash01(seed, k, m, 4) - 0.5) * size * 0.2 * spec.jitter;
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
    kMin = Math.min(kMin, u / size);
    kMax = Math.max(kMax, u / size);
    mMin = Math.min(mMin, v / size);
    mMax = Math.max(mMax, v / size);
  }
  const k0 = Math.floor(kMin) - 1;
  const k1 = Math.ceil(kMax) + 1;
  const m0 = Math.floor(mMin) - 1;
  const m1 = Math.ceil(mMax) + 1;
  if ((k1 - k0) * (m1 - m0) > 5000) return geo;
  const box = bounds(spec.outline);
  const middle = centroid(spec.outline);
  const radius = Math.sqrt(areaOf(spec.outline) / Math.PI);
  if (spec.plaza > 0) geo.plaza = { x: middle.x, y: middle.y, r: radius * spec.plaza };
  const minLot = spec.lotArea * 0.15;

  for (let k = k0; k < k1; k++)
    for (let m = m0; m < m1; m++) {
      const cell = [
        ...corner(k, m),
        ...corner(k + 1, m),
        ...corner(k + 1, m + 1),
        ...corner(k, m + 1),
      ];
      const cb = bounds(cell);
      if (cb.x1 < box.x0 || cb.x0 > box.x1 || cb.y1 < box.y0 || cb.y0 > box.y1) continue;
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
