import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { addItem, newMap } from '../model';
import { makeScatter, pieceBox, scatterOf } from '../scatterDoc';
import { NATURE_RECIPES } from './nature';
import { recipeById, recipeRules } from './recipes';
import { settingsFor } from './settings';

const recipe = (id: string) => {
  const r = recipeById(id);
  if (!r) throw new Error(id);
  return r;
};

/** A dressing of a recipe over a big square of land, with the fixture's real pictures. */
function dressed(id: string, seed = 3) {
  const start = newMap('Wilds', [], 'now');
  const layer = start.layers[0]?.id ?? '';
  const item = makeScatter(
    'w',
    settingsFor(recipe(id), FA_ENTRIES, { unit: 70 }),
    { points: [0, 0, 1400, 0, 1400, 1400, 0, 1400] },
    seed,
  );
  const doc = addItem(start, layer, item);
  return { doc, item, pieces: scatterOf(doc, item) };
}

describe('biome brushes', () => {
  it('cover every biome, each layer finding pictures of its own biome on the real packs', () => {
    expect(NATURE_RECIPES.map((r) => r.id)).toEqual(
      expect.arrayContaining(['forest', 'jungle', 'desert', 'arctic', 'underdark', 'feywild']),
    );
    for (const r of NATURE_RECIPES) {
      const rules = recipeRules(r, FA_ENTRIES, { unit: 70 });
      expect(rules, r.id).toHaveLength(r.rules.length);
    }
    // A desert brush never picks woodland trees.
    const desert = recipeRules(recipe('desert'), FA_ENTRIES, { unit: 70 });
    expect(desert[0]?.pieces.every((p) => p.ref.includes('Desert/'))).toBe(true);
  });

  it('lays a forest in layers: ground and shadows beneath, then trees, undergrowth, clearings', () => {
    const { item, pieces } = dressed('forest');
    const keys = item.rules.map((r) => (r.from ?? '').split(':')[1]);
    expect(keys).toEqual(['canopy', 'ground', 'shadows', 'undergrowth', 'clearings']);
    const order = pieces.map((p) => keys[p.rule]);
    const firstTree = order.indexOf('canopy');
    // Everything drawn beneath comes before the first tree.
    expect(order.slice(firstTree).some((k) => k === 'ground' || k === 'shadows')).toBe(false);
    expect(order.slice(0, firstTree).every((k) => k === 'ground' || k === 'shadows')).toBe(true);
    // One shadow under each tree, at the tree, as wide as it.
    const trees = pieces.filter((p) => keys[p.rule] === 'canopy');
    const shadows = pieces.filter((p) => keys[p.rule] === 'shadows');
    expect(shadows).toHaveLength(trees.length);
    const { doc } = dressed('forest');
    for (const s of shadows) {
      const tree = trees.find((t) => t.x === s.x && t.y === s.y);
      expect(tree).toBeDefined();
      const sRule = item.rules[s.rule];
      const tRule = tree ? item.rules[tree.rule] : undefined;
      if (!tree || !sRule || !tRule) continue;
      const sw = pieceBox(doc, sRule, s).w;
      const tw = pieceBox(doc, tRule, tree);
      expect(sw).toBeCloseTo(Math.max(tw.w, tw.h), 0);
    }
  });

  it('keeps undergrowth and clearings off the middle of the trees', () => {
    const { item, pieces } = dressed('forest');
    const keys = item.rules.map((r) => (r.from ?? '').split(':')[1]);
    const trees = pieces.filter((p) => keys[p.rule] === 'canopy');
    const later = pieces.filter(
      (p) => keys[p.rule] === 'undergrowth' || keys[p.rule] === 'clearings',
    );
    for (const p of later)
      for (const t of trees) expect(Math.hypot(p.x - t.x, p.y - t.y)).toBeGreaterThan(30);
  });
});

describe('tracks', () => {
  it('turn the prints to point along the path', () => {
    const start = newMap('Trail', [], 'now');
    const layer = start.layers[0]?.id ?? '';
    const item = makeScatter(
      't',
      settingsFor(recipe('tracks'), FA_ENTRIES, { unit: 70 }),
      { points: [0, 300, 1000, 300] },
      1,
    );
    const doc = addItem(start, layer, item);
    const prints = scatterOf(doc, item);
    expect(prints.length).toBeGreaterThan(5);
    // The line runs along x: a print drawn pointing up is turned a quarter, to point along it.
    for (const p of prints) expect(Math.abs(Math.sin(p.angle))).toBeGreaterThan(0.95);
  });
});
