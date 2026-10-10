import { describe, expect, it } from 'vitest';
import { isWallStrip, stripSegments } from './wallStrip';

describe('wall strips', () => {
  it('lays one strip per segment, stretched at both ends', () => {
    const [a, b] = stripSegments([0, 0, 100, 0, 100, 100], false, 20);
    expect(a).toMatchObject({ x: -10, y: 0, angle: 0, length: 120 });
    expect(b?.length).toBe(120);
    expect(b?.angle).toBeCloseTo(Math.PI / 2);
    expect(b?.y).toBeCloseTo(-10);
  });

  it('closes a loop with a last strip back to the start, and skips empty segments', () => {
    expect(stripSegments([0, 0, 100, 0, 100, 100], true, 0)).toHaveLength(3);
    expect(stripSegments([0, 0, 0, 0, 50, 0], false, 0)).toHaveLength(1);
    expect(stripSegments([5, 5], false, 10)).toEqual([]);
  });

  it('recognises the strip pictures of a pack', () => {
    expect(isWallStrip('A/Wall_Stone_Earthy_B1_Straight_Path.webp')).toBe(true);
    expect(isWallStrip('A/Wall_Stone_Earthy_B1_Straight_A_3x1.webp')).toBe(false);
  });
});
