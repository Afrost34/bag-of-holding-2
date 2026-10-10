import { describe, expect, it } from 'vitest';
import { addItem, newMap } from './model';
import {
  doorOnWall,
  generateCave,
  generateDungeon,
  isPortalPicture,
  planBounds,
  portalOnWalls,
  rectPolygon,
} from './rooms';
import { pointInPolygon } from './polygon';
import { polygonArea } from './spline';

describe('doors on walls', () => {
  const room = rectPolygon(0, 0, 200, 100);

  it('go on the nearest wall, along it, only when the click is close enough', () => {
    const top = doorOnWall(room, { x: 80, y: 6 }, 20);
    expect(top).toEqual({ x: 80, y: 0, angle: 0 });
    const side = doorOnWall(room, { x: 196, y: 40 }, 20);
    expect(side?.x).toBe(200);
    expect(Math.abs(side?.angle ?? 0)).toBeCloseTo(Math.PI / 2, 5);
    expect(doorOnWall(room, { x: 100, y: 50 }, 20)).toBeNull();
  });
});

describe('a generated dungeon', () => {
  const req = { x: 0, y: 0, width: 1400, height: 1000, cell: 70, rooms: 8, seed: 3 };

  it('is the same for a seed, and different for another', () => {
    expect(generateDungeon(req)).toEqual(generateDungeon(req));
    expect(generateDungeon({ ...req, seed: 4 })).not.toEqual(generateDungeon(req));
  });

  it('has rooms of whole cells that do not touch, joined by corridors with doors', () => {
    const plan = generateDungeon(req);
    const rooms = plan.filter((p) => !p.corridor);
    const corridors = plan.filter((p) => p.corridor);
    expect(rooms.length).toBeGreaterThanOrEqual(5);
    expect(corridors.length).toBeGreaterThanOrEqual(rooms.length - 1);
    for (const r of rooms) {
      const b = planBounds([r]);
      expect((b.x1 - b.x0) % 70).toBe(0);
      expect((b.y1 - b.y0) % 70).toBe(0);
      expect(b.x0).toBeGreaterThanOrEqual(0);
      expect(b.x1).toBeLessThanOrEqual(1400);
    }
    // Every room but the lonely case has a door on its own wall.
    for (const r of rooms) {
      for (const d of r.doors) {
        const b = planBounds([r]);
        const onEdge =
          Math.abs(d.x - b.x0) < 1 ||
          Math.abs(d.x - b.x1) < 1 ||
          Math.abs(d.y - b.y0) < 1 ||
          Math.abs(d.y - b.y1) < 1;
        expect(onEdge).toBe(true);
      }
    }
    expect(rooms.filter((r) => r.doors.length > 0).length).toBeGreaterThanOrEqual(rooms.length - 1);
    // No two rooms overlap.
    for (let i = 0; i < rooms.length; i++)
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];
        if (!a || !b) continue;
        const ca = { x: (a.points[0] ?? 0) + 1, y: (a.points[1] ?? 0) + 1 };
        expect(pointInPolygon(ca, b.points)).toBe(false);
      }
  });

  it('keeps going when the area is tiny', () => {
    expect(generateDungeon({ ...req, width: 100, height: 100 }).length).toBeLessThanOrEqual(1);
  });
});

describe('a cave', () => {
  it('is a ragged blob round its middle', () => {
    const cave = generateCave(500, 500, 200, 9);
    expect(cave.length).toBeGreaterThan(80);
    expect(Math.abs(polygonArea(cave))).toBeGreaterThan(20000);
    expect(pointInPolygon({ x: 500, y: 500 }, cave)).toBe(true);
  });
});

describe('doors and windows of a pack', () => {
  it('snap to the nearest wall, drawn or of a room, and turn along it', () => {
    const blank = newMap('Walls', [], '');
    const doc = addItem(blank, blank.layers[0]?.id ?? '', {
      kind: 'wall',
      id: 'w1',
      points: [0, 0, 200, 0],
    });
    const at = portalOnWalls(doc, { x: 80, y: 12 }, 20);
    expect(at).toMatchObject({ x: 80, y: 0 });
    expect(at?.angle).toBeCloseTo(0);
    expect(portalOnWalls(doc, { x: 80, y: 60 }, 20)).toBeNull();
  });

  it('knows which pictures are doors and windows', () => {
    expect(isPortalPicture('pack:a:X/Building/Doors/Door_Metal_Gray_A_1x1.webp')).toBe(true);
    expect(isPortalPicture('pack:a:X/Building/Windows/Small_Windows/W_1x1.webp')).toBe(true);
    expect(isPortalPicture('pack:a:X/Building/Doors/Addons/Lock_1x1.webp')).toBe(false);
    expect(isPortalPicture('pack:a:X/Furniture/Chair_1x1.webp')).toBe(false);
  });
});
