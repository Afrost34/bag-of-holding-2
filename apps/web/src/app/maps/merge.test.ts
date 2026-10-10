import { describe, expect, it } from 'vitest';
import { mergeRooms, unionPolygons } from './merge';
import { addItem, newMap, type MapDoc } from './model';
import { polygonArea } from './spline';

const rect = (x: number, y: number, w: number, h: number) => [
  x,
  y,
  x + w,
  y,
  x + w,
  y + h,
  x,
  y + h,
];
const area = (p: number[] | null) => Math.abs(polygonArea(p ?? []));

describe('the union of two polygons', () => {
  it('of overlapping rectangles has the area of both less the overlap', () => {
    const merged = unionPolygons(rect(0, 0, 100, 100), rect(60, 40, 100, 100));
    expect(area(merged)).toBeCloseTo(100 * 100 + 100 * 100 - 40 * 60, 3);
    // An L-ish outline of eight corners.
    expect((merged?.length ?? 0) / 2).toBe(8);
  });

  it('of rectangles sharing a wall is one rectangle', () => {
    const merged = unionPolygons(rect(0, 0, 100, 100), rect(100, 0, 60, 100));
    expect(area(merged)).toBeCloseTo(160 * 100, 3);
    expect((merged?.length ?? 0) / 2).toBe(4);
  });

  it('of a room inside another is the bigger one', () => {
    expect(area(unionPolygons(rect(0, 0, 200, 200), rect(50, 50, 40, 40)))).toBeCloseTo(40000, 3);
    expect(area(unionPolygons(rect(50, 50, 40, 40), rect(0, 0, 200, 200)))).toBeCloseTo(40000, 3);
  });

  it('is nothing for rooms apart, or only touching at a corner', () => {
    expect(unionPolygons(rect(0, 0, 100, 100), rect(300, 300, 50, 50))).toBeNull();
  });

  it('does not depend on which way the corners run', () => {
    const a = rect(0, 0, 100, 100);
    // The second room's corners clockwise instead.
    const clockwise = [60, 40, 60, 140, 160, 140, 160, 40];
    expect(area(unionPolygons(a, clockwise))).toBeCloseTo(17600, 3);
    expect(area(unionPolygons(a, rect(60, 40, 100, 100)))).toBeCloseTo(17600, 3);
  });

  it('joins a triangle and a square', () => {
    const tri = [50, 50, 150, 50, 100, 150];
    const merged = unionPolygons(rect(0, 0, 100, 100), tri);
    expect(area(merged)).toBeGreaterThan(10000);
    expect(area(merged)).toBeLessThan(10000 + 5000);
  });
});

describe('merging rooms', () => {
  const room = (id: string, points: number[], doors: { x: number; y: number }[] = []) => ({
    kind: 'room' as const,
    id,
    points,
    smooth: 0,
    floor: 'stone' as const,
    wall: 8,
    wallStyle: 'stone' as const,
    doors: doors.map((d) => ({ ...d, angle: 0, kind: 'door' as const })),
  });
  const withRooms = (...rooms: ReturnType<typeof room>[]): { doc: MapDoc; ids: string[] } => {
    const blank = newMap('Rooms', [], '');
    let doc = blank;
    for (const r of rooms) doc = addItem(doc, blank.layers[0]?.id ?? '', r);
    return { doc, ids: rooms.map((r) => r.id) };
  };
  const roomsOf = (doc: MapDoc) =>
    doc.layers.flatMap((l) => l.items).filter((i) => i.kind === 'room');

  it('joins touching rooms into the first, keeping the doors that still stand in a wall', () => {
    const { doc, ids } = withRooms(
      room('a', rect(0, 0, 100, 100), [
        { x: 50, y: 0 },
        { x: 100, y: 50 },
      ]),
      room('b', rect(100, 0, 60, 100), [{ x: 130, y: 100 }]),
    );
    const merged = mergeRooms(doc, ids);
    const rooms = roomsOf(merged);
    expect(rooms).toHaveLength(1);
    const only = rooms[0];
    if (only?.kind !== 'room') throw new Error('room');
    expect(area(only.points)).toBeCloseTo(16000, 3);
    // The door between the two rooms is inside now; the other two are in the outer wall.
    expect(only.doors).toHaveLength(2);
  });

  it('leaves the map as it was when a room does not touch the rest', () => {
    const { doc, ids } = withRooms(
      room('a', rect(0, 0, 100, 100)),
      room('b', rect(400, 400, 50, 50)),
    );
    expect(mergeRooms(doc, ids)).toBe(doc);
    expect(mergeRooms(doc, ['a'])).toBe(doc);
  });
});
