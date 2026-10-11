import type { GlyphId } from '../glyphs';
import type { CategoryId } from '../packCategories';
import type { Wanted } from '../packDefaults';
import type { Recipe, RecipeRule } from './recipeTypes';

/**
 * The biome brushes: one stroke lays a whole piece of land in layers, as the Forgotten Adventures
 * biomes have them. The layers, in drawing order:
 *
 *   ground      grass, moss, pebbles, drawn beneath everything (`beneath`);
 *   shadows     a tree shadow under each tree, as wide as the tree (`on` + `fit` + `beneath`);
 *   canopy      the trees (or giant mushrooms, cacti…), mirrored and tinted a little;
 *   undergrowth bushes and ferns thick at the edge of the stroke (`edge`), between the trees;
 *   clearings   clumps of logs, stumps, leaves or rocks (`cluster`), between the trees.
 *
 * Queries name a biome's own folders (`desert/!wilderness/`), so a desert brush never picks
 * woodland trees. `recipes.test.ts` checks every layer on the real pack names.
 */

/** Parts of a picture (palm fronds, loose branches, trunks), shadows and overlays. */
const NOT = ['shadow', 'broken', 'overlay', '/parts/', 'trunk', 'frond', 'tree_branch'];

/**
 * Pictures of one biome's wild lands, from some of its folders. Ceremorph (mind flayer) art is
 * left out everywhere but the Astral, where it is the whole flora.
 */
const of = (biome: string, cats: CategoryId[], folders: string[], not: string[] = []): Wanted => ({
  cats,
  words: [`${biome.toLowerCase()}/!wilderness/`],
  anyWords: folders,
  not: [...NOT, ...(biome === 'Astral' ? [] : ['ceremorph']), ...not],
});

const g = (id: GlyphId, weight = 1) => ({ id, weight });

const ground = (want: Wanted, spacing = 1.6): RecipeRule => ({
  key: 'ground',
  place: 'area',
  want,
  max: 12,
  spacing,
  rotation: 'random',
  cluster: 0.35,
  tint: 0.3,
  beneath: true,
});

/** Tree shadows (they are in the Woodlands folder, for any tree). */
const shadows: RecipeRule = {
  key: 'shadows',
  place: 'on',
  anchor: 'canopy',
  want: { cats: ['trees'], words: ['/tree_shadows/'] },
  max: 6,
  spacing: 0,
  fit: true,
  beneath: true,
};

const canopy = (
  want: Wanted,
  spacing = 0.75,
  glyphs: { id: GlyphId; weight: number }[] = [g('tree', 3), g('pine'), g('bush')],
): RecipeRule => ({
  key: 'canopy',
  place: 'area',
  want,
  max: 12,
  glyphs,
  glyphSpacing: 46,
  glyphSize: [42, 70],
  spacing,
  rotation: 'random',
  cluster: 0.15,
  flip: true,
  tint: 0.25,
});

const undergrowth = (want: Wanted): RecipeRule => ({
  key: 'undergrowth',
  place: 'edge',
  want,
  max: 10,
  spacing: 1.1,
  depth: 3,
  rotation: 'random',
  apart: true,
  flip: true,
  tint: 0.2,
});

const clearings = (want: Wanted, spacing = 1): RecipeRule => ({
  key: 'clearings',
  place: 'cluster',
  want,
  max: 10,
  spacing,
  rotation: 'random',
  apart: true,
});

const biome = (id: string, name: string, hint: string, rules: RecipeRule[]): Recipe => ({
  id,
  name,
  hint,
  group: 'Nature',
  mode: 'area',
  rules,
});

const TREE_PARTS = ['bare', 'dead', 'stump', 'log', 'branch'];

