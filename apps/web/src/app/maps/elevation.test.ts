import { describe, expect, it } from 'vitest';
import {
  decodeHeights,
  encodeHeights,
  flatElevation,
  generateHeights,
  heightAt,
  heightsOf,
  LAND,
  paintHeights,
  riversFromHeights,
  shadeImage,
} from './elevation';

describe('elevation', () => {
  it('is a grid of about 200 cells along the longer side, flat land, kept as bytes', () => {
    const e = flatElevation(2800, 2100);
    expect(Math.max(e.w, e.h)).toBeLessThanOrEqual(200);
    expect(e.w * e.cell).toBeGreaterThanOrEqual(2800);
    const heights = heightsOf(e);
    expect(heights).toHaveLength(e.w * e.h);
    expect(heights.every((v) => v === LAND)).toBe(true);
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect([...decodeHeights(encodeHeights(bytes), 5)]).toEqual([0, 1, 127, 128, 255]);
    expect([...decodeHeights('%%not base64', 3)]).toEqual([LAND, LAND, LAND]);
  });

  it('is painted with a soft brush that raises, lowers, smooths and flattens', () => {
    const e = flatElevation(1000, 1000);
    const heights = heightsOf(e);
    const middle = { x: 500, y: 500 };
    paintHeights(heights, e, middle, 100, 1, 'raise');
    const peak = heightAt(e, heights, 500, 500);
    expect(peak).toBeGreaterThan(LAND + 20);
    // Softer towards the edge of the brush, nothing outside it.
    expect(heightAt(e, heights, 590, 500)).toBeLessThan(peak);
    expect(heightAt(e, heights, 700, 500)).toBe(LAND);
    paintHeights(heights, e, middle, 100, 1, 'lower');
    paintHeights(heights, e, middle, 100, 1, 'lower');
    expect(heightAt(e, heights, 500, 500)).toBeLessThan(LAND);
    // Flatten pulls back to the target; smoothing evens out a spike.
    for (let k = 0; k < 6; k++) paintHeights(heights, e, middle, 100, 1, 'flatten', LAND);
    expect(Math.abs(heightAt(e, heights, 500, 500) - LAND)).toBeLessThan(6);
    const spike = heightsOf(e);
    spike[Math.floor(e.h / 2) * e.w + Math.floor(e.w / 2)] = 255;
    paintHeights(spike, e, middle, 60, 1, 'smooth');
    expect(spike[Math.floor(e.h / 2) * e.w + Math.floor(e.w / 2)]).toBeLessThan(255);
    // Heights stay in a byte.
    for (let k = 0; k < 30; k++) paintHeights(heights, e, middle, 100, 1, 'raise');
    expect(Math.max(...heights)).toBeLessThanOrEqual(255);
  });

  it('is made from noise, the same for a seed, with sea round an island', () => {
    const e = flatElevation(2000, 1500);
    const a = generateHeights(e, { seed: 4, roughness: 0.5, island: true });
    const b = generateHeights(e, { seed: 4, roughness: 0.5, island: true });
    const c = generateHeights(e, { seed: 5, roughness: 0.5, island: true });
    expect([...a]).toEqual([...b]);
    expect([...a]).not.toEqual([...c]);
    const edge = a[0] ?? 0;
    const middle = a[Math.floor(e.h / 2) * e.w + Math.floor(e.w / 2)] ?? 0;
    expect(middle).toBeGreaterThan(edge);
    expect(edge).toBeLessThan(e.sea);
    const rough = generateHeights(e, { seed: 4, roughness: 1, island: false });
    const smooth = generateHeights(e, { seed: 4, roughness: 0, island: false });
    const variance = (v: Uint8Array) => {
      const mean = v.reduce((s, x) => s + x, 0) / v.length;
      return v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length;
    };
    expect(variance(rough)).not.toBe(variance(smooth));
  });

  it('is shaded from the slope: see-through on flat ground, dark and light on the two sides of a hill', () => {
    const e = flatElevation(400, 400);
    const flat = shadeImage(e, heightsOf(e));
    expect(flat.filter((_, i) => i % 4 === 3).every((a) => a === 0)).toBe(true);
    const heights = heightsOf(e);
    paintHeights(heights, e, { x: 200, y: 200 }, 80, 1, 'raise');
    paintHeights(heights, e, { x: 200, y: 200 }, 80, 1, 'raise');
    const image = shadeImage(e, heights);
    const px = (x: number, y: number) => {
      const i = (Math.floor(y / e.cell) * e.w + Math.floor(x / e.cell)) * 4;
      return { r: image[i] ?? 0, a: image[i + 3] ?? 0 };
    };
    // North-west of the top is lit (white), south-east in shadow (dark).
    const lit = px(160, 160);
    const shadow = px(240, 240);
    expect(lit.a).toBeGreaterThan(0);
    expect(shadow.a).toBeGreaterThan(0);
    expect(lit.r).toBeGreaterThan(shadow.r);
    // Tinted, the sea is blue and the picture is more opaque.
    const sea = flatElevation(400, 400);
    const low = new Uint8Array(sea.w * sea.h).fill(10);
    const tinted = shadeImage({ ...sea, tint: true }, low);
    expect(tinted[3]).toBeGreaterThan(0);
    expect(tinted[2] ?? 0).toBeGreaterThan(tinted[0] ?? 0);
  });
});

describe('rivers from the heights', () => {
  /** A mountain in the middle of a square island: high in the centre, sea at the edge. */
  const cone = () => {
    const w = 60;
    const h = 60;
    const heights = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - w / 2, y - h / 2) / (w / 2);
        heights[y * w + x] = Math.max(0, Math.round(255 - d * 255 - ((x + y) % 3)));
      }
    return { e: { w, h, cell: 20, sea: 60 }, heights };
  };

  it('start high, run downhill and end at the sea', () => {
    const { e, heights } = cone();
    const rivers = riversFromHeights(e, heights, { seed: 3, count: 4, minLength: 8 });
    expect(rivers.length).toBeGreaterThan(0);
    for (const river of rivers) {
      const cell = (i: number) =>
        heights[
          Math.floor((river[i + 1] ?? 0) / e.cell) * e.w + Math.floor((river[i] ?? 0) / e.cell)
        ] ?? 0;
      expect(cell(0)).toBeGreaterThan(e.sea + 40);
      expect(cell(river.length - 2)).toBeLessThanOrEqual(e.sea + 25);
      // Never far uphill (steps are every few cells, noise is small).
      for (let i = 2; i + 1 < river.length; i += 2)
        expect(cell(i)).toBeLessThanOrEqual(cell(i - 2) + 6);
    }
  });

  it('is the same for the same seed, and none on flat or all-sea land', () => {
    const { e, heights } = cone();
    const a = riversFromHeights(e, heights, { seed: 9, count: 3, minLength: 8 });
    expect(riversFromHeights(e, heights, { seed: 9, count: 3, minLength: 8 })).toEqual(a);
    expect(
      riversFromHeights(e, new Uint8Array(e.w * e.h).fill(LAND), {
        seed: 1,
        count: 3,
        minLength: 5,
      }),
    ).toEqual([]);
    expect(
      riversFromHeights(e, new Uint8Array(e.w * e.h), { seed: 1, count: 3, minLength: 5 }),
    ).toEqual([]);
  });
});
