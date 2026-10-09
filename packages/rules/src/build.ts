import {
  buildClassPage,
  buildSpeciesPage,
  buildSubclassPage,
  classFeatureRef,
  subclassFeatureRef,
  type Edition,
  type EntityDetail,
  type FeatureEntry,
  type PageLookup,
  type RawEntity,
} from '@boh/data5e';
import { readClassLevel } from './extract/classes';
import { readEntity } from './extract/entity';
import { foundryEntryData, readFeature } from './extract/features';
import {
  ABILITIES,
  isAbility,
  isObj,
  type Ability,
  type Choice,
  type Extraction,
  type Grant,
  type Issues,
} from './model';

/**
 * The builder: a character's decisions + 5etools data → everything the character has, the
 * choices still open, and warnings. Pure and synchronous; it runs in the data worker.
 *
 * Decisions are the only thing stored for a character. Each answers a choice by its stable id;
 * a decision whose choice no longer exists (the class level was removed, the data changed) is
 * kept and reported as orphaned, so nothing the player picked is silently lost.
 */

export interface ClassLevels {
  /** Class entity key, `class:bard@xphb`. The first class is the starting class. */
  class: string;
  levels: number;
}

export interface CharacterDecisions {
  schema: 1;
  /** The rules the character is built with. Options from the other edition raise a warning. */
  edition: Edition;
  /** Scores before any increase (point buy, standard array, rolled or typed in). */
  baseScores: Record<Ability, number>;
  species?: string;
  background?: string;
  classes: ClassLevels[];
  /** Picks by choice id. */
  choices: Record<string, string[]>;
  /** What the character carries. Starting equipment is copied here when the character is made. */
  inventory?: InventoryItem[];
  /** Hit point rolls for levels after the first, in order; average is used where missing. */
  hitPointRolls?: number[];
  /**
   * Sheet values set by hand, by sheet path (`ac`, `hp`, `skill.stealth`…). They win over the
   * computed value, which the sheet still shows next to them.
   */
  overrides?: Record<string, number>;
}

export interface InventoryItem {
  /**
   * Item key (`item:dagger@xphb`; mundane items resolve to `baseitem`). Empty for things that are
   * not in the data ("a set of weighted dice"), which carry a `name` instead.
   */
  key: string;
  name?: string;
  quantity: number;
  equipped?: boolean;
  attuned?: boolean;
  /**
   * Bound to the character as a pact weapon (Pact of the Blade) or by Hex Warrior: it attacks
   * with Charisma when that is better, and the character is proficient with it.
   */
  pact?: boolean;
}

export interface CampaignRules {
  /**
   * Whether species ability score increases apply. `auto` (default) follows 2024 rules: they are
   * ignored when the background gives ability scores.
   */
  speciesAbilities?: 'auto' | 'always' | 'never';
  /** 2014 optional rule: feats instead of Ability Score Improvements. Default: allowed. */
  feats?: boolean;
}

/** What the builder needs from the data: entity lookups plus Foundry feature choices. */
export interface RulesData extends PageLookup {
  featureData(key: string): RawEntity | undefined;
}

/** The FOUNDRY_CLASS_FILE aux records, by name. */
export const FOUNDRY_FILE = 'data/class/foundry.json';

/** Rules data from page lookups and the Foundry class-feature records (aux data). */
export function makeRulesData(
  lookup: PageLookup,
  foundry: { classFeature: unknown; subclassFeature: unknown },
): RulesData {
  const features = foundryEntryData(foundry.classFeature, foundry.subclassFeature);
  return { ...lookup, featureData: (key) => features.get(key) };
}

/** A grant the character has, with where it comes from. */
export type HeldGrant = Grant & {
  /** Entity key that gives it. */
  from: string;
  /** The choice it was picked in, when it was picked. */
  choice?: string;
};

/** A choice with what the player picked so far. */
export interface AnsweredChoice extends Choice {
  /** Entity key that asks. */
  from: string;
  picks: string[];
}

