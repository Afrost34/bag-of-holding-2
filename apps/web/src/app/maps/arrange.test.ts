import { describe, expect, it } from 'vitest';
import {
  alignItems,
  constrainAngle,
  distributeItems,
  groupBox,
  itemBox,
  itemsInBox,
  itemsWithIds,
  mirrorCopies,
  moveItems,
  nearestVertex,
  orderItem,
  pasteItems,
  reflectItem,
  removeItems,
  translateItem,
} from './arrange';
import { addItem, newMap, type MapDoc, type MapItem } from './model';

const stamp = (
  id: string,
  x: number,
  y: number,
  w = 40,
  h = 20,
): Extract<MapItem, { kind: 'stamp' }> => ({
  kind: 'stamp',
  id,
  stamp: 'glyph:tree',
  x,
  y,
  w,
  h,
  rotation: 0,
});

function docWith(items: MapItem[]): MapDoc {
  const base = newMap('Arrange', [], 'now');
  const layer = base.layers[0]?.id ?? '';
  return items.reduce((d, i) => addItem(d, layer, i), base);
}

const all = (d: MapDoc) => d.layers.flatMap((l) => l.items);

describe('boxes and moves', () => {
  it('box a stamp, a stroke and a room, and move each', () => {
    expect(itemBox(stamp('a', 100, 100))).toEqual({ x0: 80, y0: 90, x1: 120, y1: 110 });
    const stroke: MapItem = {
      kind: 'stroke',
      id: 's',
      points: [0, 0, 50, 20],
      color: '#000',
      width: 10,
      brush: 'pen',
      opacity: 1,
    };
    expect(itemBox(stroke)).toEqual({ x0: -5, y0: -5, x1: 55, y1: 25 });
    const moved = translateItem(stroke, 10, -5);
    expect(moved.kind === 'stroke' && moved.points).toEqual([10, -5, 60, 15]);
    const room: MapItem = {
      kind: 'room',
      id: 'r',
      points: [0, 0, 100, 0, 100, 100],
      smooth: 0,
      floor: 'stone',
      wall: 10,
      wallStyle: 'stone',
      doors: [{ x: 50, y: 0, angle: 0, kind: 'door' }],
    };
    const shifted = translateItem(room, 5, 5);
    expect(shifted.kind === 'room' && shifted.doors?.[0]).toEqual({
      x: 55,
      y: 5,
      angle: 0,
      kind: 'door',
    });
  });

  it('move a group together and remove it', () => {
    const doc = docWith([stamp('a', 0, 0), stamp('b', 100, 0), stamp('c', 200, 0)]);
    const moved = moveItems(doc, ['a', 'b'], 10, 20);
    expect(
      itemsWithIds(moved, ['a', 'b', 'c']).map((i) => (i.kind === 'stamp' ? [i.x, i.y] : [])),
    ).toEqual([
      [10, 20],
      [110, 20],
      [200, 0],
    ]);
    expect(all(removeItems(doc, ['b'])).map((i) => i.id)).toEqual(['a', 'c']);
    expect(groupBox(itemsWithIds(doc, ['a', 'c']))).toEqual({ x0: -20, y0: -10, x1: 220, y1: 10 });
  });
});

describe('aligning and spacing', () => {
  const fixed = docWith([
    stamp('a', 0, 10),
    stamp('b', 100, 50),
    stamp('c', 300, 30),
    stamp('d', 160, 90),
  ]);
  const doc = () => fixed;

  it('lines items up by an edge or a middle', () => {
    const top = alignItems(doc(), ['a', 'b', 'c'], 'top');
    expect(itemsWithIds(top, ['a', 'b', 'c']).map((i) => (i.kind === 'stamp' ? i.y : 0))).toEqual([
      10, 10, 10,
    ]);
    const centre = alignItems(doc(), ['a', 'b', 'c'], 'center');
    const xs = itemsWithIds(centre, ['a', 'b', 'c']).map((i) => (i.kind === 'stamp' ? i.x : 0));
    expect(new Set(xs).size).toBe(1);
    expect(alignItems(doc(), ['a'], 'left')).toEqual(doc());
  });

  it('spaces three or more evenly between the outer two', () => {
    const spread = distributeItems(doc(), ['a', 'b', 'c', 'd'], 'x');
    const xs = itemsWithIds(spread, ['a', 'd', 'b', 'c'])
      .map((i) => (i.kind === 'stamp' ? i.x : 0))
      .sort((p, q) => p - q);
    expect(xs).toEqual([0, 100, 200, 300]);
    expect(distributeItems(doc(), ['a', 'b'], 'x')).toEqual(doc());
  });
});

