import { glyphRef, type GlyphId } from '../glyphs';
import type { DressPlace, DressRule } from '../model';
import { pickMany, type Wanted } from '../packDefaults';
import { packRef, squaresOf, type PackEntry } from '../packModel';
import type { TerrainRef } from '../terrain';

/**
 * Recipes: what the Dress tool can lay down (a forest, a hedge, a tavern's furniture), as rules
 * that name the pictures they want from the packs (a `Wanted` query) and drawn glyphs to stand in
 * while no pack is imported (ADR 0013). A recipe becomes the rules of a dressing with
 * `recipeRules`, which picks the pictures once (the palette): importing more packs later does not
 * change a dressing, "Pick again" does. Pure data and functions.
 */

export type RecipeGroup =
  'Nature' | 'Edges' | 'Interior' | 'Clutter' | 'Decay' | 'Settlement' | 'Kits' | 'World';

export const RECIPE_GROUPS: readonly RecipeGroup[] = [
  'Nature',
  'Edges',
  'Interior',
  'Clutter',
  'Decay',
  'Settlement',
  'Kits',
  'World',
];

export interface RecipeRule {
  /** Names the rule inside its recipe (`trees`, `undergrowth`): `recipe:key` finds it again. */
  key: string;
  place: DressPlace;
  /** The pack pictures it wants, and how many different ones to mix. */
  want?: Wanted;
  max?: number;
  /** Drawn stand-ins, sized for a 70-pixel square (`glyphSize`, `glyphSpacing`). */
  glyphs?: { id: GlyphId; weight: number }[];
  glyphSize?: [number, number];
  glyphSpacing?: number;
  /** Pack pictures: the gap between them as a multiple of their typical width. */
  spacing: number;
  /** Pack pictures vary their own size between these (as a part of 100). */
  vary?: [number, number];
  rotation?: DressRule['rotation'];
  rotMin?: number;
  rotMax?: number;
  overlap?: number;
  cluster?: number;
  /** Along a line: how far to the side, in pack squares. */
  offset?: number;
  sides?: DressRule['sides'];
  jitter?: number;
  falloff?: number;
  /** Edge: how far in, in pack squares. */
  depth?: number;
  snap?: number;
  flip?: boolean;
  tint?: number;
  apart?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  hint: string;
  group: RecipeGroup;
  mode: 'area' | 'along';
  rules: RecipeRule[];
  onlyOn?: TerrainRef[];
  /** Stand on roads and rivers too (a market spills over the street). */
  overPaths?: boolean;
}

/** A glyph's 70-pixel sizes on a map whose pack square is `unit` pixels. */
const GLYPH_GRID = 70;

const NOT_TREE_PARTS = ['shadow', 'branch', 'bare', 'dead', 'stump', 'log'];

const g = (id: GlyphId, weight = 1) => ({ id, weight });

/** A one-rule recipe: most of the list. */
function simple(
  id: string,
  name: string,
  hint: string,
  group: RecipeGroup,
  rule: Omit<RecipeRule, 'key' | 'place'> & { place?: DressPlace },
  extra: Partial<Recipe> = {},
): Recipe {
  const mode = extra.mode ?? (rule.place === 'along' ? 'along' : 'area');
  return {
    id,
    name,
    hint,
    group,
    mode,
    rules: [{ key: 'main', place: rule.place ?? (mode === 'along' ? 'along' : 'area'), ...rule }],
    ...extra,
  };
}

/** A room's furniture, squared to the walls (made smarter by the interior recipes). */
const furnish = (
  id: string,
  name: string,
  hint: string,
  words: string[],
  glyphs: { id: GlyphId; weight: number }[],
  glyphSpacing: number,
  glyphSize: [number, number],
): Recipe =>
  simple(id, name, hint, 'Interior', {
    want: { cats: ['furniture', 'decor'], anyWords: words, not: ['broken', 'covered'] },
    max: 10,
    glyphs,
    glyphSpacing,
    glyphSize,
    spacing: 1.4,
    rotation: 'quarter',
    cluster: 0.15,
  });

