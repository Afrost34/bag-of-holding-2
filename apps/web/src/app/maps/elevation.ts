import { noise2 } from './scatter';
import { seeded } from './terrain';

/**
 * Elevation: a coarse grid of heights (0–255) under the map, painted with a soft brush or made
 * from noise, shown as hill shading (light from the north-west), with the sea and the land
 * coloured by height when asked. Stored as base64 bytes, a few kilobytes for a whole map.
 * Pure: it works on bytes, the scene turns the result into a picture.
 */

export interface Elevation {
  /** Cells across and down. */
  w: number;
  h: number;
  /** Map pixels per cell. */
  cell: number;
  /** One byte per cell, row by row, base64. */
  data: string;
  /** Heights at or below this are sea (0–255). */
  sea: number;
  /** How strongly the shading shows, 0–1. */
  strength: number;
  /** Colour the land by height and the sea blue. */
  tint: boolean;
  /** Contour lines every this many height units (0–255 scale); absent: none. */
  contours?: number;
}

export const LAND = 120;

export function encodeHeights(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export function decodeHeights(data: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  try {
    const text = atob(data);
    for (let i = 0; i < Math.min(length, text.length); i++) out[i] = text.charCodeAt(i);
  } catch {
    out.fill(LAND);
  }
  return out;
}

/** The heights of an elevation as bytes. */
export const heightsOf = (e: Elevation): Uint8Array => decodeHeights(e.data, e.w * e.h);

/** An elevation for a map of this size: about 200 cells along its longer side, all flat land. */
export function flatElevation(width: number, height: number): Elevation {
  const cell = Math.max(8, Math.ceil(Math.max(width, height) / 200));
  const w = Math.ceil(width / cell);
  const h = Math.ceil(height / cell);
  return {
    w,
    h,
    cell,
    data: encodeHeights(new Uint8Array(w * h).fill(LAND)),
    sea: 90,
    strength: 0.6,
    tint: false,
  };
}

export type BrushMode = 'raise' | 'lower' | 'smooth' | 'flatten';

/**
 * A soft round brush applied at a map point: raises, lowers, smooths towards the neighbours, or
 * pulls the heights towards `target` (flatten). `strength` is 0–1 per dab; edges fall off softly.
 */
export function paintHeights(
  heights: Uint8Array,
  e: Pick<Elevation, 'w' | 'h' | 'cell'>,
  at: { x: number; y: number },
  radius: number,
  strength: number,
  mode: BrushMode,
  target = LAND,
): void {
  const cx = at.x / e.cell;
  const cy = at.y / e.cell;
  const r = Math.max(1, radius / e.cell);
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(e.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(e.h - 1, Math.ceil(cy + r));
  const source = mode === 'smooth' ? heights.slice() : heights;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) continue;
      const falloff = (1 + Math.cos(d * Math.PI)) / 2;
      const i = y * e.w + x;
      const now = heights[i] ?? LAND;
      let next: number;
      if (mode === 'raise') next = now + 40 * strength * falloff;
      else if (mode === 'lower') next = now - 40 * strength * falloff;
      else if (mode === 'flatten')
        next = now + (target - now) * Math.min(1, strength * falloff * 1.5);
      else {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= e.w || yy >= e.h) continue;
            sum += source[yy * e.w + xx] ?? LAND;
            n++;
          }
        next = now + (sum / n - now) * Math.min(1, strength * falloff * 1.5);
      }
      heights[i] = Math.max(0, Math.min(255, Math.round(next)));
    }
}

export interface TerrainRequest {
  seed: number;
  /** 0 smooth rolling land, 1 jagged mountains. */
  roughness: number;
  /** A landmass with sea all round (otherwise land everywhere). */
  island: boolean;
}

/** Heights from layered noise, with the sea round the edge when asked. */
export function generateHeights(e: Pick<Elevation, 'w' | 'h'>, req: TerrainRequest): Uint8Array {
  const out = new Uint8Array(e.w * e.h);
  const octaves = 3 + Math.round(req.roughness * 3);
  for (let y = 0; y < e.h; y++)
    for (let x = 0; x < e.w; x++) {
      let value = 0;
      let amplitude = 1;
      let norm = 0;
      let frequency = 3 / Math.max(e.w, e.h);
      for (let o = 0; o < octaves; o++) {
        value += noise2(x * frequency, y * frequency, req.seed + o * 101) * amplitude;
        norm += amplitude;
        amplitude *= 0.35 + req.roughness * 0.3;
        frequency *= 2;
      }
      let v = value / norm;
      if (req.island) {
        const dx = (x / e.w - 0.5) * 2;
        const dy = (y / e.h - 0.5) * 2;
        const dist = Math.min(1, Math.hypot(dx, dy));
        v = v * (1 - dist ** 2.2 * 0.85) - dist ** 3 * 0.15;
      }
      out[y * e.w + x] = Math.max(0, Math.min(255, Math.round(40 + v * 260 - 40)));
    }
  return out;
}

