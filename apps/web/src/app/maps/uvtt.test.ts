import { describe, expect, it } from 'vitest';
import { addItem, newMap } from './model';
import { buildUvtt } from './uvtt';

describe('Universal VTT export', () => {
  const blank = newMap('Keep', [], '', { w: 10, h: 8 });
  const layer = blank.layers[0]?.id ?? '';
  const size = blank.grid.size;

  it('gives the map size and picture resolution in squares', () => {
    const out = buildUvtt(blank, 'AAAA', 256);
    expect(out.format).toBe(0.3);
    expect(out.resolution).toEqual({
      map_origin: { x: 0, y: 0 },
      map_size: { x: 10, y: 8 },
      pixels_per_grid: 256,
    });
    expect(out.image).toBe('AAAA');
  });

  it('lists walls and room outlines as lines of sight, in squares, and doors as portals', () => {
    let doc = addItem(blank, layer, { kind: 'wall', id: 'w', points: [0, 0, size * 3, 0] });
    doc = addItem(doc, layer, {
      kind: 'room',
      id: 'r',
      points: [0, size, size * 2, size, size * 2, size * 3, 0, size * 3],
      smooth: 0,
      floor: 'stone',
      wall: 12,
      wallStyle: 'stone',
      doors: [{ x: size, y: size, angle: 0, kind: 'door' }],
    });
    doc = addItem(doc, layer, {
      kind: 'stamp',
      id: 's',
      stamp: 'pack:p:X/Building/Doors/Door_A_1x1.webp',
      x: size * 5,
      y: 0,
      w: size,
      h: size,
      rotation: 90,
    });
    const out = buildUvtt(doc, '', 70);
    expect(out.line_of_sight[0]).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]);
    // The room's outline is closed.
    const room = out.line_of_sight[1] ?? [];
    expect(room[0]).toEqual(room.at(-1));
    expect(out.portals).toHaveLength(2);
    expect(out.portals[0]).toMatchObject({ position: { x: 1, y: 1 }, closed: true });
    expect(out.portals[1]?.rotation).toBeCloseTo(Math.PI / 2, 2);
  });
});
