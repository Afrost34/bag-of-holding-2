import {
  emptyExtraction,
  isAbility,
  isObj,
  num,
  refKey,
  SKILLS,
  type Branch,
  type Choice,
  type ChoiceKind,
  type DefenceKind,
  type Extraction,
  type Grant,
  type Issues,
  type OptionFilter,
  type Pool,
  type ProficiencyKind,
} from '../model';

/**
 * 5etools proficiency blocks: `skillProficiencies`, `toolProficiencies`, `expertise`, `resist`…
 *
 * Each block is a list of alternatives (usually one): `[{ "deception": true, "choose": {…} }]`.
 * Inside one, a `true` key is a grant, `choose` is a pick from a list, and `any…` keys are picks
 * from a group (`anyStandard: 2` = two standard languages).
 */

export const PROFICIENCY_FIELDS = {
  skillProficiencies: 'skill',
  toolProficiencies: 'tool',
  languageProficiencies: 'language',
  weaponProficiencies: 'weapon',
  armorProficiencies: 'armor',
  savingThrowProficiencies: 'save',
  skillToolLanguageProficiencies: 'skillToolLanguage',
  expertise: 'expertise',
  resist: 'resist',
  immune: 'immune',
  conditionImmune: 'conditionImmune',
  vulnerable: 'vulnerable',
} as const satisfies Record<string, ChoiceKind>;

export type ProficiencyField = keyof typeof PROFICIENCY_FIELDS;

/** `any…` keys: the group they pick from, per block kind. */
const POOLS: Readonly<Record<string, Pool>> = {
  anyStandard: 'standardLanguage',
  anyExotic: 'exoticLanguage',
  anyLanguage: 'language',
  anyArtisansTool: 'artisanTool',
  anyMusicalInstrument: 'musicalInstrument',
  anyGamingSet: 'gamingSet',
  anyTool: 'tool',
  anySkill: 'skill',
  anyProficientSkill: 'proficientSkill',
};

/** `any: n` picks from everything of the block's kind. */
const ANY_POOL: Partial<Record<ChoiceKind, Pool>> = {
  skill: 'skill',
  tool: 'tool',
  language: 'language',
};

const NOUN: Record<string, [string, string]> = {
  skill: ['skill', 'skills'],
  tool: ['tool', 'tools'],
  language: ['language', 'languages'],
  weapon: ['weapon', 'weapons'],
  armor: ['armour', 'armour'],
  save: ['saving throw', 'saving throws'],
  skillToolLanguage: ['skill, tool or language', 'skills, tools or languages'],
  expertise: ['expertise', 'expertise'],
  resist: ['resistance', 'resistances'],
  immune: ['immunity', 'immunities'],
  conditionImmune: ['condition immunity', 'condition immunities'],
  vulnerable: ['vulnerability', 'vulnerabilities'],
};

const POOL_NOUN: Record<Pool, [string, string]> = {
  standardLanguage: ['standard language', 'standard languages'],
  exoticLanguage: ['exotic language', 'exotic languages'],
  language: ['language', 'languages'],
  artisanTool: ["artisan's tool", "artisan's tools"],
  musicalInstrument: ['musical instrument', 'musical instruments'],
  gamingSet: ['gaming set', 'gaming sets'],
  tool: ['tool', 'tools'],
  skill: ['skill', 'skills'],
  proficientSkill: ['skill you are proficient in', 'skills you are proficient in'],
};

export const plural = (n: number, [one, many]: readonly [string, string]) =>
  `${String(n)} ${n === 1 ? one : many}`;

