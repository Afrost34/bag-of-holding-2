/**
 * Compendium list categories: which entity types each list shows, and the fields it can display,
 * sort and filter on. Shared by the data worker (which builds rows) and the UI (which draws them).
 */

export type FieldKind = 'text' | 'number' | 'enum' | 'tags' | 'bool';

export interface FieldDef {
  id: string;
  label: string;
  kind: FieldKind;
  /** Shown as a table column (in this order). */
  column?: boolean;
  /** Offered as a filter. */
  filter?: boolean;
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
  filter: true,
  order: ['2024', '2014'],
};

export const CATEGORIES: readonly Category[] = [
  {
    id: 'spells',
    label: 'Spells',
    noun: 'spell',
    types: ['spell'],
    defaultSort: 'level',
    fields: [
      { id: 'level', label: 'Level', kind: 'number', column: true, filter: true, width: 4 },
      { id: 'school', label: 'School', kind: 'enum', column: true, filter: true, order: SCHOOL_ORDER, width: 8 },
      { id: 'time', label: 'Time', kind: 'enum', column: true, filter: true, order: TIME_ORDER, width: 7 },
      { id: 'range', label: 'Range', kind: 'text', column: true, width: 8 },
      { id: 'concentration', label: 'Concentration', kind: 'bool', column: true, filter: true, width: 3 },
      { id: 'ritual', label: 'Ritual', kind: 'bool', filter: true },
      { id: 'classes', label: 'Class', kind: 'tags', filter: true },
      { id: 'damage', label: 'Damage type', kind: 'tags', filter: true },
      { id: 'save', label: 'Saving throw', kind: 'tags', filter: true },
      { id: 'conditions', label: 'Condition', kind: 'tags', filter: true },
      { id: 'components', label: 'Components', kind: 'tags', filter: true, order: ['V', 'S', 'M', 'M ($)'] },
      EDITION,
    ],
  },
  {
    id: 'creatures',
    label: 'Creatures',
    noun: 'creature',
    types: ['monster'],
    defaultSort: 'cr',
    fields: [
      { id: 'cr', label: 'CR', kind: 'number', column: true, filter: true, width: 4 },
      { id: 'type', label: 'Type', kind: 'enum', column: true, filter: true, width: 9 },
      { id: 'size', label: 'Size', kind: 'tags', column: true, filter: true, order: SIZE_ORDER, width: 6 },
      { id: 'alignment', label: 'Alignment', kind: 'text', column: true, width: 9 },
      { id: 'environment', label: 'Environment', kind: 'tags', filter: true },
      { id: 'speeds', label: 'Movement', kind: 'tags', filter: true },
      { id: 'legendary', label: 'Legendary', kind: 'bool', filter: true },
      { id: 'spellcaster', label: 'Spellcaster', kind: 'bool', filter: true },
      EDITION,
    ],
  },
  {
    id: 'items',
    label: 'Items',
    noun: 'item',
    types: ['item', 'baseitem', 'magicvariant', 'itemGroup'],
    fields: [
      { id: 'category', label: 'Type', kind: 'enum', column: true, filter: true, width: 10 },
      { id: 'rarity', label: 'Rarity', kind: 'enum', column: true, filter: true, order: RARITY_ORDER, width: 7 },
      { id: 'attunement', label: 'Attunement', kind: 'bool', column: true, filter: true, width: 3 },
      { id: 'value', label: 'Value (gp)', kind: 'number', column: true, width: 6 },
      { id: 'weight', label: 'Weight (lb.)', kind: 'number', column: true, width: 5 },
      { id: 'magic', label: 'Magic', kind: 'bool', filter: true },
      { id: 'properties', label: 'Property', kind: 'tags', filter: true },
      { id: 'damage', label: 'Damage type', kind: 'tags', filter: true },
      EDITION,
    ],
  },
  {
    id: 'classes',
    label: 'Classes',
    noun: 'class',
    types: ['class'],
    fields: [
      { id: 'hitDie', label: 'Hit die', kind: 'enum', column: true, filter: true, width: 5 },
      { id: 'caster', label: 'Spellcasting', kind: 'enum', column: true, filter: true, width: 8 },
      EDITION,
    ],
  },
  {
    id: 'subclasses',
    label: 'Subclasses',
    noun: 'subclass',
    types: ['subclass'],
    fields: [{ id: 'className', label: 'Class', kind: 'enum', column: true, filter: true, width: 8 }, EDITION],
  },
  {
    id: 'species',
    label: 'Species',
    noun: 'species',
    types: ['race', 'subrace'],
    fields: [
      { id: 'size', label: 'Size', kind: 'tags', column: true, filter: true, order: SIZE_ORDER, width: 7 },
      { id: 'speed', label: 'Speed', kind: 'number', column: true, width: 5 },
      { id: 'darkvision', label: 'Darkvision', kind: 'bool', filter: true },
      EDITION,
    ],
  },
  {
    id: 'backgrounds',
    label: 'Backgrounds',
    noun: 'background',
    types: ['background'],
    fields: [{ id: 'skills', label: 'Skills', kind: 'tags', column: true, filter: true, width: 12 }, EDITION],
  },
  {
    id: 'feats',
    label: 'Feats',
    noun: 'feat',
    types: ['feat'],
    fields: [
      { id: 'category', label: 'Category', kind: 'enum', column: true, filter: true, width: 8 },
      { id: 'prerequisite', label: 'Prerequisite', kind: 'text', column: true, width: 14 },
      { id: 'repeatable', label: 'Repeatable', kind: 'bool', filter: true },
      EDITION,
    ],
  },
  {
    id: 'options',
    label: 'Options & features',
    noun: 'option',
    types: ['optionalfeature'],
    fields: [
      { id: 'featureType', label: 'Type', kind: 'tags', column: true, filter: true, width: 12 },
      { id: 'prerequisite', label: 'Prerequisite', kind: 'text', column: true, width: 12 },
      EDITION,
    ],
  },
  {
    id: 'conditions',
    label: 'Conditions & diseases',
    noun: 'entry',
    types: ['condition', 'disease', 'status'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: true, width: 7 }, EDITION],
  },
  {
    id: 'rules',
    label: 'Rules',
    noun: 'rule',
    types: ['variantrule', 'action', 'sense', 'skill', 'itemProperty', 'itemMastery'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: true, width: 9 }, EDITION],
  },
  {
    id: 'deities',
    label: 'Deities',
    noun: 'deity',
    types: ['deity'],
    fields: [
      { id: 'pantheon', label: 'Pantheon', kind: 'enum', column: true, filter: true, width: 9 },
      { id: 'alignment', label: 'Alignment', kind: 'text', column: true, width: 6 },
      { id: 'domains', label: 'Domain', kind: 'tags', column: true, filter: true, width: 10 },
    ],
  },
  {
    id: 'languages',
    label: 'Languages',
    noun: 'language',
    types: ['language'],
    fields: [{ id: 'kind', label: 'Type', kind: 'enum', column: true, filter: true, width: 7 }, EDITION],
  },
  {
    id: 'hazards',
    label: 'Traps, hazards & objects',
    noun: 'entry',
    types: ['trap', 'hazard', 'object'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: true, width: 7 }, EDITION],
  },
  {
    id: 'rewards',
    label: 'Boons & rewards',
    noun: 'reward',
    types: ['reward', 'boon', 'cult'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: true, width: 9 }],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    noun: 'vehicle',
    types: ['vehicle', 'vehicleUpgrade'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: true, width: 9 }],
  },
  {
    id: 'bastions',
    label: 'Bastions',
    noun: 'facility',
    types: ['facility'],
    fields: [{ id: 'level', label: 'Level', kind: 'number', column: true, filter: true, width: 4 }],
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
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: true, width: 5 }],
  },
  {
    id: 'other',
    label: 'Other',
    noun: 'entry',
    types: ['psionic', 'recipe', 'charoption', 'legendaryGroup'],
    fields: [{ id: 'kind', label: 'Kind', kind: 'enum', column: true, filter: true, width: 10 }],
  },
]; // prettier-ignore

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
