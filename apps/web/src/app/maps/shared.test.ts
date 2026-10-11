import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from './__fixtures__/faNames';
import { makeDistrict, settingsFromStyle } from './cityDoc';
import { addItem, newMap, parseMap, serializeMap, type MapDoc } from './model';
import { packShared, unpackShared } from './shared';
import { buildTown, DEFAULT_TOWN } from './town/townDoc';
import { metersPerPixel, stampUnit } from './units';

function town(): MapDoc {
  const start = newMap('Town', [], 'now', { w: 120, h: 90 });
  const cell = start.grid.size;
  const d = makeDistrict(
    'd1',
    { ...settingsFromStyle('town'), plaza: 0.18 },
    [5 * cell, 5 * cell, 115 * cell, 5 * cell, 115 * cell, 85 * cell, 5 * cell, 85 * cell],
    7,
    0,
    1 / metersPerPixel(start),
  );
  const doc = addItem(start, start.layers[0]?.id ?? '', d);
  const made = buildTown(doc, ['d1'], { ...DEFAULT_TOWN, max: 40, seed: 5 }, FA_ENTRIES, {
    unit: stampUnit(doc),
  });
  if (!made) throw new Error('no town');
  return { ...made.doc, id: 'm1' };
}

describe('what a map file shares', () => {
  it('writes a building spec and its pictures once, and reads the map back the same', () => {
    const doc = town();
    const text = serializeMap(doc);
    const naive = JSON.stringify(doc).length;
    // Forty buildings of a few kinds: a small part of writing every floor out in full.
    expect(text.length).toBeLessThan(naive / 4);
    const back = parseMap(text, 'm1');
    expect(back).toEqual(parseMap(`${JSON.stringify(doc)}\n`, 'm1'));
    expect(JSON.parse(text)).toHaveProperty('shared');
  });

  it('reads the floors of one building as one spec', () => {
    const back = parseMap(serializeMap(town()), 'm1');
    const floors = back?.layers.flatMap((l) => l.items).filter((i) => i.kind === 'structure');
    const byGroup = new Map<string, unknown[]>();
    for (const f of floors ?? []) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f.spec]);
    const tall = [...byGroup.values()].find((specs) => specs.length > 1);
    expect(tall?.[0]).toBe(tall?.[1]);
  });

  it('leaves a map without buildings as it was, and a file without a table as it is', () => {
    const plain = newMap('Plain', [], 'now');
    expect(packShared(plain)).toBe(plain);
    const json = { layers: [{ items: [{ kind: 'stamp' }] }] };
    expect(unpackShared(json)).toBe(json);
  });
});