export interface Warning {
  kind: 'edition' | 'orphan' | 'missing' | 'invalid' | 'too-many' | 'rule';
  message: string;
  /** The entity key or choice id concerned. */
  ref: string;
}

/** A feature or trait the character has, for the sheet's features list. */
export interface HeldFeature {
  key: string;
  name: string;
  /** Class (or subclass) level it is gained at; absent for species, background and feats. */
  level?: number;
  /** Entity key it belongs to: the class, subclass, species, background or feat. */
  from: string;
}

export interface BuiltCharacter {
  level: number;
  classes: { key: string; name: string; levels: number; subclass?: string }[];
  /** Every entity the character is built from, with its data. */
  entities: Map<string, EntityDetail>;
  grants: HeldGrant[];
  choices: AnsweredChoice[];
  /** Choices still missing picks. */
  pending: AnsweredChoice[];
  features: HeldFeature[];
  warnings: Warning[];
}

/** Class features that only mark where a subclass feature comes (no content of their own). */
const isPlaceholder = (gainSubclass: boolean) => gainSubclass;

/** Mundane items are `baseitem`s and "any holy symbol" an `itemgroup`; references say `item`. */
function itemKey(data: RulesData, key: string): string {
  if (data.get(key)) return key;
  for (const type of ['baseitem', 'itemgroup']) {
    const alt = key.replace(/^item:/, `${type}:`);
    if (data.get(alt)) return alt;
  }
  return key;
}

/** A feat's named version (`Magic Initiate; Cleric`): its fields replace the base feat's. */
function withVersion(entity: RawEntity, version: string | undefined): RawEntity {
  if (!version || !Array.isArray(entity._versions)) return entity;
  const versions: unknown[] = entity._versions;
  const v = versions.find(
    (x) => isObj(x) && typeof x.name === 'string' && x.name.toLowerCase() === version.toLowerCase(),
  );
  if (!isObj(v)) return entity;
  const fields: RawEntity = {};
  for (const [k, value] of Object.entries(v))
    if (k !== '_mod' && k !== 'name' && k !== 'source') fields[k] = value;
  return { ...entity, ...fields };
}

const NO_ISSUES: Issues = { add: () => undefined };

/** Ability keys of a choice pick for spellcasting ability (`int`), as stored. */
const PICK_GRANT: Partial<Record<Choice['kind'], Grant['kind']>> = {
  skill: 'skill',
  tool: 'tool',
  language: 'language',
  weapon: 'weapon',
  armor: 'armor',
  save: 'save',
  expertise: 'expertise',
  resist: 'resist',
  immune: 'immune',
  conditionImmune: 'conditionImmune',
  vulnerable: 'vulnerable',
  size: 'size',
};

const SKILL_TOOL_LANGUAGE = (pick: string): Grant['kind'] =>
  pick in SKILL_KINDS ? 'skill' : 'tool';
const SKILL_KINDS: Record<string, true> = Object.fromEntries(
  [
    'acrobatics', 'animal handling', 'arcana', 'athletics', 'deception', 'history', 'insight',
    'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance',
    'persuasion', 'religion', 'sleight of hand', 'stealth', 'survival',
  ].map((s) => [s, true]),
); // prettier-ignore

class Builder {
  readonly grants: HeldGrant[] = [];
  readonly choices: AnsweredChoice[] = [];
  readonly features: HeldFeature[] = [];
  readonly warnings: Warning[] = [];
  readonly entities = new Map<string, EntityDetail>();
  private readonly seenChoices = new Set<string>();
  private readonly visited = new Set<string>();

  constructor(
    private readonly data: RulesData,
    private readonly decisions: CharacterDecisions,
    /** Total character level: gates species, background and feat spells and choices. */
    private readonly characterLevel: number,
    private readonly rules: CampaignRules,
  ) {}

