import type { Edition } from '../editions';
import {
  ABILITIES,
  ABILITY_NAME,
  abilityMod,
  crValue,
  proficiencyForCr,
  type Ability,
} from '../format';
import type { RawEntity } from '../identity';
import { tagStatText, untagStatText } from './statText';
import { textToEntries } from './text';

/**
 * The creature editor's form ↔ a 5etools monster. The app does the arithmetic people usually do
 * by hand: proficiency bonus from the CR, saving throws and skills from the scores, passive
 * Perception, hit point averages, and attack bonuses and damage in attack text. Fields the form
 * does not show are kept when an existing creature is edited.
 */

export const SIZES = [
  ['T', 'Tiny'],
  ['S', 'Small'],
  ['M', 'Medium'],
  ['L', 'Large'],
  ['H', 'Huge'],
  ['G', 'Gargantuan'],
] as const;

export const CREATURE_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant',
  'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
] as const; // prettier-ignore

/** Alignments as offered, with their 5etools codes. */
export const ALIGNMENT_CODES: Record<string, string[]> = {
  'Lawful Good': ['L', 'G'],
  'Neutral Good': ['N', 'G'],
  'Chaotic Good': ['C', 'G'],
  'Lawful Neutral': ['L', 'N'],
  Neutral: ['N'],
  'Chaotic Neutral': ['C', 'N'],
  'Lawful Evil': ['L', 'E'],
  'Neutral Evil': ['N', 'E'],
  'Chaotic Evil': ['C', 'E'],
  Unaligned: ['U'],
  'Any alignment': ['A'],
};

export const CHALLENGE_RATINGS = [
  '0', '1/8', '1/4', '1/2',
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
]; // prettier-ignore

export const SKILLS: Record<string, Ability> = {
  acrobatics: 'dex', 'animal handling': 'wis', arcana: 'int', athletics: 'str', deception: 'cha',
  history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis',
  nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int',
  'sleight of hand': 'dex', stealth: 'dex', survival: 'wis',
}; // prettier-ignore

export const SENSES = ['darkvision', 'blindsight', 'tremorsense', 'truesight'] as const;
export const SPEEDS = ['walk', 'fly', 'swim', 'climb', 'burrow'] as const;

export const DAMAGE_NAMES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison',
  'psychic', 'radiant', 'slashing', 'thunder',
] as const; // prettier-ignore

export const CONDITION_NAMES = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
] as const; // prettier-ignore

/** A named block of text: a trait, an action, a reaction… (plain statblock wording). */
export interface Feature {
  name: string;
  text: string;
}

export interface CreatureForm {
  name: string;
  size: (typeof SIZES)[number][0];
  creatureType: string;
  /** "goblinoid", "shapechanger"… comma separated. */
  typeTags: string;
  alignment: string;
  ac: number;
  /** "natural armor", "chain mail, shield". */
  acFrom: string;
  /** "4d8 + 4": the average is worked out. */
  hpFormula: string;
  /** Set hit points by hand (for creatures without a formula). */
  hpAverage: number | null;
  speed: Record<(typeof SPEEDS)[number], number | null>;
  hover: boolean;
  scores: Record<Ability, number>;
  cr: string;
  /** Saving throws the creature is proficient in. */
  saves: Ability[];
  /** Skills: proficient (1) or expertise (2). */
  skills: Record<string, 1 | 2>;
  senses: Record<(typeof SENSES)[number], number | null>;
  languages: string;
  resist: string[];
  immune: string[];
  vulnerable: string[];
  conditionImmune: string[];
  traits: Feature[];
  actions: Feature[];
  bonusActions: Feature[];
  reactions: Feature[];
  legendaryCount: number;
  legendary: Feature[];
  spellcasting: {
    on: boolean;
    ability: Ability;
    atWill: string;
    perDay: { 1: string; 2: string; 3: string };
  };
}

export function emptyCreature(name = ''): CreatureForm {
  return {
    name,
    size: 'M',
    creatureType: 'humanoid',
    typeTags: '',
    alignment: 'Neutral',
    ac: 12,
    acFrom: '',
    hpFormula: '2d8 + 2',
    hpAverage: null,
    speed: { walk: 30, fly: null, swim: null, climb: null, burrow: null },
    hover: false,
    scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    cr: '1/4',
    saves: [],
    skills: {},
    senses: { darkvision: null, blindsight: null, tremorsense: null, truesight: null },
    languages: 'Common',
    resist: [],
    immune: [],
    vulnerable: [],
    conditionImmune: [],
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryCount: 3,
    legendary: [],
    spellcasting: { on: false, ability: 'int', atWill: '', perDay: { 1: '', 2: '', 3: '' } },
  };
}

