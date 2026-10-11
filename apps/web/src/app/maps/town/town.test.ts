import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import {
  districtGeo,
  generateTown,
  districtOutline,
  makeDistrict,
  settingsFromStyle,
  type DistrictItem,
} from '../cityDoc';
import { addItem, newMap, type MapDoc, type MapItem } from '../model';
import { pointInPolygon } from '../polygon';
import { scatterOf } from '../scatterDoc';
import { planOf, structureParts } from '../structure/structureDoc';
import { metersPerPixel, stampUnit } from '../units';
import { TOWN_LOOKS, townLookById } from './looks';
import { buildTown, DEFAULT_TOWN, townDistricts } from './townDoc';
import { convexHull, largestRect, planTown } from './townplan';

/** A map of 120 × 90 squares with a district over most of it. */
function townMap(
  style: 'town' | 'noble' | 'market' = 'town',
  plaza = 0.18,
): { doc: MapDoc; district: DistrictItem } {
  const start = newMap('Town', [], 'now', { w: 120, h: 90 });
  const layer = start.layers[0]?.id ?? '';
  const cell = start.grid.size;
  const pxPerMeter = 1 / metersPerPixel(start);
  const w = 110 * cell;
  const h = 80 * cell;
  const district = makeDistrict(
    'd1',
    { ...settingsFromStyle(style), plaza },
    [
      5 * cell,
      5 * cell,
      5 * cell + w,
      5 * cell,
      5 * cell + w,
      5 * cell + h,
      5 * cell,
      5 * cell + h,
    ],
    7,
    0,
    pxPerMeter,
  );
  return { doc: addItem(start, layer, district), district };
}

const OPTIONS = (doc: MapDoc) => ({ unit: stampUnit(doc) });