export interface RiverRequest {
  seed: number;
  /** How many rivers to try for. */
  count: number;
  /** Least length, in cells, for a river to be kept. */
  minLength: number;
}

/**
 * Rivers that run downhill: each starts high on the land and follows the steepest way down until
 * it reaches the sea, the map's edge or another river. Points are in map pixels, source first, so
 * a river that widens downstream widens the right way.
 */
export function riversFromHeights(
  e: Pick<Elevation, 'w' | 'h' | 'cell' | 'sea'>,
  heights: Uint8Array,
  req: RiverRequest,
): number[][] {
  const { w, h } = e;
  const rand = seeded(req.seed);
  const at = (x: number, y: number) => heights[y * w + x] ?? 0;
  // Sources: cells well above the sea, the highest first (with some chance, so they vary).
  const high = e.sea + Math.max(40, (255 - e.sea) * 0.35);
  const candidates: { x: number; y: number; score: number }[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (at(x, y) >= high) candidates.push({ x, y, score: at(x, y) + rand() * 60 });
  candidates.sort((a, b) => b.score - a.score);
  const taken = new Set<number>();
  const rivers: number[][] = [];
  const apart = Math.max(4, Math.round(Math.min(w, h) / 10));
  const starts: { x: number; y: number }[] = [];
  for (const c of candidates) {
    if (starts.length >= req.count) break;
    if (starts.every((s) => Math.hypot(s.x - c.x, s.y - c.y) >= apart)) starts.push(c);
  }
  for (const start of starts) {
    const path: { x: number; y: number }[] = [{ x: start.x, y: start.y }];
    const seen = new Set<number>([start.y * w + start.x]);
    let x = start.x;
    let y = start.y;
    let flat = 0;
    let joined = false;
    for (let steps = 0; steps < w * h; steps++) {
      if (at(x, y) <= e.sea) break;
      let best: { x: number; y: number; v: number } | null = null;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(ny * w + nx)) continue;
          // Diagonals are a little longer: a touch of preference for straight steps.
          const v = at(nx, ny) + (dx !== 0 && dy !== 0 ? 0.4 : 0) + rand() * 0.3;
          if (!best || v < best.v) best = { x: nx, y: ny, v };
        }
      if (!best) break;
      // A pit: a few flat steps (a lake's width) are crossed, then the river ends.
      if (best.v > at(x, y) + 0.8) {
        if (++flat > 6) break;
      } else flat = 0;
      x = best.x;
      y = best.y;
      seen.add(y * w + x);
      path.push({ x, y });
      if (taken.has(y * w + x)) {
        joined = true;
        break;
      }
    }
    const reached = joined || at(x, y) <= e.sea || x === 0 || y === 0 || x === w - 1 || y === h - 1;
    if (path.length < req.minLength || !reached) continue;
    for (const p of path) taken.add(p.y * w + p.x);
    // Every few cells is enough: the path is rounded when drawn.
    const keep = path.filter((_, i) => i % 3 === 0 || i === path.length - 1);
    rivers.push(
      keep.flatMap((p) => [Math.round((p.x + 0.5) * e.cell), Math.round((p.y + 0.5) * e.cell)]),
    );
  }
  return rivers;
}

/** One short line of a contour: x1, y1, x2, y2 in cells (a cell's middle is at .5). */
export type ContourSegment = [number, number, number, number];

/**
 * The line where the ground is at `level`, by marching squares: a short segment through every
 * square of four cells that the level crosses.
 */
