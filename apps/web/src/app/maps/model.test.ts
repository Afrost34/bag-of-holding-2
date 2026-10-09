import { describe, expect, it } from 'vitest';
import { distanceFeet, hexCentre, snapToCell, snapToCorner, templateOutline } from './geometry';
import {
  addItem,
  filterMaps,
  mapFolders,
  mapTags,
  type MapFilter,
  addPicture,
  removePicture,
  updatePicture,
  addPinCategory,
  PIN_COLOR,
  pinStyle,
  removePinCategory,
  updatePinCategory,
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
  mapKind,
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
    const doc = { ...newMap('Keep', [], 'now'), encounter: 'e1', pinStyle: 'fantasy' as const };
    expect(parseMap(serializeMap({ ...doc, campaign: 'c' }), doc.id, 'c')).toEqual({
      ...doc,
      campaign: 'c',
    });
    const bare = parseMap('{"name":"Old"}', 'x');
    expect(bare?.layers).toHaveLength(3);
    expect(bare?.grid.type).toBe('square');
  });
});

describe('picture layers', () => {
  it('are shown or hidden over the background, kept, and let go when removed', () => {
    let doc = newMap('Mine', [], 'now');
    doc = addPicture(doc, { name: 'Night', path: 'maps/assets/night.webp', visible: false });
    doc = addPicture(doc, { name: 'Fog', path: 'maps/assets/fog.webp', visible: true });
    doc = updatePicture(doc, 0, { visible: true });
    expect(doc.pictures?.map((p) => p.visible)).toEqual([true, true]);
    expect(parseMap(serializeMap(doc), doc.id)?.pictures).toEqual(doc.pictures);
    doc = removePicture(removePicture(doc, 1), 0);
    expect(doc.pictures).toBeUndefined();
  });
});

describe('pin categories', () => {
  it('give their pins an icon and colour, hide them, and let them go when removed', () => {
    let doc = newMap('World', [], '2026-01-01');
    const added = addPinCategory(doc, { name: 'Cities', icon: 'castle', color: '#1d4ed8' });
    doc = added.doc;
    const layer = doc.layers[0]?.id ?? '';
    doc = addItem(doc, layer, {
      kind: 'pin',
      id: 'p1',
      x: 0,
      y: 0,
      label: 'Waterdeep',
      category: added.id,
    });
    doc = addItem(doc, layer, {
      kind: 'pin',
      id: 'p2',
      x: 0,
      y: 0,
      label: 'Inn',
      icon: 'beer',
      category: added.id,
    });
    const pin = (id: string) => {
      const found = findItem(doc, id)?.item;
      if (found?.kind !== 'pin') throw new Error('no pin');
      return found;
    };
    expect(pinStyle(doc, pin('p1'))).toEqual({ icon: 'castle', color: '#1d4ed8', hidden: false });
    expect(pinStyle(doc, pin('p2')).icon).toBe('beer');
    doc = updatePinCategory(doc, added.id, { hidden: true });
    expect(pinStyle(doc, pin('p1')).hidden).toBe(true);
    // Kept through a save.
    const back = parseMap(serializeMap(doc), doc.id);
    expect(back?.pinCategories).toEqual(doc.pinCategories);
    doc = removePinCategory(doc, added.id);
    expect(pin('p1').category).toBeUndefined();
    expect(pinStyle(doc, pin('p1'))).toEqual({ icon: null, color: PIN_COLOR, hidden: false });
  });
});

describe('finding maps', () => {
  const maps = [
    { name: 'Pirate Tavern – Basement', folder: 'Battle maps/Pirate Tavern', tags: ['tavern', 'night'] },
    { name: 'Pirate Tavern – Top Floor', folder: 'Battle maps/Pirate Tavern', tags: ['tavern'] },
    { name: 'Goblin Bridge', folder: 'Battle maps', tags: ['forest', 'night'] },
    { name: 'Rustcrown' },
  ];

  it('by words, folder and tags', () => {
    const names = (f: Partial<MapFilter>) =>
      filterMaps(maps, { q: '', folder: '', tags: [], ...f }).map((m) => m.name);
    expect(names({ q: 'tavern base' })).toEqual(['Pirate Tavern – Basement']);
    expect(names({ folder: 'Battle maps' })).toHaveLength(3);
    expect(names({ folder: 'Battle maps/Pirate Tavern', tags: ['night'] })).toEqual([
      'Pirate Tavern – Basement',
    ]);
    expect(mapFolders(maps)).toEqual(['Battle maps', 'Battle maps/Pirate Tavern']);
    expect(mapTags(maps)[0]).toEqual(['night', 2]);
  });

  it('keep their folder and tags in the file', () => {
    const doc = { ...newMap('Mine', [], 'now'), folder: 'Battle maps', tags: ['cave'] };
    expect(parseMap(serializeMap(doc), doc.id)).toMatchObject({ folder: 'Battle maps', tags: ['cave'] });
  });
}); // prettier-ignore

describe('kinds of map', () => {
  it('battle maps have a grid; world and city maps have none, and routes', () => {
    const battle = newMap('Cave', [], '');
    expect(mapKind(battle)).toBe('battle');
    expect(battle.grid.type).toBe('square');
    const world = newMap('Continent', [], '', 'world');
    expect(mapKind(world)).toBe('world');
    expect(world.grid.type).toBe('none');
    expect(world.layers.map((l) => l.name)).toContain('Routes');
  });

  it('older maps with a real scale are world maps', () => {
    const { kind: _k, ...old } = newMap('Old', [], '');
    expect(mapKind(old)).toBe('battle');
    expect(mapKind({ ...old, scale: { unit: 'km', perPixel: 2 } })).toBe('world');
  });

  it('keeps its kind and routes in the file', () => {
    const world = newMap('Continent', [], '', 'world');
    const layer = world.layers[1]?.id ?? '';
    const withRoute = addItem(world, layer, {
      kind: 'route',
      id: 'r1',
      points: [0, 0, 100, 0],
      label: 'Sea road',
      color: '#b91c1c',
    });
    const back = parseMap(serializeMap(withRoute), world.id);
    expect(back?.kind).toBe('world');
    expect(back?.layers[1]?.items[0]).toMatchObject({ kind: 'route', label: 'Sea road' });
  });

  it('finds maps by kind', () => {
    const maps = [newMap('Cave', [], ''), newMap('Continent', [], '', 'world')];
    expect(
      filterMaps(maps, { q: '', folder: '', tags: [], kind: 'world' }).map((m) => m.name),
    ).toEqual(['Continent']);
  });
});
