import type { GlyphId } from '../glyphs';
import type { Recipe, RecipeRule } from './recipeTypes';

/**
 * Settlement generators: a market crowded with awnings and tarps, a camp of tents round fires, a
 * graveyard in rows, a farm's crop rows and hay, and a scrapyard of rusty heaps (Rust & Sunfire).
 * Each is an area recipe of a few layers, from Forgotten Adventures folders; `recipes.test.ts`
 * checks them on real names. Lay one by painting or dragging an area with the Dress tool.
 */

const g = (id: GlyphId, weight = 1) => ({ id, weight });

const settlement = (id: string, name: string, hint: string, rules: RecipeRule[]): Recipe => ({
  id,
  name,
  hint,
  group: 'Settlement',
  mode: 'area',
  rules,
});

const NOT = ['broken', 'ruined', 'cutout', 'modular', 'ceremorph', 'shadow'];

export const SETTLEMENT_RECIPES: readonly Recipe[] = [
  settlement('market', 'Market', 'crowded awnings and tarps, goods heaped between them', [
    {
      key: 'stalls',
      place: 'area',
      want: {
        cats: ['buildings'],
        anyWords: ['tarp_awning_assembled', 'tarp_assembled'],
        not: NOT,
      },
      max: 8,
      spacing: 1.05,
      overlap: 0.15,
      rotation: 'quarter',
      glyphs: [g('table')],
      glyphSize: [90, 90],
    },
    {
      key: 'goods',
      place: 'cluster',
      want: {
        cats: ['decor'],
        anyWords: ['/crates/', '/barrels/', '/sacks/'],
        not: [...NOT, 'lid', 'side'],
      },
      max: 10,
      spacing: 0.9,
      apart: true,
      rotation: 'random',
      rotMin: -15,
      rotMax: 15,
      glyphs: [g('crate'), g('barrel')],
      glyphSize: [36, 44],
    },
  ]),
  settlement('camp', 'Camp', 'tents, fires, bedrolls and supplies', [
    {
      key: 'tents',
      place: 'area',
      want: { cats: ['buildings'], words: ['/shelters/tents/tent_cloth'], not: NOT },
      max: 6,
      spacing: 1.5,
      rotation: 'quarter',
      glyphs: [g('table')],
      glyphSize: [100, 100],
    },
    {
      key: 'fires',
      place: 'area',
      want: {
        cats: ['lights'],
        words: ['/campfires_and_firepits/'],
        not: ['unlit', 'ash_', 'cold'],
      },
      max: 3,
      spacing: 6,
      apart: true,
      glyphs: [g('rock')],
      glyphSize: [40, 40],
    },
    {
      key: 'bedrolls',
      place: 'area',
      want: { cats: ['furniture'], words: ['/bedrolls/'], not: ['rolled'] },
      max: 4,
      spacing: 3,
      apart: true,
      rotation: 'random',
    },
    {
      key: 'supplies',
      place: 'cluster',
      want: { cats: ['decor'], anyWords: ['/crates/', '/sacks/'], not: [...NOT, 'lid', 'side'] },
      max: 6,
      spacing: 1.2,
      apart: true,
      rotation: 'random',
    },
  ]),
  settlement('graveyard', 'Graveyard', 'tombstones in rows, graves, a dead tree or two', [
    {
      key: 'tombstones',
      place: 'grid',
      want: { cats: ['graves'], words: ['/tombstones/tombstone_stone'], not: [...NOT, 'base'] },
      max: 8,
      spacing: 2.2,
      rotation: 'none',
      jitter: 0.15,
      glyphs: [g('rock')],
      glyphSize: [30, 30],
    },
    {
      key: 'graves',
      place: 'area',
      want: { cats: ['graves'], words: ['/graves/grave_'], not: NOT },
      max: 4,
      spacing: 3,
      apart: true,
      rotation: 'none',
    },
    {
      key: 'trees',
      place: 'edge',
      want: { cats: ['trees'], words: ['/bare_trees/'], not: ['shadow'] },
      max: 4,
      spacing: 4,
      apart: true,
      rotation: 'random',
      glyphs: [g('dead')],
      glyphSize: [70, 90],
    },
  ]),
  settlement('farm', 'Farm field', 'crops in rows, hay bales', [
    {
      key: 'crops',
      place: 'grid',
      want: {
        cats: ['workplace'],
        words: ['/farming/crops/'],
        not: [
          ...NOT,
          'smashed',
          'vine',
          'harvested',
          'peice',
          'piece',
          'carved',
          'bundle',
          'dirty',
        ],
      },
      max: 2,
      spacing: 1,
      rotation: 'none',
      glyphs: [g('tuft')],
      glyphSize: [24, 24],
    },
    {
      key: 'hay',
      place: 'cluster',
      want: { cats: ['decor', 'plants', 'other'], words: ['/hay/hay_bale'] },
      max: 4,
      spacing: 1,
      apart: true,
      rotation: 'quarter',
    },
  ]),
  settlement('scrapyard', 'Scrapyard', 'heaps of scrap and cogs, wrecked carts, rusty barrels', [
    {
      key: 'scrap',
      place: 'area',
      want: { cats: ['buildings'], anyWords: ['/scrap_metal/'] },
      max: 12,
      spacing: 0.8,
      overlap: 0.3,
      cluster: 0.6,
      rotation: 'random',
      glyphs: [g('rock')],
      glyphSize: [30, 30],
    },
    {
      key: 'cogs',
      place: 'area',
      want: { cats: ['buildings'], words: ['/cogs/'], not: ['giant', 'huge'] },
      max: 6,
      spacing: 2.5,
      apart: true,
      rotation: 'random',
    },
    {
      key: 'wrecks',
      place: 'area',
      want: { cats: ['vehicles'], words: ['cart'], anyWords: ['broken', 'rusty'] },
      max: 3,
      spacing: 5,
      apart: true,
      rotation: 'random',
    },
    {
      key: 'barrels',
      place: 'cluster',
      want: { cats: ['decor'], words: ['/barrels/', 'rusty'] },
      max: 4,
      spacing: 1,
      apart: true,
      rotation: 'random',
      glyphs: [g('barrel')],
      glyphSize: [36, 36],
    },
  ]),
];
