import type { Edition } from '../editions';
import type { RawEntity } from '../identity';
import { tagStatText, untagStatText } from './statText';
import { textToEntries } from './text';

/**
 * The spell editor's form ↔ a 5etools spell. Besides the visible fields it fills the ones lists
 * filter on (damage types, saving throws, conditions) from the description, and keeps every field
 * the form does not show when an existing spell is edited.
 */

export const SPELL_SCHOOLS = [
  ['A', 'Abjuration'],
  ['C', 'Conjuration'],
  ['D', 'Divination'],
  ['E', 'Enchantment'],
  ['V', 'Evocation'],
  ['I', 'Illusion'],
  ['N', 'Necromancy'],
  ['T', 'Transmutation'],
] as const;

export const CASTING_UNITS = [
  ['action', 'Action'],
  ['bonus', 'Bonus action'],
  ['reaction', 'Reaction'],
  ['minute', 'Minute(s)'],
  ['hour', 'Hour(s)'],
] as const;

export const RANGE_KINDS = [
  ['self', 'Self'],
  ['touch', 'Touch'],
  ['feet', 'Feet'],
  ['miles', 'Miles'],
  ['sight', 'Sight'],
  ['unlimited', 'Unlimited'],
  ['area', 'Self, with an area'],
] as const;

export const AREA_SHAPES = ['cone', 'cube', 'line', 'sphere', 'emanation', 'radius'] as const;

export const DURATION_KINDS = [
  ['instant', 'Instantaneous'],
  ['concentration', 'Concentration'],
  ['timed', 'A set time'],
  ['dispel', 'Until dispelled'],
  ['special', 'Special'],
] as const;

export const SPELL_CLASSES = [
  'Artificer', 'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard',
] as const; // prettier-ignore

export interface SpellForm {
  name: string;
  /** 0 for a cantrip. */
  level: number;
  school: (typeof SPELL_SCHOOLS)[number][0];
  ritual: boolean;
  castingNumber: number;
  castingUnit: (typeof CASTING_UNITS)[number][0];
  /** For reactions: "which you take when you are hit by an attack". */
  trigger: string;
  rangeKind: (typeof RANGE_KINDS)[number][0];
  rangeAmount: number;
  areaShape: (typeof AREA_SHAPES)[number];
  verbal: boolean;
  somatic: boolean;
  material: string;
  durationKind: (typeof DURATION_KINDS)[number][0];
  durationAmount: number;
  durationUnit: 'round' | 'minute' | 'hour' | 'day';
  classes: string[];
  description: string;
  /** "At Higher Levels" (or a cantrip's upgrade). */
  higher: string;
}

export function emptySpell(name = ''): SpellForm {
  return {
    name,
    level: 1,
    school: 'V',
    ritual: false,
    castingNumber: 1,
    castingUnit: 'action',
    trigger: '',
    rangeKind: 'feet',
    rangeAmount: 60,
    areaShape: 'sphere',
    verbal: true,
    somatic: true,
    material: '',
    durationKind: 'instant',
    durationAmount: 1,
    durationUnit: 'minute',
    classes: [],
    description: '',
    higher: '',
  };
}

const isObj = (v: unknown): v is RawEntity =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);

const FORM_FIELDS = [
  'level', 'school', 'meta', 'time', 'range', 'components', 'duration', 'classes', 'entries',
  'entriesHigherLevel', 'damageInflict', 'savingThrow', 'conditionInflict',
]; // prettier-ignore

const DAMAGE = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison',
  'psychic', 'radiant', 'slashing', 'thunder',
]; // prettier-ignore
const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
]; // prettier-ignore
const ABILITY_WORDS = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

/** What lists filter on, read from the description: damage types, saves, conditions. */
export function spellTags(text: string): {
  damageInflict: string[];
  savingThrow: string[];
  conditionInflict: string[];
} {
  const lower = text.toLowerCase();
  return {
    damageInflict: DAMAGE.filter((d) => new RegExp(`\\b${d} damage\\b`).test(lower)),
    savingThrow: ABILITY_WORDS.filter((a) => new RegExp(`\\b${a} saving throw`).test(lower)),
    conditionInflict: CONDITIONS.filter((c) => new RegExp(`\\b${c}\\b`).test(lower)),
  };
}

