import { describe, expect, it } from 'vitest';
import { findIcons, iconSvg, parseIconSet } from './onlineStamps';

const set = parseIconSet({
  prefix: 'game-icons',
  icons: {
    'castle-ruins': { body: '<path fill="currentColor" d="M0 0h1"/>' },
    castle: { body: '<path fill="currentColor" d="M1 1h1"/>' },
    'oak-tree': { body: '<path d="M2 2h1"/>' },
    broken: { nobody: true },
  },
  aliases: { fort: { parent: 'castle' } },
  width: 512,
  height: 512,
});

describe('online stamp packs', () => {
  it('reads an Iconify set, leaving out what is not an icon', () => {
    expect(Object.keys(set.icons)).toEqual(['castle-ruins', 'castle', 'oak-tree']);
  });

  it('finds icons by every word, closest first', () => {
    expect(findIcons(set, 'castle')).toEqual(['castle', 'castle-ruins']);
    expect(findIcons(set, 'ruins castle')).toEqual(['castle-ruins']);
    expect(findIcons(set, '')).toHaveLength(3);
  });

  it('makes a coloured SVG, with an outline when asked', () => {
    const plain = iconSvg(set, 'castle', '#222222');
    expect(plain).toContain('viewBox="0 0 512 512"');
    expect(plain).toContain('color="#222222"');
    expect(iconSvg(set, 'castle', '#222222', '#ffffff')).toContain('stroke="#ffffff"');
  });
});
