import { describe, expect, it } from 'vitest';
import { searchMap } from './mapSearch';
import { addItem, addPictureLayer, newMap, relocateMap, type MapDoc } from './model';

function doc(): MapDoc {
  let d = newMap('Search', [], 'now');
  const layer = d.layers[0]?.id ?? '';
  d = {
    ...d,
    pinCategories: [{ id: 'c1', name: 'Taverns', icon: 'beer', color: '#c2410c' }],
  };
  d = addItem(d, layer, {
    kind: 'pin',
    id: 'p1',
    x: 10,
    y: 20,
    label: 'Gull’s Rest',
    category: 'c1',
  });
  d = addItem(d, layer, { kind: 'pin', id: 'p2', x: 30, y: 40, label: 'Waterdeep' });
  d = addItem(d, layer, {
    kind: 'text',
    id: 't1',
    x: 100,
    y: 100,
    text: 'The Whispering Woods',
    size: 40,
    color: '#111',
  });
  d = addItem(d, layer, {
    kind: 'path',
    id: 'r',
    points: [0, 0, 400, 0],
    smooth: 0,
    style: 'river',
    width: 40,
    color: '#3d7fb0',
  });
  d = addItem(d, layer, {
    kind: 'text',
    id: 't2',
    x: 0,
    y: 0,
    text: 'Silverrun',
    size: 40,
    color: '#111',
    follow: 'r',
    along: 0.5,
  });
  return d;
}

describe('finding things on a map', () => {
  it('finds pins and text by the words in their names, pins first', () => {
    expect(searchMap(doc(), 'water').map((h) => h.label)).toEqual(['Waterdeep']);
    expect(searchMap(doc(), 'whisper wood').map((h) => h.id)).toEqual(['t1']);
    expect(searchMap(doc(), 'e').map((h) => h.kind)).toEqual(['pin', 'pin', 'text', 'text']);
    expect(searchMap(doc(), '   ')).toEqual([]);
    expect(searchMap(doc(), 'zzz')).toEqual([]);
  });

  it('finds a pin by its category, and says where a label along a river is', () => {
    expect(searchMap(doc(), 'tavern').map((h) => h.id)).toEqual(['p1']);
    expect(searchMap(doc(), 'tavern')[0]?.category).toBe('Taverns');
    expect(searchMap(doc(), 'silver')[0]?.at).toEqual({ x: 200, y: 0 });
  });

  it('keeps to a limit', () => {
    expect(searchMap(doc(), 'e', 2)).toHaveLength(2);
  });
});

describe('moving a map', () => {
  it('gives its pictures and flat pictures paths in the new place, and lists what to copy', () => {
    let d: MapDoc = { ...newMap('Moving', ['x'], 'now'), campaign: 'old' };
    d = addPictureLayer(d, 'Day', {
      path: 'campaigns/old/maps/assets/day.webp',
      width: 10,
      height: 10,
    });
    d = {
      ...d,
      render: {
        hash: 'h',
        width: 10,
        height: 10,
        images: { '-': 'campaigns/old/maps/assets/render-x--.webp' },
      },
    };
    const taken = new Set(['campaigns/new/maps/assets/day.webp']);
    const { doc: moved, copies } = relocateMap(d, 'new', (p) => taken.has(p));
    expect(moved.campaign).toBe('new');
    expect(moved.layers.find((l) => l.picture)?.picture?.path).toBe(
      'campaigns/new/maps/assets/day 1.webp',
    );
    expect(moved.render?.images['-']).toBe(`campaigns/new/maps/assets/render-${d.id}--.webp`);
    expect(copies.map((c) => c[0])).toContain('campaigns/old/maps/assets/day.webp');
    expect(copies.at(-1)).toEqual([
      `campaigns/old/maps/thumbs/${d.id}.webp`,
      `campaigns/new/maps/thumbs/${d.id}.webp`,
    ]);
    // To the library: no campaign.
    const home = relocateMap(d, undefined, () => false).doc;
    expect(home.campaign).toBeUndefined();
    expect(home.layers.find((l) => l.picture)?.picture?.path).toBe('maps/assets/day.webp');
  });
});
