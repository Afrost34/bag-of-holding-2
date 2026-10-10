import { describe, expect, it } from 'vitest';
import { frameCorners, frameRects, roseShape } from './decor';

describe('the compass rose', () => {
  it('has four long points and four short ones between, the first towards the north', () => {
    const { long, short } = roseShape('plain');
    expect(long).toHaveLength(4);
    expect(short).toHaveLength(4);
    const north = long[0]?.points ?? [];
    expect(north[0]).toBeCloseTo(0);
    expect(north[1]).toBeCloseTo(-1);
    // East is to the right.
    expect(long[1]?.points[0]).toBeCloseTo(1);
    // The short ones are shorter and point between.
    const ne = short[0]?.points ?? [];
    expect(Math.hypot(ne[0] ?? 0, ne[1] ?? 0)).toBeLessThan(1);
    expect(ne[0]).toBeGreaterThan(0);
    expect(ne[1]).toBeLessThan(0);
  });

  it('has broader points in the fantasy style', () => {
    const plain = roseShape('plain').long[0]?.points ?? [];
    const fantasy = roseShape('fantasy').long[0]?.points ?? [];
    expect(Math.abs(fantasy[2] ?? 0)).toBeGreaterThan(Math.abs(plain[2] ?? 0));
  });
});

describe('the frame', () => {
  it('is one line, or two for the fantasy style, inside the map', () => {
    expect(frameRects(2000, 1500, 'plain')).toHaveLength(1);
    const two = frameRects(2000, 1500, 'fantasy');
    expect(two).toHaveLength(2);
    expect(two[0]?.line).toBeGreaterThan(two[1]?.line ?? Infinity);
    for (const r of two) {
      expect(r.x + r.w).toBeLessThan(2000);
      expect(r.y + r.h).toBeLessThan(1500);
      expect(r.w).toBeGreaterThan(0);
    }
  });

  it('has four corners', () => {
    expect(frameCorners(2000, 1500)).toHaveLength(4);
  });
});
