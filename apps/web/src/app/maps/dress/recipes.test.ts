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
  it('makes a forest of trees, their shadows apart from them, undergrowth and clearings', () => {
    const rules = recipeRules(recipe('forest'), FA_ENTRIES, { unit: 70 });
    expect(rules.map((r) => r.place)).toEqual(['area', 'area', 'on', 'edge', 'cluster']);
    const trees = rules[0];
    expect(trees?.pieces.length).toBeGreaterThanOrEqual(3);
    expect(trees?.pieces.some((p) => p.ref.includes('Shadow'))).toBe(false);
    expect(trees?.from).toBe('forest:canopy');
    // The typical tree is 5 squares wide: 5 × 70 × 0.75.
    expect(trees?.spacing).toBe(263);
    // The shadows are tree shadows, on the trees, as wide as them, beneath them.
    expect(rules[2]?.pieces.every((p) => p.ref.includes('Tree_Shadow'))).toBe(true);
    expect(rules[2]).toMatchObject({ anchor: 0, fit: true, beneath: true });
    expect(rules[3]?.apart).toBe(true);
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

  it('makes clutter piles from the packs', () => {
    expect(fromPacks(recipe('pile'), FA_ENTRIES)).toBe(true);
    expect(fromPacks(recipe('gear'), FA_ENTRIES)).toBe(true);
    expect(recipeRules(recipe('pile'), FA_ENTRIES, { unit: 70 })[0]?.place).toBe('cluster');
  });

  it('furnishes every room type from the packs, every rule finding pictures', () => {
    expect(FURNISH_RECIPES.length).toBeGreaterThanOrEqual(20);
    for (const r of FURNISH_RECIPES) {
      const rules = recipeRules(r, FA_ENTRIES, { unit: 70 });
      expect(rules, r.id).toHaveLength(r.rules.length);
      expect(
        rules.every((x) => x.pieces.every((p) => p.ref.startsWith('pack:'))),
        r.id,
      ).toBe(true);
    }
  });

  it('turns anchors into rule numbers, and drops a rule whose anchor found nothing', () => {
    const tavern = recipeRules(recipe('tavern'), FA_ENTRIES, { unit: 70 });
    expect(tavern[1]?.place).toBe('around');
    expect(tavern[1]?.anchor).toBe(0);
    expect(tavern[2]?.anchor).toBe(1);
    // Without tables there are no seats round them, nor settings in front of the seats.
    const noTables = FA_ENTRIES.filter((e) => !e.path.includes('_Tables/'));
    const rules = recipeRules(recipe('tavern'), noTables, { unit: 70 });
    expect(rules.some((r) => r.place === 'around' || r.place === 'setting')).toBe(false);
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

describe('settlement generators', () => {
  it('find every layer of the market, camp, graveyard, farm and scrapyard on the real packs', () => {
    for (const id of ['market', 'camp', 'graveyard', 'farm', 'scrapyard', 'stone-circle']) {
      const r = recipe(id);
      expect(r.group, id).toBe('Settlement');
      const rules = recipeRules(r, FA_ENTRIES, { unit: 70 });
      expect(rules, id).toHaveLength(r.rules.length);
      expect(
        rules.every((x) => x.pieces.every((p) => p.ref.startsWith('pack:'))),
        id,
      ).toBe(true);
    }
  });
});
