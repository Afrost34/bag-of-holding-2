import type { Edition } from '../editions';
import type { RawEntity } from '../identity';
import { entriesToText, textToEntries } from './text';

/**
 * Homebrew feats, backgrounds, species and classes, made with forms and written as 5etools data
 * so the compendium shows them and the character builder offers them like any other.
 */

export const ABILITY_IDS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];

export const SKILL_NAMES = [
  'acrobatics', 'animal handling', 'arcana', 'athletics', 'deception', 'history', 'insight',
  'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance',
  'persuasion', 'religion', 'sleight of hand', 'stealth', 'survival',
] as const; // prettier-ignore

const isObj = (v: unknown): v is RawEntity =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const plainEntries = (v: unknown) => entriesToText(strings(v));
const editionMark = (edition: Edition) => (edition === '2024' ? { edition: 'one' } : {});

// Feats ------------------------------------------------------------------------------------

/** 2024 feat categories (2014 feats have none). */
export const FEAT_CATEGORIES = [
  { id: '', label: 'None' },
  { id: 'O', label: 'Origin' },
  { id: 'G', label: 'General' },
  { id: 'FS', label: 'Fighting Style' },
  { id: 'EB', label: 'Epic Boon' },
] as const;

export interface FeatForm {
  name: string;
  category: string;
  /** Character level needed (0: none). */
  level: number;
  /** Other prerequisite, in words. */
  prerequisite: string;
  repeatable: boolean;
  /** Abilities one of which goes up by 1 (none: no increase). */
  abilityFrom: AbilityId[];
  text: string;
}

export const emptyFeat = (): FeatForm => ({
  name: '',
  category: '',
  level: 0,
  prerequisite: '',
  repeatable: false,
  abilityFrom: [],
  text: '',
});

export function formToFeat(form: FeatForm, edition: Edition, base: RawEntity = {}): RawEntity {
  const prerequisite = [
    ...(form.level > 0 ? [{ level: form.level }] : []),
    ...(form.prerequisite.trim() ? [{ other: form.prerequisite.trim() }] : []),
  ];
  const { category: _c, prerequisite: _p, repeatable: _r, ability: _a, ...rest } = base;
  return {
    ...rest,
    name: form.name.trim(),
    ...editionMark(edition),
    ...(form.category ? { category: form.category } : {}),
    ...(prerequisite.length
      ? { prerequisite: [Object.assign({}, ...prerequisite) as RawEntity] }
      : {}),
    ...(form.repeatable ? { repeatable: true } : {}),
    ...(form.abilityFrom.length
      ? { ability: [{ choose: { from: form.abilityFrom, amount: 1 } }] }
      : {}),
    entries: textToEntries(form.text),
  };
}

export function featToForm(feat: RawEntity): FeatForm {
  const pre = Array.isArray(feat.prerequisite) ? feat.prerequisite.find(isObj) : undefined;
  const ability = Array.isArray(feat.ability) ? feat.ability.find(isObj) : undefined;
  const choose = isObj(ability?.choose) ? ability.choose : undefined;
  return {
    name: String(feat.name ?? ''),
    category: typeof feat.category === 'string' ? feat.category : '',
    level: typeof pre?.level === 'number' ? pre.level : 0,
    prerequisite: typeof pre?.other === 'string' ? pre.other : '',
    repeatable: feat.repeatable === true,
    abilityFrom: strings(choose?.from).filter((a): a is AbilityId =>
      (ABILITY_IDS as readonly string[]).includes(a),
    ),
    text: plainEntries(feat.entries),
  };
}

// Backgrounds --------------------------------------------------------------------------------

export interface BackgroundForm {
  name: string;
  skills: string[];
  /** A tool, by name ("thieves' tools"), or empty. */
  tool: string;
  /** Languages of the player's choice. */
  languages: number;
  /** 2024: the three abilities the background raises (+2/+1 or +1/+1/+1). */
  abilities: AbilityId[];
  /** 2024: its origin feat, as a 5etools reference ("alert|xphb"). */
  feat: string;
  equipment: string;
  text: string;
}

