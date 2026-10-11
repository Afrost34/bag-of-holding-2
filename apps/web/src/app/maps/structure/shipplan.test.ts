import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { newMap, type BuildingSpec, type MapDoc, type MapItem } from '../model';
import { pointInPolygon } from '../polygon';
import { boxFrame, hullOutline, shipFrame, shipParts, SOLAR } from './shipplan';
import { addStructure, floorsOf, newBuildingSpec, planOf, structureParts } from './structureDoc';

const CELL = 70;
const BOX = { x0: 4 * CELL, y0: 2 * CELL, x1: 12 * CELL, y1: 26 * CELL };

function ship(
  archetype: string,
  medium: 'sea' | 'sky' = 'sea',
  cellar = true,
): { doc: MapDoc; group: string; spec: BuildingSpec; hull: number[] } {
  const hull = hullOutline(boxFrame(BOX, 0));
  const spec = newBuildingSpec(
    {
      archetype,
      style: 'ship',
      upper: 0,
      cellar,
      rooms: 3,
      windows: false,
      crooked: 0,
      medium,
      heading: 0,
    },
    FA_ENTRIES,
    7,
    12,
    { unit: CELL },
  );
  const made = addStructure(newMap('Harbour', [], 'now'), { spec, points: hull });
  return { doc: { ...made.doc, hideRoofs: false }, group: made.group, spec, hull };
}

const stamps = (items: readonly MapItem[]) =>
  items.filter((i): i is Extract<MapItem, { kind: 'stamp' }> => i.kind === 'stamp');

describe('ship hulls', () => {
  it('point their bow the way they head, inside the box drawn, symmetric about the keel', () => {
    for (const heading of [0, 90, 180, 270] as const) {
      const f = boxFrame(BOX, heading);
      const hull = hullOutline(f);
      for (let i = 0; i + 1 < hull.length; i += 2) {
        expect(hull[i]).toBeGreaterThanOrEqual(BOX.x0 - 1);
        expect(hull[i]).toBeLessThanOrEqual(BOX.x1 + 1);
      }
      // The bow tip is the point furthest forward.
      let best = -Infinity;
      for (let i = 0; i + 1 < hull.length; i += 2)
        best = Math.max(best, (hull[i] ?? 0) * f.fx + (hull[i + 1] ?? 0) * f.fy);
      const tip = (f.cx + (f.fx * f.length) / 2) * f.fx + (f.cy + (f.fy * f.length) / 2) * f.fy;
      expect(best).toBeCloseTo(tip, -1);
    }
    const f = boxFrame(BOX, 0);
    const hull = hullOutline(f);
    const xs = hull.filter((_, i) => i % 2 === 0).sort((a, b) => a - b);
    const mirrored = xs.map((x) => 2 * f.cx - x).sort((a, b) => a - b);
    expect(mirrored.map(Math.round)).toEqual(xs.map(Math.round));
  });

  it('give back the same frame from the hull', () => {
    const f = boxFrame(BOX, 90);
    const g = shipFrame(hullOutline(f), 90);
    expect(g.length).toBeCloseTo(f.length, -1);
    expect(g.fx).toBe(1);
  });
});

describe('ships', () => {
  it('have a main deck and a deck below, with the ladder in the same cells on both', () => {
    const { doc, group } = ship('skiff');
    const decks = floorsOf(doc, group);
    expect(decks.map((d) => d.floor)).toEqual([-1, 0]);
    const plans = decks.map((d) => planOf(d, CELL));
    expect(plans[0]?.stairs.length).toBeGreaterThan(0);
    expect(plans[1]?.stairs).toEqual(plans[0]?.stairs);
    expect(plans[1]?.rooms.map((r) => r.type)).toEqual(['deck', 'captain-cabin']);
  });

  it('carry masts, sails across the deck, cannons on both sides, an anchor at sea', () => {
    const { doc, group, hull } = ship('warship');
    const deck = floorsOf(doc, group).find((d) => d.floor === 0);
    if (!deck) throw new Error('no deck');
    const parts = stamps(structureParts(doc, deck));
    const named = (word: string) => parts.filter((p) => p.stamp.includes(word));
    expect(named('/Masts/Mast_Wood')).toHaveLength(3);
    expect(named('Sail_Yard')).toHaveLength(3);
    expect(named('Cannon_Metal')).toHaveLength(14);
    expect(named('Anchor')).toHaveLength(1);
    // Cannons stand on the deck, their muzzles turned out to their side.
    for (const c of named('Cannon_Metal')) {
      expect(pointInPolygon(c, hull)).toBe(true);
      expect(c.rotation === 90 || c.rotation === 270).toBe(true);
    }
    // The hull is one room, its rim the Aquatic hull wall.
    const room = structureParts(doc, deck).find((p) => p.kind === 'room');
    expect(room?.kind === 'room' && room.wallTexture).toContain('Ship_Hull_Wall');
  });

  it('take in their sails when the roofs are hidden', () => {
    const { doc, group } = ship('skiff');
    const deck = floorsOf(doc, group).find((d) => d.floor === 0);
    if (!deck) throw new Error('no deck');
    const open = { ...doc, hideRoofs: true };
    expect(stamps(structureParts(open, deck)).some((p) => p.stamp.includes('Sail'))).toBe(false);
    expect(stamps(structureParts(open, deck)).some((p) => p.stamp.includes('Mast_Wood'))).toBe(
      true,
    );
  });

  it('in the sky: golden sails, no anchor, an engine room below round a shard core', () => {
    const { doc, group, spec, hull } = ship('corsair', 'sky');
    const parts = shipParts('s', spec, hull, CELL, { sails: true });
    expect(parts.filter((p) => p.stamp.includes('Sail')).every((p) => p.tint === SOLAR)).toBe(true);
    expect(parts.some((p) => p.stamp.includes('Anchor'))).toBe(false);
    const below = floorsOf(doc, group).find((d) => d.floor === -1);
    if (!below) throw new Error('no deck below');
    expect(planOf(below, CELL).rooms.some((r) => r.type === 'engine-room')).toBe(true);
    const open = { ...doc, hideRoofs: true };
    expect(stamps(structureParts(open, below)).some((p) => p.stamp.includes('Light_Crystal'))).toBe(
      true,
    );
  });

  it('a small boat is its picture, filling the box', () => {
    const { spec, hull } = ship('rowboat', 'sea', false);
    const parts = shipParts('b', spec, hull, CELL, { sails: true });
    expect(parts).toHaveLength(1);
    expect(parts[0]?.stamp).toContain('Rowboat');
    expect(parts[0]?.h).toBe(BOX.y1 - BOX.y0);
  });
});
