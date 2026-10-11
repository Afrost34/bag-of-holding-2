import type { GlyphId } from '../glyphs';
import type { CategoryId } from '../packCategories';
import type { Wanted } from '../packDefaults';
import type { Recipe, RecipeRule } from './recipeTypes';

/**
 * Room types: how each kind of room is furnished, as interior rules (`dress/interior.ts`): a rug
 * first (furniture stands on it), then the big pieces back to the walls or down the middle, the
 * seats round the tables, what goes on the tables, and the corners. The queries name Forgotten
 * Adventures folders (`/rectangle_tables/`); `recipes.test.ts` checks them on real names.
 *
 * Density is "lived-in" (the owner's choice): the main furniture plus some clutter, with the
 * doorways and a way round kept free. Big furniture is square on; seats and clutter are turned a
 * little (`loose`).
 */

/** Pieces of a picture, not a whole thing (and broken things, which decay puts in). */
const NOT_PARTS = [
  'broken',
  'ceremorph',
  '_base',
  '/parts/',
  'legs_and_bases',
  'flap',
  'cutout',
  'fallen',
  'covered',
  'shadow',
];

const q = (cats: CategoryId[], folders: string[], not: string[] = []): Wanted => ({
  cats,
  anyWords: folders,
  not: [...NOT_PARTS, ...not],
});

const g = (id: GlyphId, weight = 1) => ({ id, weight });

/** A room recipe. */
const room = (id: string, name: string, hint: string, rules: RecipeRule[]): Recipe => ({
  id,
  name,
  hint,
  group: 'Interior',
  mode: 'area',
  room: true,
  rules,
});

// region The pieces rooms share

const TABLES = q(
  ['furniture'],
  ['/rectangle_tables/', '/round_tables/', '/square_tables/'],
  ['filled'],
);
const SEATS = q(['furniture'], ['/chairs/', '/stools/'], ['armchair', 'fancy', 'throne', 'child']);
const BARRELS = q(['decor'], ['/barrels/'], ['side', 'large']);
const CRATES = q(
  ['decor'],
  ['/crates/', '/barrels/', '/sacks/'],
  ['side', 'lid', 'sticker', 'spray'],
);
const CHESTS = q(['decor'], ['/chests/'], ['open']);
const BEDS = q(['furniture'], ['single_bed_', 'double_bed_'], ['frame', 'ladder']);
const RUGS = q(['decor'], ['/rugs/rectangle/', '/rugs/oval/'], ['tassel', 'fringe', 'rolled']);
const SHELVES = q(['furniture'], ['/shelves/filled/', '/bookshelves/'], ['modular']);
const BOOKSHELVES = q(['furniture'], ['/bookshelves/'], ['modular']);
const CANDLES = q(['lights'], ['/arranged_candles/', '/candelabras/']);
/** Only lit braziers give light (`glow.ts`). */
const BRAZIERS = q(['lights'], ['/braziers/lit/']);
const WALL_LIGHTS = q(['lights'], ['/interior_wall_lights/'], ['/parts/']);

/** Lamps on the walls, a few squares apart (their mount is at the top of the picture). */
const wallLights = (count: number): RecipeRule => ({
  key: 'lights',
  place: 'wall',
  want: WALL_LIGHTS,
  max: 3,
  spacing: 0,
  gap: 3,
  count,
});

/** Tables down the middle of the room, as many as fit with room to walk round them. */
const tables = (count?: number): RecipeRule => ({
  key: 'tables',
  place: 'centre',
  want: TABLES,
  max: 4,
  glyphs: [g('table')],
  glyphSize: [90, 90],
  spacing: 0,
  gap: 1.5,
  ...(count !== undefined ? { count } : {}),
});

/** Seats round the tables, facing them. */
const seats: RecipeRule = {
  key: 'seats',
  place: 'around',
  anchor: 'tables',
  want: SEATS,
  max: 6,
  glyphs: [g('chair')],
  glyphSize: [40, 40],
  spacing: 0,
  gap: 0.1,
  loose: 12,
};

