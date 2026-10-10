import { describe, expect, it } from 'vitest';
import { libraryId, placeFootprint, toLibrary } from './buildings';
import {
  addItems,
  bakeDistrict,
  districtGeo,
  eraseBuildings,
  generateTown,
  makeBuilding,
  makeDistrict,
  rectangleFootprint,
  rotatePoints,
  shadedHalf,
  settingsFromStyle,
  type DistrictItem,
} from './cityDoc';
import { addItem, newMap, type MapDoc } from './model';
import { centroid } from './polyclip';

const square = (x: number, y: number, s: number) => [x, y, x + s, y, x + s, y + s, x, y + s];

function withDistrict(): { doc: MapDoc; layer: string; district: DistrictItem } {
  const start = newMap('Town', [], 'now');
  const layer = start.layers[0]?.id ?? '';
  const district = makeDistrict('d', settingsFromStyle('town'), square(100, 100, 700), 5, 0);
  return { doc: addItem(start, layer, district), layer, district };
}

describe('districts in a map', () => {
  it('are scaled by their settings', () => {
    const small = makeDistrict('a', settingsFromStyle('town', 0.5), square(0, 0, 100), 1);
    const big = makeDistrict('b', settingsFromStyle('town', 2), square(0, 0, 100), 1);
    expect(big.blockSize).toBe(small.blockSize * 4);
    expect(big.lotArea).toBe(small.lotArea * 16);
  });

  it('keep clear of roads and hand-made buildings', () => {
    const { doc, layer, district } = withDistrict();
    const plain = districtGeo(doc, district).buildings.length;
    expect(plain).toBeGreaterThan(50);
    let next = addItem(doc, layer, {
      kind: 'path',
      id: 'road',
      points: [0, 450, 900, 450],
      smooth: 0,
      style: 'road',
      width: 80,
      color: '#d9c79e',
    });
    const around = districtGeo(next, district);
    expect(around.buildings.length).toBeLessThan(plain);
    expect(around.buildings.some((b) => Math.abs(centroid(b.poly).y - 450) < 40)).toBe(false);
    // On water they do not go either.
    next = addItem(doc, layer, {
      kind: 'shape',
      id: 'lake',
      points: square(100, 100, 700),
      smooth: 0,
      texture: 'water',
      color: '#3d7fb0',
      opacity: 1,
      edge: 'none',
    });
    expect(districtGeo(next, district).buildings).toHaveLength(0);
  });

  it('lose the buildings the eraser went over, and keep them out', () => {
    const { doc, district } = withDistrict();
    const before = districtGeo(doc, district).buildings;
    const target = before[Math.floor(before.length / 2)];
    if (!target) throw new Error('no building');
    const c = centroid(target.poly);
    const erased = eraseBuildings(doc, [c.x - 3, c.y, c.x + 3, c.y], 8);
    const item = erased.layers.flatMap((l) => l.items).find((i) => i.id === 'd');
    if (item?.kind !== 'district') throw new Error('district');
    expect(item.removed).toContain(target.key);
    const after = districtGeo(erased, item).buildings;
    expect(after.length).toBeLessThan(before.length);
    expect(after.some((b) => b.key === target.key)).toBe(false);
    // Rolling away from the district leaves it alone.
    expect(eraseBuildings(doc, [5, 5, 6, 6], 4)).toBe(doc);
  });

  it('turn into buildings of their own when baked, leaving streets and yards', () => {
    const { doc, district } = withDistrict();
    const expected = districtGeo(doc, district).buildings.length;
    const baked = bakeDistrict(doc, 'd');
    const items = baked.layers.flatMap((l) => l.items);
    const houses = items.filter((i) => i.kind === 'building');
    expect(houses).toHaveLength(expected);
    const left = items.find((i) => i.id === 'd');
    expect(left?.kind === 'district' && left.density).toBe(0);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    // Baked buildings are not generated again.
    if (left?.kind !== 'district') throw new Error('district');
    expect(districtGeo(baked, left).buildings).toHaveLength(0);
  });
});

describe('towns and buildings', () => {
  it('make a walled town with a market quarter inside', () => {
    const doc = newMap('Town', [], 'now');
    const items = generateTown(
      doc,
      { x: 1000, y: 1000 },
      500,
      9,
      1,
      (taken) => `t${String(taken.length)}`,
    );
    expect(items).toHaveLength(2);
    const [outer, inner] = items;
    expect(outer?.kind === 'district' && outer.wall).toBe(true);
    expect(inner?.kind === 'district' && inner.style).toBe('market');
    const next = addItems(doc, doc.layers[0]?.id ?? '', items);
    expect(next.layers[0]?.items).toHaveLength(2);
  });

  it('are rectangles you can turn, and saved to the library round their middle', () => {
    const rect = rectangleFootprint(100, 100, 40, 20);
    expect(rect).toEqual([80, 90, 120, 90, 120, 110, 80, 110]);
    const turned = rotatePoints(rect, 90);
    expect(centroid(turned)).toEqual({ x: 100, y: 100 });
    expect(turned).not.toEqual(rect);
    const house = makeBuilding('h', rect, 'thatch', '#8a6a4a', 'Smithy');
    const entry = toLibrary(house, '', 'b1');
    expect(entry.name).toBe('Smithy');
    expect(entry.points).toEqual([-20, -10, 20, -10, 20, 10, -20, 10]);
    expect(placeFootprint(entry, { x: 500, y: 300 })).toEqual([
      480, 290, 520, 290, 520, 310, 480, 310,
    ]);
    expect(libraryId(['b1', 'b2'])).toBe('b3');
  });
});

describe('the shade of a roof', () => {
  // A roof split into a half on the left (x 0–50) and one on the right (x 50–100).
  const left = [0, 0, 50, 0, 50, 40, 0, 40];
  const right = [50, 0, 100, 0, 100, 40, 50, 40];

  it('is the half away from the sun', () => {
    // The sun in the east (0°): the left half is in shade.
    expect(shadedHalf(left, right, 0, { angle: 0 })).toBe('a');
    // In the west (180°): the right half is.
    expect(shadedHalf(left, right, 0, { angle: 180 })).toBe('b');
  });

  it('keeps the old rule when the map sets no sun', () => {
    expect(shadedHalf(left, right, 0.3)).toBe('b');
    expect(shadedHalf(left, right, -0.3)).toBe('a');
  });
});
