import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from './__fixtures__/faNames';
import { addItem, newMap, type MapItem } from './model';
import { folderIndex, shapeVariants } from './packNames';
import { packRef, parsePackRef } from './packModel';
import {
  legacyPrefabs,
  makePrefab,
  parsePrefab,
  placePrefab,
  prefabPath,
  serializePrefab,
} from './prefabs';

const stamp = (id: string, x: number, y: number, ref = 'pack:p:A/B_1x1.webp'): MapItem => ({
  kind: 'stamp',
  id,
  stamp: ref,
  x,
  y,
  w: 40,
  h: 40,
  rotation: 0,
});

const OPTIONS = { id: 'abc123', now: '2026-10-11T00:00:00.000Z' };

function twoStamps(ref?: string) {
  const blank = newMap('P', [], '');
  const layer = blank.layers[0]?.id ?? '';
  const doc = addItem(
    addItem(blank, layer, stamp('a', 100, 100, ref)),
    layer,
    stamp('b', 200, 100, ref),
  );
  return { doc, layer };
}

describe('prefabs', () => {
  it('keep positions around the middle and place again anywhere, with new ids', () => {
    const { doc, layer } = twoStamps();
    const prefab = makePrefab(doc, ['a', 'b'], ' Table and chair ', OPTIONS);
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
    expect(makePrefab(doc, ['zzz'], 'x', OPTIONS)).toBeNull();
  });

  it('that vary come down as other shapes of their pictures, in the same places', () => {
    // A real FA picture with sibling shapes.
    const entry = FA_ENTRIES.find(
      (e) => shapeVariants(folderIndex(FA_ENTRIES), e.pack, e.path).length > 1,
    );
    if (!entry) throw new Error('no picture with shapes in the fixture');
    const ref = packRef(entry.pack, entry.path);
    const { doc, layer } = twoStamps(ref);
    const prefab = makePrefab(doc, ['a', 'b'], 'Crates', { ...OPTIONS, vary: true });
    if (!prefab) throw new Error('no prefab');
    const index = folderIndex(FA_ENTRIES);
    const shapes = shapeVariants(index, entry.pack, entry.path);
    // Numbers that pick the last shape every time.
    const placed = placePrefab(doc, layer, prefab, { x: 0, y: 0 }, { index, rand: () => 0.999 });
    const stamps = (placed.doc.layers[0]?.items ?? []).filter(
      (i): i is Extract<MapItem, { kind: 'stamp' }> =>
        i.kind === 'stamp' && placed.ids.includes(i.id),
    );
    expect(stamps.map((s) => parsePackRef(s.stamp)?.path)).toEqual([shapes.at(-1), shapes.at(-1)]);
    expect(stamps.map((s) => [s.x, s.rotation, s.flipX])).toEqual([
      [-50, 0, undefined],
      [50, 0, undefined],
    ]);
    // A prefab that does not vary is placed as saved.
    const plain = placePrefab(
      doc,
      layer,
      { ...prefab, vary: false },
      { x: 0, y: 0 },
      {
        index,
        rand: () => 0.999,
      },
    );
    const kept = (plain.doc.layers[0]?.items ?? []).find((i) => i.id === plain.ids[0]);
    expect(kept?.kind === 'stamp' ? kept.stamp : '').toBe(ref);
  });

  it('are files of the data repo, read back as written', () => {
    const { doc } = twoStamps();
    const prefab = makePrefab(doc, ['a', 'b'], 'Pair', { ...OPTIONS, vary: true });
    if (!prefab) throw new Error('no prefab');
    expect(prefabPath(prefab.id)).toBe('map-prefabs/abc123.json');
    expect(prefabPath(prefab.id, 'c1')).toBe('campaigns/c1/map-prefabs/abc123.json');
    const text = serializePrefab(prefab);
    expect(text).not.toContain('abc123');
    expect(parsePrefab(text, 'abc123')).toEqual(prefab);
    expect(parsePrefab('not json', 'x')).toBeNull();
    expect(parsePrefab('{"name":"x"}', 'x')).toBeNull();
    expect(
      parsePrefab('{"items":[{"kind":"stamp","id":"a"},{"nope":1}]}', 'x')?.items,
    ).toHaveLength(1);
  });

  it('kept on a device before move into files, once', () => {
    const old = JSON.stringify({
      state: {
        prefabs: [
          { id: 'old1', name: 'Bar', items: [stamp('a', 0, 0)] },
          { id: 'taken', name: 'Again', items: [] },
          { id: '../bad', name: 'Bad', items: [] },
        ],
      },
      version: 1,
    });
    const moved = legacyPrefabs(old, ['taken'], OPTIONS.now);
    expect(moved.map((p) => [p.id, p.name, p.updatedAt])).toEqual([['old1', 'Bar', OPTIONS.now]]);
    expect(legacyPrefabs(null, [], OPTIONS.now)).toEqual([]);
    expect(legacyPrefabs('{}', [], OPTIONS.now)).toEqual([]);
  });
});
