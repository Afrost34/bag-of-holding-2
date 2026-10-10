import { describe, expect, it } from 'vitest';
import { alongLayout, defaultLabelText, labelTargets, targetLine } from './labels';
import { addItem, newMap, type MapDoc } from './model';

function doc(): MapDoc {
  let d = newMap('Labels', [], 'now');
  const layer = d.layers[0]?.id ?? '';
  d = addItem(d, layer, {
    kind: 'path',
    id: 'r1',
    points: [0, 0, 400, 0],
    smooth: 0,
    style: 'river',
    width: 40,
    color: '#3d7fb0',
  });
  d = addItem(d, layer, {
    kind: 'path',
    id: 'r2',
    points: [0, 100, 400, 100],
    smooth: 0,
    style: 'river',
    width: 40,
    color: '#3d7fb0',
  });
  d = addItem(d, layer, {
    kind: 'path',
    id: 'rd',
    points: [0, 200, 400, 200],
    smooth: 0,
    style: 'road',
    width: 20,
    color: '#d9c79e',
  });
  d = addItem(d, layer, {
    kind: 'shape',
    id: 's',
    points: [0, 0, 100, 0, 100, 100, 0, 100],
    smooth: 0,
    texture: 'grass',
    color: '#5b8a2b',
    opacity: 1,
    edge: 'none',
  });
  return d;
}

describe('what a label can follow', () => {
  it('lists paths and shapes, counted by kind', () => {
    expect(labelTargets(doc()).map((t) => t.name)).toEqual([
      'River 1',
      'River 2',
      'Road 1',
      'Land 1',
    ]);
  });

  it('gives the line of a path, or a shape closed round, and nothing for the rest', () => {
    expect(targetLine(doc(), 'r1')).toEqual([0, 0, 400, 0]);
    expect(targetLine(doc(), 's')).toEqual([0, 0, 100, 0, 100, 100, 0, 100, 0, 0]);
    expect(targetLine(doc(), 'nope')).toBeNull();
    expect(targetLine(doc(), undefined)).toBeNull();
  });

  it('says what a new label reads', () => {
    const items = doc().layers.flatMap((l) => l.items);
    expect(items.map(defaultLabelText)).toEqual(['River', 'River', 'Road', 'Land']);
  });
});

describe('letters along a line', () => {
  const widths = [10, 10, 10, 10];

  it('sit in order along it, centred where asked, turned with it', () => {
    const letters = alongLayout(widths, 0, [0, 0, 200, 0], 0.5, 0);
    expect(letters.map((l) => Math.round(l.x))).toEqual([85, 95, 105, 115]);
    expect(letters.every((l) => l.y === 0 && l.angle === 0)).toBe(true);
    const start = alongLayout(widths, 0, [0, 0, 200, 0], 0, 0);
    expect(start[0]?.x).toBe(5);
    const end = alongLayout(widths, 0, [0, 0, 200, 0], 1, 0);
    expect(end.at(-1)?.x).toBe(195);
  });

  it('follow a bend and stand off to the side by the lift', () => {
    const bent = alongLayout(widths, 0, [0, 0, 100, 0, 100, 100], 0.75, 0);
    expect(bent.some((l) => l.angle !== 0)).toBe(true);
    const lifted = alongLayout(widths, 0, [0, 0, 200, 0], 0.5, -12);
    expect(lifted.every((l) => Math.abs(l.y + 12) < 1e-9)).toBe(true);
  });

  it('start at the line start when the label is longer than the line', () => {
    const letters = alongLayout([40, 40, 40], 0, [0, 0, 60, 0], 0.5, 0);
    expect(letters[0]?.x).toBe(20);
  });
});
