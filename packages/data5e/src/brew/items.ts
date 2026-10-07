import type { RawEntity } from '../identity';
import { entriesToText, tagDice, textToEntries } from './text';

/**
 * The item editor's form ↔ a 5etools item. Converting an item to the form and back keeps every
 * field the form does not show, so editing an imported item never loses anything.
 */

export const ITEM_KINDS = [
  { id: 'weapon-melee', label: 'Melee weapon', type: 'M' },
  { id: 'weapon-ranged', label: 'Ranged weapon', type: 'R' },
  { id: 'armor-light', label: 'Light armor', type: 'LA' },
  { id: 'armor-medium', label: 'Medium armor', type: 'MA' },
  { id: 'armor-heavy', label: 'Heavy armor', type: 'HA' },
  { id: 'shield', label: 'Shield', type: 'S' },
  { id: 'wondrous', label: 'Wondrous item', type: null },
  { id: 'ring', label: 'Ring', type: 'RG' },
  { id: 'rod', label: 'Rod', type: 'RD' },
  { id: 'staff', label: 'Staff', type: 'ST' },
  { id: 'wand', label: 'Wand', type: 'WD' },
  { id: 'potion', label: 'Potion', type: 'P' },
  { id: 'scroll', label: 'Scroll', type: 'SC' },
  { id: 'ammunition', label: 'Ammunition', type: 'A' },
  { id: 'gear', label: 'Adventuring gear', type: 'G' },
  { id: 'tool', label: 'Tool', type: 'T' },
  { id: 'other', label: 'Other', type: 'OTH' },
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number]['id'];

export const RARITIES = [
  'none',
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
  'unknown (magic)',
] as const;

/** 5etools damage type codes. */
export const DAMAGE_TYPES = {
  B: 'bludgeoning',
  P: 'piercing',
  S: 'slashing',
  A: 'acid',
  C: 'cold',
  F: 'fire',
  O: 'force',
  L: 'lightning',
  N: 'necrotic',
  I: 'poison',
  Y: 'psychic',
  R: 'radiant',
  T: 'thunder',
} as const;

export const WEAPON_PROPERTIES = {
  F: 'Finesse',
  L: 'Light',
  H: 'Heavy',
  '2H': 'Two-handed',
  V: 'Versatile',
  T: 'Thrown',
  R: 'Reach',
  A: 'Ammunition',
  LD: 'Loading',
  S: 'Special',
} as const;

export interface ItemForm {
  name: string;
  kind: ItemKind;
  rarity: (typeof RARITIES)[number];
  /** Requires attunement. */
  attune: boolean;
  /** "by a wizard": who can attune (empty: anyone). */
  attuneBy: string;
  /** +1, +2, +3 to attacks and damage (weapons) or AC (armor, shields); 0 for none. */
  bonus: number;
  /** Pounds. */
  weight: number | null;
  /** Gold pieces. */
  valueGp: number | null;
  charges: number | null;
  /** When charges come back: "dawn", "dusk", "midnight", or "" for never. */
  recharge: string;
  weaponCategory: 'simple' | 'martial';
  damage: string;
  damageType: keyof typeof DAMAGE_TYPES | '';
  /** Two-handed damage of a versatile weapon. */
  versatile: string;
  properties: string[];
  /** "20/60" for thrown and ranged weapons. */
  range: string;
  ac: number | null;
  strength: number | null;
  stealth: boolean;
  /** Paragraphs, separated by a blank line; dice become rolls. */
  description: string;
  /** Named abilities: "Fire Burst. While holding it…". */
  abilities: { name: string; text: string }[];
}

export function emptyItem(name = ''): ItemForm {
  return {
    name,
    kind: 'wondrous',
    rarity: 'uncommon',
    attune: false,
    attuneBy: '',
    bonus: 0,
    weight: null,
    valueGp: null,
    charges: null,
    recharge: '',
    weaponCategory: 'simple',
    damage: '',
    damageType: '',
    versatile: '',
    properties: [],
    range: '',
    ac: null,
    strength: null,
    stealth: false,
    description: '',
    abilities: [],
  };
}

