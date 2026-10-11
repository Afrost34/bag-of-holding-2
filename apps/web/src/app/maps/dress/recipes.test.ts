import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { isGlyphRef } from '../glyphs';
import {
  FURNISH_RECIPES,
  fromPacks,
  hasGlyphs,
  pickAgain,
  RECIPES,
  recipeById,
  recipeRules,
} from './recipes';

const recipe = (id: string) => {
  const r = recipeById(id);
  if (!r) throw new Error(`recipe ${id}`);
  return r;
};

describe('recipes on the real packs', () => {
  it('makes a forest of trees with undergrowth, leaving out tree shadows', () => {
    const rules = recipeRules(recipe('forest'), FA_ENTRIES, { unit: 70 });
    expect(rules.map((r) => r.place)).toEqual(['area', 'edge']);
    const trees = rules[0];
    expect(trees?.pieces.length).toBeGreaterThanOrEqual(3);
    expect(trees?.pieces.some((p) => p.ref.includes('Shadow'))).toBe(false);
    expect(trees?.from).toBe('forest:trees');
    // The typical tree is 5 squares wide: 5 × 70 × 0.75.
    expect(trees?.spacing).toBe(263);
    expect(rules[1]?.apart).toBe(true);
  });

  it('finds every nature recipe the packs have pictures for', () => {
    for (const id of [
      'forest',
      'trees',
      'bushes',
      'rocks',
      'flowers',
      'grass',
      'mushrooms',
      'leaves',
    ])
      expect(fromPacks(recipe(id), FA_ENTRIES), id).toBe(true);
  });

  it('furnishes from the packs', () => {
    for (const id of ['tavern', 'storage', 'study']) {
      const rules = recipeRules(recipe(id), FA_ENTRIES, { unit: 70 });
      expect(
        rules[0]?.pieces.every((p) => p.ref.startsWith('pack:')),
        id,
      ).toBe(true);
      expect(rules[0]?.rotation).toBe('quarter');
    }
    expect(FURNISH_RECIPES.map((r) => r.id)).toContain('bedroom');
  });

  it('falls back on glyphs, standing up, when the packs have nothing', () => {
    const rules = recipeRules(recipe('forest'), [], { unit: 70 });
    // The undergrowth has no glyphs: only the trees are left.
    expect(rules).toHaveLength(1);
    expect(rules[0]?.pieces.every((p) => isGlyphRef(p.ref))).toBe(true);
    expect(rules[0]?.rotation).toBe('none');
    // Sized for the map's squares.
    const big = recipeRules(recipe('forest'), [], { unit: 140 });
    expect(big[0]?.sizeMax).toBe((rules[0]?.sizeMax ?? 0) * 2);
  });

  it('uses glyphs when drawn art is asked for, even with packs', () => {
    const rules = recipeRules(recipe('trees'), FA_ENTRIES, { unit: 70, drawn: true });
    expect(rules[0]?.pieces.every((p) => isGlyphRef(p.ref))).toBe(true);
  });

  it('has a way to be drawn for every recipe', () => {
    for (const r of RECIPES) expect(hasGlyphs(r) || r.rules.some((x) => x.want), r.id).toBe(true);
  });
});

describe('pick again', () => {
  it('picks other pictures that fit the same rule', () => {
    const [trees] = recipeRules(recipe('rocks'), FA_ENTRIES, { unit: 70 });
    if (!trees) throw new Error('rule');
    const again = pickAgain(trees, FA_ENTRIES, 12345);
    expect(again.pieces.length).toBeGreaterThan(0);
    expect(again.pieces.every((p) => p.ref.includes('Rocks'))).toBe(true);
    expect(again.spacing).toBe(trees.spacing);
  });

  it('leaves a rule made by hand as it is', () => {
    const rule = recipeRules(recipe('rocks'), FA_ENTRIES, { unit: 70 })[0];
    if (!rule) throw new Error('rule');
    const { from: _f, ...hand } = rule;
    expect(pickAgain(hand, FA_ENTRIES, 1)).toEqual(hand);
  });
});
