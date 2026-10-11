import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from './__fixtures__/faNames';
import { recipeById } from './dress/recipes';
import { settingsFor } from './dress/settings';
import { mapLights, sourceGlow, stampGlow } from './glow';
import { addItem, newMap, setLayerShown, type MapItem } from './model';
import { makeScatter } from './scatterDoc';

const L = '!Core_Settlements/Lightsources/';

describe('which pictures give light', () => {
  it('lights candles, lamps, lit braziers and fires, warm and of their own reach', () => {
    const candle = sourceGlow(`${L}Candles/Arranged_Candles/Candles_Yellow_Arranged_A1_1x1.webp`);
    const brazier = sourceGlow(`${L}Braziers/Lit/Brazier_Metal_Gray_E1_Lit_2x2.webp`);
    const wall = sourceGlow(`${L}Interior_Wall_Lights/Wall_Light_Metal_Bronze_F1_1x1.webp`);
    expect(candle?.squares).toBeLessThan(wall?.squares ?? 0);
    expect(brazier?.squares).toBeGreaterThan(wall?.squares ?? 0);
    expect(sourceGlow(`${L}Torches_and_Sconces/Lit/Sconce_Blue_A_Lit_1x1.webp`)).not.toBeNull();
    expect(
      sourceGlow(
        '!Core_Settlements/Workplace_Equipment/Smithing/Forges/Forge_Lit_Stone_Earthy_Large_Circle_A1_3x3.webp',
      ),
    ).not.toBeNull();
  });

  it('leaves out what is not lit, parts and mounts, and everything else', () => {
    expect(sourceGlow(`${L}Braziers/Brazier_Metal_Gray_A1_Bloody_2x2.webp`)).toBeNull();
    expect(sourceGlow(`${L}Torches_and_Sconces/Sconce_A_1x1.webp`)).toBeNull();
    expect(
      sourceGlow(`${L}Interior_Wall_Lights/Parts/Mounts/Wall_Light_Mount_Metal_Gray_G1_1x1.webp`),
    ).toBeNull();
    expect(sourceGlow(`${L}Lanterns/Fallen/Lantern_Fallen_A_1x1.webp`)).toBeNull();
    expect(
      sourceGlow('!Core_Settlements/Furniture/Seating/Chairs/Chair_Wood_Dark_E_1x1.webp'),
    ).toBeNull();
  });
});

const candle: Extract<MapItem, { kind: 'stamp' }> = {
  kind: 'stamp',
  id: 'c',
  stamp: `pack:fa:${L}Candles/Arranged_Candles/Candles_Yellow_Arranged_A1_1x1.webp`,
  x: 100,
  y: 200,
  w: 70,
  h: 70,
  rotation: 0,
};

describe('lights on the map', () => {
  it('gives a candle stamp its light, unless turned off, and lets it be changed', () => {
    expect(stampGlow(candle)?.squares).toBe(2.5);
    const off = { ...candle, light: false as const };
    expect(stampGlow(off)).toBeNull();
    const big = { ...candle, light: { squares: 8, color: '#ff0000', intensity: 1 } };
    expect(stampGlow(big)?.color).toBe('#ff0000');
  });

  it('collects light items, glowing stamps and glowing dressing pieces on the layers shown', () => {
    let doc = newMap('Shrine', [], 'now');
    const layer = doc.layers[0]?.id ?? '';
    doc = addItem(doc, layer, candle);
    doc = addItem(doc, layer, {
      kind: 'light',
      id: 'l',
      x: 500,
      y: 500,
      range: 300,
      color: '#ffffff',
      intensity: 1,
      shadows: true,
    });
    doc = addItem(doc, layer, {
      kind: 'room',
      id: 'room',
      points: [0, 0, 700, 0, 700, 560, 0, 560],
      smooth: 0,
      floor: 'wood',
      wall: 12,
      wallStyle: 'stone',
    });
    const recipe = recipeById('room-lights');
    if (!recipe) throw new Error('room-lights');
    const lamps = makeScatter(
      'lamps',
      settingsFor(recipe, FA_ENTRIES, { unit: 70 }),
      { points: [], within: 'room' },
      2,
    );
    doc = addItem(doc, layer, lamps);
    const lights = mapLights(doc);
    // The candle (a small glow, no shadows), the light item, and lamps round the walls.
    expect(lights.find((l) => l.x === 100)?.shadows).toBe(false);
    expect(lights.find((l) => l.x === 500)?.range).toBe(300);
    expect(lights.length).toBeGreaterThan(4);
    // A hidden layer gives no light.
    expect(mapLights(setLayerShown(doc, layer, false))).toEqual([]);
  });
});
