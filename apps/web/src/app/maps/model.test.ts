import { describe, expect, it } from 'vitest';
import { distanceFeet, hexCentre, snapToCell, snapToCorner, templateOutline } from './geometry';
import {
  addItem,
  addLayer,
  DEFAULT_GRID,
  findItem,
  itemId,
  moveItemToLayer,
  moveLayer,
  newMap,
  parseMap,
  removeItem,
  removeLayer,
  serializeMap,
  updateItem,
  type Grid,
  type MapItem,
} from './model';

const square: Grid = { ...DEFAULT_GRID, size: 50, offsetX: 10, offsetY: 20 };
const hex: Grid = { ...DEFAULT_GRID, type: 'hex', size: 60, offsetX: 0, offsetY: 0 };

describe('maps', () => {
  it('keeps items in layers, drawn bottom to top', () => {
    let doc = newMap('Cave', [], 'now');
    const [ground, objects] = doc.layers;
    expect(doc.layers.map((l) => l.name)).toEqual(['Ground', 'Objects', 'Walls and notes']);
    const stamp: MapItem = {
      kind: 'stamp',
      id: itemId(doc),
      stamp: 'Cave/rock.png',
      x: 100,
      y: 100,
      w: 50,
      h: 50,
      rotation: 0,
    };
    doc = addItem(doc, ground?.id ?? '', stamp);
    doc = updateItem(doc, stamp.id, (i) => ({ ...i, x: 200 }));
    expect(findItem(doc, stamp.id)?.item).toMatchObject({ x: 200 });
    doc = moveItemToLayer(doc, stamp.id, objects?.id ?? '');
    expect(findItem(doc, stamp.id)?.layer.name).toBe('Objects');
    doc = moveLayer(doc, objects?.id ?? '', -1);
    expect(doc.layers[0]?.name).toBe('Objects');
    doc = addLayer(doc, 'Fog');
    expect(doc.layers.at(-1)?.name).toBe('Fog');
    doc = removeItem(doc, stamp.id);
    expect(findItem(doc, stamp.id)).toBeUndefined();
    for (const l of [...doc.layers]) doc = removeLayer(doc, l.id);
    expect(doc.layers).toHaveLength(1);
  });

  it('snaps to cells and corners on square and hex grids', () => {
    expect(snapToCell({ x: 12, y: 22 }, square)).toEqual({ x: 35, y: 45 });
    expect(snapToCorner({ x: 40, y: 50 }, square)).toEqual({ x: 60, y: 70 });
    const c = hexCentre(2, 1, hex);
    expect(snapToCell({ x: c.x + 5, y: c.y - 5 }, hex)).toEqual(c);
    expect(snapToCell({ x: 3, y: 4 }, { ...square, type: 'none' })).toEqual({ x: 3, y: 4 });
  });

  it('counts distance the way the rules do', () => {
    // Four cells right and two down on squares: 4 cells (diagonals count as one) = 20 ft.
    expect(distanceFeet({ x: 35, y: 45 }, { x: 235, y: 145 }, square)).toBe(20);
    expect(distanceFeet(hexCentre(0, 0, hex), hexCentre(3, -1, hex), hex)).toBe(15);
    expect(distanceFeet({ x: 0, y: 0 }, { x: 300, y: 400 }, { ...square, type: 'none' })).toBe(50);
  });

  it('outlines spell templates at the grid’s scale', () => {
    // A 15-foot cone pointing right: 150 px long, 150 px wide at its end (50 px per 5 ft).
    const cone = templateOutline('cone', { x: 0, y: 0 }, 15, 0, square).polygon ?? [];
    expect(cone.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([
      [0, 0],
      [150, 75],
      [150, -75],
    ]);
    expect(templateOutline('sphere', { x: 5, y: 5 }, 20, 0, square).circle).toEqual({
      x: 5,
      y: 5,
      r: 200,
    });
    const line = templateOutline('line', { x: 0, y: 0 }, 30, 90, square).polygon ?? [];
    expect(Math.round(Math.max(...line.map((p) => p.y)))).toBe(300);
  });

  it('reads back what it writes, filling in what is missing', () => {
    const doc = { ...newMap('Keep', [], 'now'), encounter: 'e1' };
    expect(parseMap(serializeMap({ ...doc, campaign: 'c' }), doc.id, 'c')).toEqual({
      ...doc,
      campaign: 'c',
    });
    const bare = parseMap('{"name":"Old"}', 'x');
    expect(bare?.layers).toHaveLength(3);
    expect(bare?.grid.type).toBe('square');
  });
});
