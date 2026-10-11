import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { encodeHeights, flatElevation } from '../elevation';
import { addItem, newMap, type MapDoc } from '../model';
import { makeScatter, obstacleSignature, scatterOf } from '../scatterDoc';
import { groundOf } from './ground';
import { recipeById } from './recipes';
import { settingsFor } from './settings';

const recipe = (id: string) => {
  const r = recipeById(id);
  if (!r) throw new Error(id);
  return r;
};

const SIZE = 1400;

/** A dressing of a recipe over a big square, with the fixture's real pictures. */
function dressed(id: string, seed = 5, change: (doc: MapDoc) => MapDoc = (d) => d) {
  const start = newMap('Lands', [], 'now');
  const layer = start.layers[0]?.id ?? '';
  const item = makeScatter(
    's',
    settingsFor(recipe(id), FA_ENTRIES, { unit: 70 }),
    { points: [0, 0, SIZE, 0, SIZE, SIZE, 0, SIZE] },
    seed,
  );
  const doc = change(addItem(start, layer, item));
  const keys = item.rules.map((r) => (r.from ?? '').split(':')[1]);
  const pieces = scatterOf(doc, item);
  const of = (key: string) => pieces.filter((p) => keys[p.rule] === key);
  return { doc, item, pieces, of };
}

/** Where a piece faces: FA pictures face down, so the bottom of the turned picture. */
const facing = (angle: number) => ({ x: -Math.sin(angle), y: Math.cos(angle) });

const nearest = <P extends { x: number; y: number }>(
  list: readonly P[],
  p: { x: number; y: number },
) =>
  list.reduce<P | undefined>(
    (best, q) =>
      !best || Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? q : best,
    undefined,
  );

describe('a camp', () => {
  it('rings each fire with seats, then bedrolls, then tents, all facing the fire', () => {
    for (const seed of [1, 5, 9]) {
      const { of } = dressed('camp', seed);
      const fires = of('fires');
      expect(fires.length, String(seed)).toBeGreaterThan(0);
      const ring = (key: string) =>
        of(key).map((p) => {
          const fire = nearest(fires, p);
          if (!fire) throw new Error('no fire');
          const d = Math.hypot(fire.x - p.x, fire.y - p.y);
          const f = facing(p.angle);
          return { d, toward: (f.x * (fire.x - p.x) + f.y * (fire.y - p.y)) / d };
        });
      const mean = (list: { d: number }[]) => list.reduce((s, x) => s + x.d, 0) / list.length;
      const seats = ring('seats');
      const beds = ring('bedrolls');
      const tents = ring('tents');
      expect(seats.length).toBeGreaterThan(0);
      expect(beds.length).toBeGreaterThan(0);
      expect(tents.length).toBeGreaterThan(0);
      // At most so many round each fire.
      expect(seats.length).toBeLessThanOrEqual(4 * fires.length);
      for (const s of [...seats, ...beds, ...tents]) expect(s.toward).toBeGreaterThan(0.9);
      expect(mean(seats)).toBeLessThan(mean(beds));
      expect(mean(beds)).toBeLessThan(mean(tents));
    }
  });
});

describe('a graveyard', () => {
  it('puts a grave in front of most tombstones, below each stone', () => {
    const { of } = dressed('graveyard');
    const stones = of('tombstones');
    const graves = of('graves');
    expect(stones.length).toBeGreaterThan(4);
    expect(graves.length).toBeGreaterThan(0);
    expect(graves.length).toBeLessThanOrEqual(stones.length);
    for (const g of graves) {
      const stone = nearest(stones, g);
      if (!stone) throw new Error('no stone');
      // Upright stones: the grave lies straight below.
      expect(Math.abs(g.x - stone.x)).toBeLessThan(1);
      expect(g.y).toBeGreaterThan(stone.y);
    }
  });
});