/** A plate or a mug on the table in front of each seat. */
const settings: RecipeRule = {
  key: 'settings',
  place: 'setting',
  anchor: 'seats',
  want: q(['clutter'], ['/dishes/', '/mugs/', '/cups/'], ['pan', 'pot', 'side']),
  max: 8,
  spacing: 0,
  loose: 20,
};

/** Something in the middle of each table. */
const onTables = (want: Wanted, count = 1): RecipeRule => ({
  key: 'on-tables',
  place: 'on',
  anchor: 'tables',
  want,
  max: 8,
  spacing: 0,
  count,
});

const rug: RecipeRule = {
  key: 'rug',
  place: 'centre',
  want: RUGS,
  max: 6,
  spacing: 0,
  count: 1,
  floor: true,
};

/** Pieces back to the walls. */
const wall = (
  key: string,
  want: Wanted,
  options: Partial<RecipeRule> & { glyphs?: { id: GlyphId; weight: number }[] } = {},
): RecipeRule => ({
  key,
  place: 'wall',
  want,
  max: 8,
  spacing: 0,
  gap: 0.25,
  glyphSize: [60, 60],
  ...options,
});

/** Pieces in the corners. */
const corners = (key: string, want: Wanted, count = 2, glyphs?: GlyphId[]): RecipeRule => ({
  key,
  place: 'corner',
  want,
  max: 6,
  spacing: 0,
  count,
  loose: 10,
  ...(glyphs ? { glyphs: glyphs.map((id) => g(id)), glyphSize: [44, 44] } : {}),
});

// endregion