export const emptyBackground = (): BackgroundForm => ({
  name: '',
  skills: [],
  tool: '',
  languages: 0,
  abilities: [],
  feat: '',
  equipment: '',
  text: '',
});

const title = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase());

export function formToBackground(
  form: BackgroundForm,
  edition: Edition,
  base: RawEntity = {},
): RawEntity {
  const items = [
    ...(form.abilities.length
      ? [
          {
            type: 'item',
            name: 'Ability Scores:',
            entry: form.abilities.map((a) => a.toUpperCase()).join(', '),
          },
        ]
      : []),
    ...(form.feat ? [{ type: 'item', name: 'Feat:', entry: `{@feat ${form.feat}}` }] : []),
    ...(form.skills.length
      ? [{ type: 'item', name: 'Skill Proficiencies:', entry: form.skills.map(title).join(', ') }]
      : []),
    ...(form.tool.trim()
      ? [{ type: 'item', name: 'Tool Proficiency:', entry: title(form.tool.trim()) }]
      : []),
    ...(form.languages > 0
      ? [{ type: 'item', name: 'Languages:', entry: `${String(form.languages)} of your choice` }]
      : []),
    ...(form.equipment.trim()
      ? [{ type: 'item', name: 'Equipment:', entry: form.equipment.trim() }]
      : []),
  ];
  const {
    skillProficiencies: _s,
    toolProficiencies: _t,
    languageProficiencies: _l,
    ability: _a,
    feats: _f,
    ...rest
  } = base;
  return {
    ...rest,
    name: form.name.trim(),
    ...editionMark(edition),
    ...(form.skills.length
      ? { skillProficiencies: [Object.fromEntries(form.skills.map((s) => [s, true]))] }
      : {}),
    ...(form.tool.trim()
      ? { toolProficiencies: [{ [form.tool.trim().toLowerCase()]: true }] }
      : {}),
    ...(form.languages > 0 ? { languageProficiencies: [{ anyStandard: form.languages }] } : {}),
    ...(form.abilities.length
      ? {
          ability: [
            { choose: { weighted: { from: form.abilities, weights: [2, 1] } } },
            { choose: { weighted: { from: form.abilities, weights: [1, 1, 1] } } },
          ],
        }
      : {}),
    ...(form.feat ? { feats: [{ [form.feat.toLowerCase()]: true }] } : {}),
    entries: [
      ...(items.length ? [{ type: 'list', style: 'list-hang-notitle', items }] : []),
      ...textToEntries(form.text),
    ],
  };
}

export function backgroundToForm(bg: RawEntity): BackgroundForm {
  const skills = Array.isArray(bg.skillProficiencies)
    ? bg.skillProficiencies.find(isObj)
    : undefined;
  const tools = Array.isArray(bg.toolProficiencies) ? bg.toolProficiencies.find(isObj) : undefined;
  const langs = Array.isArray(bg.languageProficiencies)
    ? bg.languageProficiencies.find(isObj)
    : undefined;
  const ability = Array.isArray(bg.ability) ? bg.ability.find(isObj) : undefined;
  const weighted =
    isObj(ability?.choose) && isObj(ability.choose.weighted) ? ability.choose.weighted : undefined;
  const feats = Array.isArray(bg.feats) ? bg.feats.find(isObj) : undefined;
  const entries = Array.isArray(bg.entries) ? bg.entries : [];
  const list = entries.find((e) => isObj(e) && e.type === 'list');
  const equipment =
    isObj(list) && Array.isArray(list.items)
      ? list.items.find((i) => isObj(i) && i.name === 'Equipment:')
      : undefined;
  return {
    name: String(bg.name ?? ''),
    skills: skills ? Object.keys(skills).filter((k) => skills[k] === true) : [],
    tool: tools ? (Object.keys(tools)[0] ?? '') : '',
    languages: typeof langs?.anyStandard === 'number' ? langs.anyStandard : 0,
    abilities: strings(weighted?.from).filter((a): a is AbilityId =>
      (ABILITY_IDS as readonly string[]).includes(a),
    ),
    feat: feats ? (Object.keys(feats)[0] ?? '') : '',
    equipment: isObj(equipment) && typeof equipment.entry === 'string' ? equipment.entry : '',
    text: entriesToText(entries.filter((e): e is string => typeof e === 'string')),
  };
}

