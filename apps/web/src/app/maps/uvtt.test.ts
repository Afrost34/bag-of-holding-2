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
