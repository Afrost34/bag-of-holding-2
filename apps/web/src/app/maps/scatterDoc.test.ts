import { describe, expect, it } from 'vitest';
import { recipeById } from './dress/recipes';
import { settingsFor } from './dress/settings';
import { addItem, newMap, updateItem, type MapDoc } from './model';
import {
  bakeScatter,
  makeScatter,
  mixSettings,
  pieceBox,
  obstacleSignature,
  scatterOf,
  singlePiece,
  type DressSettings,
  type ScatterItem,
} from './scatterDoc';

/** A recipe with its drawn glyphs, sized for a grid of 70 (times `scale`). */
function drawn(id: string, scale = 1): DressSettings {
  const recipe = recipeById(id);
  if (!recipe) throw new Error(`recipe ${id}`);
  return settingsFor(recipe, [], { unit: 70, drawn: true }, { scale });
}

const forest = drawn('forest');

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

describe('dressing a map', () => {
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
    const wood = makeScatter('w', forest, { points: square(100, 100, 700) }, 7);
    doc = addItem(doc, layer, wood);
    const list = scatterOf(doc, wood);
    expect(list.length).toBeGreaterThan(10);
    expect(list.every((p) => p.x > 200 && p.x < 500 && p.y > 200 && p.y < 500)).toBe(true);
  });

  it('keeps out of the holes of a shape it fills', () => {
    const start = base();
    const { layer } = start;
    let doc = start.doc;
    doc = addItem(doc, layer, {
      kind: 'shape',
      id: 'land',
      points: square(0, 0, 800),
      smooth: 0,
      texture: 'grass',
      color: '#5b8a2b',
      opacity: 1,
      edge: 'none',
      holes: [square(300, 300, 200)],
    });
    const wood = makeScatter('w', forest, { points: [], within: 'land' }, 5);
    doc = addItem(doc, layer, wood);
    const list = scatterOf(doc, wood);
    expect(list.length).toBeGreaterThan(10);
    expect(list.some((p) => p.x > 300 && p.x < 500 && p.y > 300 && p.y < 500)).toBe(false);
    expect(list.some((p) => p.x < 300)).toBe(true);
  });

  it('keeps clear of a road, and follows it when moved', () => {
    const start = base();
    const { layer } = start;
    let doc = start.doc;
    const wood = makeScatter('w', forest, { points: square(0, 0, 800) }, 3);
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

  it('can avoid nothing, or stand on roads while keeping off water', () => {
    const start = base();
    const { layer } = start;
    let doc = start.doc;
    const wood: ScatterItem = {
      ...makeScatter('w', forest, { points: square(0, 0, 800) }, 3),
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
    const overRoads: ScatterItem = { ...wood, avoid: 'auto', overPaths: true };
    expect(scatterOf(doc, overRoads).some((p) => onRoad(p, 400))).toBe(true);
  });

  it('is tied to a shape: reshaping the shape reshapes the dressing', () => {
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
    const wood = makeScatter('w', forest, { points: [], within: 'clearing' }, 5);
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
    const trees = makeScatter('t', drawn('roadside'), { points: [], follow: 'road' }, 9);
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
    const small = makeScatter('a', drawn('forest', 0.5), { points: [] }, 1);
    const big = makeScatter('b', drawn('forest', 2), { points: [] }, 1);
    expect(big.rules[0]?.spacing).toBe((small.rules[0]?.spacing ?? 0) * 4);
    expect(big.rules[0]?.sizeMax).toBe((small.rules[0]?.sizeMax ?? 0) * 4);
  });

  it('remembers the recipe it came from', () => {
    expect(makeScatter('a', forest, { points: [] }, 1).recipe).toBe('forest');
    expect(makeScatter('a', { ...forest, recipe: 'custom' }, { points: [] }, 1).recipe).toBe(
      undefined,
    );
  });
});

describe('furnishing a room', () => {
  it('lays furniture inside the floor of a room, square on, and follows the room', () => {
    const start = newMap('Inn', [], 'now');
    const layer = start.layers[0]?.id ?? '';
    let doc = addItem(start, layer, {
      kind: 'room',
      id: 'room',
      points: square(100, 100, 400),
      smooth: 0,
      floor: 'wood',
      wall: 12,
      wallStyle: 'stone',
    });
    const furniture = makeScatter('f', drawn('tavern'), { points: [], within: 'room' }, 3);
    doc = addItem(doc, layer, furniture);
    const list = scatterOf(doc, furniture);
    expect(list.length).toBeGreaterThan(3);
    // Inside the room, inside its walls.
    expect(list.every((p) => p.x > 106 && p.x < 494 && p.y > 106 && p.y < 494)).toBe(true);
    // The tables (the first rule) are square on: turned by quarters only.
    const quarter = Math.PI / 2;
    expect(
      list
        .filter((p) => p.rule === 0)
        .every((p) => Math.abs(Math.round(p.angle / quarter) * quarter - p.angle) < 1e-9),
    ).toBe(true);
    // Move the room: the furniture goes with it, and the map says so.
    const moved = updateItem(doc, 'room', (i) =>
      i.kind === 'room' ? { ...i, points: square(700, 700, 400) } : i,
    );
    expect(scatterOf(moved, furniture).every((p) => p.x > 700 && p.y > 700)).toBe(true);
    expect(obstacleSignature(moved)).not.toBe(obstacleSignature(doc));
  });
});

describe('dressing with pack pictures', () => {
  const refs = [
    'pack:p1:Forest/Oak_A1_2x2.webp',
    'pack:p1:Forest/Bush_B1_1x1.webp',
    'pack:p1:Forest/Pine_C1_3x3.webp',
  ];
  const square900 = [0, 0, 900, 0, 900, 900, 0, 900];

  it('takes its spacing from the pictures and gives each its own proportions', () => {
    const mix = mixSettings(refs, drawn('tavern'), 70);
    const rule = mix.rules[0];
    if (!rule) throw new Error('rule');
    expect(rule.pieces.map((p) => p.ref)).toEqual(refs);
    // The middle of the widths is 2 squares: 2 x 70 x 1.1.
    expect(rule.spacing).toBe(154);
    expect(rule.rotation).toBe('random');
    const start = newMap('Wood', [], 'now');
    const layer = start.layers[0]?.id ?? '';
    const item = makeScatter('w', mix, { points: square900 }, 2);
    const doc = addItem(start, layer, item);
    const made = item.rules[0];
    if (!made) throw new Error('rule');
    const inst = { x: 0, y: 0, angle: 0, size: 100, piece: 0 };
    // An oak of 2 x 2 squares at the middle of the size range: 140 wide, square.
    expect(pieceBox(doc, made, inst)).toEqual({ w: 140, h: 140, base: false });
    expect(pieceBox(doc, made, { ...inst, piece: 1 }).w).toBe(70);
    expect(pieceBox(doc, made, { ...inst, piece: 2 }).w).toBe(210);
    // The size range varies it: 120 is 1.2 times the natural size.
    expect(pieceBox(doc, made, { ...inst, size: 120 }).w).toBe(168);
    // A piece's own size multiplies it.
    const bigOak = {
      ...made,
      pieces: made.pieces.map((p, i) => (i === 0 ? { ...p, scale: 2 } : p)),
    };
    expect(pieceBox(doc, bigOak, inst).w).toBe(280);
    // A glyph is as wide as asked, standing on its base.
    const glyph = makeScatter('g', drawn('tavern'), { points: [] }, 1).rules[0];
    if (!glyph) throw new Error('rule');
    expect(pieceBox(doc, glyph, { ...inst, size: 50 }).base).toBe(true);
  });

  it('bakes into stamps of the pictures own sizes', () => {
    const mix = mixSettings(refs.slice(0, 1), drawn('tavern'), 70);
    const start = newMap('Wood', [], 'now');
    const layer = start.layers[0]?.id ?? '';
    const doc = addItem(start, layer, makeScatter('w', mix, { points: square900 }, 2));
    const stamps = bakeScatter(doc, 'w')
      .layers.flatMap((l) => l.items)
      .filter((i) => i.kind === 'stamp');
    expect(stamps.length).toBeGreaterThan(4);
    // 2 x 2 squares on a grid of 70, within the 0.8 to 1.2 variation.
    expect(stamps.every((s) => s.w >= 110 && s.w <= 170 && s.w === s.h)).toBe(true);
  });

  it('bakes mirrored and tinted pieces as they are drawn', () => {
    const mix = mixSettings(refs.slice(0, 1), drawn('tavern'), 70);
    const rule = mix.rules[0];
    if (!rule) throw new Error('rule');
    const settings = { ...mix, rules: [{ ...rule, flip: true, tint: 1 }] };
    const start = newMap('Wood', [], 'now');
    const layer = start.layers[0]?.id ?? '';
    const doc = addItem(start, layer, makeScatter('w', settings, { points: square900 }, 2));
    const stamps = bakeScatter(doc, 'w')
      .layers.flatMap((l) => l.items)
      .filter((i) => i.kind === 'stamp');
    expect(stamps.some((s) => s.flipX === true)).toBe(true);
    expect(stamps.every((s) => typeof s.tint === 'string')).toBe(true);
  });
});

describe('one piece per click', () => {
  it('is a stamp of the set at the point, and another piece with another seed', () => {
    const { doc } = base();
    const settings = forest;
    const rule = settings.rules[0];
    if (!rule) throw new Error('rule');
    const a = singlePiece(doc, settings, { x: 120, y: 300 }, 'p1', 1);
    expect(a).toMatchObject({ kind: 'stamp', id: 'p1', x: 120 });
    if (a?.kind !== 'stamp') throw new Error('stamp');
    expect(rule.pieces.map((p) => p.ref)).toContain(a.stamp);
    expect(a.w).toBeGreaterThanOrEqual(rule.sizeMin);
    expect(a.w).toBeLessThanOrEqual(rule.sizeMax);
    // The same seed gives the same piece; others differ somewhere.
    expect(singlePiece(doc, settings, { x: 120, y: 300 }, 'p1', 1)).toEqual(a);
    const others = Array.from({ length: 12 }, (_, i) =>
      singlePiece(doc, settings, { x: 120, y: 300 }, 'p', i + 2),
    );
    expect(new Set(others.map((o) => JSON.stringify(o))).size).toBeGreaterThan(3);
  });

  it('is nothing without pieces', () => {
    const { doc } = base();
    expect(singlePiece(doc, { ...forest, rules: [] }, { x: 0, y: 0 }, 'p', 1)).toBeNull();
  });
});

describe('overlap', () => {
  it('packs more pieces into the same area', () => {
    const { doc } = base();
    const area = { points: square(100, 100, 600) };
    const loose = makeScatter('a', forest, area, 4);
    const packed = makeScatter(
      'b',
      { ...forest, rules: forest.rules.map((r) => ({ ...r, overlap: 0.6 })) },
      area,
      4,
    );
    expect(packed.rules[0]?.overlap).toBe(0.6);
    expect(scatterOf(doc, packed).length).toBeGreaterThan(scatterOf(doc, loose).length * 1.5);
  });
});
