import { describe, expect, it } from 'vitest';
import { cellsInPolygon, components } from './cells';
import { planDungeon, type DungeonLayout } from './dungeonplan';

const CELL = 70;
const AREA = [0, 0, 30 * CELL, 0, 30 * CELL, 22 * CELL, 0, 22 * CELL];
const LAYOUTS: DungeonLayout[] = ['rooms', 'packed', 'facility', 'caves'];

const plan = (layout: DungeonLayout, seed = 5) =>
  planDungeon({ footprint: AREA, cell: CELL, seed, rooms: 8, layout });

/** Which rooms can be walked to from the first, through doors. */
function reachable(p: ReturnType<typeof plan>): number {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const r = queue.pop() ?? 0;
    for (const d of p.doors)
      if (d.rooms.includes(r))
        for (const o of d.rooms)
          if (!seen.has(o)) {
            seen.add(o);
            queue.push(o);
          }
  }
  return seen.size;
}

describe('dungeon plans', () => {
  for (const layout of LAYOUTS)
    it(`${layout}: rooms inside the area, never sharing a cell, the same from the same seed`, () => {
      const p = plan(layout);
      const inside = cellsInPolygon(AREA, CELL);
      const all = p.rooms.flatMap((r) => r.cells);
      expect(p.rooms.length).toBeGreaterThan(1);
      expect(new Set(all).size).toBe(all.length);
      expect(all.every((c) => inside.has(c))).toBe(true);
      expect(planDungeon({ footprint: AREA, cell: CELL, seed: 5, rooms: 8, layout })).toEqual(p);
      expect(plan(layout, 6)).not.toEqual(p);
    });

  for (const layout of ['rooms', 'packed', 'facility'] as const)
    it(`${layout}: every room can be reached through doors`, () => {
      const p = plan(layout);
      expect(reachable(p)).toBe(p.rooms.length);
    });

  it('rooms: rooms apart from each other, joined by corridors', () => {
    const p = plan('rooms');
    const rooms = p.rooms.filter((r) => r.type !== 'corridor');
    const corridors = p.rooms.filter((r) => r.type === 'corridor');
    expect(rooms.length).toBeGreaterThanOrEqual(5);
    expect(corridors.length).toBeGreaterThan(0);
    // No door joins two rooms directly: they never touch.
    for (const d of p.doors)
      expect(d.rooms.some((i) => p.rooms[i]?.type === 'corridor')).toBe(true);
  });

  it('packed: the rooms fill the whole area, no corridors', () => {
    const p = plan('packed');
    expect(p.rooms.some((r) => r.type === 'corridor')).toBe(false);
    expect(p.rooms.flatMap((r) => r.cells)).toHaveLength(cellsInPolygon(AREA, CELL).size);
  });

  it('facility: a spine of corridors with rooms off it', () => {
    const p = plan('facility');
    const corridor = p.rooms.filter((r) => r.type === 'corridor');
    expect(corridor).toHaveLength(1);
    expect(corridor[0]?.cells.length).toBeGreaterThan(60);
    expect(p.rooms.length).toBeGreaterThan(6);
  });

  it('caves: one cave in a few caverns that open into each other', () => {
    const p = plan('caves');
    expect(p.doors).toHaveLength(0);
    expect(p.walls).toHaveLength(0);
    expect(components(new Set(p.rooms.flatMap((r) => r.cells)))).toHaveLength(1);
    expect(p.rooms.length).toBeGreaterThan(1);
  });

  it('keeps a locked room when the rest is planned again', () => {
    const first = plan('rooms');
    const room = first.rooms.find((r) => r.type !== 'corridor');
    if (!room) throw new Error('no room');
    const again = planDungeon({
      footprint: AREA,
      cell: CELL,
      seed: 99,
      rooms: 8,
      layout: 'rooms',
      locked: [{ ...room, type: 'treasury' }],
    });
    const kept = again.rooms.find((r) => r.id === room.id);
    expect(kept?.cells).toEqual(room.cells);
    expect(kept?.type).toBe('treasury');
    // Nothing else is built on it.
    const others = again.rooms.filter((r) => r.id !== room.id).flatMap((r) => r.cells);
    expect(others.some((c) => room.cells.includes(c))).toBe(false);
  });
});