export function contourSegments(
  w: number,
  h: number,
  heights: Uint8Array,
  level: number,
): ContourSegment[] {
  const out: ContourSegment[] = [];
  const v = (x: number, y: number) => heights[y * w + x] ?? 0;
  // Where along an edge the level is crossed (0 at the first end, 1 at the second).
  const at = (v1: number, v2: number) => (v2 === v1 ? 0.5 : (level - v1) / (v2 - v1));
  for (let y = 0; y + 1 < h; y++)
    for (let x = 0; x + 1 < w; x++) {
      const tl = v(x, y);
      const tr = v(x + 1, y);
      const br = v(x + 1, y + 1);
      const bl = v(x, y + 1);
      const index =
        (tl >= level ? 8 : 0) |
        (tr >= level ? 4 : 0) |
        (br >= level ? 2 : 0) |
        (bl >= level ? 1 : 0);
      if (index === 0 || index === 15) continue;
      const top: [number, number] = [x + 0.5 + at(tl, tr), y + 0.5];
      const right: [number, number] = [x + 1.5, y + 0.5 + at(tr, br)];
      const bottom: [number, number] = [x + 0.5 + at(bl, br), y + 1.5];
      const left: [number, number] = [x + 0.5, y + 0.5 + at(tl, bl)];
      const line = (a: [number, number], b: [number, number]) => {
        out.push([a[0], a[1], b[0], b[1]]);
      };
      switch (index) {
        case 1:
        case 14:
          line(left, bottom);
          break;
        case 2:
        case 13:
          line(bottom, right);
          break;
        case 3:
        case 12:
          line(left, right);
          break;
        case 4:
        case 11:
          line(top, right);
          break;
        case 6:
        case 9:
          line(top, bottom);
          break;
        case 7:
        case 8:
          line(top, left);
          break;
        case 5:
          // A saddle: told apart by the middle of the square.
          if ((tl + tr + br + bl) / 4 >= level) {
            line(top, right);
            line(left, bottom);
          } else {
            line(top, left);
            line(bottom, right);
          }
          break;
        case 10:
          if ((tl + tr + br + bl) / 4 >= level) {
            line(top, left);
            line(bottom, right);
          } else {
            line(top, right);
            line(left, bottom);
          }
          break;
      }
    }
  return out;
}

/** Height 0–255 → a colour: deep water to shore, then green lowland, brown hills, white peaks. */
function tintOf(height: number, sea: number): [number, number, number, number] {
  if (height <= sea) {
    const t = sea === 0 ? 1 : height / sea;
    return [Math.round(30 + 50 * t), Math.round(80 + 70 * t), Math.round(140 + 60 * t), 0.85];
  }
  const t = Math.min(1, (height - sea) / Math.max(1, 255 - sea));
  if (t < 0.35) return [95 + Math.round(t * 260), 150 - Math.round(t * 60), 70, 0.55];
  if (t < 0.7)
    return [150 + Math.round((t - 0.35) * 150), 120, 80 + Math.round((t - 0.35) * 60), 0.34];
  return [240, 240, 245, 0.45 + (t - 0.7) * 0.5];
}

/**
 * The picture of an elevation as RGBA bytes (w × h): shade from the slope, light from the
 * north-west (dark on the far side, a little light on the near), plus the height tint when
 * asked. Fully see-through where the land is flat and there is no tint.
 */
export function shadeImage(e: Elevation, heights: Uint8Array): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(e.w * e.h * 4);
  const at = (x: number, y: number) =>
    heights[Math.max(0, Math.min(e.h - 1, y)) * e.w + Math.max(0, Math.min(e.w - 1, x))] ?? LAND;
  // Heights are 0–255 over cells of `cell` pixels: this makes a typical slope visible.
  const exaggeration = 2.2;
  for (let y = 0; y < e.h; y++)
    for (let x = 0; x < e.w; x++) {
      const dzdx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * exaggeration;
      const dzdy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * exaggeration;
      // Light from the north-west: a slope that rises towards the south-east faces it, so it is lit.
      const lit = (dzdx + dzdy) / Math.SQRT2;
      const i = (y * e.w + x) * 4;
      const height = at(x, y);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      if (e.tint) {
        const [tr, tg, tb, ta] = tintOf(height, e.sea);
        r = tr;
        g = tg;
        b = tb;
        a = ta * (0.35 + 0.65 * e.strength);
      }
      if (height > e.sea || !e.tint) {
        const shade = Math.max(-1, Math.min(1, lit / 24));
        const sa = Math.abs(shade) * 0.7 * e.strength;
        const sr = shade < 0 ? 20 : 255;
        // Composite the shade over the tint.
        const outA = sa + a * (1 - sa);
        if (outA > 0) {
          r = (sr * sa + r * a * (1 - sa)) / outA;
          g = (sr * sa + g * a * (1 - sa)) / outA;
          b = (sr * sa + b * a * (1 - sa)) / outA;
          a = outA;
        }
      }
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = Math.round(a * 255);
    }
  return out;
}

/** The height at a map point (nearest cell), for scatter that follows the land. */
export function heightAt(e: Elevation, heights: Uint8Array, x: number, y: number): number {
  const cx = Math.max(0, Math.min(e.w - 1, Math.floor(x / e.cell)));
  const cy = Math.max(0, Math.min(e.h - 1, Math.floor(y / e.cell)));
  return heights[cy * e.w + cx] ?? LAND;
}