export const NATURE_RECIPES: readonly Recipe[] = [
  biome('forest', 'Forest', 'trees with shadows, undergrowth, clearings', [
    canopy(of('Woodlands', ['trees'], ['/trees/'], TREE_PARTS)),
    ground(of('Woodlands', ['plants'], ['/long_grass/', '/weeds/', '/moss/', '/grass/'], ['edge'])),
    shadows,
    undergrowth(of('Woodlands', ['bushes', 'plants'], ['/bushes/', '/ferns/'])),
    clearings(
      of('Woodlands', ['trees', 'plants'], ['/logs/', '/stumps/', '/leaf_piles/', '/twigs/']),
    ),
  ]),
  biome('deadwood', 'Dead wood', 'bare trees, fallen logs, dead leaves', [
    canopy(of('Woodlands', ['trees'], ['/bare_trees/']), 0.9, [g('dead')]),
    ground(of('Woodlands', ['plants'], ['/leaves/', '/twigs/'], ['pile'])),
    clearings(of('Woodlands', ['trees', 'plants'], ['/logs/', '/stumps/', '/branches/'])),
  ]),
  biome('jungle', 'Jungle', 'palms, giant leaves, vines, big flowers', [
    canopy(of('Jungle', ['trees', 'plants'], ['/palm_trees/', '/plants_huge/']), 0.7, [g('palm')]),
    ground(of('Woodlands', ['plants'], ['/long_grass/', '/moss/'])),
    undergrowth(of('Jungle', ['plants'], ['/plants_large/', '/flowers_large/'])),
    clearings(of('Jungle', ['plants'], ['/tendril_vines/', '/flowers/']), 0.8),
  ]),
  biome('swamp', 'Swamp', 'bare trees, lily pads, cattails, moss', [
    canopy(of('Woodlands', ['trees'], ['/bare_trees/']), 1.1, [g('dead'), g('reed')]),
    ground(of('Woodlands', ['plants'], ['/moss/', '/mushrooms/', '/weeds/'])),
    clearings(of('Swamp', ['plants', 'waterfx'], ['/lilypads/', '/cattails/']), 0.8),
  ]),
  biome('arctic', 'Snowy woods', 'snowy trees, ice rocks, snow drifts', [
    canopy(of('Arctic', ['trees'], ['/bare_trees_snow/', '/trees/'], ['log', 'stump']), 0.9, [
      g('pine'),
    ]),
    ground(of('Arctic', ['plants', 'decor'], ['/snowy_grass/', '/frosty_leaves/'])),
    undergrowth(of('Arctic', ['bushes'], ['/bushes/'])),
    clearings(
      of(
        'Arctic',
        ['rocks', 'decor', 'trees'],
        ['/ice_rocks/', '/snow/', '/logs/', '/stumps/'],
        ['blood', 'floe'],
      ),
    ),
  ]),
  biome('desert', 'Desert scrub', 'cacti, palms, brush, scattered rocks', [
    canopy(of('Desert', ['plants', 'trees'], ['/cacti/', '/palm_trees/']), 1.6, [g('palm')]),
    ground(of('Desert', ['rocks', 'plants'], ['/pebbles/', '/grass/']), 2),
    undergrowth(of('Desert', ['bushes'], ['/sage_brush/', '/desert_brushes/'])),
    clearings(of('Desert', ['rocks'], ['/boulders/', '/buried/', '/stones/']), 1.2),
  ]),
  biome('mountain', 'Mountainside', 'boulders, firs, ore, scree', [
    canopy(of('Mountain', ['trees'], ['/trees/'], TREE_PARTS), 1.3, [g('pine')]),
    ground(of('Mountain', ['rocks'], ['/pebbles/', '/stones/']), 1.4),
    clearings(of('Mountain', ['rocks'], ['/boulders/', '/rock_ore/']), 1.2),
    {
      ...clearings(of('Mountain', ['trees'], ['/logs/', '/stumps/'])),
      key: 'logs',
    },
  ]),
  biome('underdark', 'Underdark caverns', 'giant mushrooms, crystals, cocoons', [
    canopy(of('Underdark', ['plants'], ['/mushrooms/']), 0.9, [g('tree')]),
    ground(of('Mountain', ['rocks'], ['/pebbles/'])),
    clearings(of('Underdark', ['rocks', 'decor'], ['/crystals/'])),
    {
      ...clearings(of('Underdark', ['decor'], ['/spider_cocoons/']), 2),
      key: 'cocoons',
    },
  ]),
  biome('volcanic', 'Volcanic waste', 'black boulders, glowing rocks, stalagmites', [
    canopy(of('Volcanic', ['rocks'], ['/boulders/', '/stalagmites/']), 1.2, [g('rock')]),
    ground(of('Volcanic', ['rocks'], ['/pebbles/', '/stones/'])),
    clearings(of('Volcanic', ['rocks'], ['/magical/'])),
  ]),
  biome('astral', 'Astral drift', 'tendrils, glowing plants, eyes', [
    canopy(of('Astral', ['plants'], ['/tendrils_vines/']), 0.8, [g('bush')]),
    clearings(of('Astral', ['plants'], ['/bioluminescent_plants/'])),
    {
      ...clearings(of('Astral', ['decor'], ['/eyes/']), 2),
      key: 'eyes',
    },
  ]),
  biome('feywild', 'Feywild glade', 'strange trees, giant plants, big flowers', [
    canopy(of('Feywilds', ['trees'], ['/trees/'], TREE_PARTS), 0.85),
    ground(of('Feywilds', ['plants'], ['/long_grass/', '/moss/', '/lichen/'])),
    shadows,
    undergrowth(
      of('Feywilds', ['plants', 'bushes'], ['/plants_large/', '/plants_huge/', '/bushes/']),
    ),
    clearings(of('Feywilds', ['plants'], ['/flowers_large/', '/mushrooms/'])),
  ]),
  biome('blight', 'Blighted land', 'bones, skeletons, grasping tendrils', [
    canopy(of('Woodlands', ['trees'], ['/bare_trees/']), 1.4, [g('dead')]),
    ground(of('Horror', ['plants'], ['/tendril_vines/']), 1.8),
    clearings(of('Horror', ['decor'], ['/beast_bones/', '/beast_skeletons/', '/humanoid_bones/'])),
  ]),
];