// Species ------------------------------------------------------------------------------------

export interface SpeciesForm {
  name: string;
  size: 'S' | 'M' | 'L';
  speed: number;
  /** Darkvision range in feet (0: none). */
  darkvision: number;
  traits: { name: string; text: string }[];
}

export const emptySpecies = (): SpeciesForm => ({
  name: '',
  size: 'M',
  speed: 30,
  darkvision: 0,
  traits: [],
});

export function formToSpecies(
  form: SpeciesForm,
  edition: Edition,
  base: RawEntity = {},
): RawEntity {
  const { darkvision: _d, ...rest } = base;
  return {
    ...rest,
    name: form.name.trim(),
    ...editionMark(edition),
    size: [form.size],
    speed: form.speed,
    ...(form.darkvision > 0 ? { darkvision: form.darkvision } : {}),
    creatureTypes: ['humanoid'],
    entries: form.traits
      .filter((t) => t.name.trim())
      .map((t) => ({ type: 'entries', name: t.name.trim(), entries: textToEntries(t.text) })),
  };
}

export function speciesToForm(race: RawEntity): SpeciesForm {
  const size = strings(race.size)[0];
  return {
    name: String(race.name ?? ''),
    size: size === 'S' || size === 'L' ? size : 'M',
    speed:
      typeof race.speed === 'number'
        ? race.speed
        : isObj(race.speed) && typeof race.speed.walk === 'number'
          ? race.speed.walk
          : 30,
    darkvision: typeof race.darkvision === 'number' ? race.darkvision : 0,
    traits: (Array.isArray(race.entries) ? race.entries : []).flatMap((e) =>
      isObj(e) && typeof e.name === 'string'
        ? [{ name: e.name, text: plainEntries(e.entries) }]
        : [],
    ),
  };
}

// Classes ------------------------------------------------------------------------------------

export type Caster = 'none' | 'full' | 'half' | 'pact';

export interface ClassForm {
  name: string;
  hitDie: 6 | 8 | 10 | 12;
  primary: AbilityId;
  saves: AbilityId[];
  armor: string[];
  weapons: string[];
  skillsFrom: string[];
  skillCount: number;
  caster: Caster;
  spellAbility: AbilityId;
  /** Whose spell list it uses ("Wizard"). */
  spellList: string;
  subclassTitle: string;
  features: { level: number; name: string; text: string }[];
}

export const emptyClass = (): ClassForm => ({
  name: '',
  hitDie: 8,
  primary: 'str',
  saves: [],
  armor: [],
  weapons: ['simple'],
  skillsFrom: [],
  skillCount: 2,
  caster: 'none',
  spellAbility: 'int',
  spellList: '',
  subclassTitle: '',
  features: [],
});

/** Cantrips and prepared spells by level, as the 2024 core classes have them. */
const PROGRESSIONS: Record<Exclude<Caster, 'none'>, { cantrips?: number[]; prepared: number[] }> = {
  full: {
    cantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
  },
  half: { prepared: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15] },
  pact: {
    cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    prepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  },
};

