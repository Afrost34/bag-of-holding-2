import { describe, expect, it } from 'vitest';
import {
  addSplatStroke,
  dabPoints,
  fillSplat,
  parseSplat,
  setSplatSlot,
  emptySplat,
} from './splat';

describe('terrain splat', () => {
  it('starts with four slots and keeps strokes in order', () => {
    const a = addSplatStroke(undefined, {
      slot: 0,
      points: [0, 0, 10, 0],
      radius: 20,
      hardness: 0.5,
    });
    const b = addSplatStroke(a, {
      slot: 1,
      points: [5, 5],
      radius: 20,
      hardness: 0.5,
      erase: true,
    });
    expect(b.slots).toEqual(['grass', 'dirt', 'sand', 'water']);
    expect(b.strokes.map((s) => s.slot)).toEqual([0, 1]);
    expect(a.strokes).toHaveLength(1);
  });

  it('changes a slot, or adds the next one, up to eight', () => {
    const s = setSplatSlot(emptySplat(), 0, 'lava');
    expect(s.slots[0]).toBe('lava');
    expect(setSplatSlot(s, 4, 'snow').slots).toHaveLength(5);
    expect(setSplatSlot(s, 6, 'snow').slots).toHaveLength(4);
    let full = emptySplat();
    for (let i = 4; i < 8; i++) full = setSplatSlot(full, i, 'rock');
    expect(full.slots).toHaveLength(8);
    expect(setSplatSlot(full, 8, 'rock').slots).toHaveLength(8);
  });

  it('fills the map with a slot', () => {
    expect(fillSplat(undefined, 2).strokes[0]).toMatchObject({ slot: 2, fill: true });
  });

  it('spaces dabs at most a quarter of the radius apart', () => {
    const dabs = dabPoints([0, 0, 100, 0], 40);
    expect(dabs[0]).toEqual({ x: 0, y: 0 });
    expect(dabs.at(-1)).toEqual({ x: 100, y: 0 });
    for (let i = 1; i < dabs.length; i++)
      expect((dabs[i]?.x ?? 0) - (dabs[i - 1]?.x ?? 0)).toBeLessThanOrEqual(10.0001);
    expect(dabPoints([5, 5], 40)).toEqual([{ x: 5, y: 5 }]);
  });

  it('is read back from a file, dropping what is wrong', () => {
    const s = parseSplat({
      slots: ['grass', 3, 'pack:a:b.jpg'],
      strokes: [
        { slot: 0, points: [1, 2, 3, 4], radius: 30, hardness: 2 },
        { slot: 9, points: [1, 2] },
        { slot: 1, points: [1] },
        { slot: 1, fill: true },
      ],
    });
    expect(s?.slots).toEqual(['grass', 'pack:a:b.jpg']);
    expect(s?.strokes).toHaveLength(2);
    expect(s?.strokes[0]?.hardness).toBe(1);
    expect(parseSplat({ slots: [] })).toBeUndefined();
    expect(parseSplat(null)).toBeUndefined();
  });
});