export const isWeapon = (k: ItemKind) => k === 'weapon-melee' || k === 'weapon-ranged';
export const isArmor = (k: ItemKind) => k.startsWith('armor-') || k === 'shield';

const isObj = (v: unknown): v is RawEntity =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const code = (v: unknown) => (typeof v === 'string' ? (v.split('|')[0] ?? '') : '');
const num = (v: unknown) =>
  typeof v === 'number'
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null;
const bonusOf = (v: unknown) => {
  const n = num(typeof v === 'string' ? v.replace('+', '') : v);
  return n ?? 0;
};

/** Fields the form writes: everything else on an item is kept as it was. */
const FORM_FIELDS = [
  'type', 'wondrous', 'staff', 'rarity', 'reqAttune', 'bonusWeapon', 'bonusAc', 'weight', 'value',
  'charges', 'recharge', 'weapon', 'weaponCategory', 'dmg1', 'dmgType', 'dmg2', 'property',
  'range', 'armor', 'ac', 'strength', 'stealth', 'entries',
]; // prettier-ignore

/** Sentences the editor adds, as official items word them (and recognises when reading back). */
const GENERATED = [
  /^You have a \+\d bonus to attack and damage rolls made with this magic (weapon|ammunition)\.$/,
  /^You have a \+\d bonus to Armor Class while (wearing this armor|holding this shield)\.$/,
  /^This item has \d+ charges?\.( It regains all expended charges daily at (dawn|dusk|midnight)\.)?$/,
];

function rulesText(form: ItemForm): string[] {
  const out: string[] = [];
  if (form.bonus > 0 && (isWeapon(form.kind) || form.kind === 'ammunition')) {
    const what = form.kind === 'ammunition' ? 'ammunition' : 'weapon';
    out.push(
      `You have a +${String(form.bonus)} bonus to attack and damage rolls made with this magic ${what}.`,
    );
  }
  if (form.bonus > 0 && isArmor(form.kind)) {
    const how = form.kind === 'shield' ? 'holding this shield' : 'wearing this armor';
    out.push(`You have a +${String(form.bonus)} bonus to Armor Class while ${how}.`);
  }
  if (form.charges !== null && form.charges > 0) {
    const n = form.charges;
    out.push(
      `This item has ${String(n)} charge${n === 1 ? '' : 's'}.${
        form.recharge ? ` It regains all expended charges daily at ${form.recharge}.` : ''
      }`,
    );
  }
  return out;
}

export function itemToForm(item: RawEntity): ItemForm {
  const type = code(item.type);
  const kind: ItemKind =
    item.wondrous === true
      ? 'wondrous'
      : (ITEM_KINDS.find((k) => k.type === type)?.id ?? (item.staff === true ? 'staff' : 'other'));
  const entries = Array.isArray(item.entries) ? item.entries : [];
  // The sentences the editor writes for bonuses and charges are read back as those fields.
  const paragraphs = entries.filter(
    (e): e is string => typeof e === 'string' && !GENERATED.some((g) => g.test(e)),
  );
  const abilities = entries
    .filter(isObj)
    .filter((e) => e.type === 'entries' && typeof e.name === 'string' && Array.isArray(e.entries))
    .filter((e) => (e.entries as unknown[]).every((x) => typeof x === 'string'))
    .map((e) => ({ name: String(e.name), text: entriesToText(e.entries as string[]) }));
  const value = num(item.value);
  return {
    name: typeof item.name === 'string' ? item.name : '',
    kind,
    rarity: (RARITIES as readonly string[]).includes(String(item.rarity))
      ? (item.rarity as ItemForm['rarity'])
      : 'none',
    attune: item.reqAttune !== undefined && item.reqAttune !== false,
    attuneBy: typeof item.reqAttune === 'string' ? item.reqAttune : '',
    bonus: bonusOf(item.bonusWeapon ?? item.bonusAc),
    weight: num(item.weight),
    valueGp: value === null ? null : value / 100,
    charges: num(item.charges),
    recharge: typeof item.recharge === 'string' ? item.recharge : '',
    weaponCategory: item.weaponCategory === 'martial' ? 'martial' : 'simple',
    damage: typeof item.dmg1 === 'string' ? item.dmg1 : '',
    damageType: (code(item.dmgType) in DAMAGE_TYPES
      ? code(item.dmgType)
      : '') as ItemForm['damageType'],
    versatile: typeof item.dmg2 === 'string' ? item.dmg2 : '',
    properties: Array.isArray(item.property) ? item.property.map(code).filter(Boolean) : [],
    range: typeof item.range === 'string' ? item.range : '',
    ac: num(item.ac),
    strength: num(item.strength),
    stealth: item.stealth === true,
    description: entriesToText(paragraphs),
    abilities,
  };
}

