import { describe, expect, it } from 'vitest';
import { addItem, newMap, updateItem, type MapDoc } from './model';
import {
  bakeScatter,
  makeScatter,
  obstacleSignature,
  SCATTER_PRESETS,
  scatterOf,
  settingsFromPreset,
  type ScatterItem,
} from './scatterDoc';

const forest = SCATTER_PRESETS.find((p) => p.id === 'forest');
const roadside = SCATTER_PRESETS.find((p) => p.id === 'roadside');
if (!forest || !roadside) throw new Error('presets');

const square = (x: number, y: number, size: number) => [
  x,
  y,
  x + size,
  y,
  x + size,
  y + size,
  x,
  y + size,
];

/** Beside the road's length (a rounded outline can swing past its ends). */
const onRoad = (p: { x: number; y: number }, y: number) =>
  p.x > 0 && p.x < 800 && Math.abs(p.y - y) < 30;

function base(): { doc: MapDoc; layer: string } {
  const doc = newMap('Wood', [], 'now');
  return { doc, layer: doc.layers[0]?.id ?? '' };
}

describe('scatter in a map', () => {
  it('stays off the water, but goes on land drawn over it', () => {
    const start = base();
    const { layer } = start;
    let doc = start.doc;
    // The sea over the whole map, then an island on top of it.
    doc = addItem(doc, layer, {
      kind: 'shape',
      id: 'sea',
      points: square(0, 0, 1000),
      smooth: 0,
      texture: 'water',
      color: '#3d7fb0',
      opacity: 1,
      edge: 'none',
    });
    doc = addItem(doc, layer, {
      kind: 'shape',
      id: 'isle',
      points: square(200, 200, 300),
      smooth: 0,
      texture: 'grass',
      color: '#5b8a2b',
      opacity: 1,
      edge: 'none',
    });
    const wood = makeScatter('w', settingsFromPreset(forest), { points: square(100, 100, 700) }, 7);
    doc = addItem(doc, layer, wood);
    const list = scatterOf(doc, wood);
    expect(list.length).toBeGreaterThan(10);
    expect(list.every((p) => p.x > 200 && p.x < 500 && p.y > 200 && p.y < 500)).toBe(true);
  });

  it('keeps clear of a road, and follows it when moved', () => {
    const start = base();
    const { layer } = start;
    let doc = start.doc;
    const wood = makeScatter('w', settingsFromPreset(forest), { points: square(0, 0, 800) }, 3);
    doc = addItem(doc, layer, wood);
    doc = addItem(doc, layer, {
      kind: 'path',
      id: 'road',
      points: [0, 400, 800, 400],
      smooth: 0,
      style: 'road',
      width: 60,
      color: '#d9c79e',
    });
    const list = scatterOf(doc, wood);
    expect(list.some((p) => onRoad(p, 400))).toBe(false);
    // Move the road: the gap moves with it.
    const moved = updateItem(doc, 'road', (i) =>
      i.kind === 'path' ? { ...i, points: [0, 150, 800, 150] } : i,
    );
    const after = scatterOf(moved, wood);
    expect(after.some((p) => onRoad(p, 150))).toBe(false);
    expect(after.some((p) => onRoad(p, 400))).toBe(true);
    expect(obstacleSignature(moved)).not.toBe(obstacleSignature(doc));
  });

  it('can avoid nothing', () => {
    const start = base();
    const { layer } = start;
    let doc = start.doc;
    const wood: ScatterItem = {
      ...makeScatter('w', settingsFromPreset(forest), { points: square(0, 0, 800) }, 3),
      avoid: 'none',
    };
    doc = addItem(doc, layer, wood);
    doc = addItem(doc, layer, {
      kind: 'path',
      id: 'road',
      points: [0, 400, 800, 400],
      smooth: 0,
      style: 'road',
      width: 60,
      color: '#d9c79e',
    });
    expect(scatterOf(doc, wood).some((p) => onRoad(p, 400))).toBe(true);
  });

  it('is tied to a shape: reshaping the shape reshapes the scatter', () => {
    const start = base();
    const { layer } = start;
    let doc = start.doc;
    doc = addItem(doc, layer, {
      kind: 'shape',
      id: 'clearing',
      points: square(100, 100, 300),
      smooth: 0,
      texture: 'grass',
      color: '#5b8a2b',
      opacity: 1,
      edge: 'none',
    });
    const wood = makeScatter(
      'w',
      settingsFromPreset(forest),
      { points: [], within: 'clearing' },
      5,
    );
    doc = addItem(doc, layer, wood);
    expect(scatterOf(doc, wood).every((p) => p.x > 100 && p.x < 400)).toBe(true);
    const moved = updateItem(doc, 'clearing', (i) =>
      i.kind === 'shape' ? { ...i, points: square(600, 600, 300) } : i,
    );
    expect(scatterOf(moved, wood).every((p) => p.x > 600 && p.y > 600)).toBe(true);
  });

  it('runs along a path on both sides, and becomes stamps when baked', () => {
    const start = base();
    const { layer } = start;
    let doc = start.doc;
    doc = addItem(doc, layer, {
      kind: 'path',
      id: 'road',
      points: [0, 300, 900, 300],
      smooth: 0,
      style: 'road',
      width: 24,
      color: '#d9c79e',
    });
    const trees = makeScatter('t', settingsFromPreset(roadside), { points: [], follow: 'road' }, 9);
    doc = addItem(doc, layer, trees);
    const list = scatterOf(doc, trees);
    expect(list.some((p) => p.y > 320)).toBe(true);
    expect(list.some((p) => p.y < 280)).toBe(true);
    const baked = bakeScatter(doc, 't');
    const items = baked.layers.flatMap((l) => l.items);
    expect(items.some((i) => i.kind === 'scatter')).toBe(false);
    const stamps = items.filter((i) => i.kind === 'stamp');
    expect(stamps).toHaveLength(list.length);
    expect(stamps.every((s) => s.stamp.startsWith('glyph:'))).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('is scaled by the settings, for a small map or a big one', () => {
    const small = makeScatter('a', settingsFromPreset(forest, 0.5), { points: [] }, 1);
    const big = makeScatter('b', settingsFromPreset(forest, 2), { points: [] }, 1);
    expect(big.spacing).toBe(small.spacing * 4);
    expect(big.sizeMax).toBe(small.sizeMax * 4);
  });
});