describe('mirroring', () => {
  const axis = { x: 500, y: 300 };
  let n = 0;
  const newId = () => `m${String(++n)}`;

  it('reflects a stamp with its turn and flip, and a path point by point', () => {
    const s: MapItem = { ...stamp('a', 400, 100), rotation: 30 };
    const left = reflectItem(s, 'x', axis, 'z');
    expect(left.kind === 'stamp' && [left.x, left.y, left.rotation, left.flipX]).toEqual([
      600,
      100,
      330,
      true,
    ]);
    const top = reflectItem(s, 'y', axis, 'z');
    expect(top.kind === 'stamp' && [top.x, top.y, top.flipY]).toEqual([400, 500, true]);
    const path: MapItem = {
      kind: 'path',
      id: 'p',
      points: [400, 100, 450, 200],
      smooth: 0,
      style: 'road',
      width: 20,
      color: '#d9c79e',
    };
    const flipped = reflectItem(path, 'x', axis, 'q');
    expect(flipped.kind === 'path' && flipped.points).toEqual([600, 100, 550, 200]);
  });

  it('makes the copies a setting asks for, none for pins', () => {
    const s = stamp('a', 400, 100);
    expect(mirrorCopies(s, 'off', axis, newId)).toEqual([]);
    expect(mirrorCopies(s, 'x', axis, newId)).toHaveLength(1);
    expect(mirrorCopies(s, 'xy', axis, newId)).toHaveLength(3);
    const copies = mirrorCopies(s, 'xy', axis, newId);
    expect(copies.map((c) => (c.kind === 'stamp' ? [c.x, c.y] : []))).toEqual([
      [600, 100],
      [400, 500],
      [600, 500],
    ]);
    expect(new Set(copies.map((c) => c.id)).size).toBe(3);
    const pin: MapItem = { kind: 'pin', id: 'p', x: 1, y: 1, label: 'x' };
    expect(mirrorCopies(pin, 'xy', axis, newId)).toEqual([]);
  });

  it('turns a door round with the wall it is in', () => {
    const room: MapItem = {
      kind: 'room',
      id: 'r',
      points: [400, 200, 450, 200, 450, 250],
      smooth: 0,
      floor: 'stone',
      wall: 10,
      wallStyle: 'stone',
      doors: [{ x: 425, y: 200, angle: 0, kind: 'door' }],
    };
    const r = reflectItem(room, 'x', axis, 'm');
    expect(r.kind === 'room' && r.doors?.[0]?.x).toBe(575);
    expect(r.kind === 'room' && r.doors?.[0]?.angle).toBeCloseTo(Math.PI, 5);
  });
});

describe('drawing aids', () => {
  it('holds a line to steps of an angle', () => {
    const p = constrainAngle({ x: 0, y: 0 }, { x: 100, y: 12 }, 15);
    expect(Math.round(Math.atan2(p.y, p.x) * (180 / Math.PI))).toBe(
      15 * Math.round((Math.atan2(12, 100) * (180 / Math.PI)) / 15),
    );
    const flat = constrainAngle({ x: 0, y: 0 }, { x: 100, y: 3 }, 15);
    expect(flat.y).toBeCloseTo(0, 5);
    expect(constrainAngle({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it('finds the nearest corner of another item, ignoring one', () => {
    const wall: MapItem = { kind: 'wall', id: 'w', points: [100, 100, 300, 100] };
    const doc = docWith([wall]);
    expect(nearestVertex(doc, { x: 104, y: 97 }, 10)).toEqual({ x: 100, y: 100 });
    expect(nearestVertex(doc, { x: 200, y: 100 }, 10)).toBeNull();
    expect(nearestVertex(doc, { x: 104, y: 97 }, 10, 'w')).toBeNull();
  });
});

describe('copying and ordering', () => {
  it('pastes copies with new ids, moved', () => {
    const doc = docWith([stamp('a', 10, 10), stamp('b', 50, 50)]);
    const layer = doc.layers[0]?.id ?? '';
    const { doc: next, ids } = pasteItems(doc, layer, itemsWithIds(doc, ['a', 'b']), 70, 70);
    expect(ids).toHaveLength(2);
    expect(new Set(all(next).map((i) => i.id)).size).toBe(4);
    expect(itemsWithIds(next, ids).map((i) => (i.kind === 'stamp' ? [i.x, i.y] : []))).toEqual([
      [80, 80],
      [120, 120],
    ]);
  });

  it('moves an item to the front or the back of its layer', () => {
    const doc = docWith([stamp('a', 0, 0), stamp('b', 0, 0), stamp('c', 0, 0)]);
    expect(all(orderItem(doc, 'a', 'front')).map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(all(orderItem(doc, 'c', 'back')).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('picking with a box', () => {
  it('takes the items whose middle is inside, on shown unlocked layers only', () => {
    const blank = newMap('Box', [], '');
    const [low, high] = blank.layers;
    if (!low || !high) throw new Error('layers');
    let doc: MapDoc = addItem(blank, low.id, stamp('a', 100, 100));
    doc = addItem(doc, low.id, stamp('b', 500, 500));
    doc = addItem(doc, high.id, stamp('c', 140, 120));
    // A backdrop as big as the map: only its middle counts.
    doc = addItem(doc, low.id, {
      kind: 'shape',
      id: 'sea',
      points: [0, 0, 2000, 0, 2000, 1500, 0, 1500],
      smooth: 0,
      texture: 'water',
      color: '#3d7fb0',
      opacity: 1,
      edge: 'none',
    });
    const box = { x0: 50, y0: 50, x1: 200, y1: 200 };
    expect(itemsInBox(doc, box)).toEqual(['a', 'c']);
    // A locked layer, and one that is hidden, give nothing.
    const locked = {
      ...doc,
      layers: doc.layers.map((l) => (l.id === high.id ? { ...l, locked: true } : l)),
    };
    expect(itemsInBox(locked, box)).toEqual(['a']);
    const hidden = {
      ...doc,
      layers: doc.layers.map((l) => (l.id === low.id ? { ...l, visible: false } : l)),
    };
    expect(itemsInBox(hidden, box)).toEqual(['c']);
  });
});
