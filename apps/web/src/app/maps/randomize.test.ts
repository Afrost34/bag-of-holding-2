import { describe, expect, it } from 'vitest';
import { addItem, newMap, type MapDoc, type MapItem } from './model';
import { folderIndex } from './packNames';
import {
  DEFAULT_RANDOMIZE,
  faintTint,
  materialChoices,
  randomizeStamps,
  swapMaterial,
} from './randomize';

const DIR = '!Core_Settlements/Furniture/Cupboards_and_Wardrobes/Wardrobes/';
const names = ['Ashen_A1', 'Ashen_A2', 'Dark_A1', 'Dark_A2', 'Light_A1'].map(
  (n) => `${DIR}Wardrobe_Wood_${n}_2x1.webp`,
);
const index = folderIndex(names.map((path) => ({ pack: 'fa', path })));

const stamp = (id: string, name: string): MapItem => ({
  kind: 'stamp',
  id,
  stamp: `pack:fa:${DIR}Wardrobe_Wood_${name}_2x1.webp`,
  x: 100,
  y: 100,
  w: 140,
  h: 70,
  rotation: 0,
});

function mapWith(items: MapItem[]): MapDoc {
  let doc = newMap('Test', [], '2026-10-11T00:00:00.000Z');
  const layer = doc.layers[0]?.id ?? '';
  for (const i of items) doc = addItem(doc, layer, i);
  return doc;
}

const stamps = (doc: MapDoc) =>
  doc.layers.flatMap((l) => l.items).filter((i) => i.kind === 'stamp');

describe('randomizeStamps', () => {
  const doc = mapWith([stamp('a', 'Ashen_A1'), stamp('b', 'Ashen_A1'), stamp('c', 'Ashen_A1')]);

  it('gives the same result for the same seed', () => {
    const a = randomizeStamps(doc, ['a', 'b', 'c'], DEFAULT_RANDOMIZE, index, 7);
    const b = randomizeStamps(doc, ['a', 'b', 'c'], DEFAULT_RANDOMIZE, index, 7);
    expect(a).toEqual(b);
  });

  it('only swaps for shapes of the same material and keeps the size', () => {
    const out = randomizeStamps(
      doc,
      ['a', 'b', 'c'],
      { ...DEFAULT_RANDOMIZE, turn: false },
      index,
      3,
    );
    for (const s of stamps(out)) {
      expect(s.stamp).toMatch(/Ashen_A[12]_2x1/);
      expect(s.w).toBe(140);
    }
  });

  it('turns only a little', () => {
    const out = randomizeStamps(
      doc,
      ['a', 'b', 'c'],
      { ...DEFAULT_RANDOMIZE, shape: false },
      index,
      5,
    );
    for (const s of stamps(out)) {
      const off = Math.min(s.rotation, 360 - s.rotation);
      expect(off).toBeLessThanOrEqual(10);
    }
  });

  it('leaves items that are not picked alone', () => {
    const out = randomizeStamps(doc, ['a'], { ...DEFAULT_RANDOMIZE, size: true }, index, 9);
    expect(stamps(out)[1]).toEqual(stamps(doc)[1]);
  });
});

describe('materials', () => {
  const doc = mapWith([stamp('a', 'Ashen_A1'), stamp('b', 'Ashen_A2'), stamp('c', 'Light_A1')]);

  it('lists what the picked stamps come in', () => {
    const choices = materialChoices(doc, ['a', 'b', 'c'], index);
    expect(choices[0]).toEqual({ label: 'Dark', count: 3 });
    expect(choices.map((c) => c.label)).toContain('Light');
  });

  it('swaps every stamp that has the material', () => {
    const out = swapMaterial(doc, ['a', 'b', 'c'], 'Dark', index);
    expect(stamps(out).map((s) => s.stamp.split('Wood_')[1])).toEqual([
      'Dark_A1_2x1.webp',
      'Dark_A2_2x1.webp',
      'Dark_A1_2x1.webp',
    ]);
  });
});

describe('faintTint', () => {
  it('is a light colour', () => {
    const hex = faintTint(0.3, 0.5);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const c of channels) expect(c).toBeGreaterThan(190);
  });
});