export const INTERIOR_RECIPES: readonly Recipe[] = [
  // Lights for any room ("Light this room"): not a room type of its own.
  {
    id: 'room-lights',
    name: 'Wall lamps',
    hint: 'lamps round the walls of a room',
    group: 'Interior',
    mode: 'area',
    rules: [{ ...wallLights(12), gap: 3.5 }],
  },
  // Tavern and inn
  room('tavern', 'Common room', 'tables and seats, barrels, benches', [
    tables(),
    seats,
    settings,
    onTables(q(['lights', 'clutter'], ['/arranged_candles/', '/prepared_meals/', '/pitchers/'])),
    wall('benches', q(['furniture'], ['/benches/']), { count: 3, fill: 0.5 }),
    wall('barrels', BARRELS, { count: 4, fill: 0.6, glyphs: [g('barrel')], glyphSize: [40, 40] }),
    wallLights(4),
    corners('corners', CRATES, 2, ['crate']),
  ]),
  room('kitchen', 'Kitchen', 'ovens, cupboards, a work table', [
    wall('ovens', q(['furniture'], ['/cooking_appliances/']), { count: 2 }),
    wall(
      'cupboards',
      q(
        ['furniture'],
        ['/cupboards_and_wardrobes/', '/shelves/filled/'],
        ['wardrobe', 'nightstand', 'fancy'],
      ),
      { fill: 0.6, glyphs: [g('shelf')], glyphSize: [70, 70] },
    ),
    wallLights(2),
    tables(1),
    onTables(
      q(
        ['clutter'],
        ['/kitchen_accessories/', '/pans_and_pots/', '/vegetables/', '/breads/', '/meats/'],
      ),
      3,
    ),
    corners('corners', q(['decor'], ['/sacks/', '/barrels/', '/baskets/filled/'], ['side']), 3, [
      'barrel',
    ]),
  ]),
  room('guest-room', 'Guest room', 'two beds, a chest, a nightstand', [
    rug,
    wall('beds', BEDS, { count: 2, glyphs: [g('bed')], glyphSize: [50, 50] }),
    wall('nightstand', q(['furniture'], ['/nightstands/']), { count: 1 }),
    corners('chest', CHESTS, 1, ['chest']),
  ]),
  room('cellar', 'Cellar', 'barrels, wine racks, crates', [
    wall('barrels', BARRELS, { fill: 0.9, glyphs: [g('barrel')], glyphSize: [40, 40] }),
    wall('wine', q(['clutter'], ['/wine_racks/']), { count: 2 }),
    corners('crates', CRATES, 4, ['crate']),
  ]),
  // Homes and shops
  room('bedroom', 'Bedroom', 'a bed, a wardrobe, a chest', [
    rug,
    wall('bed', BEDS, { count: 1, glyphs: [g('bed')], glyphSize: [60, 60] }),
    wall('nightstand', q(['furniture'], ['/nightstands/']), { count: 1 }),
    wall('wardrobe', q(['furniture'], ['/wardrobes/'], ['door']), { count: 1 }),
    corners('chest', CHESTS, 1, ['chest']),
  ]),
  room('living-room', 'Living room', 'a couch, armchairs, a bookshelf', [
    rug,
    tables(1),
    { ...seats, want: q(['furniture'], ['/armchairs/']), count: 2, loose: 15 },
    wall('couch', q(['furniture'], ['/couches/']), { count: 1 }),
    wall('bookshelf', BOOKSHELVES, { count: 1, glyphs: [g('shelf')], glyphSize: [70, 70] }),
  ]),
  room('shop', 'Shop floor', 'display cases, shelves of wares', [
    {
      key: 'counter',
      place: 'centre',
      want: q(['furniture'], ['/display_cases/']),
      max: 4,
      spacing: 0,
      gap: 1,
      count: 2,
      glyphs: [g('table')],
      glyphSize: [80, 80],
    },
    wall('wares', q(['furniture'], ['/shelves/filled/', '/display_cases/filled/']), {
      fill: 0.8,
      glyphs: [g('shelf')],
      glyphSize: [70, 70],
    }),
    corners('corners', CRATES, 2, ['crate']),
  ]),
  room('storage', 'Storeroom', 'crates, barrels, sacks', [
    wall('stock', CRATES, { fill: 1, glyphs: [g('crate'), g('barrel')], glyphSize: [40, 40] }),
    corners('corners', CRATES, 4, ['barrel']),
    {
      key: 'stacks',
      place: 'centre',
      want: CRATES,
      max: 6,
      spacing: 0,
      gap: 1,
      count: 2,
      loose: 15,
      glyphs: [g('crate')],
      glyphSize: [44, 44],
    },
  ]),
  room('workshop', 'Workshop', 'a work table, tools, toolboxes', [
    tables(1),
    onTables(q(['workplace'], ['/woodworking_tools/', '/smithing_tools/', '/tailoring_tools/']), 3),
    wall('toolboxes', q(['workplace'], ['/toolboxes/', '/wheelbarrows/']), { count: 2 }),
    wall('shelves', SHELVES, { count: 2, glyphs: [g('shelf')], glyphSize: [70, 70] }),
    corners('corners', CRATES, 2, ['crate']),
  ]),
  room('smithy', 'Smithy', 'a forge, an anvil, quenching troughs', [
    corners('forge', q(['workplace'], ['/forges/']), 1),
    {
      key: 'anvil',
      place: 'centre',
      want: q(['workplace'], ['anvil_']),
      max: 3,
      spacing: 0,
      gap: 1,
      count: 1,
    },
    wall('troughs', q(['workplace'], ['/troughs/', '/bellows/']), { count: 2 }),
    wall('racks', q(['combat'], ['/weapon_racks/'], ['empty']), { count: 1 }),
    corners('corners', BARRELS, 2, ['barrel']),
  ]),
  // Martial and civic
  room('barracks', 'Barracks', 'rows of beds, weapon racks, a table', [
    wall(
      'beds',
      q(
        ['furniture'],
        ['single_bed_', '/bedrolls_and_sleeping_bags/'],
        ['frame', 'ladder', 'rolled'],
      ),
      {
        fill: 1,
        glyphs: [g('bed')],
        glyphSize: [50, 50],
      },
    ),
    wall('racks', q(['combat'], ['/weapon_racks/'], ['empty']), { count: 1 }),
    wallLights(3),
    tables(1),
    { ...seats, count: 4 },
    corners('chests', CHESTS, 2, ['chest']),
  ]),
  room('armory', 'Armory', 'weapon racks, armor stands', [
    wall('racks', q(['combat'], ['/weapon_racks/'], ['empty']), { fill: 0.9 }),
    wallLights(2),
    corners('stands', q(['combat'], ['/armor_stands/', '/training_dummies/'], ['dummy_arm']), 4),
    tables(1),
    onTables(q(['combat'], ['/swords/', '/axes/', '/shields/', '/daggers/']), 2),
  ]),
  room('prison', 'Prison cell', 'straw bedding, chains, a bucket', [
    wall(
      'bedding',
      q(['furniture'], ['/hay_bedding/', '/bedrolls_and_sleeping_bags/'], ['rolled']),
      {
        count: 1,
      },
    ),
    wall('chains', q(['decor'], ['/restraints_and_chains/'], ['torment', 'path']), { count: 2 }),
    corners('bucket', q(['decor'], ['/buckets/']), 1),
  ]),
  room('throne-room', 'Throne room', 'a throne, banners, braziers', [
    { ...rug, want: q(['decor'], ['/rugs/rectangle/'], ['small', 'tassel', 'rolled']) },
    wall('throne', q(['furniture'], ['/thrones/']), { count: 1 }),
    wall('banners', q(['decor'], ['/banners/'], ['ripped', 'top', 'pole']), {
      count: 4,
      fill: 0.5,
    }),
    corners('braziers', BRAZIERS, 4),
  ]),
  room('guardhouse', 'Guardhouse', 'a table, a weapon rack, a bench', [
    tables(1),
    seats,
    wall('racks', q(['combat'], ['/weapon_racks/'], ['empty']), { count: 1 }),
    wall('bench', q(['furniture'], ['/benches/']), { count: 1 }),
    wallLights(2),
    corners('barrels', BARRELS, 2, ['barrel']),
  ]),
  // Arcane and holy
  room('study', 'Library or study', 'bookshelves, reading tables', [
    wall('shelves', BOOKSHELVES, { fill: 1, glyphs: [g('shelf')], glyphSize: [70, 70] }),
    tables(2),
    { ...seats, count: 2 },
    onTables(q(['clutter'], ['/books_and_tomes/', '/scrolls/']), 2),
    corners('stands', q(['furniture'], ['/book_stands/']), 2),
  ]),
  room('wizard-lab', 'Wizard’s laboratory', 'shelves, glassware, an orrery', [
    wall('shelves', SHELVES, { fill: 0.6, glyphs: [g('shelf')], glyphSize: [70, 70] }),
    wall('desk', q(['furniture'], ['/desks/'], ['school', 'control', 'corner']), { count: 1 }),
    tables(1),
    onTables(q(['workplace'], ['/glassware/']), 3),
    // An orrery is its base (the arms and planets are parts to add by hand).
    corners(
      'orrery',
      { cats: ['furniture'], words: ['/orreries/'], not: ['/arms/', '/planets/'] },
      1,
    ),
  ]),
  room('alchemy', 'Alchemist’s workroom', 'glassware, a cauldron', [
    wall('shelves', SHELVES, { fill: 0.6 }),
    tables(1),
    onTables(q(['workplace'], ['/alchemy_arrangements/', '/glassware/']), 3),
    corners('cauldron', q(['clutter'], ['/cauldrons/']), 1),
  ]),
  room('shrine', 'Shrine', 'an altar, candles', [
    rug,
    wall('altar', q(['furniture'], ['/altars/']), { count: 1 }),
    corners('candles', CANDLES, 4),
  ]),
  room('temple', 'Temple nave', 'rows of pews, an altar, braziers', [
    {
      key: 'pews',
      place: 'centre',
      want: q(['furniture'], ['pew_', '/benches/']),
      max: 3,
      spacing: 0,
      gap: 0.6,
      glyphs: [g('table')],
      glyphSize: [70, 40],
    },
    wall('altar', q(['furniture'], ['/altars/']), { count: 1 }),
    corners('braziers', BRAZIERS, 4),
  ]),
  room('crypt', 'Crypt', 'sarcophagi, coffins, candles', [
    {
      key: 'sarcophagi',
      place: 'centre',
      want: q(['graves'], ['/sarcophagi/']),
      max: 4,
      spacing: 0,
      gap: 1,
      glyphs: [g('chest')],
      glyphSize: [60, 60],
    },
    wall('coffins', q(['graves'], ['/coffins/']), { fill: 0.4 }),
    corners('candles', CANDLES, 4),
  ]),
  // Dungeons and caves
  room('corridor', 'Corridor', 'a lamp now and then', [{ ...wallLights(2), gap: 6 }]),
  room('treasury', 'Treasury', 'chests, coins and treasure piles, braziers', [
    wall('chests', q(['decor'], ['/treasure_chests/'], ['empty']), {
      count: 3,
      glyphs: [g('chest')],
      glyphSize: [44, 44],
    }),
    {
      key: 'hoard',
      place: 'centre',
      want: q(['clutter'], ['/treasure_piles/', '/coin_piles/'], ['edge']),
      max: 4,
      spacing: 0,
      gap: 0.6,
      count: 3,
      loose: 30,
    },
    corners('braziers', BRAZIERS, 2),
  ]),
  room('machine-room', 'Machine room', 'old gears, levers, a tank', [
    {
      key: 'gears',
      place: 'centre',
      want: q(['buildings'], ['/cogs/'], ['giant', 'huge', 'lid']),
      max: 4,
      spacing: 0,
      gap: 1,
      count: 3,
      loose: 40,
      glyphs: [g('barrel')],
      glyphSize: [60, 60],
    },
    wall('levers', q(['buildings'], ['/levers/']), { count: 3 }),
    corners('tank', { cats: ['buildings'], anyWords: ['pipe_tank_'], not: ['broken'] }, 1),
    wallLights(1),
  ]),
  room('collapsed', 'Collapsed room', 'fallen stone and rubble', [
    corners('rubble', q(['rubble'], ['/rubble/'], ['overlay', 'damage']), 4),
    wall('heaps', q(['rubble'], ['/rubble/'], ['overlay', 'damage']), { fill: 0.5 }),
  ]),
  room('cavern', 'Cavern', 'stalagmites and rocks', [
    corners('stalagmites', q(['rocks'], ['/stalagmites/']), 4, ['rock']),
    wall('rocks', q(['rocks'], ['/stalagmites/', '/rocks/'], ['cliff', 'elevation']), {
      fill: 0.4,
      glyphs: [g('rock')],
      glyphSize: [40, 40],
    }),
  ]),
  room('cavern-camp', 'Cave camp', 'a fire, bedrolls round it, sacks and crates', [
    {
      key: 'fire',
      place: 'centre',
      want: q(['lights'], ['/campfires_and_firepits/'], ['unlit', 'ash_', 'cold']),
      max: 2,
      spacing: 0,
      gap: 2,
      count: 1,
      glyphs: [g('rock')],
      glyphSize: [40, 40],
    },
    {
      key: 'bedrolls',
      place: 'around',
      anchor: 'fire',
      want: q(['furniture'], ['/bedrolls/'], ['rolled']),
      max: 4,
      spacing: 0,
      gap: 0.8,
      count: 3,
      loose: 25,
    },
    corners('supplies', q(['decor'], ['/sacks/', '/crates/']), 3, ['crate']),
  ]),
  room('lair', 'Lair', 'bones and skulls, a hoard', [
    corners('hoard', q(['clutter'], ['/treasure_piles/']), 1),
    {
      key: 'bones',
      place: 'centre',
      want: q(['decor'], ['/bones/']),
      max: 6,
      spacing: 0,
      gap: 0.4,
      count: 5,
      loose: 180,
    },
    corners('skulls', q(['decor'], ['/skulls/']), 2),
  ]),
  // Docks: cranes over the berths, cargo, mooring posts along the edges
  room('dock', 'Dock', 'cranes, cargo, mooring posts', [
    wall('cranes', q(['workplace'], ['/cranes/crane_wood_']), { count: 2 }),
    wall('moorings', q(['vehicles'], ['/mooring_posts/']), { fill: 0.3 }),
    corners('cargo', CRATES, 4, ['crate']),
    {
      key: 'stacks',
      place: 'centre',
      want: CRATES,
      max: 4,
      spacing: 0,
      gap: 1.5,
      count: 3,
      loose: 15,
      glyphs: [g('crate')],
      glyphSize: [44, 44],
    },
  ]),
  // Ships: the main deck, the captain's cabin, and the decks below
  room('deck', 'Ship’s deck', 'barrels and crates by the rails, coils of rope', [
    wall('cargo', q(['decor'], ['/barrels/', '/crates/']), {
      fill: 0.25,
      glyphs: [g('barrel')],
      glyphSize: [40, 40],
    }),
    corners('rope', q(['clutter'], ['/ropes/']), 3),
  ]),
  room('captain-cabin', 'Captain’s cabin', 'a desk with charts, a bed, a sea chest', [
    rug,
    tables(1),
    seats,
    onTables(q(['clutter'], ['/maps/', '/books/', '/scrolls/']), 2),
    wall('bed', BEDS, { count: 1, glyphs: [g('bed')], glyphSize: [50, 80] }),
    corners('chest', CHESTS, 1, ['chest']),
    wallLights(1),
  ]),
  room('hold', 'Hold', 'crates, barrels and sacks', [
    wall('cargo', CRATES, { fill: 0.8, glyphs: [g('crate')], glyphSize: [44, 44] }),
    {
      key: 'stacks',
      place: 'centre',
      want: CRATES,
      max: 6,
      spacing: 0,
      gap: 0.8,
      loose: 15,
      glyphs: [g('barrel')],
      glyphSize: [40, 40],
    },
  ]),
  room('crew', 'Crew quarters', 'hammocks, sea chests', [
    wall('hammocks', q(['furniture'], ['/hammocks/']), {
      fill: 0.8,
      glyphs: [g('bed')],
      glyphSize: [40, 80],
    }),
    corners('chests', CHESTS, 2, ['chest']),
    wallLights(1),
  ]),
  room('gun-deck', 'Gun deck', 'cannons along both sides, shot and powder', [
    // The cannon's muzzle points down in its picture: turned to face out through the hull.
    wall('cannons', q(['combat'], ['/cannons/cannon_metal_']), {
      fill: 0.7,
      turn: 180,
      glyphs: [g('barrel')],
      glyphSize: [40, 60],
    }),
    corners('powder', BARRELS, 2, ['barrel']),
    wallLights(1),
  ]),
  room('engine-room', 'Engine room', 'the shard core, pipes and gears (sky ships)', [
    {
      key: 'core',
      place: 'centre',
      want: { cats: ['lights'], words: ['light_crystal', '_glowing'], not: ['wall_light'] },
      // A big crystal: the light picture is small.
      vary: [260, 300],
      max: 1,
      spacing: 0,
      gap: 2,
      count: 1,
      glyphs: [g('rock')],
      glyphSize: [50, 50],
    },
    corners('tanks', { cats: ['buildings'], anyWords: ['pipe_tank_'], not: ['broken'] }, 2),
    wall('gears', q(['buildings'], ['/cogs/', '/levers/'], ['giant', 'huge', 'lid']), {
      fill: 0.4,
    }),
  ]),
  // Rust & Sunfire: the platform cities' works, shanties and lift stations
  room('foundry', 'Foundry floor', 'crucibles, forges, moulds and slag', [
    {
      key: 'crucibles',
      place: 'centre',
      want: q(['workplace'], ['crucible_large_'], ['stand']),
      max: 3,
      spacing: 0,
      gap: 1.5,
      count: 2,
      glyphs: [g('barrel')],
      glyphSize: [80, 80],
    },
    corners('forges', q(['workplace'], ['/forges/'], ['chimney']), 2),
    wall('moulds', q(['workplace'], ['/smelting/', '/smithing_tools/'], ['slag']), { fill: 0.4 }),
    corners('slag', q(['workplace'], ['slag_cold_', 'molten_chunk_']), 2),
    wallLights(2),
  ]),
  room('refinery', 'Refinery', 'tanks and pipes, barrels, scrap', [
    {
      key: 'tanks',
      place: 'centre',
      // Tanks are kept with the pipe parts (the other parts are not whole things).
      want: { cats: ['buildings'], anyWords: ['pipe_tank_'], not: ['broken'] },
      max: 3,
      spacing: 0,
      gap: 1.2,
      count: 2,
      glyphs: [g('barrel')],
      glyphSize: [90, 90],
    },
    wall('barrels', BARRELS, { fill: 0.5, glyphs: [g('barrel')], glyphSize: [40, 40] }),
    corners('scrap', q(['buildings'], ['/scrap_metal/', '/cogs/']), 3),
    wallLights(2),
  ]),
  room('shanty', 'Shanty room', 'bedrolls and hammocks, crates, a stool', [
    wall('beds', q(['furniture'], ['/bedrolls/', '/hammocks/']), {
      count: 2,
      glyphs: [g('bed')],
      glyphSize: [40, 80],
    }),
    corners('crates', CRATES, 2, ['crate']),
    {
      key: 'stool',
      place: 'centre',
      want: SEATS,
      max: 2,
      spacing: 0,
      gap: 1,
      count: 1,
      loose: 30,
    },
    wallLights(1),
  ]),
  room('winch-room', 'Winch house', 'a winch drum, crane gear, crates', [
    {
      key: 'winch',
      place: 'centre',
      want: q(['workplace'], ['winch_rope_']),
      max: 2,
      spacing: 0,
      gap: 1,
      count: 1,
      glyphs: [g('barrel')],
      glyphSize: [120, 90],
    },
    wall('gear', q(['workplace'], ['/winches/', '/cranes/crane_pincers'], ['winch_rope_']), {
      count: 3,
    }),
    corners('crates', CRATES, 2, ['crate']),
    wallLights(2),
  ]),
  room('arena-floor', 'Arena pit', 'an open floor, weapon racks, benches for the fighters', [
    wall('racks', q(['combat'], ['/weapon_racks/'], ['empty']), { count: 2 }),
    wall('benches', q(['furniture'], ['/benches/'], ['fancy']), { count: 2 }),
    corners('dummies', q(['combat'], ['/training_dummies/']), 2),
    corners('braziers', BRAZIERS, 2),
  ]),
  room('chapel', 'Chapel', 'an altar at the beam, a few pews, candles', [
    wall('altar', q(['furniture'], ['/altars/']), { count: 1 }),
    {
      key: 'pews',
      place: 'centre',
      want: q(['furniture'], ['pew_', '/benches/']),
      max: 3,
      spacing: 0,
      gap: 0.8,
      count: 4,
      glyphs: [g('table')],
      glyphSize: [70, 40],
    },
    corners('candles', CANDLES, 3),
  ]),
];