/** Average of a dice formula like "4d8 + 4" (rounded down, as statblocks do), or null. */
export function averageOf(formula: string): number | null {
  const clean = formula.replace(/\s+/g, '');
  if (!/^(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/i.test(clean)) return null;
  let total = 0;
  for (const m of clean.matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/gi)) {
    if (m[3] !== undefined) {
      // `d8` alone means one die.
      const n = m[2] ? Number(m[2]) : 1;
      total += (m[1] === '-' ? -1 : 1) * ((n * (Number(m[3]) + 1)) / 2);
    } else if (m[5] !== undefined) {
      total += (m[4] === '-' ? -1 : 1) * Number(m[5]);
    }
  }
  return Math.floor(total);
}

const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));
const listOf = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export function proficiency(form: Pick<CreatureForm, 'cr'>): number {
  return proficiencyForCr(form.cr);
}

export function passivePerception(form: CreatureForm): number {
  const level = form.skills.perception ?? 0;
  return 10 + abilityMod(form.scores.wis) + level * proficiency(form);
}

/** The attack builder's input: what it writes is ordinary statblock text. */
export interface AttackSpec {
  kind: 'melee' | 'ranged' | 'both';
  ability: Ability;
  /** "5" (reach, feet) and "80/320" (range, feet). */
  reach: string;
  range: string;
  damage: string;
  damageType: string;
  /** Extra damage: "2d6", "fire". */
  extraDamage: string;
  extraType: string;
}

