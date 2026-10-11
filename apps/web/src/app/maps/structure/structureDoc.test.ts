import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { activeVariant, layerShown, newMap, type MapDoc } from '../model';
import { pointInPolygon } from '../polygon';
import { roomOutline } from '../rooms';
import {
  addStructure,
  bakeStructure,
  cutAllCorners,
  floorsOf,
  footprintOf,
  handlesOf,
  lockRoom,
  mergeFootprint,
  mergeRoomsOf,
  moveStructure,
  neighbours,
  newBuildingSpec,
  planOf,
  rollAgain,
  setRoomType,
  splitRoom,
  structureParts,
  updateGroup,
  withHandles,
  type StructureItem,
} from './structureDoc';

const CELL = 70;
const rect = (x: number, y: number, w: number, h: number) => [
  x * CELL,
  y * CELL,
  (x + w) * CELL,
  y * CELL,
  (x + w) * CELL,
  (y + h) * CELL,
  x * CELL,
  (y + h) * CELL,
];

function tavern(entries = FA_ENTRIES): { doc: MapDoc; id: string; group: string } {
  const doc = newMap('Town', [], 'now');
  const spec = newBuildingSpec(
    {
      archetype: 'tavern',
      style: 'timber',
      upper: 1,
      cellar: true,
      rooms: 4,
      windows: true,
      crooked: 0,
      name: 'Gull and Anchor',
    },
    entries,
    11,
    12,
    { unit: CELL },
  );
  return addStructure(doc, { spec, points: rect(2, 2, 10, 8) });
}

const item = (doc: MapDoc, id: string): StructureItem => {
  const found = doc.layers.flatMap((l) => l.items).find((i) => i.id === id);
  if (found?.kind !== 'structure') throw new Error(id);
  return found;
};

describe('making a building', () => {
  it('makes a layer and a floor for the cellar, the ground floor and the floor above', () => {
    const { doc, group } = tavern();
    const floors = floorsOf(doc, group);
    expect(floors.map((f) => f.floor)).toEqual([-1, 0, 1]);
    expect(doc.layers.map((l) => l.name).slice(-3)).toEqual([
      'Gull and Anchor – Cellar',
      'Gull and Anchor – Ground floor',
      'Gull and Anchor – First floor',
    ]);
    // A variant per floor; the ground floor is shown, the others not.
    expect(doc.variants?.map((v) => v.name)).toEqual([
      'Gull and Anchor: Cellar',
      'Gull and Anchor: Ground floor',
      'Gull and Anchor: First floor',
    ]);
    expect(activeVariant(doc)?.name).toBe('Gull and Anchor: Ground floor');
    const shown = doc.layers.filter((l) => layerShown(doc, l)).map((l) => l.name);
    expect(shown).toContain('Gull and Anchor – Ground floor');
    expect(shown).not.toContain('Gull and Anchor – First floor');
  });

  it('picks its pictures from the packs by its style', () => {
    const { doc, id } = tavern();
    const palette = item(doc, id).spec.palette;
    expect(palette.wall).toMatch(/PlasterWood|StoneWood/);
    expect(palette.floor).toMatch(/^pack:/);
    // Without packs, drawn floors and walls.
    const bare = tavern([]);
    expect(item(bare.doc, bare.id).spec.palette).toEqual({
      floor: 'wood',
      upperFloor: 'wood',
      cellarFloor: 'stone',
    });
  });

  it('gives the rooms the types of its programme: the biggest is the common room', () => {
    const { doc, id } = tavern();
    const plan = planOf(item(doc, id), CELL);
    const rooms = plan.rooms.filter((r) => r.type !== 'stairs');
    const biggest = [...rooms].sort((a, b) => b.cells.length - a.cells.length)[0];
    expect(biggest?.type).toBe('tavern');
    expect(rooms.map((r) => r.type)).toContain('kitchen');
  });
});

