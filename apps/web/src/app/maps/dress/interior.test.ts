import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { addItem, newMap, type MapItem } from '../model';
import { makeScatter, roomDoors, scatterOf, pieceBox } from '../scatterDoc';
import { seeded } from '../terrain';
import {
  backTowards,
  boxCorners,
  boxesOverlap,
  distanceToBox,
  faceTowards,
  walkable,
  wallsOf,
  type Box,
} from './interior';
import { FURNISH_RECIPES, recipeById } from './recipes';
import { settingsFor } from './settings';

const square = (x: number, y: number, w: number, h = w) => [x, y, x + w, y, x + w, y + h, x, y + h];

describe('geometry', () => {
  it('tells when two turned boxes overlap', () => {
    const a: Box = { x: 0, y: 0, w: 100, h: 20, angle: 0 };
    expect(boxesOverlap(a, { x: 0, y: 30, w: 100, h: 20, angle: 0 })).toBe(false);
    expect(boxesOverlap(a, { x: 0, y: 15, w: 100, h: 20, angle: 0 })).toBe(true);
    // Turned a quarter, a long box crosses a flat one.
    expect(boxesOverlap(a, { x: 40, y: 0, w: 100, h: 10, angle: Math.PI / 2 })).toBe(true);
    expect(boxesOverlap(a, { x: 80, y: 80, w: 20, h: 20, angle: Math.PI / 4 })).toBe(false);
  });

  it('measures how far a point is from a box', () => {
    const b: Box = { x: 0, y: 0, w: 40, h: 20, angle: 0 };
    expect(distanceToBox({ x: 0, y: 0 }, b)).toBe(0);
    expect(distanceToBox({ x: 30, y: 0 }, b)).toBe(10);
    expect(boxCorners(b)[0]).toEqual({ x: -20, y: -10 });
  });

  it('finds the walls of a floor and which way is in', () => {
    const walls = wallsOf(square(0, 0, 100));
    expect(walls).toHaveLength(4);
    // The top wall runs along x; in is down.
    expect(walls[0]).toMatchObject({ ux: 1, uy: 0, length: 100 });
    expect(walls[0]?.ny).toBeCloseTo(1);
  });

  it('turns a picture back to a wall, or facing a point (Forgotten Adventures art faces down)', () => {
    // Back to a wall above: as drawn.
    expect(backTowards(0, -1)).toBeCloseTo(0);
    // Back to a wall on the left: turned a quarter clockwise.
    expect(backTowards(-1, 0)).toBeCloseTo(-Math.PI / 2);
    // Facing down: as drawn; facing up: half a turn.
    expect(faceTowards(0, 1)).toBeCloseTo(0);
    expect(Math.abs(faceTowards(0, -1))).toBeCloseTo(Math.PI);
  });
});

/** A room of `w` × `h` squares (70 px) with a door in the middle of its bottom wall. */
function furnished(recipeId: string, w = 8, h = 6, seed = 3) {
  const start = newMap('Inn', [], 'now');
  const layer = start.layers[0]?.id ?? '';
  const room: Extract<MapItem, { kind: 'room' }> = {
    kind: 'room',
    id: 'room',
    points: square(0, 0, w * 70, h * 70),
    smooth: 0,
    floor: 'wood',
    wall: 12,
    wallStyle: 'stone',
    doors: [{ x: (w * 70) / 2, y: h * 70, angle: 0, kind: 'door' }],
  };
  let doc = addItem(start, layer, room);
  const recipe = recipeById(recipeId);
  if (!recipe) throw new Error(recipeId);
  const settings = settingsFor(recipe, FA_ENTRIES, { unit: 70 });
  const item = makeScatter('f', settings, { points: [], within: 'room' }, seed);
  doc = addItem(doc, layer, item);
  const pieces = scatterOf(doc, item);
  const boxes = pieces.map((p) => {
    const rule = item.rules[p.rule];
    if (!rule) throw new Error('rule');
    const { w: bw, h: bh } = pieceBox(doc, rule, p);
    return {
      box: { x: p.x, y: p.y, w: bw, h: bh, angle: p.angle },
      place: rule.place,
      rule: p.rule,
    };
  });
  return { doc, item, pieces, boxes, room };
}

