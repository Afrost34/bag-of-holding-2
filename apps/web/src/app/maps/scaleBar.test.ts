import { describe, expect, it } from 'vitest';
import { newMap } from './model';
import { roundDistance, scaleBarLabel, scaleBarSpec } from './scaleBar';

describe('scale bar', () => {
  it('picks a round distance', () => {
    expect(roundDistance(7.3)).toBe(5);
    expect(roundDistance(380)).toBe(200);
    expect(roundDistance(0.35)).toBe(0.2);
    expect(roundDistance(1000)).toBe(1000);
  });

  it('measures a world map in its unit', () => {
    const doc = { ...newMap('W', [], '', 'world'), scale: { unit: 'mi' as const, perPixel: 0.5 } };
    // 2800 px wide: about 0.3 of it is 840 px = 420 miles → 200 miles, 400 px, four blocks.
    const spec = scaleBarSpec(doc);
    expect(spec).toEqual({ length: 400, distance: 200, unit: 'mi', segments: 4 });
    expect(spec && scaleBarLabel(spec)).toBe('200 miles');
  });

  it('measures a battle map by its grid', () => {
    const doc = newMap('B', [], '');
    const spec = scaleBarSpec(doc);
    expect(spec?.unit).toBe('ft');
    expect(spec && spec.length / doc.grid.size).toBe((spec?.distance ?? 0) / doc.grid.feet);
    expect(spec && scaleBarLabel(spec)).toMatch(/^\d+ ft$/);
  });
});