/** "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage." in the edition's words. */
export function attackText(form: CreatureForm, attack: AttackSpec, edition: Edition): string {
  const mod = abilityMod(form.scores[attack.ability]);
  const toHit = mod + proficiency(form);
  const where = [
    attack.kind !== 'ranged' ? `reach ${attack.reach || '5'} ft.` : '',
    attack.kind !== 'melee' ? `range ${attack.range || '20/60'} ft.` : '',
  ]
    .filter(Boolean)
    .join(' or ');
  const dice = attack.damage.trim() || '1d6';
  const formula = mod === 0 ? dice : `${dice} ${mod > 0 ? '+' : '-'} ${String(Math.abs(mod))}`;
  const average = averageOf(formula) ?? 0;
  const type = (t: string) => (edition === '2024' ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const extraAvg = attack.extraDamage.trim() ? averageOf(attack.extraDamage) : null;
  const extra =
    extraAvg !== null
      ? ` plus ${String(extraAvg)} (${attack.extraDamage.trim()}) ${type(attack.extraType || 'fire')} damage`
      : '';
  const hit = `Hit: ${String(average)} (${formula}) ${type(attack.damageType || 'bludgeoning')} damage${extra}.`;
  if (edition === '2024') {
    const label =
      attack.kind === 'melee'
        ? 'Melee Attack Roll:'
        : attack.kind === 'ranged'
          ? 'Ranged Attack Roll:'
          : 'Melee or Ranged Attack Roll:';
    return `${label} ${signed(toHit)}, ${where} ${hit}`;
  }
  const label =
    attack.kind === 'melee'
      ? 'Melee Weapon Attack:'
      : attack.kind === 'ranged'
        ? 'Ranged Weapon Attack:'
        : 'Melee or Ranged Weapon Attack:';
  return `${label} ${signed(toHit)} to hit, ${where}, one target. ${hit}`;
}

const isObj = (v: unknown): v is RawEntity =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

/** Fields the form writes; everything else on a creature stays as it was. */
const FORM_FIELDS = [
  'size', 'type', 'alignment', 'ac', 'hp', 'speed', ...ABILITIES, 'cr', 'save', 'skill', 'senses',
  'passive', 'languages', 'resist', 'immune', 'vulnerable', 'conditionImmune', 'trait', 'action',
  'bonus', 'reaction', 'legendary', 'legendaryActions', 'spellcasting',
]; // prettier-ignore

function featuresOf(list: unknown): Feature[] {
  if (!Array.isArray(list)) return [];
  return list.filter(isObj).map((f) => ({
    name: typeof f.name === 'string' ? untagStatText(f.name) : '',
    text: (Array.isArray(f.entries) ? f.entries : [])
      .filter((e): e is string => typeof e === 'string')
      .map(untagStatText)
      .join('\n\n'),
  }));
}

function featuresTo(list: Feature[]): RawEntity[] {
  return list
    .filter((f) => f.name.trim() || f.text.trim())
    .map((f) => ({
      name: f.name.trim() || 'Feature',
      entries: textToEntries(f.text).map((p) => tagStatText(untagStatText(p))),
    }));
}

/** Spell names → `{@spell …}`, keeping any the person tagged. */
const spells = (list: string) =>
  listOf(list).map((s) => (s.startsWith('{@') ? s : `{@spell ${s.toLowerCase()}}`));
const spellNames = (list: unknown) =>
  (Array.isArray(list) ? list : []).map((s) => untagStatText(String(s))).join(', ');

const sizeOf = (v: unknown) => SIZES.find(([code]) => code === v)?.[0];

export function creatureToForm(c: RawEntity): CreatureForm {
  const base = emptyCreature(typeof c.name === 'string' ? c.name : '');
  const typeObj = isObj(c.type) ? c.type : null;
  const acFirst: unknown = Array.isArray(c.ac) ? (c.ac as unknown[])[0] : c.ac;
  const hp = isObj(c.hp) ? c.hp : {};
  const speed = isObj(c.speed) ? c.speed : {};
  const speedOf = (k: string) => {
    const v = speed[k];
    return typeof v === 'number' ? v : isObj(v) ? num(v.number) : null;
  };
  const cr = crValue(c.cr) ?? base.cr;
  const pb = proficiencyForCr(cr);
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, num(c[a]) ?? 10])) as Record<
    Ability,
    number
  >;
  const alignCode = Array.isArray(c.alignment) ? c.alignment.map(String).join(',') : '';
  const alignment =
    Object.entries(ALIGNMENT_CODES).find(([, codes]) => codes.join(',') === alignCode)?.[0] ??
    base.alignment;
  const skills: Record<string, 1 | 2> = {};
  if (isObj(c.skill)) {
    for (const [skill, bonus] of Object.entries(c.skill)) {
      const ability = SKILLS[skill];
      if (!ability) continue;
      const extra = Number(String(bonus).replace('−', '-')) - abilityMod(scores[ability]);
      skills[skill] = extra >= pb * 2 ? 2 : 1;
    }
  }
  const sensesText = (Array.isArray(c.senses) ? c.senses : []).map(String).join(', ');
  const senses = { ...base.senses };
  for (const s of SENSES) {
    const m = new RegExp(`${s} (\\d+)`).exec(sensesText);
    if (m) senses[s] = Number(m[1]);
  }
  const damage = (list: unknown) =>
    (Array.isArray(list) ? list : []).filter((d): d is string => typeof d === 'string');
  const casting = Array.isArray(c.spellcasting) ? c.spellcasting.find(isObj) : undefined;
  const daily = isObj(casting?.daily) ? casting.daily : {};
  return {
    ...base,
    size: sizeOf(Array.isArray(c.size) ? (c.size as unknown[])[0] : c.size) ?? base.size,
    creatureType:
      typeof c.type === 'string'
        ? c.type
        : typeof typeObj?.type === 'string'
          ? typeObj.type
          : base.creatureType,
    typeTags: Array.isArray(typeObj?.tags)
      ? typeObj.tags.filter((t) => typeof t === 'string').join(', ')
      : '',
    alignment,
    ac:
      typeof acFirst === 'number'
        ? acFirst
        : isObj(acFirst)
          ? (num(acFirst.ac) ?? base.ac)
          : base.ac,
    acFrom:
      isObj(acFirst) && Array.isArray(acFirst.from)
        ? acFirst.from.map(untagStatText).join(', ')
        : '',
    hpFormula: typeof hp.formula === 'string' ? hp.formula : '',
    hpAverage: typeof hp.formula === 'string' ? null : num(hp.average),
    speed: Object.fromEntries(SPEEDS.map((k) => [k, speedOf(k)])) as CreatureForm['speed'],
    hover: speed.canHover === true,
    scores,
    cr,
    saves: isObj(c.save) ? ABILITIES.filter((a) => a in (c.save as RawEntity)) : [],
    skills,
    senses,
    languages: (Array.isArray(c.languages) ? c.languages : [])
      .map((l) => untagStatText(String(l)))
      .join(', '),
    resist: damage(c.resist),
    immune: damage(c.immune),
    vulnerable: damage(c.vulnerable),
    conditionImmune: damage(c.conditionImmune),
    traits: featuresOf(c.trait),
    actions: featuresOf(c.action),
    bonusActions: featuresOf(c.bonus),
    reactions: featuresOf(c.reaction),
    legendaryCount: num(c.legendaryActions) ?? 3,
    legendary: featuresOf(c.legendary),
    spellcasting: casting
      ? {
          on: true,
          ability: (ABILITIES as readonly string[]).includes(String(casting.ability))
            ? (casting.ability as Ability)
            : 'int',
          atWill: spellNames(casting.will),
          perDay: {
            1: spellNames(daily['1e'] ?? daily['1']),
            2: spellNames(daily['2e'] ?? daily['2']),
            3: spellNames(daily['3e'] ?? daily['3']),
          },
        }
      : base.spellcasting,
  };
}

