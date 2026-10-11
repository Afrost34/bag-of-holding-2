import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { isGlyphRef } from '../glyphs';
import { newMap, type BuildingSpec, type MapDoc, type MapItem } from '../model';
import { pointInPolygon } from '../polygon';
import { CLUTTER, RUIN, roomTypes, withFurnishing } from './furnish';
import {
  addStructure,
  floorsOf,
  newBuildingSpec,
  planOf,
  rerollRoom,
  structureParts,
  type StructureItem,
} from './structureDoc';

const CELL = 70;
const OPTIONS = { unit: CELL };

function tavern(
  more: Partial<Pick<BuildingSpec, 'dressing' | 'condition'>> = {},
  entries = FA_ENTRIES,
): { doc: MapDoc; ground: StructureItem } {
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
      ...more,
    },
    entries,
    11,
    12,
    OPTIONS,
  );
  const made = addStructure(doc, {
    spec,
    points: [2, 2, 12, 2, 12, 10, 2, 10].map((v) => v * CELL),
  });
  const ground = floorsOf(made.doc, made.group).find((f) => f.floor === 0);
  if (!ground) throw new Error('no ground floor');
  return { doc: made.doc, ground };
}

const furniture = (items: readonly MapItem[]) =>
  items.filter(
    (i): i is Extract<MapItem, { kind: 'stamp' }> => i.kind === 'stamp' && i.id.includes('~f'),
  );

describe('furnishing a building', () => {
  it('picks the furniture of every room type the archetype has, and clutter and rubble', () => {
    const { ground } = tavern();
    const keys = Object.keys(ground.spec.furnish ?? {});
    for (const type of roomTypes('tavern')) expect(keys).toContain(type);
    expect(keys).toContain(CLUTTER);
    expect(keys).toContain(RUIN);
    expect(ground.spec.furnish?.tavern?.some((r) => r.pieces.length > 0)).toBe(true);
  });

  it('furnishes each room inside its own walls', () => {
    const { doc, ground } = tavern();
    const parts = structureParts(doc, ground);
    const pieces = furniture(parts);
    expect(pieces.length).toBeGreaterThan(5);
    const rooms = new Map(
      parts.flatMap((p) => (p.kind === 'room' ? [[p.id.split('~r')[1] ?? '', p.points]] : [])),
    );
    for (const piece of pieces) {
      const roomId = piece.id.split('~f')[1]?.split('.')[0] ?? '';
      const outline = rooms.get(roomId);
      expect(outline, piece.id).toBeDefined();
      expect(pointInPolygon(piece, outline ?? [])).toBe(true);
    }
  });

  it('lays the same furniture from the same seed, and Furnish again changes only that room', () => {
    const { doc, ground } = tavern();
    const first = furniture(structureParts(doc, ground));
    const again = furniture(structureParts(doc, { ...ground }));
    expect(again).toEqual(first);
    const room = planOf(ground, CELL).rooms.find((r) => r.type === 'tavern');
    if (!room) throw new Error('no common room');
    const changed = rerollRoom(ground, CELL, room.id, 999);
    const after = furniture(structureParts(doc, changed));
    const mark = `~f${String(room.id)}.`;
    const others = (list: typeof first) => list.filter((p) => !p.id.includes(mark));
    expect(others(after)).toEqual(others(first));
    expect(after.filter((p) => p.id.includes(mark))).not.toEqual(
      first.filter((p) => p.id.includes(mark)),
    );
  });

  it('leaves the rooms bare, or adds clutter, as the building is dressed', () => {
    const lived = furniture(structureParts(tavern().doc, tavern().ground)).length;
    const bare = tavern({ dressing: 'bare' });
    expect(furniture(structureParts(bare.doc, bare.ground))).toHaveLength(0);
    const cluttered = tavern({ dressing: 'cluttered' });
    expect(furniture(structureParts(cluttered.doc, cluttered.ground)).length).toBeGreaterThan(
      lived,
    );
  });

  it('breaks or knocks over some pieces of a worn building, more of a ruined one', () => {
    const { doc, ground } = tavern();
    const kept = furniture(structureParts(doc, ground));
    const differ = (condition: BuildingSpec['condition']) => {
      const item = { ...ground, spec: { ...ground.spec, condition } };
      const aged = furniture(structureParts(doc, item));
      return aged.filter((p) => {
        const was = kept.find((k) => k.id === p.id);
        return was?.stamp !== p.stamp || was.rotation !== p.rotation || was.tint !== p.tint;
      }).length;
    };
    const worn = differ('worn');
    expect(worn).toBeGreaterThan(0);
    expect(differ('ruined')).toBeGreaterThan(worn);
  });

  it('draws the furniture without packs', () => {
    const { doc, ground } = tavern({}, []);
    const pieces = furniture(structureParts(doc, ground));
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.every((p) => isGlyphRef(p.stamp))).toBe(true);
  });

  it('adds furniture for a room type the building did not have', () => {
    const { ground } = tavern();
    expect(ground.spec.furnish?.['wizard-lab']).toBeUndefined();
    const spec = withFurnishing(ground.spec, ['wizard-lab'], FA_ENTRIES, OPTIONS);
    expect(spec.furnish?.['wizard-lab']?.length).toBeGreaterThan(0);
    expect(spec.furnish?.tavern).toBe(ground.spec.furnish?.tavern);
    expect(withFurnishing(spec, ['tavern'], FA_ENTRIES, OPTIONS)).toBe(spec);
  });
});
