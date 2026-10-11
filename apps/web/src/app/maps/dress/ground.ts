import { heightsOf, type Elevation } from '../elevation';

/**
 * The ground under a dressing: how high and how steep it is at a point, from the map's
 * elevation, so rules can keep to a band (trees below the tree line, scree on the slopes, snow on
 * the peaks). Pure.
 *
 * Height is measured from the sea's edge (0) to the highest ground of the map (1), so the same
 * recipe fits a low island and a mountain range; below the sea it is negative. Steepness is the
 * rise over one elevation cell, 1 at `CLIFF` height units or more.
 */

export interface GroundSample {
  height: number;
  slope: number;
}

export type Ground = (x: number, y: number) => GroundSample;

/** Height units of rise over one cell that count as a cliff (steepness 1). */
export const CLIFF = 24;

/** How wide the soft end of a band is (pieces thin out across it). */
export const BAND_SOFT = 0.06;

const grounds = new WeakMap<Elevation, Ground>();

/** The ground of a map's elevation, sampled between cells (worked out once per elevation). */
export function groundOf(e: Elevation): Ground {
  const known = grounds.get(e);
  if (known) return known;
  const heights = heightsOf(e);
  let peak = 0;
  for (const h of heights) if (h > peak) peak = h;
  const range = Math.max(1, peak - e.sea);
  const at = (cx: number, cy: number): number => {
    const x = Math.max(0, Math.min(e.w - 1, cx));
    const y = Math.max(0, Math.min(e.h - 1, cy));
    return heights[y * e.w + x] ?? 0;
  };
  /** Bilinear between the four cells round a point. */
  const sample = (fx: number, fy: number): number => {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
  const ground: Ground = (x, y) => {
    // Cell centres sit at half a cell.
    const fx = x / e.cell - 0.5;
    const fy = y / e.cell - 0.5;
    const h = sample(fx, fy);
    const gx = (sample(fx + 1, fy) - sample(fx - 1, fy)) / 2;
    const gy = (sample(fx, fy + 1) - sample(fx, fy - 1)) / 2;
    return {
      height: (h - e.sea) / range,
      slope: Math.min(1, Math.hypot(gx, gy) / CLIFF),
    };
  };
  grounds.set(e, ground);
  return ground;
}

/**
 * Whether a value in a band keeps its piece: always well inside, never outside, and less and less
 * often across the soft ends (`r` is a random number, 0–1). A band from 0 has no lower end, one to
 * 1 no upper end (the shore and the peaks are not thinned).
 */
export function keepInBand(value: number, band: readonly [number, number], r: number): boolean {
  const [lo, hi] = band;
  const inside = Math.min(lo <= 0 ? Infinity : value - lo, hi >= 1 ? Infinity : hi - value);
  if (inside >= BAND_SOFT) return true;
  if (inside <= 0) return false;
  return r < inside / BAND_SOFT;
}