/** The class and its features (5etools keeps features in their own list). */
export function formToClass(
  form: ClassForm,
  edition: Edition,
  source: string,
  base: RawEntity = {},
): { cls: RawEntity; features: RawEntity[] } {
  const name = form.name.trim();
  const features = form.features.filter((f) => f.name.trim()).sort((a, b) => a.level - b.level);
  const {
    casterProgression: _cp,
    spellcastingAbility: _sa,
    cantripProgression: _c,
    preparedSpellsProgression: _p,
    spellList: _sl,
    ...rest
  } = base;
  const prog = form.caster === 'none' ? null : PROGRESSIONS[form.caster];
  const cls: RawEntity = {
    ...rest,
    name,
    ...editionMark(edition),
    hd: { number: 1, faces: form.hitDie },
    proficiency: form.saves,
    primaryAbility: [{ [form.primary]: true }],
    startingProficiencies: {
      ...(form.armor.length ? { armor: form.armor } : {}),
      ...(form.weapons.length ? { weapons: form.weapons } : {}),
      ...(form.skillsFrom.length
        ? { skills: [{ choose: { from: form.skillsFrom, count: form.skillCount } }] }
        : {}),
    },
    ...(prog
      ? {
          casterProgression:
            form.caster === 'half' ? (edition === '2024' ? 'artificer' : '1/2') : form.caster,
          spellcastingAbility: form.spellAbility,
          ...(prog.cantrips ? { cantripProgression: prog.cantrips } : {}),
          preparedSpellsProgression: prog.prepared,
          ...(form.spellList.trim() ? { spellList: form.spellList.trim() } : {}),
        }
      : {}),
    ...(form.subclassTitle.trim() ? { subclassTitle: form.subclassTitle.trim() } : {}),
    classFeatures: features.map((f) => `${f.name.trim()}|${name}|${source}|${String(f.level)}`),
  };
  return {
    cls,
    features: features.map((f) => ({
      name: f.name.trim(),
      source,
      className: name,
      classSource: source,
      level: f.level,
      entries: textToEntries(f.text),
    })),
  };
}

export function classToForm(cls: RawEntity, features: readonly RawEntity[]): ClassForm {
  const hd = isObj(cls.hd) && typeof cls.hd.faces === 'number' ? cls.hd.faces : 8;
  const primary = Array.isArray(cls.primaryAbility) ? cls.primaryAbility.find(isObj) : undefined;
  const sp = isObj(cls.startingProficiencies) ? cls.startingProficiencies : {};
  const skills = Array.isArray(sp.skills) ? sp.skills.find(isObj) : undefined;
  const choose = isObj(skills?.choose) ? skills.choose : undefined;
  const cp = cls.casterProgression;
  const asAbility = (v: unknown): AbilityId =>
    (ABILITY_IDS as readonly string[]).includes(String(v)) ? (v as AbilityId) : 'int';
  return {
    name: String(cls.name ?? ''),
    hitDie: hd === 6 || hd === 10 || hd === 12 ? hd : 8,
    primary: primary ? asAbility(Object.keys(primary)[0]) : 'str',
    saves: strings(cls.proficiency).filter((a): a is AbilityId =>
      (ABILITY_IDS as readonly string[]).includes(a),
    ),
    armor: strings(sp.armor),
    weapons: strings(sp.weapons),
    skillsFrom: strings(choose?.from),
    skillCount: typeof choose?.count === 'number' ? choose.count : 2,
    caster:
      cp === 'full'
        ? 'full'
        : cp === 'pact'
          ? 'pact'
          : cp === '1/2' || cp === 'artificer'
            ? 'half'
            : 'none',
    spellAbility: asAbility(cls.spellcastingAbility),
    spellList: typeof cls.spellList === 'string' ? cls.spellList : '',
    subclassTitle: typeof cls.subclassTitle === 'string' ? cls.subclassTitle : '',
    features: features
      .filter((f) => f.className === cls.name)
      .map((f) => ({
        level: typeof f.level === 'number' ? f.level : 1,
        name: String(f.name ?? ''),
        text: plainEntries(f.entries),
      })),
  };
}
