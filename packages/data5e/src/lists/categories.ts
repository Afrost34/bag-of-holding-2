import type { ListRow } from './rows';

/**
 * Compendium list categories: which entity types each list shows, and the fields it can display,
 * sort and filter on. Shared by the data worker (which builds rows) and the UI (which draws them).
 *
 * Only `browse` categories appear in the compendium menu. The others keep working for search,
 * `{@filter}` links and direct URLs, but stay out of the way.
 */

export type FieldKind = 'text' | 'number' | 'enum' | 'tags' | 'bool';

export interface FieldDef {
  id: string;
  label: string;
  kind: FieldKind;
  /** Shown as a list column (in this order). */
  column?: boolean;
  /** Row field holding the cell text when it differs from the sortable value (e.g. `crText`). */
  display?: string;
  /** Offered as a filter: in the main filter bar, or under "More filters". */
  filter?: 'main' | 'more';
  /** Preferred order of enum/tag values (others follow alphabetically). */
  order?: readonly string[];
  /** Column width hint in rem. */
  width?: number;
}

export interface Category {
  id: string;
  label: string;
  /** Singular noun for counts and empty states. */
  noun: string;
  types: readonly string[];
  fields: readonly FieldDef[];
  /** Default sort field id (name otherwise). */
  defaultSort?: string;
  /** Listed in the compendium's Browse menu. */
  browse?: boolean;
  /** `cards`: art cards grouped by source; `rows` (default): a filterable list. */
  layout?: 'cards' | 'rows';
  /** Narrows the rows further, e.g. items split into equipment and magic items. */
  include?: (row: ListRow) => boolean;
}

const RARITY_ORDER = [
  'none',
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
  'varies',
  'unknown',
  'unknown (magic)',
];
const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Varies'];
const SCHOOL_ORDER = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
];
const TIME_ORDER = ['Action', 'Bonus action', 'Reaction', 'Minute', 'Hour', 'Other'];
const EDITION: FieldDef = {
  id: 'edition',
  label: 'Edition',
  kind: 'enum',
  filter: 'more',
  order: ['2024', '2014'],
};

const isMagicItem = (row: ListRow) => row.type === 'magicvariant' || row.f.magic === true;
/** Generated specific variants ("+1 Longsword") are reached from their generic variant. */
const isListedItem = (row: ListRow) => row.generated !== true;

const ITEM_FIELDS: readonly FieldDef[] = [
  { id: 'category', label: 'Type', kind: 'enum', filter: 'main' },
  { id: 'rarity', label: 'Rarity', kind: 'enum', column: true, filter: 'main', order: RARITY_ORDER, width: 7 },
  { id: 'attunement', label: 'Attunement', kind: 'bool', column: true, display: 'attuneText', filter: 'main', width: 9 },
  { id: 'value', label: 'Cost', kind: 'number', column: true, display: 'costText', width: 6 },
  { id: 'weight', label: 'Weight', kind: 'number', column: true, display: 'weightText', width: 5 },
  { id: 'properties', label: 'Property', kind: 'tags', column: true, filter: 'main', width: 14 },
  { id: 'magic', label: 'Magic', kind: 'bool', filter: 'more' },
  { id: 'damage', label: 'Damage type', kind: 'tags', filter: 'more' },
  EDITION,
]; // prettier-ignore

/** A subset of fields, with `columns` (only) shown as columns. */
const pick = (fields: readonly FieldDef[], ids: readonly string[], columns: readonly string[]) =>
  fields
    .filter((f) => ids.includes(f.id))
    .map((f): FieldDef => ({ ...f, column: columns.includes(f.id) }));

