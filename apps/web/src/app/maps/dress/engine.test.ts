import { describe, expect, it } from 'vitest';
import type { DressRule } from '../model';
import { pointInPolygon } from '../polygon';
import { scatterInstances } from '../scatter';
import { dressPieces, ruleSeed, type DressTarget } from './engine';

const square = [0, 0, 800, 0, 800, 800, 0, 800];

const target = (over: Partial<DressTarget> = {}): DressTarget => ({
  line: square,
  mode: 'area',
  seed: 11,
  obstacles: { lines: [], polygons: [] },
  allowed: () => true,
  clearance: 0,
  cell: 70,
  ...over,
});

const rule = (over: Partial<DressRule> = {}): DressRule => ({
  place: 'area',
  pieces: [
    { ref: 'glyph:tree', weight: 1 },
    { ref: 'glyph:bush', weight: 1 },
  ],
  spacing: 50,
  sizeMin: 30,
  sizeMax: 50,
  rotation: 'none',
  cluster: 0,
  offset: 0,
  sides: 'center',
  jitter: 0,
  ...over,
});

const edgeDistance = (p: { x: number; y: number }) => Math.min(p.x, p.y, 800 - p.x, 800 - p.y);

describe('the dress engine', () => {
  it('gives the same pieces for the same seed', () => {
    expect(dressPieces([rule()], target())).toEqual(dressPieces([rule()], target()));
  });

  it('places the first rule exactly as a plain scatter did (old maps look the same)', () => {
    const r = rule();
    const old = scatterInstances(
      {
        mode: 'area',
        line: square,
        seed: 11,
        spacing: r.spacing,
        sizeMin: r.sizeMin,
        sizeMax: r.sizeMax,
        weights: [1, 1],
        rotation: 'none',
        cluster: 0,
        offset: 0,
        sides: 'center',
        jitter: 0,
        clearance: 0,
        max: 6000,
      },
      { lines: [], polygons: [] },
    );
    const now = dressPieces([r], target());
    expect(now.map((p) => [p.x, p.y, p.piece])).toEqual(old.map((p) => [p.x, p.y, p.piece]));
    expect(ruleSeed(11, 0)).toBe(11);
  });

  it('runs rules in order and tells which rule placed a piece', () => {
    const list = dressPieces([rule(), rule({ spacing: 120 })], target());
    const first = list.findIndex((p) => p.rule === 1);
    expect(first).toBeGreaterThan(0);
    expect(list.slice(first).every((p) => p.rule === 1)).toBe(true);
  });

  it('keeps near the edge', () => {
    const list = dressPieces([rule({ place: 'edge', depth: 100 })], target());
    expect(list.length).toBeGreaterThan(10);
    expect(list.every((p) => edgeDistance(p) <= 100)).toBe(true);
  });

  it('thins towards the edge with falloff', () => {
    const even = dressPieces([rule()], target());
    const thin = dressPieces([rule({ falloff: 1 })], target());
    const nearEdge = (l: { x: number; y: number }[]) =>
      l.filter((p) => edgeDistance(p) < 60).length;
    expect(nearEdge(thin)).toBeLessThan(nearEdge(even));
    expect(thin.length).toBeLessThan(even.length);
  });

  it('places clumps inside the area', () => {
    const list = dressPieces([rule({ place: 'cluster' })], target());
    expect(list.length).toBeGreaterThan(10);
    expect(list.every((p) => pointInPolygon(p, square))).toBe(true);
  });

  it('places rows on a regular step', () => {
    const list = dressPieces([rule({ place: 'grid', spacing: 100 })], target());
    expect(list).toHaveLength(64);
    expect(list.every((p) => (p.x - 50) % 100 === 0 && (p.y - 50) % 100 === 0)).toBe(true);
  });

  it('snaps to the middle of grid cells, one piece per cell', () => {
    const list = dressPieces([rule({ snap: 1, spacing: 30 })], target());
    const keys = list.map((p) => `${String(p.x)},${String(p.y)}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.every((p) => (p.x - 35) % 70 === 0 && (p.y - 35) % 70 === 0)).toBe(true);
  });

  it('keeps a later rule clear of the earlier pieces', () => {
    const big = rule({ spacing: 150, sizeMin: 120, sizeMax: 120 });
    const small = rule({ spacing: 30, sizeMin: 20, sizeMax: 20 });
    const crowded = dressPieces([big, small], target());
    const apart = dressPieces([big, { ...small, apart: true }], target());
    const second = (l: typeof crowded) => l.filter((p) => p.rule === 1);
    expect(second(apart).length).toBeLessThan(second(crowded).length);
    const trees = apart.filter((p) => p.rule === 0);
    for (const p of second(apart))
      for (const t of trees) expect(Math.hypot(p.x - t.x, p.y - t.y)).toBeGreaterThanOrEqual(49);
  });

  it('mirrors and tints some pieces', () => {
    const list = dressPieces([rule({ flip: true, tint: 1 })], target());
    expect(list.some((p) => p.flip)).toBe(true);
    expect(list.some((p) => !p.flip)).toBe(true);
    expect(list.every((p) => typeof p.tint === 'string')).toBe(true);
  });

  it('follows the outline of an area along its edge', () => {
    const list = dressPieces([rule({ place: 'along', spacing: 80 })], target());
    expect(list.length).toBeGreaterThan(20);
    expect(list.every((p) => edgeDistance(p) < 1)).toBe(true);
  });

  it('makes nothing for a rule without pieces', () => {
    expect(dressPieces([rule({ pieces: [] })], target())).toEqual([]);
  });
});