export const RECIPES: readonly Recipe[] = [
  // Nature
  {
    id: 'forest',
    name: 'Forest',
    hint: 'trees, undergrowth at the edge',
    group: 'Nature',
    mode: 'area',
    rules: [
      {
        key: 'trees',
        place: 'area',
        want: { cats: ['trees'], not: NOT_TREE_PARTS },
        max: 12,
        glyphs: [g('tree', 3), g('pine'), g('bush')],
        glyphSpacing: 46,
        glyphSize: [42, 70],
        spacing: 0.75,
        rotation: 'random',
        cluster: 0.15,
        flip: true,
      },
      {
        key: 'undergrowth',
        place: 'edge',
        want: { cats: ['bushes', 'plants'], anyWords: ['bush', 'fern', 'shrub', 'grass'] },
        max: 10,
        spacing: 1.1,
        depth: 3,
        rotation: 'random',
        apart: true,
        flip: true,
      },
    ],
  },
  simple('trees', 'Trees', 'trees only', 'Nature', {
    want: { cats: ['trees'], not: NOT_TREE_PARTS },
    max: 12,
    glyphs: [g('tree', 3), g('pine')],
    glyphSpacing: 46,
    glyphSize: [42, 70],
    spacing: 0.9,
    rotation: 'random',
    flip: true,
  }),
  simple('pines', 'Pine forest', 'dense conifers', 'Nature', {
    want: { cats: ['trees'], anyWords: ['pine', 'spruce', 'fir'], not: NOT_TREE_PARTS },
    max: 10,
    glyphs: [g('pine', 5), g('tree', 0.5)],
    glyphSpacing: 38,
    glyphSize: [40, 66],
    spacing: 0.7,
    rotation: 'random',
    cluster: 0.1,
  }),
  simple('groves', 'Groves', 'clumps with clearings', 'Nature', {
    want: { cats: ['trees', 'bushes'], not: NOT_TREE_PARTS },
    max: 12,
    glyphs: [g('tree', 3), g('bush')],
    glyphSpacing: 40,
    glyphSize: [40, 64],
    spacing: 0.75,
    rotation: 'random',
    cluster: 0.75,
  }),
  simple('bushes', 'Bushes', 'shrubs and hedges', 'Nature', {
    want: { cats: ['bushes'] },
    max: 12,
    glyphs: [g('bush')],
    glyphSpacing: 34,
    glyphSize: [24, 40],
    spacing: 1,
    rotation: 'random',
  }),
  simple('rocks', 'Rocks', 'boulders and stones', 'Nature', {
    want: { cats: ['rocks'], not: ['stalagmite', 'crystal', 'ore'] },
    max: 16,
    glyphs: [g('rock')],
    glyphSpacing: 52,
    glyphSize: [22, 46],
    spacing: 1.2,
    rotation: 'random',
    cluster: 0.4,
  }),
  simple('flowers', 'Flowers', 'blooms in the grass', 'Nature', {
    want: { cats: ['plants'], anyWords: ['flower'] },
    max: 14,
    spacing: 1.4,
    rotation: 'random',
    cluster: 0.3,
  }),
  simple('grass', 'Tall grass', 'tufts and weeds', 'Nature', {
    want: { cats: ['plants'], anyWords: ['grass', 'weed'] },
    max: 14,
    glyphs: [g('tuft')],
    glyphSpacing: 30,
    glyphSize: [16, 26],
    spacing: 1.2,
    rotation: 'random',
    cluster: 0.2,
  }),
  simple('mushrooms', 'Mushrooms', 'fungi', 'Nature', {
    want: { cats: ['plants'], anyWords: ['mushroom'] },
    max: 12,
    spacing: 1.2,
    rotation: 'random',
    cluster: 0.4,
  }),
  simple('vines', 'Vines', 'creepers and roots', 'Nature', {
    want: { cats: ['plants'], anyWords: ['vine', 'root'] },
    max: 12,
    spacing: 1,
    rotation: 'random',
  }),
  simple('cacti', 'Desert plants', 'cacti and scrub', 'Nature', {
    want: { cats: ['plants', 'bushes', 'trees'], anyWords: ['cact', 'agave', 'yucca', 'palm'] },
    max: 12,
    glyphs: [g('palm')],
    glyphSpacing: 50,
    glyphSize: [36, 56],
    spacing: 1,
    rotation: 'random',
  }),
  simple('crystals', 'Crystals', 'crystals and ore', 'Nature', {
    want: { cats: ['rocks'], anyWords: ['crystal', 'ore'] },
    max: 14,
    spacing: 1,
    rotation: 'random',
    cluster: 0.4,
  }),
  simple('leaves', 'Fallen leaves', 'leaf litter', 'Nature', {
    want: { cats: ['plants'], anyWords: ['leaves', 'leaf'] },
    max: 14,
    spacing: 1.2,
    rotation: 'random',
  }),
  simple('puddles', 'Puddles', 'standing water', 'Nature', {
    want: { cats: ['decor'], anyWords: ['puddle'] },
    max: 12,
    spacing: 1.6,
    rotation: 'random',
  }),
  simple(
    'reeds',
    'Reeds',
    'in water',
    'Nature',
    {
      want: { cats: ['plants', 'waterfx'], anyWords: ['reed', 'lily', 'cattail'] },
      max: 10,
      glyphs: [g('reed')],
      glyphSpacing: 26,
      glyphSize: [18, 30],
      spacing: 1,
      rotation: 'random',
      cluster: 0.5,
    },
    { onlyOn: ['water'] },
  ),
  // Edges and lines
  simple('hedge', 'Hedge or tree line', 'along a line you draw', 'Edges', {
    place: 'along',
    want: { cats: ['bushes'] },
    max: 8,
    glyphs: [g('bush', 3), g('tree')],
    glyphSpacing: 30,
    glyphSize: [26, 40],
    spacing: 0.8,
    rotation: 'random',
    jitter: 0.12,
  }),
  simple('roadside', 'Trees beside a road', 'both sides of a line', 'Edges', {
    place: 'along',
    want: { cats: ['trees'], not: NOT_TREE_PARTS },
    max: 8,
    glyphs: [g('tree', 3), g('pine')],
    glyphSpacing: 62,
    glyphSize: [40, 60],
    spacing: 1.4,
    offset: 2,
    sides: 'both',
    rotation: 'random',
    jitter: 0.25,
  }),
  simple('fence', 'Fence line', 'posts and rails along a line', 'Edges', {
    place: 'along',
    want: { cats: ['buildings'], anyWords: ['fence', 'railing', 'palisade'] },
    max: 10,
    spacing: 1,
    rotation: 'along',
  }),
  // Clutter and decay
  simple('clutter', 'Clutter', 'small things on the floor', 'Clutter', {
    want: { cats: ['clutter'] },
    max: 18,
    spacing: 1.6,
    rotation: 'random',
    cluster: 0.3,
  }),
  simple('rubble', 'Rubble', 'debris and ruins', 'Decay', {
    want: { cats: ['rubble'] },
    max: 14,
    spacing: 1.2,
    rotation: 'random',
    cluster: 0.3,
  }),
  // A world map's hills and mountains (drawn art: the packs are for battle maps).
  simple('hills', 'Hills', 'rolling hills', 'World', {
    glyphs: [g('hill')],
    glyphSpacing: 84,
    glyphSize: [80, 130],
    spacing: 1,
    cluster: 0.2,
  }),
  simple('mountains', 'Mountain range', 'along a line you draw', 'World', {
    place: 'along',
    glyphs: [g('mountain', 3), g('peak')],
    glyphSpacing: 66,
    glyphSize: [90, 150],
    spacing: 1,
    jitter: 0.7,
  }),
  // A room's furniture
  furnish(
    'tavern',
    'Tavern',
    'tables, chairs, barrels',
    ['table', 'chair', 'stool', 'bench', 'barrel'],
    [g('table', 2), g('chair', 5), g('barrel')],
    175,
    [62, 104],
  ),
  furnish(
    'storage',
    'Storeroom',
    'barrels, crates, chests',
    ['barrel', 'crate', 'chest', 'sack', 'box'],
    [g('barrel', 3), g('crate', 3), g('chest')],
    112,
    [48, 70],
  ),
  furnish(
    'bedroom',
    'Bedroom',
    'beds, chests, a shelf',
    ['bed', 'chest', 'wardrobe', 'nightstand'],
    [g('bed', 2), g('chest'), g('shelf'), g('chair')],
    200,
    [66, 120],
  ),
  furnish(
    'workshop',
    'Workshop',
    'benches, crates, shelves',
    ['workbench', 'table', 'crate', 'shelf', 'barrel'],
    [g('table', 3), g('crate'), g('barrel'), g('shelf')],
    165,
    [62, 104],
  ),
  furnish(
    'study',
    'Library or study',
    'shelves, tables, chairs',
    ['bookshelf', 'bookcase', 'desk', 'chair', 'table'],
    [g('shelf', 3), g('table'), g('chair', 2)],
    170,
    [80, 130],
  ),
];

