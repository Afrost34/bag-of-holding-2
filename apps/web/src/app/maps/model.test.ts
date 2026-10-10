import { describe, expect, it } from 'vitest';
import { distanceFeet, hexCentre, snapToCell, snapToCorner, templateOutline } from './geometry';
import {
  addItem,
  filterMaps,
  mapFolders,
  mapTags,
  type MapFilter,
  addFog,
  artHash,
  hasArt,
  fogHides,
  addPictureLayer,
  addVariant,
  itemShown,
  layerShown,
  mapIsStale,
  rectPoints,
  removeFog,
  removeVariant,
  setActiveVariant,
  setFogRevealed,
  setItemShown,
  setLayerShown,
  stepVariant,
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
    expect(snapToCell({ x: 3, y: 4 }, square)).toEqual({ x: -15, y: -5 });
  });

  it('counts distance the way the rules do', () => {
    // Four cells right and two down on squares: 4 cells (diagonals count as one) = 20 ft.
    expect(distanceFeet({ x: 35, y: 45 }, { x: 235, y: 145 }, square)).toBe(20);
    expect(distanceFeet(hexCentre(0, 0, hex), hexCentre(3, -1, hex), hex)).toBe(15);
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
  it('go above the other pictures and below what is drawn; the first sizes the map', () => {
    let doc = newMap('Mine', [], 'now');
    doc = addPictureLayer(doc, 'Day', { path: 'maps/assets/day.webp', width: 4000, height: 3000 });
    doc = addPictureLayer(doc, 'Night', {
      path: 'maps/assets/night.webp',
      width: 4000,
      height: 3000,
    });
    expect(doc.layers.slice(0, 2).map((l) => l.name)).toEqual(['Day', 'Night']);
    expect(doc.layers.slice(2).every((l) => !l.picture)).toBe(true);
    expect([doc.width, doc.height]).toEqual([4000, 3000]);
    expect(parseMap(serializeMap(doc), doc.id)).toEqual(doc);
  });
});

describe('maps of version 1', () => {
  const old = {
    version: 1,
    name: 'Old',
    width: 100,
    height: 100,
    background: { path: 'maps/assets/day.webp', width: 3000, height: 2000 },
    pictures: [
      { name: 'Night', path: 'maps/assets/night.webp', visible: true },
      { name: 'Snow', path: 'maps/assets/snow.webp', visible: false },
    ],
    layers: [{ id: 'l1', name: 'Pins', visible: true, locked: false, items: [] }],
  };

  it('become picture layers and variants, and are saved again once read', () => {
    const text = JSON.stringify(old);
    expect(mapIsStale(text)).toBe(true);
    const doc = parseMap(text, 'x');
    expect(doc?.version).toBe(2);
    expect([doc?.width, doc?.height]).toEqual([3000, 2000]);
    expect(doc?.layers.map((l) => l.name)).toEqual(['Background', 'Night', 'Snow', 'Pins']);
    expect(doc?.layers.slice(0, 3).every((l) => l.picture && l.locked)).toBe(true);
    expect(doc?.variants?.map((v) => v.name)).toEqual(['As it was', 'Night', 'Snow']);
    // "As it was": the background and the night picture were shown.
    const was = doc?.variants?.[0];
    const shown = doc?.layers.filter((l) => was?.layers[l.id]).map((l) => l.name);
    expect(shown).toEqual(['Background', 'Night', 'Pins'].filter((n) => n !== 'Pins'));
    expect(doc?.activeVariant).toBe(was?.id);
    const again = doc ? parseMap(serializeMap(doc), 'x') : null;
    expect(again).toEqual(doc);
    expect(mapIsStale(doc ? serializeMap(doc) : null)).toBe(false);
  });

  it('with a background alone get a picture layer and no variants', () => {
    const doc = parseMap(JSON.stringify({ ...old, pictures: undefined }), 'x');
    expect(doc?.layers.map((l) => l.name)).toEqual(['Background', 'Pins']);
    expect(doc?.variants).toBeUndefined();
  });
});

describe('variants', () => {
  const base = () => {
    let doc = newMap('Inn', [], 'now');
    doc = addPictureLayer(doc, 'Ground floor', { path: 'a.webp', width: 900, height: 600 });
    doc = addPictureLayer(doc, 'Upstairs', { path: 'b.webp', width: 900, height: 600 });
    return doc;
  };

  it('remember which layers are shown, and showing a layer changes the active one only', () => {
    let doc = base();
    const [ground, up] = doc.layers;
    if (!ground || !up) throw new Error('layers');
    doc = setLayerShown(doc, up.id, false);
    doc = addVariant(doc, 'Ground');
    const ground1 = doc.activeVariant;
    doc = addVariant(doc, 'Upstairs');
    doc = setLayerShown(doc, up.id, true);
    doc = setLayerShown(doc, ground.id, false);
    // Back on the first one: the upstairs picture is hidden again.
    doc = setActiveVariant(doc, ground1);
    expect(layerShown(doc, up)).toBe(false);
    expect(layerShown(doc, ground)).toBe(true);
    // The layer's own flag is untouched by variant changes.
    expect(doc.layers.find((l) => l.id === up.id)?.visible).toBe(false);
    expect(parseMap(serializeMap(doc), doc.id)).toEqual(doc);
  });

  it('hide items, step round, and are removed with their activity', () => {
    let doc = base();
    doc = addVariant(doc, 'A');
    doc = addVariant(doc, 'B');
    const [a, b] = doc.variants ?? [];
    expect(doc.activeVariant).toBe(b?.id);
    doc = setItemShown(doc, 'pin1', false);
    expect(itemShown(doc, 'pin1')).toBe(false);
    expect(itemShown(doc, 'other')).toBe(true);
    doc = stepVariant(doc, 1);
    expect(doc.activeVariant).toBe(a?.id);
    expect(itemShown(doc, 'pin1')).toBe(true);
    doc = removeVariant(doc, a?.id ?? '');
    expect(doc.activeVariant).toBeUndefined();
    doc = removeVariant(doc, b?.id ?? '');
    expect(doc.variants).toBeUndefined();
  });
});