describe('a floor drawn as rooms and stamps', () => {
  it('has a room for each room of the plan, joined by doorways, and stairs', () => {
    const { doc: shown, id } = tavern([]);
    // Roofs off: under a roof the rooms have no doorways (they would be drawn over the roof).
    const doc = { ...shown, hideRoofs: true };
    const parts = structureParts(doc, item(doc, id));
    const rooms = parts.filter((p) => p.kind === 'room');
    expect(rooms).toHaveLength(planOf(item(doc, id), CELL).rooms.length);
    // Drawn doors (no packs).
    expect(rooms.some((r) => r.doors?.some((d) => d.kind === 'door'))).toBe(true);
    // The same items every time (the scene redraws only what changed).
    expect(structureParts(doc, item(doc, id))).toBe(parts);
  });

  it('with packs: door, window and stair pictures, and gaps in the walls for the doors', () => {
    const { doc, id } = tavern();
    // With the roofs off: under a roof the doors and windows are hidden with the rooms.
    const parts = structureParts({ ...doc, hideRoofs: true }, item(doc, id));
    const stamps = parts.filter((p) => p.kind === 'stamp');
    expect(stamps.some((s) => s.stamp.includes('/Doors/'))).toBe(true);
    expect(stamps.some((s) => s.id.endsWith('~stairs'))).toBe(true);
    const rooms = parts.filter((p) => p.kind === 'room');
    expect(rooms.every((r) => (r.doors ?? []).every((d) => d.kind === 'gap'))).toBe(true);
  });

  it('bakes into rooms, walls and stamps on each floor, with ids of their own', () => {
    const { doc, group } = tavern();
    // Baked as drawn with the roofs off (a baked roof would hide the rooms for good).
    const open = { ...doc, hideRoofs: true };
    const before = floorsOf(doc, group).map((f) => structureParts(open, f).length);
    const baked = bakeStructure(doc, group);
    expect(floorsOf(baked, group)).toHaveLength(0);
    const items = baked.layers.flatMap((l) => l.items);
    expect(items.filter((i) => ['room', 'stamp', 'wall'].includes(i.kind))).toHaveLength(
      before.reduce((a, b) => a + b, 0),
    );
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
});

describe('changing a building', () => {
  it('bends a wall when a corner is dragged, and the rooms move with it', () => {
    const { doc, id } = tavern([]);
    const floor = item(doc, id);
    const handles = handlesOf(floor, CELL);
    // Drag the first corner half a square out.
    const dragged = [...handles];
    dragged[0] = (dragged[0] ?? 0) - 35;
    dragged[1] = (dragged[1] ?? 0) - 35;
    const bent = withHandles(floor, dragged, CELL);
    expect(footprintOf(bent, CELL).slice(0, 2)).toEqual([2 * CELL - 35, 2 * CELL - 35]);
    // The room in that corner has its corner there too.
    const corner = structureParts(doc, bent)
      .filter((p) => p.kind === 'room')
      .map((r) => roomOutline(r.points, 0))
      .some((o) =>
        o.some((v, i) => i % 2 === 0 && v === 2 * CELL - 35 && o[i + 1] === 2 * CELL - 35),
      );
    expect(corner).toBe(true);
  });

  it('cuts the outward corners at 45°', () => {
    const { doc, id } = tavern([]);
    const cut = cutAllCorners(item(doc, id), true);
    expect(cut.chamfers).toEqual([0, 1, 2, 3]);
    expect(footprintOf(cut, CELL)).toHaveLength(16);
    expect(cutAllCorners(cut, false).chamfers).toBeUndefined();
  });

  it('grows by a dragged rectangle, on every floor', () => {
    const { doc, group } = tavern([]);
    const grown = mergeFootprint(doc, group, rect(12, 2, 4, 4));
    for (const f of floorsOf(grown, group)) expect(f.points).toHaveLength(12);
  });

  it('keeps a locked room when it is rolled again', () => {
    const { doc, id, group } = tavern([]);
    const floor = item(doc, id);
    const room = planOf(floor, CELL).rooms.find((r) => r.type === 'kitchen');
    if (!room) throw new Error('kitchen');
    const locked = lockRoom(floor, CELL, room.id, true);
    const withLock = {
      ...doc,
      layers: doc.layers.map((l) => ({
        ...l,
        items: l.items.map((i) => (i.id === id ? locked : i)),
      })),
    };
    const rolled = updateGroup(withLock, group, (i) => ({ ...i, spec: rollAgain(i.spec, 999) }));
    const plan = planOf(item(rolled, id), CELL);
    expect(plan.rooms.find((r) => r.id === room.id)?.cells).toEqual(room.cells);
    // The stairs stay too; the other rooms are cut anew.
    expect(plan.stairs).toEqual(planOf(floor, CELL).stairs);
  });

  it('splits a room in two, merges two rooms, and gives a room another type', () => {
    const { doc, id } = tavern([]);
    const floor = item(doc, id);
    const big = [...planOf(floor, CELL).rooms]
      .filter((r) => r.type !== 'stairs')
      .sort((a, b) => b.cells.length - a.cells.length)[0];
    if (!big) throw new Error('room');
    const split = splitRoom(floor, CELL, big.id);
    // The floor is kept as it was, with that room cut in two.
    const after = split ? planOf(split, CELL) : null;
    expect(after?.rooms.length).toBe(planOf(floor, CELL).rooms.length + 1);
    for (const r of planOf(floor, CELL).rooms)
      if (r.id !== big.id) expect(after?.rooms.find((x) => x.id === r.id)?.cells).toEqual(r.cells);
    const next = neighbours(floor, CELL, big.id)[0];
    if (!next) throw new Error('neighbour');
    const merged = mergeRoomsOf(floor, CELL, big.id, next.id);
    expect(merged && planOf(merged, CELL).rooms.find((r) => r.id === big.id)?.cells.length).toBe(
      big.cells.length + next.cells.length,
    );
    const study = setRoomType(floor, CELL, big.id, 'study');
    expect(planOf(study, CELL).rooms.find((r) => r.id === big.id)?.type).toBe('study');
  });

  it('moves by whole squares, its kept rooms with it', () => {
    const { doc, id } = tavern([]);
    const floor = item(doc, id);
    const room = planOf(floor, CELL).rooms.find((r) => r.type !== 'stairs');
    if (!room) throw new Error('room');
    const moved = moveStructure(lockRoom(floor, CELL, room.id, true), 100, 0, CELL);
    expect(moved.points[0]).toBe(2 * CELL + 70);
    expect(moved.rooms?.[0]?.cells[0]).toBe(
      room.cells[0]?.replace(/^(\d+)/, (n) => String(Number(n) + 1)),
    );
  });
});

describe('roofs', () => {
  it('puts a roof over the ground and upper floors, not the cellar, and takes it off with Hide roofs', () => {
    const { doc, group } = tavern();
    for (const f of floorsOf(doc, group)) {
      const roof = structureParts(doc, f).find((p) => p.kind === 'building');
      if (f.floor < 0) expect(roof).toBeUndefined();
      else expect(roof?.kind === 'building' && roof.roofTexture).toContain('Roof_Texture');
    }
    const open = { ...doc, hideRoofs: true };
    for (const f of floorsOf(doc, group))
      expect(structureParts(open, f).some((p) => p.kind === 'building')).toBe(false);
  });

  it('stands a chimney over each hearth, inside the building', () => {
    const { doc, id } = tavern();
    const ground = item(doc, id);
    const plan = planOf(ground, CELL);
    const hearths = plan.rooms.filter((r) =>
      ['kitchen', 'tavern', 'smithy', 'living-room', 'guardhouse'].includes(r.type),
    );
    const chimneys = structureParts(doc, ground).filter(
      (p) => p.kind === 'stamp' && p.stamp.includes('/Chimneys/'),
    );
    expect(chimneys.length).toBe(hearths.length);
    const outline = footprintOf(ground, CELL);
    for (const c of chimneys) if (c.kind === 'stamp') expect(pointInPolygon(c, outline)).toBe(true);
  });

  it('gives working rooms on the ground floor the hard floor', () => {
    const { doc, id } = tavern();
    const ground = item(doc, id);
    const plan = planOf(ground, CELL);
    const kitchen = plan.rooms.find((r) => r.type === 'kitchen');
    if (!kitchen) throw new Error('no kitchen');
    const part = structureParts(doc, ground).find((p) => p.id === `${id}~r${String(kitchen.id)}`);
    expect(part?.kind === 'room' && part.floor).toBe(ground.spec.palette.hardFloor);
    expect(ground.spec.palette.hardFloor).not.toBe(ground.spec.palette.floor);
  });
});