describe('furnishing rooms', () => {
  it('lays a common room: tables in the middle, seats round them facing in, a setting at each', () => {
    const { item, boxes } = furnished('tavern');
    const places = item.rules.map((r) => r.place);
    expect(places.slice(0, 3)).toEqual(['centre', 'around', 'setting']);
    const tables = boxes.filter((b) => b.place === 'centre');
    const seats = boxes.filter((b) => b.place === 'around');
    expect(tables.length).toBeGreaterThan(0);
    expect(seats.length).toBeGreaterThanOrEqual(tables.length * 2);
    expect(boxes.filter((b) => b.place === 'setting')).toHaveLength(seats.length);
    // Each seat's front (the bottom of its picture) points at a table.
    for (const s of seats) {
      const front = { x: -Math.sin(s.box.angle), y: Math.cos(s.box.angle) };
      // The table it sits at: the one whose edge is nearest.
      const nearest = tables.reduce((a, b) =>
        distanceToBox(s.box, b.box) < distanceToBox(s.box, a.box) ? b : a,
      );
      const to = { x: nearest.box.x - s.box.x, y: nearest.box.y - s.box.y };
      const len = Math.hypot(to.x, to.y);
      expect((front.x * to.x + front.y * to.y) / len).toBeGreaterThan(0.8);
    }
  });

  it('puts wall pieces with their backs to a wall, inside the floor', () => {
    const { boxes, room } = furnished('storage');
    const stock = boxes.filter((b) => b.place === 'wall');
    expect(stock.length).toBeGreaterThan(4);
    const outline = room.points;
    const near = (b: Box) => {
      const back = {
        x: b.x + Math.sin(b.angle) * (b.h / 2),
        y: b.y - Math.cos(b.angle) * (b.h / 2),
      };
      // The middle of its back is on a wall (within the wall's thickness).
      return Math.min(back.x, back.y, 560 - back.x, 420 - back.y) < 12;
    };
    for (const s of stock) expect(near(s.box)).toBe(true);
    expect(outline.length).toBe(8);
  });

  it('never overlaps pieces, except a rug under them and seats tucked under a table', () => {
    for (const id of ['tavern', 'bedroom', 'barracks', 'study', 'kitchen', 'throne-room']) {
      const { item, boxes } = furnished(id);
      const solid = boxes.filter((b) => !item.rules[b.rule]?.floor);
      for (let i = 0; i < solid.length; i++)
        for (let j = i + 1; j < solid.length; j++) {
          const a = solid[i];
          const b = solid[j];
          if (!a || !b) continue;
          const related =
            ['around', 'on', 'setting'].includes(a.place) ||
            ['around', 'on', 'setting'].includes(b.place);
          if (!related)
            expect(boxesOverlap(a.box, b.box, 1), `${id}: ${String(i)} and ${String(j)}`).toBe(
              false,
            );
        }
    }
  });

  it('keeps doorways free and a way from every door to the middle', () => {
    for (const id of FURNISH_RECIPES.map((r) => r.id)) {
      const { doc, boxes, room } = furnished(id);
      const doors = roomDoors(doc, room);
      for (const b of boxes)
        if (b.place !== 'on' && b.place !== 'setting')
          for (const d of doors) expect(distanceToBox(d, b.box), id).toBeGreaterThan(60);
      const floor = square(6, 6, 560 - 12, 420 - 12);
      const solid = boxes.filter((b) => !['on', 'setting'].includes(b.place)).map((b) => b.box);
      expect(walkable(floor, doors, solid, 70), id).toBe(true);
    }
  });

  it('gives the same furniture for the same seed and other furniture for another', () => {
    const a = furnished('tavern', 8, 6, 5).pieces;
    expect(furnished('tavern', 8, 6, 5).pieces).toEqual(a);
    expect(furnished('tavern', 8, 6, 6).pieces).not.toEqual(a);
  });

  it('furnishes a small room with fewer pieces', () => {
    const big = furnished('storage', 10, 8).pieces.length;
    const small = furnished('storage', 4, 3).pieces.length;
    expect(small).toBeLessThan(big);
    expect(small).toBeGreaterThan(0);
  });

  it('follows the room when it is reshaped', () => {
    const { doc, item } = furnished('bedroom');
    const moved = {
      ...doc,
      layers: doc.layers.map((l) => ({
        ...l,
        items: l.items.map((i) =>
          i.kind === 'room' ? { ...i, points: square(700, 700, 560, 420), doors: [] } : i,
        ),
      })),
    };
    expect(scatterOf(moved, item).every((p) => p.x > 700 && p.y > 700)).toBe(true);
  });

  it('works with drawn glyphs when no pack is imported', () => {
    const start = newMap('Inn', [], 'now');
    const layer = start.layers[0]?.id ?? '';
    let doc = addItem(start, layer, {
      kind: 'room',
      id: 'room',
      points: square(0, 0, 560, 420),
      smooth: 0,
      floor: 'wood',
      wall: 12,
      wallStyle: 'stone',
    });
    const recipe = recipeById('tavern');
    if (!recipe) throw new Error('tavern');
    const item = makeScatter(
      'f',
      settingsFor(recipe, [], { unit: 70 }),
      { points: [], within: 'room' },
      1,
    );
    doc = addItem(doc, layer, item);
    const pieces = scatterOf(doc, item);
    expect(pieces.length).toBeGreaterThan(3);
    expect(item.rules.every((r) => r.pieces.every((p) => p.ref.startsWith('glyph:')))).toBe(true);
  });
});

describe('random numbers', () => {
  it('are repeatable', () => {
    const a = seeded(4);
    const b = seeded(4);
    expect([a(), a()]).toEqual([b(), b()]);
  });
});
