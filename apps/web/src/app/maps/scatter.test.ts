import { describe, expect, it } from 'vitest';
import { blocked, noise2, scatterInstances, type ScatterSpec } from './scatter';

const square = [0, 0, 600, 0, 600, 600, 0, 600];
const base: ScatterSpec = {
  mode: 'area',
  line: square,
  seed: 42,
  spacing: 40,
  sizeMin: 30,
  sizeMax: 50,
  weights: [1, 1],
  rotation: 'random',
  cluster: 0,
  offset: 0,
  sides: 'center',
  jitter: 0.3,
  clearance: 0,
  max: 5000,
};
const none = { lines: [], polygons: [] };

describe('scatter in an area', () => {
  it('is the same for the same seed and differs for another', () => {
    expect(scatterInstances(base, none)).toEqual(scatterInstances(base, none));
    expect(scatterInstances({ ...base, seed: 43 }, none)).not.toEqual(scatterInstances(base, none));
  });

  it('stays inside the area, keeps pieces apart, and goes back to front', () => {
    const list = scatterInstances(base, none);
    expect(list.length).toBeGreaterThan(40);
    for (const p of list) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(600);
      expect(p.y).toBeLessThanOrEqual(600);
    }
    let closest = Infinity;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a && b) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
      }
    expect(closest).toBeGreaterThanOrEqual(40 * 0.85 - 0.001);
    expect(list.map((p) => p.y)).toEqual([...list.map((p) => p.y)].sort((a, b) => a - b));
  });

  it('is thinner with more spacing, and capped', () => {
    const dense = scatterInstances({ ...base, spacing: 30 }, none).length;
    const sparse = scatterInstances({ ...base, spacing: 80 }, none).length;
    expect(dense).toBeGreaterThan(sparse);
    expect(scatterInstances({ ...base, spacing: 10, max: 25 }, none)).toHaveLength(25);
  });

  it('keeps clear of roads and water, and uses the weights', () => {
    const road = { points: [0, 300, 600, 300], half: 20 };
    const lake = [100, 100, 250, 100, 250, 250, 100, 250];
    const list = scatterInstances(base, { lines: [road], polygons: [lake] });
    expect(list.length).toBeGreaterThan(20);
    expect(list.some((p) => Math.abs(p.y - 300) < 20)).toBe(false);
    expect(list.some((p) => p.x > 100 && p.x < 250 && p.y > 100 && p.y < 250)).toBe(false);
    expect(blocked(300, 305, { lines: [road], polygons: [] }, 0)).toBe(true);
    expect(blocked(300, 330, { lines: [road], polygons: [] }, 0)).toBe(false);
    expect(blocked(300, 330, { lines: [road], polygons: [] }, 15)).toBe(true);
    const only = scatterInstances({ ...base, weights: [0, 1] }, none);
    expect(only.every((p) => p.piece === 1)).toBe(true);
  });

  it('can be clustered into groves, leaving clearings', () => {
    const even = scatterInstances(base, none).length;
    const grove = scatterInstances({ ...base, cluster: 0.9 }, none).length;
    expect(grove).toBeLessThan(even);
    expect(grove).toBeGreaterThan(0);
  });

  it('only goes where allowed', () => {
    const list = scatterInstances(base, none, (x) => x < 300);
    expect(list.every((p) => p.x < 300)).toBe(true);
  });
});

describe('scatter along a line', () => {
  const along: ScatterSpec = {
    ...base,
    mode: 'along',
    line: [0, 0, 600, 0],
    spacing: 50,
    offset: 30,
    sides: 'both',
    jitter: 0,
    rotation: 'along',
  };

  it('stands on both sides of the line, offset from it', () => {
    const list = scatterInstances(along, none);
    expect(list.length).toBeGreaterThan(8);
    expect(list.some((p) => p.y > 20)).toBe(true);
    expect(list.some((p) => p.y < -20)).toBe(true);
    expect(list.every((p) => Math.abs(Math.abs(p.y) - 30) < 0.001)).toBe(true);
  });

  it('can run down the middle of the line, like a mountain range', () => {
    const list = scatterInstances({ ...along, sides: 'center', jitter: 0.5 }, none);
    expect(list.every((p) => Math.abs(p.y) <= 0.5 * 50 + 0.001)).toBe(true);
  });
});

describe('noise', () => {
  it('is smooth, stays between 0 and 1 and repeats for the same input', () => {
    expect(noise2(3.3, 4.4, 1)).toBe(noise2(3.3, 4.4, 1));
    for (let i = 0; i < 50; i++) {
      const v = noise2(i * 0.37, i * 0.91, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(noise2(2, 2, 1) - noise2(2.01, 2, 1))).toBeLessThan(0.1);
  });
});
