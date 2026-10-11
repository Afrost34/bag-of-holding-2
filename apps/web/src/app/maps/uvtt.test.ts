import { describe, expect, it } from 'vitest';
import { addItem, newMap, type MapDoc, type MapItem } from './model';
import { buildUvtt } from './uvtt';

describe('Universal VTT export', () => {
  const blank = newMap('V', [], '', { w: 20, h: 10 });
  const layer = blank.layers[0]?.id ?? '';
  const add = (doc: MapDoc, item: MapItem) => addItem(doc, layer, item);

  it('sizes the map in squares and carries the picture', () => {
    const u = buildUvtt(blank, 'QUJD', 100);
    expect(u.format).toBe(0.3);
    expect(u.resolution).toEqual({
      map_origin: { x: 0, y: 0 },
      map_size: { x: 20, y: 10 },
      pixels_per_grid: 100,
    });
    expect(u.image).toBe('QUJD');
    expect(u.environment).toEqual({ baked_lighting: false, ambient_light: 'ffffffff' });
  });

  it('turns walls and rooms into sight lines, closing a loop', () => {
    let d = add(blank, { kind: 'wall', id: 'w', points: [0, 0, 140, 0, 140, 70] });
    d = add(d, { kind: 'wall', id: 'w2', points: [0, 0, 70, 0, 70, 70], loop: true });
    const u = buildUvtt(d, '', 70);
    expect(u.line_of_sight[0]).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]);
    expect(u.line_of_sight[1]).toHaveLength(4);
    expect(u.line_of_sight[1]?.[3]).toEqual({ x: 0, y: 0 });
  });

  it('makes portals of room doors and pack doors and windows, and lights of lights', () => {
    let d = add(blank, {
      kind: 'room',
      id: 'r',
      points: [0, 0, 280, 0, 280, 280, 0, 280],
      smooth: 0,
      floor: 'stone',
      wall: 12,
      wallStyle: 'stone',
      doors: [{ x: 140, y: 0, angle: 0, kind: 'door' }],
    });
    d = add(d, {
      kind: 'stamp',
      id: 'door',
      stamp: 'pack:p:A/Doors/Door_Wood_A_1x1.webp',
      x: 70,
      y: 70,
      w: 70,
      h: 70,
      rotation: 90,
    });
    d = add(d, {
      kind: 'stamp',
      id: 'win',
      stamp: 'pack:p:A/Windows/Window_A_1x1.webp',
      x: 210,
      y: 70,
      w: 70,
      h: 70,
      rotation: 0,
    });
    d = add(d, {
      kind: 'light',
      id: 'l',
      x: 140,
      y: 140,
      range: 280,
      color: '#ffeebb',
      intensity: 0.8,
      shadows: true,
    });
    const u = buildUvtt(d, '', 70);
    expect(u.portals).toHaveLength(3);
    expect(u.portals[0]).toMatchObject({
      position: { x: 2, y: 0 },
      closed: true,
      freestanding: false,
    });
    expect(u.portals[1]).toMatchObject({ closed: true, rotation: 1.571 });
    expect(u.portals[2]).toMatchObject({ closed: false });
    expect(u.lights).toEqual([
      { position: { x: 2, y: 2 }, range: 4, intensity: 0.8, color: 'ffffeebb', shadows: true },
    ]);
  });

  it('outlines stamps that block light as objects', () => {
    const d = add(blank, {
      kind: 'stamp',
      id: 's',
      stamp: 'pack:p:A/Pillar_1x1.webp',
      x: 70,
      y: 70,
      w: 70,
      h: 70,
      rotation: 0,
      blockLight: true,
    });
    const u = buildUvtt(d, '', 70);
    expect(u.objects_line_of_sight[0]).toHaveLength(5);
    expect(u.objects_line_of_sight[0]?.[0]).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("what Foundry's dd-import module reads", () => {
  it('finds every field it uses, in the shape it uses it', () => {
    let d = addItem(newMap('F', [], '', { w: 10, h: 10 }), 'x', {
      kind: 'wall',
      id: 'w',
      points: [0, 0, 700, 0],
    });
    d = {
      ...d,
      layers: [
        {
          id: 'x',
          name: 'x',
          visible: true,
          locked: false,
          items: [
            { kind: 'wall', id: 'w', points: [0, 0, 280, 0, 280, 140] },
            {
              kind: 'stamp',
              id: 'd',
              stamp: 'pack:p:A/Doors/Door_A_1x1.webp',
              x: 140,
              y: 0,
              w: 70,
              h: 70,
              rotation: 0,
            },
            {
              kind: 'light',
              id: 'l',
              x: 70,
              y: 70,
              range: 140,
              color: '#aabbcc',
              intensity: 1,
              shadows: true,
            },
          ],
        },
      ],
    };
    const u = buildUvtt(d, 'iVBORw0KGgo=', 70);
    // GetWalls: every sight line has points, read as wallSet[0] and wallSet[length - 1].
    for (const w of u.line_of_sight) {
      expect(w.length).toBeGreaterThanOrEqual(2);
      expect(typeof w[0]?.x).toBe('number');
      expect(typeof w[w.length - 1]?.y).toBe('number');
    }
    // GetDoors: bounds[0], bounds[1] and closed.
    for (const p of u.portals) {
      expect(p.bounds).toHaveLength(2);
      expect(typeof p.closed).toBe('boolean');
    }
    // GetLights: colour as "#" + color.substring(2) is a valid colour; range and intensity numbers; inside the map.
    for (const l of u.lights) {
      expect('#' + l.color.substring(2)).toMatch(/^#[0-9a-f]{6}$/);
      expect(l.range).toBeGreaterThan(0);
      expect(l.position.x).toBeGreaterThanOrEqual(u.resolution.map_origin.x);
      expect(l.position.x).toBeLessThanOrEqual(u.resolution.map_size.x);
    }
    // The image's first bytes say its type (atob(image.substr(0, 8))): a PNG here.
    expect(atob(u.image.substring(0, 8)).startsWith('\x89PNG')).toBe(true);
  });
});
