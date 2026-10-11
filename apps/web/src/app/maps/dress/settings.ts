import type { PackEntry } from '../packModel';
import type { DressSettings } from '../scatterDoc';
import { RECIPES, recipeRules, type Recipe, type RecipeOptions } from './recipes';

/**
 * The Dress tool's settings made from a recipe: its rules with pictures picked from the packs
 * (or its glyphs), and the recipe's own placement wishes. Pure.
 */
export function settingsFor(
  recipe: Recipe,
  entries: readonly Pick<PackEntry, 'path' | 'pack' | 'cat'>[],
  options: RecipeOptions,
  keep: Pick<DressSettings, 'scale' | 'single'> = { scale: 1 },
): DressSettings {
  return {
    recipe: recipe.id,
    mode: recipe.mode,
    rules: recipeRules(recipe, entries, options),
    avoid: 'auto',
    ...(recipe.overPaths ? { overPaths: true } : {}),
    ...(recipe.onlyOn ? { onlyOn: [...recipe.onlyOn] } : {}),
    scale: keep.scale,
    ...(keep.single ? { single: true } : {}),
  };
}

const first = RECIPES[0];
if (!first) throw new Error('No dress recipes');

/** What the Dress tool starts with before any pack is looked at: the drawn forest. */
export const DEFAULT_DRESS: DressSettings = settingsFor(first, [], { unit: 70, drawn: true });