  /** Records an entity and warns when it is from the other edition. */
  entity(key: string): EntityDetail | undefined {
    const e = this.data.get(key);
    if (!e) {
      this.warn('missing', `Not in the data: ${key}`, key);
      return undefined;
    }
    if (!this.entities.has(key)) {
      this.entities.set(key, e);
      if (e.edition !== this.decisions.edition)
        this.warn(
          'edition',
          `${e.name} is ${e.edition === '2024' ? '2024' : '2014'} rules; this character uses ${this.decisions.edition} rules.`,
          key,
        );
    }
    return e;
  }

  warn(kind: Warning['kind'], message: string, ref: string) {
    if (!this.warnings.some((w) => w.kind === kind && w.ref === ref))
      this.warnings.push({ kind, message, ref });
  }

  /** Applies an extraction: its grants, and its choices answered by the decisions. */
  apply(ex: Extraction, from: string, gate?: number, via?: string) {
    for (const g of ex.grants) this.grant(g, from, gate);
    for (const c of ex.choices) this.choice(via && !c.via ? { ...c, via } : c, from, gate);
  }

  grant(g: Grant, from: string, gate?: number, choice?: string) {
    const limit = gate ?? this.characterLevel;
    if (g.kind === 'spell' && g.level > limit) return;
    if (g.kind === 'spellList' && g.level > limit) return;
    const held: HeldGrant = choice ? { ...g, from, choice } : { ...g, from };
    if (g.kind === 'item')
      (held as Extract<HeldGrant, { kind: 'item' }>).key = itemKey(this.data, g.key);
    this.grants.push(held);
    if (g.kind === 'feat') this.feat(g.key, g.version);
    if (g.kind === 'optionalfeature') this.optionalFeature(g.key);
  }

  choice(c: Choice, from: string, gate?: number) {
    if (c.level !== undefined && c.level > (gate ?? this.characterLevel)) return;
    if (this.seenChoices.has(c.id)) return;
    this.seenChoices.add(c.id);
    const stored = this.decisions.choices[c.id] ?? [];
    const valid = stored.filter((p) => !c.options || c.options.includes(p));
    if (valid.length !== stored.length)
      this.warn('invalid', `Some picks are no longer offered: ${c.label}`, c.id);
    const picks = valid.slice(0, c.count);
    if (valid.length > c.count) this.warn('too-many', `Too many picks: ${c.label}`, c.id);
    this.choices.push({ ...c, from, picks });

    if (c.kind === 'alternative') {
      // 2014 Ability Score Improvements offer a feat only where the campaign allows feats.
      const branch = c.branches?.find(
        (b) => b.id === picks[0] && !(b.id === 'feat' && this.rules.feats === false),
      );
      if (branch) this.apply(branch, from, gate, c.via);
      return;
    }
    picks.forEach((pick, i) => {
      this.pick(c, pick, i, from, gate);
    });
  }

