import { describe, expect, it } from 'vitest';
import { addItem, newMap } from './model';
import { fuzzyIncludes, findPackEntries, packTags } from './packModel';
import { usedPackRefs } from './packUse';

describe('searching packs', () => {
  it('finds letters in order, close together, when fuzzy', () => {
    expect(fuzzyIncludes('forest/oak_tree_2x2.webp', 'forst')).toBe(true);
    expect(fuzzyIncludes('forest/oak_tree_2x2.webp', 'oakt')).toBe(true);
    expect(fuzzyIncludes('forest/oak_tree_2x2.webp', 'tre')).toBe(true);
    expect(fuzzyIncludes('forest/oak_tree_2x2.webp', 'zzz')).toBe(false);
    // Letters from far apart parts of the path are not one word.
    expect(fuzzyIncludes('forest/oak_tree_2x2.webp', 'fwebp')).toBe(false);
  });

  it('searches exactly or fuzzily, and can be limited to some pictures', () => {
    const entries = [
      { path: 'Forest/Oak_Tree_2x2.webp' },
      { path: 'Forest/Pine_1x1.webp' },
      { path: 'Desert/Cactus_1x1.webp' },
    ];
    expect(findPackEntries(entries, '', 'forst', 10).total).toBe(0);
    expect(findPackEntries(entries, '', 'forst', 10, { fuzzy: true }).total).toBe(2);
    const only = findPackEntries(entries, '', '', 10, { only: (e) => e.path.includes('Cactus') });
    expect(only.list.map((e) => e.path)).toEqual(['Desert/Cactus_1x1.webp']);
  });
});

describe('the pictures a map uses', () => {
  it('lists stamps, scatter pieces and textures of packs, and skips glyphs', () => {
    const blank = newMap('Use', [], '');
    const layer = blank.layers[0]?.id ?? '';
    let doc = addItem(blank, layer, {
      kind: 'stamp',
      id: 's1',
      stamp: 'pack:a:Forest/Oak_1x1.webp',
      x: 0,
      y: 0,
      w: 70,
      h: 70,
      rotation: 0,
    });
    doc = addItem(doc, layer, {
      kind: 'stamp',
      id: 's2',
      stamp: 'glyph:tree',
      x: 0,
      y: 0,
      w: 70,
      h: 70,
      rotation: 0,
    });
    doc = addItem(doc, layer, {
      kind: 'stroke',
      id: 'k1',
      points: [0, 0, 10, 10],
      color: '#000000',
      width: 20,
      brush: 'terrain',
      opacity: 1,
      texture: 'pack:b:Textures/Sand.webp',
    });
    expect([...usedPackRefs(doc)].sort()).toEqual([
      'pack:a:Forest/Oak_1x1.webp',
      'pack:b:Textures/Sand.webp',
    ]);
  });
});

describe('tags from folders', () => {
  const entries = [
    { path: 'Forest/Trees/Oak_1x1.webp' },
    { path: 'Forest/Trees/Pine_1x1.webp' },
    { path: 'Forest/Rocks/Moss_1x1.webp' },
    { path: 'Desert/Town/Well_2x2.webp' },
    { path: 'Desert/Town/Cart_3x1.webp' },
    { path: 'Desert/Single/Lone_1x1.webp' },
  ];

  it('are the folder names, most used first, without those of one picture', () => {
    expect(packTags(entries)).toEqual([
      { tag: 'desert', count: 3 },
      { tag: 'forest', count: 3 },
      { tag: 'town', count: 2 },
      { tag: 'trees', count: 2 },
    ]);
  });

  it('find the pictures in a folder of that name, at any depth', () => {
    expect(findPackEntries(entries, '', '', 10, { tag: 'trees' }).total).toBe(2);
    expect(findPackEntries(entries, '', 'well', 10, { tag: 'town' }).total).toBe(1);
    expect(findPackEntries(entries, '', '', 10, { tag: 'desert' }).total).toBe(3);
  });
});
