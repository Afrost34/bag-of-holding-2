import { noise2 } from './scatter';

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