describe('the biggest rectangle in a lot', () => {
  it('fills a square lot and finds the room inside an L', () => {
    expect(largestRect([0, 0, 100, 0, 100, 100, 0, 100], 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    // An L: 10 across the top half, 5 down the left.
    const l = [0, 0, 100, 0, 100, 50, 50, 50, 50, 100, 0, 100];
    expect(largestRect(l, 10)).toEqual({ x: 0, y: 0, w: 10, h: 5 });
    expect(largestRect([0, 0, 5, 0, 5, 5, 0, 5], 10)).toBeNull();
  });
});

describe('a town plan', () => {
  it('puts the shops, taverns, temple and guildhall in the middle and farms at the edge', () => {
    const { doc, district } = townMap();
    const geo = districtGeo(doc, district);
    const lots = planTown(geo, districtOutline(district), {
      look: townLookById('temperate'),
      district: 'town',
      seed: 3,
      cell: doc.grid.size,
      max: 200,
    });
    expect(lots.length).toBeGreaterThan(20);
    const of = (id: string) => lots.filter((l) => l.archetype === id);
    // One temple, one guildhall at most; at least one tavern, with a name.
    expect(of('temple').length).toBeLessThanOrEqual(1);
    expect(of('guildhall').length).toBeLessThanOrEqual(1);
    expect(of('tavern').length).toBeGreaterThan(0);
    expect(of('tavern')[0]?.name).toMatch(/^The \w+ \w+$/);
    const meanRing = (list: { ring: number }[]) =>
      list.reduce((s, l) => s + l.ring, 0) / Math.max(1, list.length);
    expect(meanRing(of('shop'))).toBeLessThan(
      meanRing(of('farmhouse').length ? of('farmhouse') : of('house')),
    );
    for (const l of of('farmhouse')) expect(l.ring).toBeGreaterThanOrEqual(0.7);
    // Taller in the middle than at the edge.
    const core = lots.filter((l) => l.ring < 0.35);
    const edge = lots.filter((l) => l.ring > 0.7);
    expect(meanRing(core)).toBeLessThan(meanRing(edge));
    const floors = (list: typeof lots) =>
      list.reduce((s, l) => s + l.upper, 0) / Math.max(1, list.length);
    expect(floors(core)).toBeGreaterThan(floors(edge));
    // Styles from the look's mix only.
    const allowed = new Set(townLookById('temperate').styles.map((s) => s.style));
    for (const l of lots) expect(allowed.has(l.style)).toBe(true);
    expect(new Set(lots.map((l) => l.style)).size).toBeGreaterThan(1);
  });

  it('stands every building on whole squares inside its lot, its door towards the street', () => {
    const { doc, district } = townMap();
    const cell = doc.grid.size;
    const geo = districtGeo(doc, district);
    const lots = planTown(geo, districtOutline(district), {
      look: townLookById('temperate'),
      district: 'town',
      seed: 3,
      cell,
      max: 200,
    });
    for (const lot of lots) {
      // A hall stands on two lots joined (and the gap between them).
      const poly = convexHull(
        geo.buildings.filter((b) => lot.keys.includes(b.key)).flatMap((b) => b.poly),
      );
      for (let i = 0; i < 8; i += 2) {
        expect((lot.footprint[i] ?? 0) % cell).toBe(0);
        // Corners on the lot's edge count; a hair in from each corner is inside.
        const x = lot.footprint[i] ?? 0;
        const y = lot.footprint[i + 1] ?? 0;
        const mx = (lot.footprint[0] ?? 0) + (lot.footprint[4] ?? 0);
        const my = (lot.footprint[1] ?? 0) + (lot.footprint[5] ?? 0);
        expect(
          pointInPolygon({ x: x + (mx / 2 - x) * 0.01, y: y + (my / 2 - y) * 0.01 }, poly),
        ).toBe(true);
      }
      expect(Math.min(lot.w, lot.h)).toBeGreaterThanOrEqual(3);
      expect(Math.abs(lot.facing.x) + Math.abs(lot.facing.y)).toBe(1);
    }
  });

  it('is the same for the same seed, and makes manors in a noble quarter', () => {
    const { doc, district } = townMap('noble');
    const plan = (seed: number) =>
      planTown(districtGeo(doc, district), districtOutline(district), {
        look: townLookById('city'),
        district: 'noble',
        seed,
        cell: doc.grid.size,
        max: 200,
      });
    expect(plan(4)).toEqual(plan(4));
    expect(plan(4).filter((l) => l.archetype === 'manor').length).toBeGreaterThanOrEqual(2);
  });
});

describe('building a town', () => {
  it('makes whole buildings on shared level layers, paved streets, a dressed square', () => {
    const { doc } = townMap();
    const made = buildTown(
      doc,
      ['d1'],
      { ...DEFAULT_TOWN, max: 30, seed: 5 },
      FA_ENTRIES,
      OPTIONS(doc),
    );
    if (!made) throw new Error('no town');
    const out = made.doc;
    expect(made.count).toBe(30);
    const added = out.layers.slice(doc.layers.length);
    const names = added.map((l) => l.name);
    expect(names[0]).toMatch(/Streets$/);
    expect(names).toContain('Town – Ground floor');
    expect(names).toContain('Town – First floor');
    // A handful of layers, however many buildings.
    expect(added.length).toBeLessThanOrEqual(6);
    const structures = out.layers.flatMap((l) => l.items).filter((i) => i.kind === 'structure');
    const ground = structures.filter((i) => i.floor === 0);
    expect(ground).toHaveLength(30);
    // Each building's floors share its group and its spec.
    for (const g of ground) {
      const mine = structures.filter((i) => i.group === g.group);
      expect(mine.length).toBe(1 + g.spec.upper + (g.spec.cellar ? 1 : 0));
      expect(g.spec.facing).toBeDefined();
    }
    // The streets are paved with the packs' cobbles, the blocks cut out; the square in flagstone.
    const shapes =
      added[0]?.items.filter((i): i is Extract<MapItem, { kind: 'shape' }> => i.kind === 'shape') ??
      [];
    expect(shapes[0]?.texture).toContain('Cobblestone');
    expect(shapes[0]?.holes?.length).toBeGreaterThan(5);
    expect(shapes[1]?.texture).toContain('Flagstone');
    // Street life and a market, tied to the paving.
    const groundLayer = added.find((l) => l.name === 'Town – Ground floor');
    const dressings = groundLayer?.items.filter((i) => i.kind === 'scatter') ?? [];
    expect(dressings.map((d) => d.recipe)).toEqual(['streets', 'market']);
    for (const d of dressings) expect(scatterOf(out, d).length).toBeGreaterThan(0);
    // A variant per level, the ground floor shown.
    const variants = out.variants ?? [];
    expect(variants.map((v) => v.name)).toContain('Town: Ground floor');
    expect(variants.find((v) => v.id === out.activeVariant)?.name).toBe('Town: Ground floor');
    // The lots built left the district.
    const district = out.layers.flatMap((l) => l.items).find((i) => i.kind === 'district');
    // Halls stand on two lots: more lots left the district than there are buildings.
    expect(district?.kind === 'district' ? district.removed?.length : 0).toBeGreaterThan(
      ground.length,
    );
  });

  it('furnishes the buildings: a tavern has its tables and seats, and its door faces the street', () => {
    const { doc } = townMap();
    const made = buildTown(
      doc,
      ['d1'],
      { ...DEFAULT_TOWN, max: 40, seed: 5 },
      FA_ENTRIES,
      OPTIONS(doc),
    );
    if (!made) throw new Error('no town');
    const tavern = made.doc.layers
      .flatMap((l) => l.items)
      .find((i) => i.kind === 'structure' && i.floor === 0 && i.spec.archetype === 'tavern');
    if (tavern?.kind !== 'structure') throw new Error('no tavern');
    // Roofs off: the rooms show.
    const parts = structureParts({ ...made.doc, hideRoofs: true }, tavern);
    const stamps = parts.filter((p) => p.kind === 'stamp');
    expect(stamps.length).toBeGreaterThan(10);
    expect(stamps.some((s) => s.stamp.includes('Tables/'))).toBe(true);
    expect(stamps.some((s) => /Chairs\/|Stools\/|Benches\//.test(s.stamp))).toBe(true);
    // The front door is on the street side.
    const facing = tavern.spec.facing;
    if (!facing) throw new Error('no facing');
    const front = planOf(tavern, made.doc.grid.size).doors.find((d) => d.outer);
    if (!front) throw new Error('no front door');
    const p = tavern.points;
    const mid = { x: ((p[0] ?? 0) + (p[4] ?? 0)) / 2, y: ((p[1] ?? 0) + (p[5] ?? 0)) / 2 };
    expect((front.x - mid.x) * facing.x + (front.y - mid.y) * facing.y).toBeGreaterThan(0);
  });

  it('each look paves its streets from the real packs', () => {
    const { doc } = townMap();
    for (const look of TOWN_LOOKS) {
      const made = buildTown(
        doc,
        ['d1'],
        { ...DEFAULT_TOWN, look: look.id, max: 4, seed: 1 },
        FA_ENTRIES,
        OPTIONS(doc),
      );
      const street = made?.doc.layers.at(doc.layers.length)?.items[0];
      expect(street?.kind === 'shape' ? street.texture : '', look.id).toMatch(/^pack:/);
    }
  });

  it('builds nothing on a map whose squares are too big for a house', () => {
    const { doc } = townMap();
    const coarse = { ...doc, grid: { ...doc.grid, size: doc.grid.size * 20 } };
    expect(
      buildTown(coarse, ['d1'], { ...DEFAULT_TOWN, seed: 1 }, FA_ENTRIES, OPTIONS(doc)),
    ).toBeNull();
  });
});

describe('a walled town', () => {
  it('is built whole from its market quarter or its outer district', () => {
    const start = newMap('Brindle', [], 'now', { w: 118, h: 92 });
    const items = generateTown(
      start,
      { x: start.width / 2, y: start.height / 2 },
      Math.min(start.width, start.height) * 0.4,
      3,
      1,
      (taken) => `t${String(taken.length)}`,
    );
    let doc = start;
    for (const i of items) doc = addItem(doc, doc.layers[0]?.id ?? '', i);
    const [outer, inner] = items;
    if (!outer || !inner) throw new Error('no town');
    // Picking either district finds both.
    expect(townDistricts(doc, inner.id).sort()).toEqual([outer.id, inner.id].sort());
    expect(townDistricts(doc, outer.id).sort()).toEqual([outer.id, inner.id].sort());
    const made = buildTown(
      doc,
      townDistricts(doc, inner.id),
      { ...DEFAULT_TOWN, max: 60, seed: 2 },
      FA_ENTRIES,
      OPTIONS(doc),
    );
    expect(made?.count).toBeGreaterThan(10);
    // One set of town layers, the streets of both districts paved.
    const added = made?.doc.layers.slice(doc.layers.length) ?? [];
    expect(added.filter((l) => l.name.endsWith('Ground floor'))).toHaveLength(1);
    expect(added[0]?.items.filter((i) => i.kind === 'shape').length).toBeGreaterThanOrEqual(2);
  });
});