export function spellToForm(s: RawEntity): SpellForm {
  const base = emptySpell(typeof s.name === 'string' ? s.name : '');
  const time = Array.isArray(s.time) ? s.time.find(isObj) : undefined;
  const range = isObj(s.range) ? s.range : {};
  const dist = isObj(range.distance) ? range.distance : {};
  const comps = isObj(s.components) ? s.components : {};
  const material = isObj(comps.m)
    ? typeof comps.m.text === 'string'
      ? comps.m.text
      : ''
    : typeof comps.m === 'string'
      ? comps.m
      : '';
  const duration = Array.isArray(s.duration) ? s.duration.find(isObj) : undefined;
  const timed = isObj(duration?.duration) ? duration.duration : {};
  const area =
    typeof range.type === 'string' && (AREA_SHAPES as readonly string[]).includes(range.type);
  const unit = typeof time?.unit === 'string' ? time.unit : 'action';
  const higher = Array.isArray(s.entriesHigherLevel) ? s.entriesHigherLevel.find(isObj) : undefined;
  const classes =
    isObj(s.classes) && Array.isArray(s.classes.fromClassList) ? s.classes.fromClassList : [];
  const paragraphs = (list: unknown) =>
    (Array.isArray(list) ? list : [])
      .filter((e): e is string => typeof e === 'string')
      .map(untagStatText)
      .join('\n\n');
  return {
    ...base,
    level: num(s.level, base.level),
    school: SPELL_SCHOOLS.find(([c]) => c === s.school)?.[0] ?? base.school,
    ritual: isObj(s.meta) && s.meta.ritual === true,
    castingNumber: num(time?.number, 1),
    castingUnit: CASTING_UNITS.find(([u]) => u === unit)?.[0] ?? 'action',
    trigger: typeof time?.condition === 'string' ? untagStatText(time.condition) : '',
    rangeKind: area
      ? 'area'
      : (RANGE_KINDS.find(([k]) => k === dist.type)?.[0] ??
        (dist.type === 'foot' ? 'feet' : base.rangeKind)),
    rangeAmount: num(dist.amount, base.rangeAmount),
    areaShape: area ? (range.type as SpellForm['areaShape']) : base.areaShape,
    verbal: comps.v === true,
    somatic: comps.s === true,
    material: untagStatText(material),
    durationKind:
      duration?.type === 'instant'
        ? 'instant'
        : duration?.type === 'timed'
          ? duration.concentration === true
            ? 'concentration'
            : 'timed'
          : duration?.type === 'permanent'
            ? 'dispel'
            : duration?.type === 'special'
              ? 'special'
              : base.durationKind,
    durationAmount: num(timed.amount, 1),
    durationUnit: (['round', 'minute', 'hour', 'day'].includes(String(timed.type))
      ? timed.type
      : 'minute') as SpellForm['durationUnit'],
    classes: classes.filter(isObj).map((c) => String(c.name)),
    description: paragraphs(s.entries),
    higher: paragraphs(higher?.entries),
  };
}

export function formToSpell(form: SpellForm, edition: Edition, base: RawEntity = {}): RawEntity {
  const kept: RawEntity = {};
  for (const [k, v] of Object.entries(base)) if (!FORM_FIELDS.includes(k)) kept[k] = v;
  const tagged = (text: string) => textToEntries(text).map((p) => tagStatText(untagStatText(p)));
  const s: RawEntity = {
    ...kept,
    name: form.name.trim(),
    level: form.level,
    school: form.school,
    time: [
      {
        number:
          form.castingUnit === 'minute' || form.castingUnit === 'hour' ? form.castingNumber : 1,
        unit: form.castingUnit,
        ...(form.castingUnit === 'reaction' && form.trigger.trim()
          ? { condition: form.trigger.trim() }
          : {}),
      },
    ],
  };
  if (form.ritual) s.meta = { ritual: true };
  s.range =
    form.rangeKind === 'area'
      ? { type: form.areaShape, distance: { type: 'feet', amount: form.rangeAmount } }
      : form.rangeKind === 'feet' || form.rangeKind === 'miles'
        ? { type: 'point', distance: { type: form.rangeKind, amount: form.rangeAmount } }
        : { type: 'point', distance: { type: form.rangeKind } };
  const components: RawEntity = {};
  if (form.verbal) components.v = true;
  if (form.somatic) components.s = true;
  if (form.material.trim()) components.m = form.material.trim();
  s.components = components;
  s.duration = [
    form.durationKind === 'instant'
      ? { type: 'instant' }
      : form.durationKind === 'dispel'
        ? { type: 'permanent', ends: ['dispel'] }
        : form.durationKind === 'special'
          ? { type: 'special' }
          : {
              type: 'timed',
              duration: { type: form.durationUnit, amount: form.durationAmount },
              ...(form.durationKind === 'concentration' ? { concentration: true } : {}),
            },
  ];
  if (form.classes.length) {
    const source = edition === '2024' ? 'XPHB' : 'PHB';
    s.classes = {
      fromClassList: form.classes.map((name) => ({
        name,
        source: name === 'Artificer' ? (edition === '2024' ? 'EFA' : 'TCE') : source,
      })),
    };
  }
  const entries = tagged(form.description);
  if (entries.length) s.entries = entries;
  const higher = tagged(form.higher);
  if (higher.length) {
    s.entriesHigherLevel = [
      {
        type: 'entries',
        name:
          form.level === 0
            ? 'Cantrip Upgrade'
            : edition === '2024'
              ? 'Using a Higher-Level Spell Slot'
              : 'At Higher Levels',
        entries: higher,
      },
    ];
  }
  const tags = spellTags(`${form.description}\n${form.higher}`);
  if (tags.damageInflict.length) s.damageInflict = tags.damageInflict;
  if (tags.savingThrow.length) s.savingThrow = tags.savingThrow;
  if (tags.conditionInflict.length) s.conditionInflict = tags.conditionInflict;
  return s;
}