export const CATEGORIES: readonly Category[] = [
  {
    id: 'classes',
    label: 'Classes',
    noun: 'class',
    types: ['class'],
    browse: true,
    layout: 'cards',
    fields: [
      { id: 'hitDie', label: 'Hit die', kind: 'enum', column: true, filter: 'main', width: 5 },
      { id: 'caster', label: 'Spellcasting', kind: 'enum', column: true, filter: 'main', width: 8 },
      EDITION,
    ],
  },
  {
    id: 'backgrounds',
    label: 'Backgrounds',
    noun: 'background',
    types: ['background'],
    browse: true,
    fields: [
      { id: 'feature', label: 'Feature', kind: 'text', column: true, width: 16 },
      { id: 'skills', label: 'Proficiencies', kind: 'tags', column: true, filter: 'main', width: 14 },
      EDITION,
    ],
  },
  {
    id: 'species',
    label: 'Species',
    noun: 'species',
    types: ['race', 'subrace'],
    browse: true,
    layout: 'cards',
    // Subraces and lineages appear on their species' page.
    include: (row) => row.type === 'race',
    fields: [
      { id: 'size', label: 'Size', kind: 'tags', column: true, filter: 'main', order: SIZE_ORDER, width: 7 },
      { id: 'speed', label: 'Speed', kind: 'number', column: true, width: 5 },
      { id: 'darkvision', label: 'Darkvision', kind: 'bool', filter: 'more' },
      EDITION,
    ],
  },
  {
    id: 'feats',
    label: 'Feats',
    noun: 'feat',
    types: ['feat'],
    browse: true,
    fields: [
      { id: 'category', label: 'Category', kind: 'enum', column: true, filter: 'main', width: 10 },
      { id: 'prerequisite', label: 'Prerequisite', kind: 'text', column: true, width: 18 },
      { id: 'repeatable', label: 'Repeatable', kind: 'bool', filter: 'more' },
      EDITION,
    ],
  },
  {
    id: 'spells',
    label: 'Spells',
    noun: 'spell',
    types: ['spell'],
    browse: true,
    defaultSort: 'level',
    fields: [
      { id: 'level', label: 'Level', kind: 'number', column: true, filter: 'main', width: 4.5 },
      { id: 'time', label: 'Casting time', kind: 'enum', column: true, display: 'timeText', filter: 'main', order: TIME_ORDER, width: 7.5 },
      { id: 'duration', label: 'Duration', kind: 'text', column: true, display: 'durationText', width: 8 },
      { id: 'range', label: 'Range/Area', kind: 'text', column: true, display: 'rangeText', width: 9 },
      { id: 'attack', label: 'Attack/Save', kind: 'text', column: true, width: 6.5 },
      { id: 'effect', label: 'Damage/Effect', kind: 'text', column: true, width: 8 },
      { id: 'classes', label: 'Class', kind: 'tags', filter: 'main' },
      { id: 'school', label: 'School', kind: 'enum', filter: 'main', order: SCHOOL_ORDER },
      { id: 'concentration', label: 'Concentration', kind: 'bool', filter: 'more' },
      { id: 'ritual', label: 'Ritual', kind: 'bool', filter: 'more' },
      { id: 'damage', label: 'Damage type', kind: 'tags', filter: 'more' },
      { id: 'save', label: 'Saving throw', kind: 'tags', filter: 'more' },
      { id: 'conditions', label: 'Condition', kind: 'tags', filter: 'more' },
      { id: 'components', label: 'Components', kind: 'tags', filter: 'more', order: ['V', 'S', 'M', 'M ($)'] },
      EDITION,
    ],
  },
  {
    id: 'equipment',
    label: 'Equipment',
    noun: 'item',
    types: ['item', 'baseitem', 'magicvariant', 'itemGroup'],
    browse: true,
    include: (row) => isListedItem(row) && !isMagicItem(row),
    fields: pick(ITEM_FIELDS, ['category', 'value', 'weight', 'properties', 'damage', 'edition'], ['value', 'weight', 'properties']),
  },
  {
    id: 'magic-items',
    label: 'Magic Items',
    noun: 'magic item',
    types: ['item', 'baseitem', 'magicvariant', 'itemGroup'],
    browse: true,
    include: (row) => isListedItem(row) && isMagicItem(row),
    fields: pick(ITEM_FIELDS, ['category', 'rarity', 'attunement', 'properties', 'damage', 'edition'], ['rarity', 'attunement']),
  },
  {
    id: 'creatures',
    label: 'Monsters',
    noun: 'monster',
    types: ['monster'],
    browse: true,
    defaultSort: 'cr',
    fields: [
      { id: 'cr', label: 'CR', kind: 'number', column: true, display: 'crText', filter: 'main', width: 4 },
      { id: 'type', label: 'Type', kind: 'enum', column: true, filter: 'main', width: 9 },
      { id: 'size', label: 'Size', kind: 'tags', column: true, filter: 'main', order: SIZE_ORDER, width: 6 },
      { id: 'alignment', label: 'Alignment', kind: 'text', column: true, width: 10 },
      { id: 'environment', label: 'Environment', kind: 'tags', filter: 'more' },
      { id: 'speeds', label: 'Movement', kind: 'tags', filter: 'more' },
      { id: 'legendary', label: 'Legendary', kind: 'bool', filter: 'more' },
      { id: 'spellcaster', label: 'Spellcaster', kind: 'bool', filter: 'more' },
      EDITION,
    ],
  },
  // Not in the Browse menu: reached through search, links and their pages.
  {
    id: 'items',
    label: 'Items',
    noun: 'item',
    types: ['item', 'baseitem', 'magicvariant', 'itemGroup'],
    include: isListedItem,
    fields: ITEM_FIELDS,
  },
  {
    id: 'subclasses',
    label: 'Subclasses',
    noun: 'subclass',
    types: ['subclass'],
    fields: [{ id: 'className', label: 'Class', kind: 'enum', column: true, filter: 'main', width: 8 }, EDITION],
  },
  {
    id: 'options',
    label: 'Options & features',
    noun: 'option',
    types: ['optionalfeature'],
    fields: [
      { id: 'featureType', label: 'Type', kind: 'tags', column: true, filter: 'main', width: 12 },
      { id: 'prerequisite', label: 'Prerequisite', kind: 'text', column: true, width: 12 },
      EDITION,
    ],
  },
  {
    id: 'conditions',
    label: 'Conditions & diseases',
    noun: 'entry',
    types: ['condition', 'disease', 'status'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: 'main', width: 7 }, EDITION],
  },
  {
    id: 'rules',
    label: 'Rules',
    noun: 'rule',
    types: ['variantrule', 'action', 'sense', 'skill', 'itemProperty', 'itemMastery'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: 'main', width: 9 }, EDITION],
  },
  {
    id: 'deities',
    label: 'Deities',
    noun: 'deity',
    types: ['deity'],
    fields: [
      { id: 'pantheon', label: 'Pantheon', kind: 'enum', column: true, filter: 'main', width: 9 },
      { id: 'alignment', label: 'Alignment', kind: 'text', column: true, width: 6 },
      { id: 'domains', label: 'Domain', kind: 'tags', column: true, filter: 'main', width: 10 },
    ],
  },
  {
    id: 'languages',
    label: 'Languages',
    noun: 'language',
    types: ['language'],
    fields: [{ id: 'kind', label: 'Type', kind: 'enum', column: true, filter: 'main', width: 7 }, EDITION],
  },
  {
    id: 'hazards',
    label: 'Traps, hazards & objects',
    noun: 'entry',
    types: ['trap', 'hazard', 'object'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: 'main', width: 7 }, EDITION],
  },
  {
    id: 'rewards',
    label: 'Boons & rewards',
    noun: 'reward',
    types: ['reward', 'boon', 'cult'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: 'main', width: 9 }],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    noun: 'vehicle',
    types: ['vehicle', 'vehicleUpgrade'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: 'main', width: 9 }],
  },
  {
    id: 'bastions',
    label: 'Bastions',
    noun: 'facility',
    types: ['facility'],
    fields: [{ id: 'level', label: 'Level', kind: 'number', column: true, filter: 'main', width: 4 }],
  },
  {
    id: 'tables',
    label: 'Tables',
    noun: 'table',
    types: ['table', 'tableGroup'],
    fields: [EDITION],
  },
  {
    id: 'decks',
    label: 'Decks & cards',
    noun: 'card',
    types: ['deck', 'card'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: 'main', width: 5 }],
  },
  {
    id: 'other',
    label: 'Other',
    noun: 'entry',
    types: ['psionic', 'recipe', 'charoption', 'legendaryGroup'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: 'main', width: 10 }],
  },
]; // prettier-ignore

/** The categories in the compendium's Browse menu, in menu order. */
export const BROWSE_CATEGORIES: readonly Category[] = CATEGORIES.filter((c) => c.browse === true);

/**
 * Support data: templates, lookup tables and generator inputs that only appear inside other
 * pages. Never shown in search results or lists.
 */
export const SUPPORT_TYPES: readonly string[] = [
  'monsterTemplate', 'legendaryGroupTemplate', 'itemEntry', 'itemType', 'itemTypeAdditionalEntries',
  'languageScript', 'lifeBackground', 'lifeClass', 'name', 'encounter', 'encounterShape',
  'magicItems', 'artObjects', 'gems', 'hoard', 'individual', 'dragon', 'raceFeature',
  'makebrewCreatureTrait', 'makebrewCreatureAction',
]; // prettier-ignore

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** The list a given entity type appears in. */
export function categoryForType(type: string): Category | undefined {
  return CATEGORIES.find((c) => c.types.includes(type));
}
