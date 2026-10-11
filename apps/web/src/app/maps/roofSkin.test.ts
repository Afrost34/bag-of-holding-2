import { describe, expect, it } from 'vitest';
import { opaqueShare } from './roofSkin';

describe('the hem of a roof texture', () => {
  it('finds how much of the picture is not empty at the bottom', () => {
    // 100 rows: the last 8 are transparent.
    expect(opaqueShare((row) => (row < 92 ? 1 : 0), 100)).toBeCloseTo(0.92);
  });
  it('keeps a texture that fills its whole picture', () => {
    expect(opaqueShare(() => 1, 100)).toBe(1);
  });
  it('keeps something of a picture that is empty', () => {
    expect(opaqueShare(() => 0, 100)).toBe(0.01);
  });
});
