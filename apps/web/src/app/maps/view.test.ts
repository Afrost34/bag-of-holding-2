import { describe, expect, it } from 'vitest';
import { resizedView, type ViewBase } from './view';

describe('a map view following its host', () => {
  const base: ViewBase = { w: 400, h: 300, zoom: 0.5, middle: { x: 1000, y: 800 } };

  it('keeps the middle and zooms with the host', () => {
    const v = resizedView(base, { w: 800, h: 600 });
    expect(v.zoom).toBe(1);
    expect(v).toEqual({ x: 400 - 1000, y: 300 - 800, zoom: 1 });
  });

  it('comes back to the same view when the host shrinks and grows back', () => {
    // A card a few pixels shorter while it is dragged, then its own size again.
    resizedView(base, { w: 400, h: 290 });
    expect(resizedView(base, { w: 400, h: 300 })).toEqual(resizedView(base, base));
    expect(resizedView(base, base).zoom).toBe(0.5);
  });

  it('fits the narrower side when the host changes shape', () => {
    expect(resizedView(base, { w: 1600, h: 300 }).zoom).toBe(0.5);
    expect(resizedView(base, { w: 200, h: 3000 }).zoom).toBe(0.25);
  });
});
