import { describe, expect, it } from 'vitest';
import { cellKey, cellsInPolygon, cellsOfRects, components, traceCells } from './cells';
import { clipSegment, planFloor, stairwell, type FloorPlan, type FloorRequest } from './floorplan';
import { nearestOnPolyline } from '../spline';

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

describe('cells', () => {
  it('covers a rectangle with its cells and outlines it again', () => {
    const cells = cellsInPolygon(rect(2, 3, 4, 2), CELL);
    expect(cells.size).toBe(8);
    expect(cells.has(cellKey(2, 3))).toBe(true);
    expect(traceCells(cells, CELL)).toEqual(rect(2, 3, 4, 2));
  });

  it('outlines an L of cells with its six corners', () => {
    const cells = cellsOfRects([
      { x: 0, y: 0, w: 4, h: 2 },
      { x: 0, y: 2, w: 2, h: 3 },
    ]);
    expect(traceCells(cells, CELL)).toHaveLength(12);
    expect(components(cells)).toHaveLength(1);
  });

  it('cuts a segment to the part inside a polygon', () => {
    expect(clipSegment([-100, 50, 500, 50], rect(0, 0, 4, 2))).toEqual([[0, 50, 280, 50]]);
  });
});

function request(over: Partial<FloorRequest> = {}): FloorRequest {
  return {
    footprint: rect(0, 0, 10, 8),
    cell: CELL,
    seed: 7,
    floor: 0,
    rooms: 5,
    stairs: true,
    entrance: true,
    windows: true,
    ...over,
  };
}

/** Which rooms can be reached from the room with the front door, through doors. */
function reachable(plan: FloorPlan): Set<number> {
  const front = plan.doors.find((d) => d.outer)?.rooms[0] ?? 0;
  const seen = new Set([front]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of plan.doors) {
      const [a, b] = d.rooms;
      if (a === undefined || b === undefined) continue;
      if (seen.has(a) !== seen.has(b)) {
        seen.add(a);
        seen.add(b);
        grew = true;
      }
    }
  }
  return seen;
}

describe('a floor plan', () => {
  it('is the same for the same seed, and another for another', () => {
    expect(planFloor(request())).toEqual(planFloor(request()));
    expect(planFloor(request({ seed: 8 }))).not.toEqual(planFloor(request()));
  });

  it('tiles the footprint with rooms of 2 × 2 cells at least, none overlapping', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = planFloor(request({ seed }));
      const all = plan.rooms.flatMap((r) => r.cells);
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBe(80);
      for (const r of plan.rooms) {
        if (r.type === 'stairs') continue;
        const xs = r.cells.map((k) => Number(k.split(',')[0]));
        const ys = r.cells.map((k) => Number(k.split(',')[1]));
        expect(Math.max(...xs) - Math.min(...xs) + 1).toBeGreaterThanOrEqual(2);
        expect(Math.max(...ys) - Math.min(...ys) + 1).toBeGreaterThanOrEqual(2);
      }
      expect(plan.rooms.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('can reach every room from the front door', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const plan = planFloor(request({ seed, rooms: 7 }));
      expect(plan.doors.filter((d) => d.outer)).toHaveLength(1);
      expect(reachable(plan).size).toBe(plan.rooms.length);
    }
  });

  it('puts inner doors on the wall between the rooms they join, and the front door on the outside', () => {
    const plan = planFloor(request({ seed: 3 }));
    for (const d of plan.doors) {
      if (d.outer) {
        const ring = [...rect(0, 0, 10, 8), 0, 0];
        expect(nearestOnPolyline(ring, d).dist).toBeLessThan(1e-6);
        continue;
      }
      // On a cell line: one coordinate a whole number of cells, the other a half.
      const onX = Math.abs(d.x / CELL - Math.round(d.x / CELL)) < 1e-9;
      const onY = Math.abs(d.y / CELL - Math.round(d.y / CELL)) < 1e-9;
      expect(onX || onY).toBe(true);
    }
  });

  it('keeps the stairwell in the same cells on every floor', () => {
    const ground = planFloor(request({ floor: 0 }));
    const up = planFloor(request({ floor: 1, entrance: false }));
    const cellar = planFloor(request({ floor: -1, entrance: false, windows: false }));
    expect(ground.stairs.length).toBeGreaterThanOrEqual(3);
    expect(up.stairs).toEqual(ground.stairs);
    expect(cellar.stairs).toEqual(ground.stairs);
    expect(cellar.windows).toEqual([]);
    expect(up.doors.some((d) => d.outer)).toBe(false);
  });

  it('keeps a locked room as it is, and cuts the rest again', () => {
    const plan = planFloor(request());
    const keep = plan.rooms.find((r) => r.type !== 'stairs');
    if (!keep) throw new Error('room');
    const again = planFloor(request({ seed: 99, locked: [{ ...keep, type: 'kitchen' }] }));
    const kept = again.rooms.find((r) => r.id === keep.id);
    expect(kept?.cells).toEqual(keep.cells);
    expect(kept?.type).toBe('kitchen');
    expect(kept?.locked).toBe(true);
  });

  it('puts windows on the outer walls, away from the front door', () => {
    const plan = planFloor(request());
    expect(plan.windows.length).toBeGreaterThan(0);
    const ring = [...rect(0, 0, 10, 8), 0, 0];
    const front = plan.doors.find((d) => d.outer);
    for (const w of plan.windows) {
      expect(nearestOnPolyline(ring, w).dist).toBeLessThan(1e-6);
      if (front)
        expect(Math.hypot(w.x - front.x, w.y - front.y)).toBeGreaterThanOrEqual(CELL * 1.5);
    }
  });

  it('plans an L-shaped building', () => {
    const footprint = traceCells(
      cellsOfRects([
        { x: 0, y: 0, w: 8, h: 4 },
        { x: 0, y: 4, w: 4, h: 4 },
      ]),
      CELL,
    );
    const plan = planFloor(request({ footprint, rooms: 4 }));
    expect(plan.rooms.flatMap((r) => r.cells)).toHaveLength(48);
    expect(reachable(plan).size).toBe(plan.rooms.length);
  });

  it('finds no stairwell in a tiny building', () => {
    expect(stairwell(cellsInPolygon(rect(0, 0, 3, 3), CELL), 1)).toEqual([]);
  });
});