export const recipeById = (id: string): Recipe | undefined => RECIPES.find((r) => r.id === id);

/** The interior recipes: what "Furnish it as…" offers. */
export const FURNISH_RECIPES: readonly Recipe[] = RECIPES.filter((r) => r.group === 'Interior');

type Pickable = Pick<PackEntry, 'path' | 'pack' | 'cat'>;

/** How wide pictures typically are, in pack squares (the middle one of the set). */
function typicalSquares(refs: readonly { path: string }[]): number {
  const widths = refs.map((r) => squaresOf(r.path)?.w ?? 1).sort((a, b) => a - b);
  return Math.max(1, widths[Math.floor(widths.length / 2)] ?? 1);
}

export interface RecipeOptions {
  /** Pixels to a pack square on this map (`stampUnit`). */
  unit: number;
  /** Use the drawn glyphs even when the packs have pictures. */
  drawn?: boolean;
}

/**
 * One recipe rule as a dress rule: the pack pictures it wants (a few, spread over the set), or its
 * glyphs when the packs have none. Null when it has neither.
 */
export function resolveRule(
  recipe: Recipe,
  rule: RecipeRule,
  entries: readonly Pickable[],
  options: RecipeOptions,
): DressRule | null {
  const picked = !options.drawn && rule.want ? pickMany(entries, rule.want, rule.max ?? 12) : [];
  const common = {
    place: rule.place,
    from: `${recipe.id}:${rule.key}`,
    rotation: rule.rotation ?? 'none',
    ...(rule.rotMin !== undefined ? { rotMin: rule.rotMin } : {}),
    ...(rule.rotMax !== undefined ? { rotMax: rule.rotMax } : {}),
    ...(rule.overlap ? { overlap: rule.overlap } : {}),
    cluster: rule.cluster ?? 0,
    sides: rule.sides ?? 'center',
    jitter: rule.jitter ?? 0,
    ...(rule.falloff ? { falloff: rule.falloff } : {}),
    ...(rule.snap ? { snap: rule.snap } : {}),
    ...(rule.flip ? { flip: true } : {}),
    ...(rule.tint ? { tint: rule.tint } : {}),
    ...(rule.apart ? { apart: true } : {}),
  } satisfies Partial<DressRule>;
  if (picked.length > 0) {
    const width = typicalSquares(picked) * options.unit;
    const [lo, hi] = rule.vary ?? [80, 120];
    return {
      ...common,
      pieces: picked.map((e) => ({ ref: packRef(e.pack, e.path), weight: 1 })),
      spacing: Math.max(4, Math.round(width * rule.spacing)),
      sizeMin: lo,
      sizeMax: hi,
      offset: Math.round((rule.offset ?? 0) * options.unit),
      ...(rule.depth !== undefined ? { depth: Math.round(rule.depth * options.unit) } : {}),
    };
  }
  if (!rule.glyphs?.length) return null;
  const k = options.unit / GLYPH_GRID;
  const [lo, hi] = rule.glyphSize ?? [30, 50];
  const spacing = rule.glyphSpacing ?? (lo + hi) / 2;
  return {
    ...common,
    // Glyphs are drawn standing up: they are never turned any way, only squared or along a line.
    rotation: rule.rotation === 'random' ? 'none' : (rule.rotation ?? 'none'),
    pieces: rule.glyphs.map((x) => ({ ref: glyphRef(x.id), weight: x.weight })),
    spacing: Math.max(4, Math.round(spacing * k)),
    sizeMin: Math.round(lo * k),
    sizeMax: Math.round(hi * k),
    offset: Math.round((rule.offset ?? 0) * options.unit),
    ...(rule.depth !== undefined ? { depth: Math.round(rule.depth * options.unit) } : {}),
  };
}

