import { glyphRef, type GlyphId } from '../glyphs';
import type { DressPlace, DressRule } from '../model';
import { pickMany } from '../packDefaults';
import { packRef, squaresOf, type PackEntry } from '../packModel';
import { INTERIOR_PLACES } from './interior';
import { INTERIOR_RECIPES } from './interiors';
import { NATURE_RECIPES } from './nature';
import type { Recipe, RecipeGroup, RecipeRule } from './recipeTypes';

export type { Recipe, RecipeGroup, RecipeRule } from './recipeTypes';

/**
 * Recipes: what the Dress tool can lay down (a forest, a hedge, a tavern's furniture), as rules
 * that name the pictures they want from the packs (a `Wanted` query) and drawn glyphs to stand in
 * while no pack is imported (ADR 0013). A recipe becomes the rules of a dressing with
 * `recipeRules`, which picks the pictures once (the palette): importing more packs later does not
 * change a dressing, "Pick again" does. Pure data and functions.
 */

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

export const RECIPES: readonly Recipe[] = [
  // Nature: the biome brushes (`nature.ts`), then single kinds of plant or rock.
  ...NATURE_RECIPES,
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
    want: {
      cats: ['plants', 'bushes', 'trees'],
      anyWords: ['cact', 'agave', 'yucca', 'palm'],
      not: ['trunk', 'leaf', 'leaves', 'shadow'],
    },
    max: 12,
    glyphs: [g('palm')],
    glyphSpacing: 50,
    glyphSize: [36, 56],
    spacing: 1,
    rotation: 'random',
  }),
  simple('crystals', 'Crystals', 'crystals and ore', 'Nature', {
    want: { cats: ['rocks'], anyWords: ['crystal', 'ore'], not: ['minecart', '_fill'] },
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
    want: {
      cats: ['buildings'],
      anyWords: ['fence', 'railing', 'palisade'],
      not: ['fallen', 'broken', 'stairs'],
    },
    max: 10,
    spacing: 1,
    rotation: 'along',
  }),
  // Edges: softening the hard line of a road, a wall, a shape or a shore.
  simple('weed-edge', 'Weedy edge', 'weeds and grass along a road or wall', 'Edges', {
    place: 'along',
    want: {
      cats: ['plants'],
      anyWords: ['/weed_edges/', '/long_grass/', '/grass/'],
      not: ['overlay', 'shadow'],
    },
    max: 10,
    spacing: 0.7,
    sides: 'both',
    offset: 0.6,
    jitter: 0.4,
    rotation: 'random',
    flip: true,
    tint: 0.25,
  }),
  simple(
    'shore',
    'Shore and reeds',
    'reeds, lily pads and stones at the edge of water',
    'Edges',
    {
      place: 'edge',
      want: {
        cats: ['plants', 'waterfx'],
        anyWords: ['/cattails/', '/lilypads/', 'reed'],
        not: ['overlay'],
      },
      max: 10,
      spacing: 0.8,
      depth: 1.5,
      rotation: 'random',
      cluster: 0.4,
      flip: true,
    },
    { onlyOn: ['water'] },
  ),
  simple('rocky-edge', 'Rocky edge', 'stones and pebbles along a line', 'Edges', {
    place: 'along',
    want: { cats: ['rocks'], anyWords: ['/stones/', '/pebbles/'], not: ['ore', 'crystal'] },
    max: 12,
    spacing: 0.9,
    sides: 'both',
    offset: 0.5,
    jitter: 0.5,
    rotation: 'random',
  }),
  simple('tracks', 'Tracks', 'footprints or paw prints along a path', 'Edges', {
    place: 'along',
    want: { cats: ['decor'], words: ['/tracks/', '_wolf_'], not: ['overlay'] },
    max: 4,
    spacing: 0.6,
    sides: 'both',
    offset: 0.2,
    jitter: 0.05,
    rotation: 'along',
    // The prints point up in their pictures; laid along the line they point the way it goes.
    turn: 90,
  }),
  simple('boot-tracks', 'Boot prints', 'people walked this way', 'Edges', {
    place: 'along',
    want: { cats: ['decor'], words: ['/tracks/'], anyWords: ['_foot_', 'boot'], not: ['large'] },
    max: 4,
    spacing: 0.5,
    sides: 'both',
    offset: 0.18,
    jitter: 0.05,
    rotation: 'along',
    turn: 90,
  }),
  // Clutter and decay
  simple('pile', 'Storage pile', 'crates, barrels and sacks in heaps', 'Clutter', {
    place: 'cluster',
    want: {
      cats: ['decor'],
      anyWords: ['/crates/', '/barrels/', '/sacks/', '/boxes/'],
      not: ['side', 'lid', 'sticker', 'spray', 'broken', 'large', 'ceremorph'],
    },
    max: 12,
    glyphs: [g('crate', 2), g('barrel')],
    glyphSpacing: 40,
    glyphSize: [36, 44],
    spacing: 0.9,
    vary: [100, 100],
    rotation: 'random',
    rotMin: -12,
    rotMax: 12,
  }),
  simple('gear', 'Adventuring gear', 'packs, ropes, tools in a heap', 'Clutter', {
    place: 'cluster',
    want: {
      cats: ['clutter'],
      anyWords: ['/backpacks/', '/bags_and_purses/', '/ropes/', '/tools/', '/liquid_containers/'],
      not: ['broken', 'ceremorph'],
    },
    max: 14,
    spacing: 0.7,
    rotation: 'random',
  }),
  simple('clutter', 'Clutter', 'small things on the floor', 'Clutter', {
    want: { cats: ['clutter'] },
    max: 18,
    spacing: 1.6,
    rotation: 'random',
    cluster: 0.3,
  }),
  simple('rubble', 'Rubble', 'debris and ruins', 'Decay', {
    want: { cats: ['rubble'], not: ['overlay', 'walls_and_curbs'] },
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
  // A room's furniture (`interiors.ts`)
  ...INTERIOR_RECIPES,
];

export const recipeById = (id: string): Recipe | undefined => RECIPES.find((r) => r.id === id);

/** The room types: what "Furnish it as…" offers. */
export const FURNISH_RECIPES: readonly Recipe[] = RECIPES.filter((r) => r.room === true);

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
    ...(rule.count !== undefined ? { count: rule.count } : {}),
    ...(rule.fill !== undefined ? { fill: rule.fill } : {}),
    ...(rule.loose ? { loose: rule.loose } : {}),
    ...(rule.floor ? { floor: true } : {}),
    ...(rule.beneath ? { beneath: true } : {}),
    ...(rule.fit ? { fit: true } : {}),
    ...(rule.turn ? { turn: rule.turn } : {}),
  } satisfies Partial<DressRule>;
  // Interiors space pieces by a gap (in squares) between them, not by a spacing of centres.
  const interior = INTERIOR_PLACES.has(rule.place);
  if (picked.length > 0) {
    const width = typicalSquares(picked) * options.unit;
    const [lo, hi] = rule.vary ?? (interior ? [100, 100] : [80, 120]);
    return {
      ...common,
      pieces: picked.map((e) => ({ ref: packRef(e.pack, e.path), weight: 1 })),
      spacing: interior
        ? Math.round((rule.gap ?? 0) * options.unit)
        : Math.max(4, Math.round(width * rule.spacing)),
      sizeMin: lo,
      sizeMax: hi,
      offset: Math.round((rule.offset ?? 0) * options.unit),
      ...(rule.depth !== undefined ? { depth: Math.round(rule.depth * options.unit) } : {}),
    };
  }
  // Glyphs stand in only for drawn art or while no pack is imported: a room made from the packs
  // never mixes drawn tables with pack chairs.
  if (!rule.glyphs?.length || (!options.drawn && entries.length > 0)) return null;
  const k = options.unit / GLYPH_GRID;
  const [lo, hi] = rule.glyphSize ?? [30, 50];
  const spacing = rule.glyphSpacing ?? (lo + hi) / 2;
  return {
    ...common,
    // Glyphs are drawn standing up: they are never turned any way, only squared or along a line.
    rotation: rule.rotation === 'random' ? 'none' : (rule.rotation ?? 'none'),
    pieces: rule.glyphs.map((x) => ({ ref: glyphRef(x.id), weight: x.weight })),
    spacing: interior
      ? Math.round((rule.gap ?? 0) * options.unit)
      : Math.max(4, Math.round(spacing * k)),
    sizeMin: Math.round(lo * k),
    sizeMax: Math.round(hi * k),
    offset: Math.round((rule.offset ?? 0) * options.unit),
    ...(rule.depth !== undefined ? { depth: Math.round(rule.depth * options.unit) } : {}),
  };
}

