import { describe, expect, it } from 'vitest';
import { newMap } from './model';
import {
  cellFor,
  formatLength,
  mapSizeMeters,
  metersPerPixel,
  PACK_SQUARE_M,
  squaresFor,
  stampUnit,
} from './units';

describe('real sizes', () => {
  it('reads a battle map as 5 feet to the square', () => {
    const doc = newMap('B', [], '', { w: 40, h: 30 });
    expect(metersPerPixel(doc)).toBeCloseTo(PACK_SQUARE_M / 70);
    const size = mapSizeMeters(doc);
    expect(size.w).toBeCloseTo(40 * PACK_SQUARE_M);
    expect(size.h).toBeCloseTo(30 * PACK_SQUARE_M);
  });

  it('draws pack squares as one grid square on a battle map, small on a large map', () => {
    const doc = newMap('B', [], '', { w: 40, h: 30 });
    expect(stampUnit(doc)).toBeCloseTo(70);
    const world = { ...doc, scale: { unit: 'km' as const, perPixel: 0.5 } };
    expect(metersPerPixel(world)).toBeCloseTo(500);
    expect(stampUnit(world)).toBeLessThan(0.01);
  });

  it('scales every stamp by the map factor', () => {
    const doc = { ...newMap('B', [], '', { w: 40, h: 30 }), stampScale: 3 };
    expect(stampUnit(doc)).toBeCloseTo(210);
  });

  it('names lengths in the unit that reads best', () => {
    expect(formatLength(7.5)).toBe('7.5 m');
    expect(formatLength(61)).toBe('61 m');
    expect(formatLength(1500)).toBe('1.5 km');
    expect(formatLength(250_000)).toBe('250 km');
  });

  it('keeps 5 feet to the square while the map is small and rounds the cell up for a large one', () => {
    expect(cellFor(60, 45)).toBeCloseTo(PACK_SQUARE_M);
    expect(cellFor(300, 200)).toBeCloseTo(PACK_SQUARE_M);
    expect(cellFor(500, 400)).toBe(5);
    expect(cellFor(30_000, 20_000)).toBe(200);
    expect(squaresFor(500, 400, 5)).toEqual({ w: 100, h: 80 });
    expect(squaresFor(100_000, 1, 10)).toEqual({ w: 200, h: 1 });
  });
});

import { planMap } from './units';

describe('planning a new map', () => {
  it('turns a size in meters into squares of 5 feet', () => {
    const plan = planMap(61, 46, 'm');
    expect(plan.squares).toEqual({ w: 40, h: 30 });
    expect(plan.cell).toBeCloseTo(PACK_SQUARE_M);
  });
  it('picks a larger square for a large map and keeps the real size', () => {
    const plan = planMap(50, 30, 'km');
    expect(plan.cell).toBe(500);
    expect(plan.squares).toEqual({ w: 100, h: 60 });
  });
  it('grows a square that is too small to fit the map', () => {
    const plan = planMap(1000, 500, 'm', 1);
    expect(plan.cell).toBeCloseTo(5);
    expect(plan.squares.w).toBe(200);
  });
  it('reads feet and miles', () => {
    expect(planMap(200, 150, 'ft').squares).toEqual({ w: 40, h: 30 });
    expect(planMap(30, 20, 'mi').cell).toBe(500);
  });
});
