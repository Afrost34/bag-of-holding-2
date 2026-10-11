import { describe, expect, it } from 'vitest';
import { addItem, newMap, type MapItem } from './model';
import { makePrefab, placePrefab } from './prefabs';

const stamp = (id: string, x: number, y: number): MapItem => ({
  kind: 'stamp',
  id,
  stamp: 'pack:p:A/B_1x1.webp',
  x,
  y,
  w: 40,
  h: 40,
  rotation: 0,
});

describe('prefabs', () => {
  it('keep positions around the middle and place again anywhere, with new ids', () => {
    const blank = newMap('P', [], '');
    const layer = blank.layers[0]?.id ?? '';
    const doc = addItem(addItem(blank, layer, stamp('a', 100, 100)), layer, stamp('b', 200, 100));
    const prefab = makePrefab(doc, ['a', 'b'], ' Table and chair ');
    expect(prefab?.name).toBe('Table and chair');
    expect(prefab?.items.map((i) => (i.kind === 'stamp' ? i.x : 0))).toEqual([-50, 50]);
    if (!prefab) throw new Error('no prefab');
    const placed = placePrefab(doc, layer, prefab, { x: 1000, y: 500 });
    expect(placed.ids).toHaveLength(2);
    const items = placed.doc.layers[0]?.items ?? [];
    expect(items).toHaveLength(4);
    expect(new Set(items.map((i) => i.id)).size).toBe(4);
    const xs = items
      .filter((i) => placed.ids.includes(i.id))
      .map((i) => (i.kind === 'stamp' ? i.x : 0));
    expect(xs).toEqual([950, 1050]);
    expect(makePrefab(doc, ['zzz'], 'x')).toBeNull();
  });
});