  /** Turns one pick into what it gives. */
  private pick(c: Choice, pick: string, index: number, from: string, gate?: number) {
    // `pool:artisanTool`: the player still has to say which one.
    if (pick.startsWith('pool:')) {
      const pool = pick.slice(5);
      this.choice(
        {
          id: `${c.id}/${String(index)}`,
          kind:
            c.kind === 'skillToolLanguage'
              ? pool === 'skill'
                ? 'skill'
                : pool.endsWith('anguage')
                  ? 'language'
                  : 'tool'
              : c.kind,
          count: 1,
          label: `Choose the ${pool.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
          filter: {
            type: 'pool',
            pool: pool as Extract<Choice['filter'], { type: 'pool' }>['pool'],
          },
        },
        from,
        gate,
      );
      return;
    }
    const grantKind = PICK_GRANT[c.kind];
    if (grantKind) {
      this.grant({ kind: grantKind, value: pick } as Grant, from, gate, c.id);
      return;
    }
    switch (c.kind) {
      case 'skillToolLanguage':
        this.grant({ kind: SKILL_TOOL_LANGUAGE(pick), value: pick } as Grant, from, gate, c.id);
        return;
      case 'ability': {
        const amount = c.amounts?.[index] ?? 1;
        if (isAbility(pick))
          this.grant(
            { kind: 'ability', ability: pick, amount, ...(c.max ? { max: c.max } : {}) },
            from,
            gate,
            c.id,
          );
        return;
      }
      case 'spellAbility':
        if (isAbility(pick)) this.grant({ kind: 'spellAbility', ability: pick }, from, gate, c.id);
        return;
      case 'spell':
        this.grant(
          { kind: 'spell', key: pick, mode: 'known', level: c.level ?? 1 },
          from,
          gate,
          c.id,
        );
        return;
      case 'feat':
        this.grant({ kind: 'feat', key: pick }, from, gate, c.id);
        return;
      case 'optionalfeature':
        this.grant({ kind: 'optionalfeature', key: pick }, from, gate, c.id);
        return;
      case 'feature':
        // Options written inline in the text are only names; there is nothing more to follow.
        if (/^[a-z]+:.+@/.test(pick)) this.feature(pick, from, c.level);
        return;
      case 'item':
        this.grant({ kind: 'item', key: pick, quantity: 1 }, from, gate, c.id);
        return;
      case 'weaponMastery':
        this.grant({ kind: 'mastery', key: itemKey(this.data, pick) }, from, gate, c.id);
        return;
      case 'subclass':
        return; // Handled by the class walk.
    }
  }

  feat(key: string, version?: string) {
    const id = version ? `${key}#${version}` : key;
    if (this.visited.has(id)) return;
    this.visited.add(id);
    const e = this.entity(key);
    if (!e) return;
    this.features.push({ key, name: version ?? e.name, from: key });
    // Repeatable feats taken twice would share choice ids; the version keeps versions apart.
    this.apply(
      readEntity(
        withVersion(e.data, version),
        version ? `${key}#${version.toLowerCase()}` : key,
        NO_ISSUES,
      ),
      key,
    );
  }

  optionalFeature(key: string) {
    if (this.visited.has(key)) return;
    this.visited.add(key);
    const e = this.entity(key);
    if (!e) return;
    this.features.push({ key, name: e.name, from: key });
    this.apply(readEntity(e.data, key, NO_ISSUES), key);
  }

  /** A class or subclass feature: listed, plus whatever it grants and asks. */
  feature(key: string, from: string, level?: number, progressions?: ReadonlySet<string>) {
    if (this.visited.has(key)) return;
    this.visited.add(key);
    const e = this.data.get(key);
    if (!e) {
      this.warn('missing', `Not in the data: ${key}`, key);
      return;
    }
    this.features.push({ key, name: e.name, ...(level !== undefined ? { level } : {}), from });
    const ex = readFeature(
      e.data,
      key,
      {
        edition: e.edition,
        ...entryData(this.data, key),
        ...(progressions ? { progressions } : {}),
      },
      NO_ISSUES,
    );
    this.apply(ex, from, level === undefined ? undefined : Infinity, key);
    // Features shown inside this one ("College of Whispers" → Psychic Blades, Words of Terror).
    for (const ref of nestedFeatures(e.data.entries)) this.feature(ref, from, level, progressions);
  }
}

/**
 * Ties class-level choices to the feature that describes them: the subclass pick to "Bard
 * Subclass", a feat progression to the feature of the same name ("Fighting Style", "Epic Boon"),
 * optional features to theirs ("Eldritch Invocations"), Weapon Mastery to "Weapon Mastery".
 */
function withVia(ex: Extraction, features: readonly FeatureEntry[], level: number): Extraction {
  const reached = features.filter((f) => f.level <= level);
  // Same name ("Fighting Style"); else the first feature that talks about it ("Combat
  // Superiority" introduces Maneuvers, "Rune Carver" Runes).
  const byName = (name: string) => {
    const lower = name.toLowerCase();
    const named = [...reached]
      .filter((f) => f.name.toLowerCase() === lower)
      .sort((a, b) => b.level - a.level)[0];
    if (named) return named.key;
    const stem = lower.replace(/s$/, '');
    return [...reached]
      .filter((f) =>
        JSON.stringify(f.entity?.data.entries ?? '')
          .toLowerCase()
          .includes(stem),
      )
      .sort((a, b) => a.level - b.level)[0]?.key;
  };
  const choices = ex.choices.map((c) => {
    const what = c.id.slice(c.id.lastIndexOf('/') + 1);
    const via =
      what === 'subclass'
        ? features.find((f) => f.gainSubclass && f.level === level)?.key
        : what.startsWith('feat:') || what.startsWith('optionalfeature:')
          ? byName(what.slice(what.indexOf(':') + 1))
          : what === 'weaponMastery'
            ? byName('weapon mastery')
            : undefined;
    return via ? { ...c, via } : c;
  });
  return { ...ex, choices };
}

/** Features referenced inside a feature's text, outside "choose one" option blocks. */
function nestedFeatures(entries: unknown): string[] {
  const found: string[] = [];
  const walk = (e: unknown) => {
    if (Array.isArray(e)) {
      e.forEach(walk);
      return;
    }
    if (!isObj(e) || e.type === 'options') return;
    const ref =
      e.type === 'refClassFeature'
        ? classFeatureRef(e.classFeature)
        : e.type === 'refSubclassFeature'
          ? subclassFeatureRef(e.subclassFeature)
          : null;
    if (ref) found.push(ref.key);
    for (const v of Object.values(e)) walk(v);
  };
  walk(entries);
  return found;
}

const entryData = (data: RulesData, key: string) => {
  const d = data.featureData(key);
  return d ? { entryData: d } : {};
};

/** Lowercase names of an entity's optional-feature and feat progressions. */
function progressionNames(...entities: (EntityDetail | undefined)[]): Set<string> {
  const names = new Set<string>();
  for (const e of entities)
    for (const field of ['optionalfeatureProgression', 'featProgression'])
      for (const p of Array.isArray(e?.data[field]) ? (e.data[field] as unknown[]) : [])
        if (isObj(p) && typeof p.name === 'string') names.add(p.name.toLowerCase());
  return names;
}

export function buildCharacter(
  data: RulesData,
  decisions: CharacterDecisions,
  rules: CampaignRules = {},
): BuiltCharacter {
  const level = decisions.classes.reduce((n, c) => n + c.levels, 0);
  const b = new Builder(data, decisions, Math.max(1, level), rules);
  const classes: BuiltCharacter['classes'] = [];

  // Background first: whether it gives ability scores decides the species' (2024 rules).
  const background = decisions.background ? b.entity(decisions.background) : undefined;
  const backgroundAbilities = background?.data.ability !== undefined;
  // 2024 character origins: Common plus two standard languages, whatever the species says.
  const origins2024 = decisions.edition === '2024';
  if (origins2024) {
    b.grant({ kind: 'language', value: 'common' }, 'character');
    b.choice(
      {
        id: 'character/languages',
        kind: 'language',
        count: 2,
        label: 'Choose 2 standard languages',
        filter: { type: 'pool', pool: 'standardLanguage' },
      },
      'character',
    );
  }
  if (background) {
    b.apply(readEntity(background.data, background.key, NO_ISSUES), background.key);
    b.features.push({ key: background.key, name: background.name, from: background.key });
  }

  if (decisions.species) {
    const race = b.entity(decisions.species);
    if (race) {
      const mode = rules.speciesAbilities ?? 'auto';
      const dropAbilities = mode === 'never' || (mode === 'auto' && backgroundAbilities);
      // Older species under 2024 rules: ignore their ability increases and languages.
      const strip = (d: RawEntity): RawEntity => {
        const out = { ...d };
        if (dropAbilities) {
          delete out.ability;
          delete out.lineage;
        }
        if (origins2024 && race.edition === '2014') out.languageProficiencies = [];
        return out;
      };
      const page = buildSpeciesPage(data, race.key);
      const subraces = page?.subraces ?? [];
      const subraceId = `${race.key}/subspecies`;
      let subrace: EntityDetail | undefined;
      if (subraces.length) {
        b.choice(
          {
            id: subraceId,
            kind: 'feature',
            count: 1,
            label: 'Choose a subspecies',
            options: subraces.map((s) => s.key),
          },
          race.key,
        );
        const picked = decisions.choices[subraceId]?.[0];
        subrace = picked ? b.entity(picked) : undefined;
      }
      // A subrace that overwrites the race's ability scores replaces them.
      const overwrite = isObj(subrace?.data.overwrite) ? subrace.data.overwrite : {};
      const raceData =
        overwrite.ability === true ? { ...race.data, ability: undefined } : race.data;
      b.apply(readEntity(strip(raceData), race.key, NO_ISSUES), race.key);
      if (subrace) b.apply(readEntity(strip(subrace.data), subrace.key, NO_ISSUES), subrace.key);
      for (const e of [race, subrace])
        if (e)
          for (const trait of namedEntries(e.data))
            b.features.push({ key: `${e.key}#${trait}`, name: trait, from: e.key });
    }
  }

  decisions.classes.forEach((cl, i) => {
    const cls = b.entity(cl.class);
    if (!cls) return;
    const page = buildClassPage(data, cls.key);
    const subclassId = page?.features.find((f) => f.gainSubclass)
      ? `${cls.key}/level:${String(page.features.find((f) => f.gainSubclass)?.level ?? 0)}/subclass`
      : undefined;
    const subclassKey = subclassId ? decisions.choices[subclassId]?.[0] : undefined;
    const subclass = subclassKey ? b.entity(subclassKey) : undefined;
    if (subclassId && subclass && !page?.subclasses.some((s) => s.key === subclass.key))
      b.warn('invalid', `${subclass.name} is not a ${cls.name} subclass`, subclassId);
    const subPage = subclass ? buildSubclassPage(data, subclass.key) : undefined;
    const progressions = progressionNames(cls, subclass);
    classes.push({
      key: cls.key,
      name: cls.name,
      levels: cl.levels,
      ...(subclass ? { subclass: subclass.key } : {}),
    });

    for (let lvl = 1; lvl <= cl.levels; lvl++) {
      const options = { first: i === 0, edition: cls.edition, current: lvl === cl.levels };
      const ex = readClassLevel(cls.data, cls.key, lvl, options, NO_ISSUES);
      // Subclass options are known here; the choice itself comes from the extractor.
      for (const c of ex.choices)
        if (c.kind === 'subclass')
          (c as { options?: readonly string[] }).options = page?.subclasses.map((s) => s.key) ?? [];
      b.apply(withVia(ex, page?.features ?? [], lvl), cls.key, lvl);
      for (const f of page?.features ?? []) {
        if (f.level !== lvl) continue;
        if (!isPlaceholder(f.gainSubclass)) b.feature(f.key, cls.key, lvl, progressions);
        // Where the subclass is picked: listed, so the pick can be shown inside it.
        else if (`${cls.key}/level:${String(lvl)}/subclass` === subclassId)
          b.features.push({ key: f.key, name: f.name, level: lvl, from: cls.key });
      }
      if (subclass) {
        b.apply(
          withVia(
            readClassLevel(subclass.data, subclass.key, lvl, options, NO_ISSUES),
            subPage?.features ?? [],
            lvl,
          ),
          subclass.key,
          lvl,
        );
        for (const f of subPage?.features ?? [])
          if (f.level === lvl) b.feature(f.key, subclass.key, lvl, progressions);
      }
    }
  });

  // Multiclassing: each class's ability requirements (the first class's too). Warn, never block.
  if (decisions.classes.length > 1) {
    const scores = scoreTotals(decisions, b.grants);
    for (const c of classes) {
      const req = b.entities.get(c.key)?.data.multiclassing;
      const requirements = isObj(req) ? req.requirements : undefined;
      if (isObj(requirements) && !meetsRequirements(requirements, scores))
        b.warn(
          'rule',
          `Multiclassing with ${c.name} needs ${requirementText(requirements)}.`,
          c.key,
        );
    }
  }

  // Decisions nobody asked for: kept, and reported. Choices made inside a feat or option the
  // character no longer has (another feat was picked instead) are kept silently: picking that
  // feat again brings them back.
  const asked = new Set(b.choices.map((c) => c.id));
  for (const id of Object.keys(decisions.choices))
    if (
      !asked.has(id) &&
      (decisions.choices[id]?.length ?? 0) > 0 &&
      !rememberedFor(id, b.entities)
    )
      b.warn('orphan', `A decision no longer matches anything in the character: ${id}`, id);

  return {
    level,
    classes,
    entities: b.entities,
    grants: b.grants,
    choices: b.choices,
    pending: b.choices.filter((c) => c.picks.length < c.count),
    features: b.features,
    warnings: b.warnings,
  };
}

/** Ability scores after increases (capped at 20, or a higher cap an increase allows). */
export function scoreTotals(
  decisions: CharacterDecisions,
  grants: readonly Grant[],
): Record<Ability, number> {
  const out = { ...decisions.baseScores };
  for (const a of ABILITIES) {
    let total = decisions.baseScores[a];
    let cap = 20;
    for (const g of grants)
      if (g.kind === 'ability' && g.ability === a) {
        total += g.amount;
        if (g.max) cap = Math.max(cap, g.max);
      }
    out[a] = Math.min(total, Math.max(cap, decisions.baseScores[a]));
  }
  return out;
}

/** `{ int: 13 }`, `{ str: 13, cha: 13 }` (both) or `{ or: [{ str: 13, dex: 13 }] }` (either). */
export function meetsRequirements(
  req: Record<string, unknown>,
  scores: Record<Ability, number>,
): boolean {
  const all = (r: Record<string, unknown>) =>
    Object.entries(r).every(([k, v]) => !isAbility(k) || typeof v !== 'number' || scores[k] >= v);
  if (Array.isArray(req.or))
    return req.or.some(
      (alt) =>
        isObj(alt) &&
        Object.entries(alt).some(
          ([k, v]) => isAbility(k) && typeof v === 'number' && scores[k] >= v,
        ),
    );
  return all(req);
}

const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}; // prettier-ignore

export function requirementText(req: Record<string, unknown>): string {
  const parts = (r: Record<string, unknown>) =>
    Object.entries(r).flatMap(([k, v]) =>
      isAbility(k) && typeof v === 'number' ? [`${ABILITY_NAMES[k]} ${String(v)}`] : [],
    );
  if (Array.isArray(req.or)) return req.or.filter(isObj).flatMap(parts).join(' or ');
  return parts(req).join(' and ');
}

/** Species traits shown as entries ("Darkvision", "Fury of the Small"), minus the structural ones. */
const STRUCTURAL_TRAITS = new Set([
  'creature type',
  'size',
  'speed',
  'age',
  'alignment',
  'languages',
  'language',
]);

function namedEntries(data: RawEntity): string[] {
  if (!Array.isArray(data.entries)) return [];
  return data.entries
    .filter(isObj)
    .map((e) => (typeof e.name === 'string' ? e.name : ''))
    .filter((n) => n !== '' && !STRUCTURAL_TRAITS.has(n.toLowerCase()));
}

/** A blank character: scores of 10, nothing chosen. */
export function newCharacter(edition: Edition = '2024'): CharacterDecisions {
  return {
    schema: 1,
    edition,
    baseScores: Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Record<Ability, number>,
    classes: [],
    choices: {},
  };
}

/** The key of a choice made at a class level: `class:bard@xphb/level:3/subclass`. */
export const classChoiceId = (classKey: string, level: number, what: string) =>
  `${classKey}/level:${String(level)}/${what}`;

/** Kinds of entries whose own choices are kept, unreported, while another one is picked. */
const SWAPPABLE = new Set(['feat', 'optionalfeature']);

/** A decision inside a feat or option the character does not have now (see the orphans above). */
function rememberedFor(id: string, entities: ReadonlyMap<string, unknown>): boolean {
  const owner = id.split('/')[0] ?? '';
  const type = owner.slice(0, owner.indexOf(':'));
  return SWAPPABLE.has(type) && owner.includes('@') && !entities.has(owner);
}