export function formToCreature(
  form: CreatureForm,
  edition: Edition,
  base: RawEntity = {},
): RawEntity {
  const kept: RawEntity = {};
  for (const [k, v] of Object.entries(base)) if (!FORM_FIELDS.includes(k)) kept[k] = v;
  const pb = proficiency(form);
  const mod = (a: Ability) => abilityMod(form.scores[a]);
  const tags = listOf(form.typeTags);
  const c: RawEntity = {
    ...kept,
    name: form.name.trim(),
    size: [form.size],
    type: tags.length ? { type: form.creatureType, tags } : form.creatureType,
    alignment: ALIGNMENT_CODES[form.alignment] ?? ['N'],
    ac: form.acFrom.trim() ? [{ ac: form.ac, from: listOf(form.acFrom) }] : [form.ac],
  };
  const average = averageOf(form.hpFormula);
  c.hp =
    average !== null && form.hpFormula.trim()
      ? { average, formula: form.hpFormula.trim() }
      : { average: form.hpAverage ?? 1 };
  const speed: RawEntity = {};
  for (const k of SPEEDS) {
    const v = form.speed[k];
    if (v !== null && (v > 0 || k === 'walk')) speed[k] = v;
  }
  if (form.hover && form.speed.fly) speed.canHover = true;
  c.speed = speed;
  for (const a of ABILITIES) c[a] = form.scores[a];
  if (form.saves.length) {
    c.save = Object.fromEntries(form.saves.map((a) => [a, signed(mod(a) + pb)]));
  }
  const skillEntries = Object.entries(form.skills);
  if (skillEntries.length) {
    c.skill = Object.fromEntries(
      skillEntries
        .filter(([s]) => SKILLS[s])
        .map(([s, level]) => [s, signed(mod(SKILLS[s] ?? 'wis') + pb * level)]),
    );
  }
  const senses = SENSES.filter((s) => form.senses[s]).map(
    (s) => `${s} ${String(form.senses[s])} ft.`,
  );
  if (senses.length) c.senses = senses;
  c.passive = passivePerception(form);
  const languages = listOf(form.languages);
  if (languages.length) c.languages = languages;
  if (form.resist.length) c.resist = [...form.resist];
  if (form.immune.length) c.immune = [...form.immune];
  if (form.vulnerable.length) c.vulnerable = [...form.vulnerable];
  if (form.conditionImmune.length) c.conditionImmune = [...form.conditionImmune];
  c.cr = form.cr;
  const traits = featuresTo(form.traits);
  if (traits.length) c.trait = traits;
  const actions = featuresTo(form.actions);
  if (actions.length) c.action = actions;
  const bonus = featuresTo(form.bonusActions);
  if (bonus.length) c.bonus = bonus;
  const reactions = featuresTo(form.reactions);
  if (reactions.length) c.reaction = reactions;
  const legendary = featuresTo(form.legendary);
  if (legendary.length) {
    c.legendary = legendary;
    c.legendaryActions = form.legendaryCount;
  }
  if (form.spellcasting.on) {
    const s = form.spellcasting;
    const dc = 8 + pb + mod(s.ability);
    const hit = pb + mod(s.ability);
    const who = form.name.trim() || 'The creature';
    const header =
      edition === '2024'
        ? `${who} casts one of the following spells, requiring no Material components and using ${ABILITY_NAME[s.ability]} as the spellcasting ability (spell save {@dc ${String(dc)}}, {@hit ${String(hit)}} to hit with spell attacks):`
        : `${who}'s spellcasting ability is ${ABILITY_NAME[s.ability]} (spell save {@dc ${String(dc)}}, {@hit ${String(hit)}} to hit with spell attacks). It can cast the following spells:`;
    const daily: RawEntity = {};
    for (const n of [1, 2, 3] as const)
      if (listOf(s.perDay[n]).length) daily[`${String(n)}e`] = spells(s.perDay[n]);
    c.spellcasting = [
      {
        type: 'spellcasting',
        name: 'Spellcasting',
        headerEntries: [header],
        ...(listOf(s.atWill).length ? { will: spells(s.atWill) } : {}),
        ...(Object.keys(daily).length ? { daily } : {}),
        ability: s.ability,
        ...(edition === '2024' ? { displayAs: 'action' } : {}),
      },
    ];
  }
  return c;
}