/** The item for a form, on top of the item it was made from (`base`), so other fields stay. */
export function formToItem(form: ItemForm, base: RawEntity = {}): RawEntity {
  const kept: RawEntity = {};
  for (const [k, v] of Object.entries(base)) if (!FORM_FIELDS.includes(k)) kept[k] = v;
  // Entries the form cannot show (lists, tables…) go after the ones it wrote.
  const otherEntries = (Array.isArray(base.entries) ? (base.entries as unknown[]) : []).filter(
    (e) =>
      typeof e !== 'string' &&
      !(
        isObj(e) &&
        e.type === 'entries' &&
        typeof e.name === 'string' &&
        Array.isArray(e.entries) &&
        e.entries.every((x) => typeof x === 'string')
      ),
  );
  const kind = ITEM_KINDS.find((k) => k.id === form.kind) ?? ITEM_KINDS[6];
  const item: RawEntity = { ...kept, name: form.name.trim() };
  if (kind.type) item.type = kind.type;
  if (form.kind === 'wondrous') item.wondrous = true;
  if (form.kind === 'staff') item.staff = true;
  item.rarity = form.rarity;
  if (form.attune) item.reqAttune = form.attuneBy.trim() ? form.attuneBy.trim() : true;
  if (form.bonus > 0) {
    if (isWeapon(form.kind) || form.kind === 'ammunition')
      item.bonusWeapon = `+${String(form.bonus)}`;
    if (isArmor(form.kind)) item.bonusAc = `+${String(form.bonus)}`;
  }
  if (form.weight !== null) item.weight = form.weight;
  if (form.valueGp !== null) item.value = Math.round(form.valueGp * 100);
  if (form.charges !== null) {
    item.charges = form.charges;
    if (form.recharge) item.recharge = form.recharge;
  }
  if (isWeapon(form.kind)) {
    item.weapon = true;
    item.weaponCategory = form.weaponCategory;
    if (form.damage.trim()) item.dmg1 = form.damage.trim();
    if (form.damageType) item.dmgType = form.damageType;
    if (form.properties.length > 0) item.property = [...form.properties];
    if (form.properties.includes('V') && form.versatile.trim()) item.dmg2 = form.versatile.trim();
    if (form.range.trim()) item.range = form.range.trim();
  }
  if (isArmor(form.kind)) {
    if (form.kind !== 'shield') item.armor = true;
    const ac = form.ac ?? (form.kind === 'shield' ? 2 : null);
    if (ac !== null) item.ac = ac;
    if (form.strength !== null && form.kind === 'armor-heavy')
      item.strength = String(form.strength);
    if (form.stealth) item.stealth = true;
  }
  const entries: unknown[] = [
    ...rulesText(form),
    ...textToEntries(form.description),
    ...form.abilities
      .filter((a) => a.name.trim() || a.text.trim())
      .map((a) => ({
        type: 'entries',
        name: a.name.trim() || 'Ability',
        entries: textToEntries(a.text).length ? textToEntries(a.text) : [tagDice(a.text.trim())],
      })),
    ...otherEntries,
  ];
  if (entries.length > 0) item.entries = entries;
  return item;
}