describe('fog', () => {
  it('hides areas until they are revealed, and lets them go', () => {
    let doc = newMap('Cave', [], 'now');
    doc = addFog(doc, rectPoints(0, 0, 100, 50));
    const id = doc.reveal?.[0]?.id ?? '';
    expect(doc.reveal?.[0]).toEqual({
      id,
      points: [0, 0, 100, 0, 100, 50, 0, 50],
      revealed: false,
    });
    doc = setFogRevealed(doc, id, true);
    expect(doc.reveal?.[0]?.revealed).toBe(true);
    expect(parseMap(serializeMap(doc), doc.id)?.reveal).toEqual(doc.reveal);
    doc = removeFog(doc, id);
    expect(doc.reveal).toBeUndefined();
  });

  it('applies shapes in order: a later reveal cuts a hole, a later fog covers it again', () => {
    let doc = addFog(newMap('Cave', [], 'now'), rectPoints(0, 0, 100, 100));
    expect(fogHides(doc, 50, 50)).toBe(true);
    expect(fogHides(doc, 150, 50)).toBe(false);
    doc = addFog(doc, rectPoints(40, 40, 60, 60), true);
    expect(fogHides(doc, 50, 50)).toBe(false);
    expect(fogHides(doc, 10, 10)).toBe(true);
    doc = addFog(doc, rectPoints(45, 45, 55, 55));
    expect(fogHides(doc, 50, 50)).toBe(true);
    expect(fogHides(doc, 42, 42)).toBe(false);
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

describe('maps have a size and no type', () => {
  it('start at the size asked in squares, with a visible grid', () => {
    const doc = newMap('Cave', [], '', { w: 20, h: 10 });
    expect(doc.width).toBe(20 * DEFAULT_GRID.size);
    expect(doc.height).toBe(10 * DEFAULT_GRID.size);
    expect(doc.grid).toMatchObject({ type: 'square', visible: true });
    expect(newMap('Big', [], '', { w: 900, h: 0 })).toMatchObject({
      width: 200 * DEFAULT_GRID.size,
      height: DEFAULT_GRID.size,
    });
  });

  it('read an old world map (no grid) as a map with a hidden grid', () => {
    const old = JSON.parse(serializeMap(newMap('Old', [], ''))) as Record<string, unknown>;
    old.kind = 'world';
    old.grid = { type: 'none', size: 70, feet: 5, opacity: 0.35 };
    expect(parseMap(JSON.stringify(old), 'x')?.grid).toMatchObject({
      type: 'square',
      visible: false,
    });
  });

  it('keeps routes in the file', () => {
    const doc = newMap('Continent', [], '');
    const layer = doc.layers[1]?.id ?? '';
    const withRoute = addItem(doc, layer, {
      kind: 'route',
      id: 'r1',
      points: [0, 0, 100, 0],
      label: 'Sea road',
      color: '#b91c1c',
    });
    const back = parseMap(serializeMap(withRoute), doc.id);
    expect(back?.layers[1]?.items[0]).toMatchObject({ kind: 'route', label: 'Sea road' });
  });
});

describe('the fingerprint of the art', () => {
  it('changes with the art, not with pins, routes or fog', () => {
    const doc = newMap('Keep', [], 'now');
    const layer = doc.layers[0]?.id ?? '';
    const base = artHash(doc);
    expect(hasArt(doc)).toBe(false);
    const withPin = addItem(doc, layer, { kind: 'pin', id: 'p', x: 1, y: 2, label: 'Inn' });
    const withRoute = addItem(withPin, layer, {
      kind: 'route',
      id: 'r',
      points: [0, 0, 5, 5],
      label: 'Road',
      color: '#000',
    });
    expect(artHash(addFog(withRoute, rectPoints(0, 0, 9, 9)))).toBe(base);
    const stroked = addItem(doc, layer, {
      kind: 'stroke',
      id: 's',
      points: [0, 0, 9, 9],
      color: '#111',
      width: 4,
      brush: 'pen',
      opacity: 1,
    });
    expect(hasArt(stroked)).toBe(true);
    expect(artHash(stroked)).not.toBe(base);
    expect(artHash(setLayerShown(doc, layer, false))).not.toBe(base);
    expect(artHash({ ...doc, width: doc.width + 1 })).not.toBe(base);
  });
});
