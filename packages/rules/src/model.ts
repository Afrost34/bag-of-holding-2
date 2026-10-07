import { makeKey } from '@boh/data5e';

/**
 * What an entity gives a character (grants) and what it asks the player to pick (choices).
 *
 * The extractor reads these from 5etools' structured fields; the builder (build.ts) applies the
 * player's decisions and follows what they lead to (a chosen feat brings its own grants and
 * choices). Everything here is plain data so it can cross the worker boundary.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const isAbility = (v: unknown): v is Ability =>
  typeof v === 'string' && (ABILITIES as readonly string[]).includes(v);

/** The 18 skills with the ability each uses, in 5etools' lowercase names. */
export const SKILLS: Readonly<Record<string, Ability>> = {
  acrobatics: 'dex',
  'animal handling': 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  'sleight of hand': 'dex',
  stealth: 'dex',
  survival: 'wis',
};

export type ProficiencyKind = 'skill' | 'tool' | 'language' | 'weapon' | 'armor' | 'save';
export type DefenceKind = 'resist' | 'immune' | 'conditionImmune' | 'vulnerable';

/** How a granted spell is had: always prepared, known, cast innately, or added to the list. */
export type SpellMode = 'prepared' | 'known' | 'innate' | 'expanded';

/** Uses of an innately cast spell: `daily: 1` is once per long rest; `each` means per spell. */
export interface SpellUses {
  per: 'will' | 'daily' | 'rest' | 'ritual' | 'resource';
  count?: number;
  /** Uses equal to an ability modifier (`daily: { int: [...] }`). */
  countAbility?: Ability;
  /** "1e": the count applies to each spell of the group rather than to the group. */
  each?: boolean;
}

export type Grant =
  | { kind: ProficiencyKind | DefenceKind; value: string }
  | { kind: 'expertise'; value: string }
  /** `max`: the score the increase cannot exceed (30 for Epic Boons; 20 when absent). */
  | { kind: 'ability'; ability: Ability; amount: number; max?: number }
  /**
   * `version`: a named version of the feat (`Magic Initiate; Cleric`), which picks one of its
   * alternatives in advance. See `_versions` in 5etools data.
   */
  | { kind: 'feat'; key: string; version?: string }
  | { kind: 'optionalfeature'; key: string }
  | {
      kind: 'spell';
      key: string;
      mode: SpellMode;
      uses?: SpellUses;
      /** Character (or class) level from which the spell is had. */
      level: number;
    }
  /** Every spell matching a filter joins the spell list (Magical Secrets, 2024 Bard). */
  | { kind: 'spellList'; filter: string; level: number }
  | { kind: 'item'; key: string; quantity: number }
  | { kind: 'special'; text: string; quantity: number }
  /** Coins, in copper pieces. */
  | { kind: 'money'; cp: number }
  | { kind: 'size'; value: string }
  /** The spellcasting ability for spells from the same source (feats, species). */
  | { kind: 'spellAbility'; ability: Ability }
  /** A weapon whose mastery property the character can use (2024). */
  | { kind: 'mastery'; key: string };

export type ChoiceKind =
  | ProficiencyKind
  | DefenceKind
  | 'skillToolLanguage'
  | 'expertise'
  | 'ability'
  | 'spellAbility'
  | 'feat'
  | 'spell'
  | 'optionalfeature'
  /** One of the options a feature lists (Totem Spirit: Bear, Eagle…; Divine Order). */
  | 'feature'
  | 'subclass'
  | 'item'
  /** Weapons whose mastery property you can use (2024). */
  | 'weaponMastery'
  | 'size'
  /** Pick one of several bundles ("A or B", "Drow, High Elf or Wood Elf"). */
  | 'alternative';

/** Where options come from when they are not a fixed list. */
export type OptionFilter =
  | { type: 'any' }
  /** Languages, tools or skills from a named group; `proficient` = skills already proficient. */
  | { type: 'pool'; pool: Pool }
  /** A 5etools spell filter: `level=0|class=Wizard`. Empty means any spell. */
  | { type: 'spell'; filter: string }
  | { type: 'feat'; categories?: readonly string[] }
  | { type: 'optionalfeature'; featureTypes: readonly string[] }
  | { type: 'subclass'; className: string; classSource: string }
  /** 5etools' equipment groups (`weaponSimple`, `instrumentMusical`…) or an item filter string. */
  | { type: 'items'; equipmentType?: string; filter?: string };

export type Pool =
  | 'standardLanguage'
  | 'exoticLanguage'
  | 'language'
  | 'artisanTool'
  | 'musicalInstrument'
  | 'gamingSet'
  | 'tool'
  | 'skill'
  | 'proficientSkill';

/** A bundle offered by an `alternative` choice. */
export interface Branch {
  id: string;
  label: string;
  grants: Grant[];
  choices: Choice[];
}

export interface Choice {
  /** Stable: decisions are stored under it. `class:bard@xphb/level:3/subclass`. */
  id: string;
  kind: ChoiceKind;
  label: string;
  count: number;
  /** Class level (classes, subclasses) or character level (anything else) it is made at. */
  level?: number;
  /** Fixed options. May include pool options (`pool:artisanTool`) that need a follow-up pick. */
  options?: readonly string[];
  filter?: OptionFilter;
  /** For ability choices, the bonus each pick gets in order: `[2, 1]` for "+2 and +1". */
  amounts?: readonly number[];
  /** For ability choices: the score the increase cannot exceed. */
  max?: number;
  /**
   * The class or subclass feature that asks (its key), set by the builder so a choice can be shown
   * inside its feature ("Fighting Style", "Bard Subclass", "Expertise").
   */
  via?: string;
  /** For `alternative` choices: what each option brings. Option ids are branch ids. */
  branches?: readonly Branch[];
}

export interface Extraction {
  grants: Grant[];
  choices: Choice[];
}

/** Collects data shapes the extractor does not understand, for the conformance guard. */
export interface Issues {
  add(where: string, message: string): void;
}

export const ignoreIssues: Issues = { add: () => undefined };

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** A 5etools `name|source` reference as an entity key; a missing source means `fallback`. */
export function refKey(type: string, ref: string, fallback = 'PHB'): string {
  const [name = '', source] = ref.split('#')[0]?.split('|') ?? [];
  return makeKey(type, [name], source === undefined || source === '' ? fallback : source);
}

export const emptyExtraction = (): Extraction => ({ grants: [], choices: [] });

export function merge(into: Extraction, from: Extraction): Extraction {
  into.grants.push(...from.grants);
  into.choices.push(...from.choices);
  return into;
}
