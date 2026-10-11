import { describe, expect, it } from 'vitest';
import { encodeHeights, type Elevation } from '../elevation';
import { BAND_SOFT, CLIFF, groundOf, keepInBand } from './ground';

/** A ramp rising along x: `rise` height units per cell, from the sea's edge. */
function ramp(rise: number, w = 20, h = 4): Elevation {
  const heights = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) heights[y * w + x] = Math.min(255, 50 + x * rise);
  return { w, h, cell: 10, data: encodeHeights(heights), sea: 50, strength: 0.5, tint: false };
}

describe('the ground under a dressing', () => {
  it('measures height from the sea (0) to the highest ground (1), between cells', () => {
    const e = ramp(10);
    const ground = groundOf(e);
    // Cell centres sit at half a cell: the first is at the sea, the last at the peak.
    expect(ground(5, 15).height).toBeCloseTo(0, 5);
    expect(ground(195, 15).height).toBeCloseTo(1, 5);
    // Halfway between two cell centres, halfway between their heights.
    expect(ground(10, 15).height).toBeCloseTo(5 / 190, 5);
    // The same function each time for the same elevation.
    expect(groundOf(e)).toBe(ground);
  });

  it('measures steepness by the rise over a cell, a cliff at CLIFF units', () => {
    expect(groundOf(ramp(6))(100, 15).slope).toBeCloseTo(6 / CLIFF, 5);
    expect(groundOf(ramp(12))(60, 15).slope).toBeCloseTo(12 / CLIFF, 5);
    expect(groundOf(ramp(40, 6))(30, 15).slope).toBe(1);
    expect(groundOf(ramp(0))(30, 15).slope).toBe(0);
  });
});

describe('a band of ground', () => {
  it('keeps every piece well inside it and none outside', () => {
    for (const r of [0, 0.5, 0.999]) {
      expect(keepInBand(0.3, [0.2, 0.6], r)).toBe(true);
      expect(keepInBand(0.1, [0.2, 0.6], r)).toBe(false);
      expect(keepInBand(0.7, [0.2, 0.6], r)).toBe(false);
    }
  });

  it('thins pieces out across its soft ends', () => {
    const edge = 0.2 + BAND_SOFT / 4;
    expect(keepInBand(edge, [0.2, 0.6], 0.1)).toBe(true);
    expect(keepInBand(edge, [0.2, 0.6], 0.5)).toBe(false);
  });

  it('has no end at 0 or 1: the shore and the peaks are not thinned', () => {
    expect(keepInBand(0.001, [0, 0.5], 0.999)).toBe(true);
    expect(keepInBand(-0.2, [0, 0.5], 0.999)).toBe(true);
    expect(keepInBand(0.999, [0.5, 1], 0.999)).toBe(true);
  });
});