describe('a market', () => {
  it('lays wares in front of the stalls', () => {
    const { of } = dressed('market');
    const stalls = of('stalls');
    const wares = of('wares');
    expect(wares.length).toBeGreaterThan(0);
    expect(wares.length).toBeLessThanOrEqual(stalls.length);
    for (const w of wares) {
      const stall = nearest(stalls, w);
      if (!stall) throw new Error('no stall');
      const f = facing(stall.angle);
      // Out from the stall the way it faces.
      expect((w.x - stall.x) * f.x + (w.y - stall.y) * f.y).toBeGreaterThan(0);
    }
  });
});

describe('a stone circle', () => {
  it('has one altar near the middle and standing stones evenly round it', () => {
    const { of } = dressed('stone-circle');
    const altars = of('altar');
    expect(altars).toHaveLength(1);
    const altar = altars[0];
    if (!altar) throw new Error('no altar');
    expect(Math.hypot(altar.x - SIZE / 2, altar.y - SIZE / 2)).toBeLessThan(SIZE / 4);
    const stones = of('stones');
    expect(stones.length).toBeGreaterThanOrEqual(6);
    expect(stones.length).toBeLessThanOrEqual(9);
    const d = stones.map((s) => Math.hypot(s.x - altar.x, s.y - altar.y));
    const mid = d.reduce((a, b) => a + b, 0) / d.length;
    for (const x of d) expect(Math.abs(x - mid) / mid).toBeLessThan(0.3);
    // Spread all the way round: no gap wider than a third of the circle.
    const angles = stones
      .map((s) => Math.atan2(s.y - altar.y, s.x - altar.x))
      .sort((a, b) => a - b);
    const gaps = angles.map((a, i) => (angles[i + 1] ?? (angles[0] ?? 0) + 2 * Math.PI) - a);
    expect(Math.max(...gaps)).toBeLessThan((2 * Math.PI) / 3);
  });
});

/** Ground that rises evenly from the sea on the left to the peak on the right. */
function slopeUp(doc: MapDoc): MapDoc {
  const e = flatElevation(SIZE, SIZE);
  const heights = new Uint8Array(e.w * e.h);
  for (let y = 0; y < e.h; y++)
    for (let x = 0; x < e.w; x++)
      heights[y * e.w + x] = Math.round(e.sea + ((250 - e.sea) * x) / (e.w - 1));
  return { ...doc, elevation: { ...e, data: encodeHeights(heights) } };
}

describe('highlands by height', () => {
  it('put firs low, snowy firs higher, ice on the peaks, and no scree on gentle ground', () => {
    const { doc, of } = dressed('highlands', 5, slopeUp);
    const elevation = doc.elevation;
    if (!elevation) throw new Error('no elevation');
    const ground = groundOf(elevation);
    const heights = (key: string) => of(key).map((p) => ground(p.x, p.y).height);
    const firs = heights('canopy');
    const snowy = heights('snowline');
    const ice = heights('ice');
    expect(firs.length).toBeGreaterThan(5);
    expect(snowy.length).toBeGreaterThan(0);
    expect(ice.length).toBeGreaterThan(0);
    expect(Math.max(...firs)).toBeLessThanOrEqual(0.5);
    expect(Math.min(...snowy)).toBeGreaterThanOrEqual(0.45);
    expect(Math.max(...snowy)).toBeLessThanOrEqual(0.75);
    expect(Math.min(...ice)).toBeGreaterThanOrEqual(0.72);
    // The ramp is gentle: no boulders or scree.
    expect(of('boulders')).toHaveLength(0);
    expect(of('ground')).toHaveLength(0);
  });

  it('are drawn again when the ground changes under them', () => {
    const flat = dressed('highlands', 5).doc;
    const hilly = slopeUp(flat);
    expect(obstacleSignature(hilly)).not.toBe(obstacleSignature(flat));
    // A map whose dressings ignore the ground does not redraw them when hills are painted.
    const forest = dressed('camp', 5).doc;
    expect(obstacleSignature(slopeUp(forest))).toBe(obstacleSignature(forest));
  });
});
