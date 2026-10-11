import { describe, expect, it } from 'vitest';
import { edgeLayers, featherOf } from './softEdge';

/** The opacity at a distance `d` from the stroke's edge: what the copies add up to. */
function opacityAt(layers: ReturnType<typeof edgeLayers>, width: number, d: number): number {
  let seen = 1;
  for (const l of layers)
    if (width - 2 * d <= l.width + 1e-9 && d >= (width - l.width) / 2) seen *= 1 - l.alpha;
  return 1 - seen;
}

describe('soft edges', () => {
  it('leave a stroke without softness as one plain line', () => {
    expect(edgeLayers(100, 0)).toEqual([{ width: 100, alpha: 1 }]);
  });

  it('never reach further in than half the stroke', () => {
    expect(featherOf(100, 1)).toBeLessThan(50);
    expect(featherOf(100, 0.4)).toBe(20);
  });

  it('make narrower and more opaque copies, the last one fully opaque', () => {
    const layers = edgeLayers(100, 0.6);
    expect(layers.length).toBeGreaterThan(4);
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i]?.width).toBeLessThan(layers[i - 1]?.width ?? 0);
    }
    expect(layers[layers.length - 1]?.alpha).toBe(1);
    expect(layers[0]?.width).toBe(100);
  });

  it('rise smoothly from clear at the edge to opaque inside', () => {
    const layers = edgeLayers(100, 0.6);
    const feather = featherOf(100, 0.6);
    expect(opacityAt(layers, 100, 0)).toBeLessThan(0.1);
    expect(opacityAt(layers, 100, feather * 0.5)).toBeGreaterThan(0.3);
    expect(opacityAt(layers, 100, feather * 0.5)).toBeLessThan(0.7);
    expect(opacityAt(layers, 100, feather + 1)).toBeCloseTo(1);
  });
});