const titleCase = (s: string) =>
  s.replace(/(^|[\s(-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

/** The option id for a pool: `pool:artisanTool`. Picking it needs a follow-up pick. */
export const poolOption = (pool: Pool) => `pool:${pool}`;

/** What a value in a block means as a grant: an item key for weapons, the name otherwise. */
function grantValue(kind: ChoiceKind, value: string): string {
  if (kind === 'weapon' && value.includes('|')) return refKey('item', value);
  return value.toLowerCase();
}

function grantKind(kind: ChoiceKind, value: string): Grant['kind'] | null {
  if (kind === 'skillToolLanguage') return null;
  if (kind === 'expertise') return 'expertise';
  if (kind === 'save') return isAbility(value) ? 'save' : null;
  return kind as ProficiencyKind | DefenceKind;
}

/** `choose.from` entries: plain values, or `any…` pool names. */
function optionId(kind: ChoiceKind, value: string): string {
  const pool = POOLS[value];
  if (pool) return poolOption(pool);
  return grantValue(kind, value);
}

/** One alternative of a block. */
function readAlternative(
  kind: ChoiceKind,
  alt: Record<string, unknown>,
  id: string,
  where: string,
  issues: Issues,
): Extraction {
  const out = emptyExtraction();
  let pick = 0;
  const nextId = () => {
    const n = pick++;
    return n === 0 ? id : `${id}/${String(n)}`;
  };
  for (const [key, value] of Object.entries(alt)) {
    if (key === 'choose') {
      for (const c of Array.isArray(value) ? value : [value]) {
        if (!isObj(c)) {
          issues.add(where, `choose is not an object`);
          continue;
        }
        const count = num(c.count) ?? 1;
        if (Array.isArray(c.from)) {
          const options = c.from.filter((o): o is string => typeof o === 'string');
          if (options.length !== c.from.length) issues.add(where, `non-text option in choose`);
          out.choices.push({
            id: nextId(),
            kind,
            count,
            label: `Choose ${plural(count, NOUN[kind] ?? ['option', 'options'])}`,
            options: options.map((o) => optionId(kind, o)),
          });
        } else if (typeof c.fromFilter === 'string') {
          out.choices.push({
            id: nextId(),
            kind,
            count,
            label: `Choose ${plural(count, NOUN[kind] ?? ['option', 'options'])}`,
            filter: { type: 'items', filter: c.fromFilter },
          });
        } else issues.add(where, `choose without from`);
        for (const k of Object.keys(c))
          if (k !== 'from' && k !== 'count' && k !== 'fromFilter')
            issues.add(where, `unknown choose field ${k}`);
      }
      continue;
    }
    // `all: { fromFilter }`: every weapon matching a filter (Monk, Rogue).
    if (key === 'all' && isObj(value) && typeof value.fromFilter === 'string') {
      out.grants.push({ kind: 'weapon', value: `filter:${value.fromFilter}` });
      continue;
    }
    const count = num(value);
    const pool = key === 'any' ? ANY_POOL[kind] : POOLS[key];
    if (count !== undefined && pool) {
      out.choices.push({
        id: nextId(),
        kind: pool === 'proficientSkill' ? 'expertise' : kind,
        count,
        label: `Choose ${plural(count, POOL_NOUN[pool])}`,
        filter: { type: 'pool', pool } satisfies OptionFilter,
      });
      continue;
    }
    // 2014 races: "Common and one other language".
    if (key === 'other' && value === true && kind === 'language') {
      out.choices.push({
        id: nextId(),
        kind,
        count: 1,
        label: 'Choose 1 language',
        filter: { type: 'pool', pool: 'standardLanguage' },
      });
      continue;
    }
    const gk = value === true ? grantKind(kind, key) : null;
    if (gk) {
      out.grants.push({ kind: gk, value: grantValue(kind, key) } as Grant);
      continue;
    }
    issues.add(where, `unknown ${kind} entry ${key}=${JSON.stringify(value)}`);
  }
  return out;
}

/** A short description of an alternative, for the pick: "Deception and Sleight of Hand". */
export function describe(ex: Extraction): string {
  const parts = [
    ...ex.grants.map((g) => ('value' in g ? titleCase(g.value.replace(/@.*$/, '')) : g.kind)),
    ...ex.choices.map((c) => c.label.replace(/^Choose /, '')),
  ];
  return parts.length <= 2
    ? parts.join(' and ')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
}

/**
 * Reads one block. With several alternatives the result is one `alternative` choice whose
 * branches hold each alternative's grants and choices.
 */
export function readProficiencies(
  field: ProficiencyField,
  value: unknown,
  id: string,
  issues: Issues,
): Extraction {
  const kind = PROFICIENCY_FIELDS[field];
  const where = `${id} ${field}`;
  const list = Array.isArray(value) ? value : [value];
  if (list.length === 0) return emptyExtraction();
  // `resist: ["fire"]`: a flat list of grants.
  if (list.every((v) => typeof v === 'string')) {
    const out = emptyExtraction();
    const gk = grantKind(kind, '');
    if (
      !gk ||
      (kind !== 'resist' &&
        kind !== 'immune' &&
        kind !== 'conditionImmune' &&
        kind !== 'vulnerable')
    )
      issues.add(where, `list of names`);
    else for (const v of list) out.grants.push({ kind: gk, value: v.toLowerCase() } as Grant);
    return out;
  }
  const alts = list.filter(isObj);
  if (alts.length !== list.length) issues.add(where, `mixed entries`);
  if (alts.length === 1 && alts[0]) return readAlternative(kind, alts[0], id, where, issues);
  const branches: Branch[] = alts.map((alt, i) => {
    const ex = readAlternative(kind, alt, `${id}/${String(i)}`, where, issues);
    return { id: String(i), label: describe(ex), ...ex };
  });
  return {
    grants: [],
    choices: [
      {
        id,
        kind: 'alternative',
        count: 1,
        label: `Choose ${NOUN[kind]?.[1] ?? 'one'}`,
        options: branches.map((b) => b.id),
        branches,
      } satisfies Choice,
    ],
  };
}

export const isSkill = (v: string) => v in SKILLS;
