import { describe, expect, it } from 'vitest';
import { basename, dirname, InvalidPathError, joinPath, normalizePath, segments } from './path';

describe('normalizePath', () => {
  it.each([
    ['', ''],
    ['/', ''],
    ['a/b', 'a/b'],
    ['/a/b/', 'a/b'],
    ['a//b/./c', 'a/b/c'],
    ['a\\b\\c', 'a/b/c'],
  ])('%j -> %j', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });

  it('rejects parent segments', () => {
    expect(() => normalizePath('a/../b')).toThrow(InvalidPathError);
    expect(() => normalizePath('..')).toThrow(InvalidPathError);
  });
});

describe('path helpers', () => {
  it('joins, splits and names paths', () => {
    expect(joinPath('campaigns', '/rust/', 'vault')).toBe('campaigns/rust/vault');
    expect(dirname('a/b/c.md')).toBe('a/b');
    expect(dirname('c.md')).toBe('');
    expect(basename('a/b/c.md')).toBe('c.md');
    expect(segments('')).toEqual([]);
    expect(segments('a/b')).toEqual(['a', 'b']);
  });
});
