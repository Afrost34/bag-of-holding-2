import { describe, expect, it } from 'vitest';
import { lightSegments, visibilityPolygon, type Segment } from './lighting';
import { addItem, newMap } from './model';

const wall = (ax: number, ay: number, bx: number, by: number): Segment => ({ ax, ay, bx, by });

/** Whether a point is inside a polygon of x, y pairs. */
function inside(poly: readonly number[], px: number, py: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i] ?? 0;
    const yi = poly[i + 1] ?? 0;
    const xj = poly[j] ?? 0;
    const yj = poly[j + 1] ?? 0;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe('the area a light sees', () => {
  it('is a square round the light when nothing is in the way', () => {
    const poly = visibilityPolygon(0, 0, 100, []);
    expect(inside(poly, 50, 50)).toBe(true);
    expect(inside(poly, -90, 20)).toBe(true);
    expect(inside(poly, 200, 0)).toBe(false);
  });

  it('stops at a wall and leaves what is behind it dark', () => {
    // A wall to the right of the light, across its way.
    const poly = visibilityPolygon(0, 0, 200, [wall(50, -100, 50, 100)]);
    expect(inside(poly, 30, 0)).toBe(true);
    expect(inside(poly, 120, 0)).toBe(false);
    // Beside the wall's end it still shines.
    expect(inside(poly, 80, 200)).toBe(true);
    expect(inside(poly, 120, 150)).toBe(false);
    expect(inside(poly, -120, 0)).toBe(true);
  });

  it('shines through the gap between two walls', () => {
    const walls = [wall(50, -100, 50, -10), wall(50, 10, 50, 100)];
    const poly = visibilityPolygon(0, 0, 200, walls);
    expect(inside(poly, 120, 0)).toBe(true);
    expect(inside(poly, 120, 60)).toBe(false);
  });
});

describe('what blocks light', () => {
  it('takes walls and rooms, shut at doors and open at archways', () => {
    let doc = newMap('Keep', [], '');
    const layer = doc.layers[0]?.id ?? '';
    doc = addItem(doc, layer, { kind: 'wall', id: 'w', points: [0, 0, 100, 0, 100, 100] });
    expect(lightSegments(doc)).toHaveLength(2);
    const room = (id: string, kind: 'door' | 'arch') => ({
      kind: 'room' as const,
      id,
      points: [0, 200, 140, 200, 140, 340, 0, 340],
      smooth: 0,
      floor: 'stone' as never,
      wall: 6,
      wallStyle: 'stone' as const,
      doors: [{ x: 70, y: 200, angle: 0, kind }],
    });
    const closed = addItem(doc, layer, room('r', 'door'));
    expect(lightSegments(closed)).toHaveLength(2 + 4);
    const open = addItem(doc, layer, room('r', 'arch'));
    // The top wall is split in two by the archway: one more segment.
    expect(lightSegments(open)).toHaveLength(2 + 5);
  });

  it('leaves out hidden layers', () => {
    let doc = newMap('Hidden', [], '');
    const layer = doc.layers[0]?.id ?? '';
    doc = addItem(doc, layer, { kind: 'wall', id: 'w', points: [0, 0, 100, 0] });
    doc = { ...doc, layers: doc.layers.map((l) => ({ ...l, visible: false })) };
    expect(lightSegments(doc)).toHaveLength(0);
  });
});