/** A recipe's rules for a dressing: the rules the packs (or glyphs) can fill. */
export function recipeRules(
  recipe: Recipe,
  entries: readonly Pickable[],
  options: RecipeOptions,
): DressRule[] {
  return recipe.rules.flatMap((r) => {
    const rule = resolveRule(recipe, r, entries, options);
    return rule ? [rule] : [];
  });
}

/** Whether the recipe can be made from the packs: its first rule finds at least three pictures. */
export function fromPacks(recipe: Recipe, entries: readonly Pickable[]): boolean {
  const first = recipe.rules[0];
  return Boolean(first?.want && pickMany(entries, first.want, 3).length >= 3);
}

/** Whether the recipe has drawn glyphs to stand in. */
export const hasGlyphs = (recipe: Recipe): boolean =>
  recipe.rules.some((r) => (r.glyphs?.length ?? 0) > 0);

/**
 * A dress rule with its pictures picked again from the packs (all of them, not only the favourite
 * biome), keeping its other settings. Rules not made from a recipe come back as they were.
 */
export function pickAgain(rule: DressRule, entries: readonly Pickable[], seed: number): DressRule {
  const [recipeId, key] = (rule.from ?? '').split(':');
  const recipeRule = recipeById(recipeId ?? '')?.rules.find((r) => r.key === key);
  if (!recipeRule?.want) return rule;
  const pool = pickMany(entries, recipeRule.want, 400, false);
  if (pool.length === 0) return rule;
  const count = Math.min(pool.length, recipeRule.max ?? 12);
  // A shuffle from the seed: another few of the pictures that fit.
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    if (a && b) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  return {
    ...rule,
    pieces: shuffled.slice(0, count).map((e) => ({ ref: packRef(e.pack, e.path), weight: 1 })),
  };
}
