import { describe, expect, it } from 'vitest';
import { clampSides, dragBox, presetOutline } from './outline';

describe('dragBox', () => {
  it('runs from the start to the pointer', () => {
    expect(dragBox({ x: 10, y: 10 }, { x: 40, y: 30 }, false, false)).toEqual({
      x0: 10,
      y0: 10,
      x1: 40,
      y1: 30,
    });
  });
  it('makes a square with Shift, in the direction of the drag', () => {
    expect(dragBox({ x: 10, y: 10 }, { x: 40, y: 20 }, true, false)).toEqual({
      x0: 10,
      y0: 10,
      x1: 40,
      y1: 40,
    });
    expect(dragBox({ x: 10, y: 10 }, { x: -20, y: 5 }, true, false).x1).toBe(-20);
  });
  it('takes the start as the centre with Alt', () => {
    expect(dragBox({ x: 50, y: 50 }, { x: 60, y: 70 }, false, true)).toEqual({
      x0: 40,
      y0: 30,
      x1: 60,
      y1: 70,
    });
  });
});

describe('presetOutline', () => {
  const box = { x0: 0, y0: 0, x1: 100, y1: 60 };
  it('has no outline for a free shape or a tiny box', () => {
    expect(presetOutline({ kind: 'free', sides: 6 }, box)).toBeNull();
    expect(presetOutline({ kind: 'rect', sides: 6 }, { x0: 0, y0: 0, x1: 3, y1: 90 })).toBeNull();
  });
  it('makes a rectangle from any corner order', () => {
    expect(presetOutline({ kind: 'rect', sides: 6 }, { x0: 100, y0: 60, x1: 0, y1: 0 })).toEqual([
      0, 0, 100, 0, 100, 60, 0, 60,
    ]);
  });
  it('makes a triangle with its apex at the top', () => {
    expect(presetOutline({ kind: 'triangle', sides: 6 }, box)).toEqual([50, 0, 100, 60, 0, 60]);
  });
  it('makes a regular polygon of any number of sides, a corner at the top', () => {
    const hex = presetOutline({ kind: 'ngon', sides: 6 }, { x0: 0, y0: 0, x1: 100, y1: 100 });
    expect(hex).toHaveLength(12);
    expect(hex?.[0]).toBeCloseTo(50);
    expect(hex?.[1]).toBeCloseTo(0);
    expect(presetOutline({ kind: 'ngon', sides: 5 }, box)).toHaveLength(10);
    expect(presetOutline({ kind: 'ngon', sides: 99 }, box)).toHaveLength(48);
  });
  it('makes a circle that fits its box', () => {
    const c = presetOutline({ kind: 'circle', sides: 6 }, box) ?? [];
    const xs = c.filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(100);
  });
  it('keeps the sides in range', () => {
    expect(clampSides(1)).toBe(3);
    expect(clampSides(500)).toBe(24);
  });
});
