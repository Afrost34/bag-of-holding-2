import { describe, expect, it } from 'vitest';
import { parseMap, type MapItem } from '../model';
import { upgradeScatter } from './upgrade';

/** A scatter as maps saved it before dressings had rules. */
const OLD = {
  kind: 'scatter',
  id: 's1',
  mode: 'along',
  points: [0, 0, 100, 0],
  smooth: 0.5,
  follow: 'road',
  seed: 9,
  pieces: [
    { ref: 'glyph:tree', weight: 3 },
    { ref: 'glyph:pine', weight: 1 },
  ],
  spacing: 62,
  sizeMin: 40,
  sizeMax: 60,
  rotation: 'random',
  rotMin: 10,
  rotMax: 40,
  overlap: 0.2,
  cluster: 0,
  offset: 44,
  sides: 'both',
  jitter: 0.25,
  clearance: 0,
  avoid: 'auto',
  onlyOn: ['grass'],
};

describe('upgrading old scatters', () => {
  it('moves the settings into one rule', () => {
    const item = upgradeScatter(OLD as unknown as MapItem);
    expect(item).toEqual({
      kind: 'scatter',
      id: 's1',
      mode: 'along',
      points: [0, 0, 100, 0],
      smooth: 0.5,
      follow: 'road',
      seed: 9,
      clearance: 0,
      avoid: 'auto',
      onlyOn: ['grass'],
      rules: [
        {
          place: 'along',
          pieces: [
            { ref: 'glyph:tree', weight: 3 },
            { ref: 'glyph:pine', weight: 1 },
          ],
          spacing: 62,
          sizeMin: 40,
          sizeMax: 60,
          rotation: 'random',
          rotMin: 10,
          rotMax: 40,
          overlap: 0.2,
          cluster: 0,
          offset: 44,
          sides: 'both',
          jitter: 0.25,
        },
      ],
    });
  });

  it('leaves new dressings and other items alone', () => {
    const fresh = upgradeScatter(OLD as unknown as MapItem);
    expect(upgradeScatter(fresh)).toBe(fresh);
    const text: MapItem = {
      kind: 'text',
      id: 't',
      x: 0,
      y: 0,
      text: 'Hi',
      size: 12,
      color: '#000',
    };
    expect(upgradeScatter(text)).toBe(text);
  });

  it('happens when a map is opened', () => {
    const doc = parseMap(
      JSON.stringify({
        version: 2,
        name: 'Old',
        layers: [{ id: 'l', name: 'Art', items: [OLD] }],
      }),
      'm',
    );
    const item = doc?.layers[0]?.items[0];
    expect(item?.kind === 'scatter' && item.rules[0]?.spacing).toBe(62);
  });
});