/**
 * A recipe's rules for a dressing: the rules the packs (or glyphs) can fill. A rule whose anchor
 * could not be filled (no tables, so no chairs round them) is left out too; anchors become the
 * index of the rule in the list made.
 */
export function recipeRules(
  recipe: Recipe,
  entries: readonly Pickable[],
  options: RecipeOptions,
): DressRule[] {
  const out: DressRule[] = [];
  const index = new Map<string, number>();
  for (const r of recipe.rules) {
    let anchor: number | undefined;
    if (r.anchor !== undefined) {
      anchor = index.get(r.anchor);
      if (anchor === undefined) continue;
    }
    const rule = resolveRule(recipe, r, entries, options);
    if (!rule) continue;
    index.set(r.key, out.length);
    out.push(anchor === undefined ? rule : { ...rule, anchor });
  }
  return out;
}

/**
 * Whether the recipe can be made from the packs: its first rule finds at least two pictures, so
 * a dressing is not one picture over and over (a room: one of its rules finds a picture that is
 * not a rug).
 */
export function fromPacks(recipe: Recipe, entries: readonly Pickable[]): boolean {
  if (recipe.room)
    return recipe.rules.some((r) => !r.floor && r.want && pickMany(entries, r.want, 1).length > 0);
  const first = recipe.rules[0];
  return Boolean(first?.want && pickMany(entries, first.want, 2).length >= 2);
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
