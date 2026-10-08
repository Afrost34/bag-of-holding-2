import { describe, expect, it } from 'vitest';
import { pageRows } from './printText';

describe('pageRows', () => {
  it('fills the first page, then the next ones', () => {
    expect(pageRows([1, 2, 3, 4, 5, 6], 2, 3)).toEqual([[1, 2], [3, 4, 5], [6]]);
    expect(pageRows([], 2, 3)).toEqual([[]]);
    expect(pageRows([1, 2], 2, 3)).toEqual([[1, 2]]);
  });
});
