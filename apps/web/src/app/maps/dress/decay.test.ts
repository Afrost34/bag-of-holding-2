import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { addItem, newMap, type MapDoc, type MapItem } from '../model';
import { folderIndex, stateVariant } from '../packNames';
import { ageStamps } from './decay';
import { recipeById, recipeRules } from './recipes';

const index = folderIndex(FA_ENTRIES);
const BARREL = '!Core_Settlements/Decor/Storage/Barrels/Barrel_Wood_Ashen_A_1x1.webp';
const STOOL = '!Core_Settlements/Furniture/Seating/Stools/Stool_Wood_Ashen_A_1x1.webp';
const CANDLES =
  '!Core_Settlements/Lightsources/Candles/Arranged_Candles/Candles_Yellow_Arranged_A1_1x1.webp';

describe('broken and fallen pictures', () => {
  it('finds the broken barrel and the fallen stool beside the whole ones', () => {
    expect(stateVariant(index, 'fa', BARREL)).toBe(
      '!Core_Settlements/Decor/Storage/Barrels/Broken/Barrel_Broken_Side_Wood_Ashen_A1_2x2.webp',
    );
    expect(stateVariant(index, 'fa', STOOL)).toBe(
      '!Core_Settlements/Furniture/Seating/Stools/Fallen/Stool_Fallen_Wood_Ashen_A1_1x1.webp',
    );
    expect(stateVariant(index, 'fa', CANDLES)).toBeNull();
  });
});

const stamp = (id: string, path: string, x: number): MapItem => ({
  kind: 'stamp',
  id,
  stamp: `pack:fa:${path}`,
  x,
  y: 100,
  w: 70,
  h: 70,
  rotation: 0,
});

function room(): MapDoc {
  let doc = newMap('Ruin', [], 'now');
  const layer = doc.layers[0]?.id ?? '';
  doc = addItem(doc, layer, stamp('barrel', BARREL, 100));
  doc = addItem(doc, layer, stamp('stool', STOOL, 300));
  doc = addItem(doc, layer, stamp('candles', CANDLES, 500));
  return doc;
}

const byId = (doc: MapDoc, id: string) => {
  const item = doc.layers.flatMap((l) => l.items).find((i) => i.id === id);
  if (item?.kind !== 'stamp') throw new Error(id);
  return item;
};

describe('ageing stamps', () => {
  it('breaks what has a broken picture, at its own size, and grimes the rest', () => {
    const aged = ageStamps(room(), ['barrel', 'stool', 'candles'], index, 1, 5);
    const barrel = byId(aged, 'barrel');
    expect(barrel.stamp).toContain('/Broken/Barrel_Broken_Side');
    // A barrel on its side is 2 × 2 squares.
    expect(barrel.w).toBe(140);
    expect(byId(aged, 'stool').stamp).toContain('/Fallen/');
    expect(byId(aged, 'candles').tint).toBe('#cfc3ad');
  });

  it('leaves everything alone at no strength, and is the same for the same seed', () => {
    const doc = room();
    expect(ageStamps(doc, ['barrel', 'stool'], index, 0, 1)).toEqual(doc);
    expect(ageStamps(doc, ['barrel', 'stool'], index, 0.5, 9)).toEqual(
      ageStamps(doc, ['barrel', 'stool'], index, 0.5, 9),
    );
  });
});

describe('ruin recipes', () => {
  it('lay damaged floor, debris, heaps and cobwebs in the corners, and ivy on the walls', () => {
    const ruin = recipeRules(recipeById('ruin') ?? (undefined as never), FA_ENTRIES, { unit: 70 });
    expect(ruin.map((r) => r.place)).toEqual(['area', 'area', 'corner', 'corner', 'wall']);
    expect(ruin[0]?.beneath).toBe(true);
  });

  it('rusted: scrap instead of green, no wooden floor', () => {
    const rust = recipeById('rust-ruin');
    if (!rust) throw new Error('rust-ruin');
    const rules = recipeRules(rust, FA_ENTRIES, { unit: 70 });
    expect(rules.some((r) => r.pieces.some((p) => p.ref.includes('Scrap_Metal')))).toBe(true);
    expect(rules.some((r) => r.pieces.some((p) => /ivy|damage_overlay/i.test(p.ref)))).toBe(false);
  });
});
