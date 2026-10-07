import { describe, expect, it } from 'vitest';
import { imageSrcSet, originalImageUrl, resizedImageUrl } from './images';

describe('image urls', () => {
  it('encodes paths with spaces and brackets', () => {
    expect(originalImageUrl('races/LFL/Elf (Lorwyn).webp')).toBe(
      'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/races/LFL/Elf%20(Lorwyn).webp',
    );
  });

  it('asks the resizer for a WebP no wider than needed, never enlarged', () => {
    const url = new URL(resizedImageUrl('races/XPHB/Elf.webp', 480));
    expect(url.origin).toBe('https://wsrv.nl');
    expect(url.searchParams.get('url')).toBe(originalImageUrl('races/XPHB/Elf.webp'));
    expect(url.searchParams.get('w')).toBe('480');
    expect(url.searchParams.get('output')).toBe('webp');
    expect(url.searchParams.has('we')).toBe(true);
  });

  it('builds a srcset', () => {
    expect(
      imageSrcSet('a.webp', [320, 640])
        .split(', ')
        .map((s) => s.split(' ')[1]),
    ).toEqual(['320w', '640w']);
  });
});
