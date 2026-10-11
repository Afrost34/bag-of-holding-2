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
    expect(isWallStrip('A/Shack_Wall_Wood_Ashen_A1_Path.webp')).toBe(true);
    expect(isWallStrip('pack:x:A/Fence_Wood_Ashen_A_Path.webp')).toBe(true);
    expect(isWallStrip('A/Cobblestone_A_01.jpg')).toBe(false);
  });
});

describe('strips at a corner with a piece', () => {
  it('stop at the vertex instead of reaching past it', () => {
    const open = stripSegments([0, 0, 100, 0, 100, 100], false, 20);
    expect(open[0]?.length).toBe(120);
    const trimmed = stripSegments([0, 0, 100, 0, 100, 100], false, 20, new Map([[1, 0]]));
    expect(trimmed[0]?.length).toBe(110);
    expect(trimmed[1]?.x).toBe(100);
    expect(trimmed[1]?.y).toBe(0);
  });
});
