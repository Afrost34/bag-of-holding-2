/**
 * The choice extractor over the whole pinned 5etools release. Skipped when the data has not been
 * downloaded (`pnpm data:fetch`). When a 5etools bump makes this fail, teach the extractor the
 * new shape; never loosen the checks.
 */
import { stripTagsPlain, type EntityDetail, type EntityIndex } from '@boh/data5e';
import { hasLocalData } from '@boh/data5e/testing/local';
import { openLocalIndex } from '@boh/data5e/testing/index';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readClassLevel, subclassLevel } from './extract/classes';
import { readEntity } from './extract/entity';
import { foundryEntryData, readFeature } from './extract/features';
import { isObj, type Choice, type Extraction, type Grant, type Issues } from './model';

vi.setConfig({ testTimeout: 120_000 });

/**
 * Every top-level field of the entity types the engine reads, sorted into the ones it uses and
 * the ones that do not matter to a character (display, fluff, bookkeeping). A field missing from
 * both fails the guard: decide what it means before shipping a new 5etools version.
 */
const DISPLAY = [
  'name', 'source', 'page', 'srd', 'srd52', 'basicRules', 'basicRules2024', 'otherSources',
  'additionalSources', 'reprintedAs', 'isReprinted', 'hasFluff', 'hasFluffImages', 'fluff',
  'entries', 'edition', 'soundClip', 'alias', '_versions', '_copy', 'heightAndWeight', 'age',
  'traitTags', 'sizeEntry', '_isCopy', 'header', 'type', 'isClassFeatureVariant', 'creatureTypeTags',
]; // prettier-ignore
const PROFICIENCIES = [
  'skillProficiencies', 'toolProficiencies', 'languageProficiencies', 'weaponProficiencies',
  'armorProficiencies', 'savingThrowProficiencies', 'skillToolLanguageProficiencies', 'expertise',
  'resist', 'immune', 'conditionImmune', 'vulnerable',
]; // prettier-ignore
const KNOWN_FIELDS: Record<string, readonly string[]> = {
  class: [
    ...DISPLAY, 'classFeatures', 'hd', 'proficiency', 'startingProficiencies', 'startingEquipment',
    'classTableGroups', 'subclassTitle', 'multiclassing', 'casterProgression', 'spellcastingAbility',
    'cantripProgression', 'preparedSpellsChange', 'primaryAbility', 'featProgression',
    'preparedSpellsProgression', 'optionalfeatureProgression', 'additionalSpells', 'preparedSpells',
    'spellsKnownProgression', 'isSidekick', 'spellsKnownProgressionFixedByLevel',
    'spellsKnownProgressionFixed', 'spellsKnownProgressionFixedAllowLowerLevel',
  ],
  subclass: [
    ...DISPLAY, 'shortName', 'className', 'classSource', 'subclassFeatures', 'additionalSpells',
    'spellcastingAbility', 'optionalfeatureProgression', 'subclassTableGroups', 'casterProgression',
    'cantripProgression', 'preparedSpellsProgression', 'preparedSpellsChange',
    'spellsKnownProgression', 'featProgression',
  ],
  classFeature: [...DISPLAY, 'className', 'classSource', 'level', 'consumes'],
  subclassFeature: [
    ...DISPLAY, 'className', 'classSource', 'subclassShortName', 'subclassSource', 'level', 'consumes',
  ],
  race: [
    ...DISPLAY, ...PROFICIENCIES, 'size', 'speed', 'darkvision', 'ability', 'lineage',
    'creatureTypes', 'additionalSpells', 'feats', 'blindsight',
  ],
  subrace: [
    ...DISPLAY, ...PROFICIENCIES, 'raceName', 'raceSource', 'ability', 'additionalSpells', 'overwrite',
    'speed', 'darkvision', 'feats', 'size',
  ],
  background: [
    ...DISPLAY, ...PROFICIENCIES, 'startingEquipment', 'feats', 'ability', 'fromFeature',
    'additionalSpells', 'prerequisite',
  ],
  feat: [
    ...DISPLAY, ...PROFICIENCIES, 'prerequisite', 'category', 'ability', 'additionalSpells',
    'repeatable', 'repeatableHidden', 'senses', 'optionalfeatureProgression', 'bonusSenses',
  ],
  optionalfeature: [
    ...DISPLAY, ...PROFICIENCIES, 'featureType', 'prerequisite', 'consumes', 'additionalSpells',
    'senses', 'featProgression', 'optionalfeatureProgression',
  ],
}; // prettier-ignore

/** Text that reads like a character-building choice. */
const CHOICE_TEXT =
  /\b(proficiency|proficient|you learn|cantrips?|languages?|skills?|tools?|expertise|feat)\b[^.]{0,80}\b(of your choice|you choose|choose (one|two|three|four)|your choice)\b|\b(of your choice|choose (one|two|three|four)|you choose)\b[^.]{0,60}\b(proficiency|skills?|tools?|languages?|cantrips?|spells?|feat|expertise|damage type|options)\b/i;

const entryDataOf = (map: Map<string, Record<string, unknown>>, key: string) => {
  const entryData = map.get(key);
  return entryData ? { entryData } : {};
};

/**
 * Class features whose text reads like a choice, but that need no patch: the class already asks
 * for it (spell progressions, Magical Secrets lists, Mystic Arcanum…), it is made in play rather
 * than when building (Fiendish Resilience), or it is Unearthed Arcana not worth patching.
 */
const TEXT_ONLY: readonly string[] = [
  // Asked by the class itself: spell progressions, additionalSpells, optional-feature progressions.
  'classfeature:infusions known|artificer|tce|2@tce',
  'classfeature:replicate magic item|artificer|efa|2@efa',
  'classfeature:magical secrets|bard|phb|10@phb',
  'classfeature:magical secrets|bard|phb|14@phb',
  'classfeature:magical secrets|bard|phb|18@phb',
  'classfeature:mystic arcanum (6th level)|warlock|phb|11@phb',
  'classfeature:mystic arcanum|warlock|xphb|11@xphb',
  'classfeature:pact magic|warlock|phb|1@phb',
  'classfeature:pact magic|warlock|xphb|1@xphb',
  'classfeature:spellcasting|artificer|efa|1@efa',
  'classfeature:spellcasting|artificer|tce|1@tce',
  'classfeature:spellcasting|bard|phb|1@phb',
  'classfeature:spellcasting|bard|xphb|1@xphb',
  'classfeature:spellcasting|cleric|phb|1@phb',
  'classfeature:spellcasting|cleric|xphb|1@xphb',
  'classfeature:spellcasting|druid|phb|1@phb',
  'classfeature:spellcasting|druid|xphb|1@xphb',
  'classfeature:spellcasting|ranger|phb|2@phb',
  'classfeature:spellcasting|sorcerer|phb|1@phb',
  'classfeature:spellcasting|sorcerer|xphb|1@xphb',
  'classfeature:spellcasting|spellcaster sidekick|tce|1@tce',
  'classfeature:spellcasting|wizard|phb|1@phb',
  'classfeature:spellcasting|wizard|xphb|1@xphb',
  'subclassfeature:additional maneuvers|fighter|phb|battle master|phb|10@phb',
  'subclassfeature:additional maneuvers|fighter|phb|battle master|phb|15@phb',
  'subclassfeature:additional maneuvers|fighter|phb|battle master|phb|7@phb',
  'subclassfeature:arcane shot|fighter|phb|arcane archer|xge|3@xge',
  'subclassfeature:arcane shot|fighter|xphb|arcane archer|au|3@au',
  'subclassfeature:combat superiority|fighter|phb|battle master|phb|3@phb',
  'subclassfeature:combat superiority|fighter|xphb|battle master|xphb|3@xphb',
  'subclassfeature:disciple of the elements|monk|phb|four elements|phb|3@phb',
  'subclassfeature:extra elemental discipline|monk|phb|four elements|phb|11@phb',
  'subclassfeature:extra elemental discipline|monk|phb|four elements|phb|17@phb',
  'subclassfeature:extra elemental discipline|monk|phb|four elements|phb|6@phb',
  'subclassfeature:spellcasting|fighter|phb|eldritch knight|phb|3@phb',
  'subclassfeature:spellcasting|fighter|xphb|eldritch knight|xphb|3@xphb',
  'subclassfeature:spellcasting|monk|xphb|mystic arts|au|3@au',
  'subclassfeature:spellcasting|rogue|phb|arcane trickster|phb|3@phb',
  'subclassfeature:spellcasting|rogue|xphb|arcane trickster|xphb|3@xphb',
  'subclassfeature:the archfey|warlock|phb|archfey|phb|1@phb',
  'subclassfeature:the archfey|warlock|xphb|archfey|phb|3@phb',
  'subclassfeature:the celestial|warlock|phb|celestial|xge|1@xge',
  'subclassfeature:the celestial|warlock|xphb|celestial|xge|3@xge',
  'subclassfeature:the fathomless|warlock|phb|fathomless|tce|1@tce',
  'subclassfeature:the fathomless|warlock|xphb|fathomless|tce|3@tce',
  'subclassfeature:the fiend|warlock|phb|fiend|phb|1@phb',
  'subclassfeature:the fiend|warlock|xphb|fiend|phb|3@phb',
  'subclassfeature:the genie|warlock|phb|genie|tce|1@tce',
  'subclassfeature:the genie|warlock|xphb|genie|tce|3@tce',
  'subclassfeature:the great old one|warlock|phb|great old one|phb|1@phb',
  'subclassfeature:the great old one|warlock|xphb|great old one|phb|3@phb',
  'subclassfeature:the hexblade|warlock|phb|hexblade|xge|1@xge',
  'subclassfeature:the hexblade|warlock|xphb|hexblade|xge|3@xge',
  'subclassfeature:the undead|warlock|phb|undead|vrgr|1@vrgr',
  'subclassfeature:the undead|warlock|xphb|undead|vrgr|3@vrgr',
  'subclassfeature:the undying|warlock|phb|undying|scag|1@scag',
  'subclassfeature:the undying|warlock|xphb|undying|scag|3@scag',
  // Chosen in play, not when building the character.
  'subclassfeature:alter memories|wizard|xphb|enchanter|au|14@au',
  'subclassfeature:channel divinity: knowledge of the ages|cleric|phb|knowledge|phb|2@phb',
  'subclassfeature:channel divinity: knowledge of the ages|cleric|xphb|knowledge|phb|3@phb',
  'subclassfeature:fiendish resilience|warlock|phb|fiend|phb|10@phb',
  'subclassfeature:fiendish resilience|warlock|xphb|fiend|xphb|10@xphb',
  'subclassfeature:gravity well|wizard|phb|graviturgy|egw|6@egw',
  'subclassfeature:infectious fury|barbarian|phb|beast|tce|10@tce',
  'subclassfeature:mind magic|cleric|xphb|knowledge|frhof|3@frhof',
  'subclassfeature:natural recovery|druid|phb|land|phb|2@phb',
  'subclassfeature:one with the word|wizard|phb|scribes|tce|14@tce',
  "subclassfeature:reanimator's skill set|artificer|efa|reanimator|rhw|3@rhw",
  'subclassfeature:splintered summons|wizard|xphb|conjurer|au|14@au',
  "subclassfeature:transmuter's stone|wizard|xphb|transmuter|au|3@au",
  'subclassfeature:whispers of the dead|rogue|phb|phantom|tce|3@tce',
  'subclassfeature:whispers of the dead|rogue|xphb|phantom|rhw|3@rhw',
  'subclassfeature:wild magic surge|sorcerer|xphb|wild magic|xphb|3@xphb',
  // Sidekicks and Unearthed Arcana: not patched.
  'classfeature:martial role|warrior sidekick|tce|1@tce',
  'classfeature:psionics|mystic|uathemysticclass|1@uathemysticclass',
  'subclassfeature:arcane dabbler|mystic|uathemysticclass|wu jen|uathemysticclass|6@uathemysticclass',
  'subclassfeature:awakened talent|mystic|uathemysticclass|awakened|uathemysticclass|1@uathemysticclass',
  'subclassfeature:bonus disciplines|mystic|uathemysticclass|avatar|uathemysticclass|1@uathemysticclass',
  'subclassfeature:bonus disciplines|mystic|uathemysticclass|awakened|uathemysticclass|1@uathemysticclass',
  'subclassfeature:bonus disciplines|mystic|uathemysticclass|immortal|uathemysticclass|1@uathemysticclass',
  'subclassfeature:bonus disciplines|mystic|uathemysticclass|nomad|uathemysticclass|1@uathemysticclass',
  'subclassfeature:bonus disciplines|mystic|uathemysticclass|wu jen|uathemysticclass|1@uathemysticclass',
  'subclassfeature:breadth of knowledge|mystic|uathemysticclass|nomad|uathemysticclass|1@uathemysticclass',
  "subclassfeature:hermit's study|mystic|uathemysticclass|wu jen|uathemysticclass|1@uathemysticclass",
];

function collector() {
  const found: string[] = [];
  const issues: Issues = {
    add: (where, message) => {
      found.push(`${where}: ${message}`);
    },
  };
  return { found, issues };
}

/** Every choice, including those inside alternatives. */
function allChoices(ex: Extraction): Choice[] {
  return ex.choices.flatMap((c) => [c, ...(c.branches ?? []).flatMap((b) => allChoices(b))]);
}
function allGrants(ex: Extraction): Grant[] {
  return [
    ...ex.grants,
    ...ex.choices.flatMap((c) => (c.branches ?? []).flatMap((b) => allGrants(b))),
  ];
}

function problemsWith(c: Choice): string[] {
  const p: string[] = [];
  if (!(c.count > 0)) p.push('count');
  if (!c.options && !c.filter) p.push('no options');
  if (c.options?.length === 0) p.push('empty options');
  if (c.kind === 'alternative' && c.branches?.map((b) => b.id).join() !== c.options?.join())
    p.push('branches');
  if (c.kind === 'ability' && c.amounts?.length !== c.count) p.push('amounts');
  const pooled = c.options?.some((o) => o.startsWith('pool:'));
  if (c.options && !pooled && c.options.length < c.count && c.kind !== 'alternative')
    p.push('too few options');
  return p.map((x) => `${c.id}: ${x}`);
}

describe.runIf(hasLocalData())('choice extraction over the pinned 5etools release', () => {
  let index: EntityIndex;
  const extractions = new Map<string, Extraction>();
  const { found, issues } = collector();
  /** Class features that read like a build choice but have no structure and no patch. */
  const textOnly: string[] = [];

  beforeAll(async () => {
    index = await openLocalIndex();
    for (const type of ['race', 'subrace', 'background', 'feat', 'optionalfeature']) {
      for (const e of index.ofType(type)) extractions.set(e.key, readEntity(e.data, e.key, issues));
    }
    for (const type of ['class', 'subclass']) {
      for (const e of index.ofType(type)) {
        for (const first of [true, false]) {
          for (let level = 1; level <= 20; level++) {
            const ex = readClassLevel(
              e.data,
              e.key,
              level,
              { first, edition: e.edition, current: true },
              issues,
            );
            extractions.set(`${e.key} ${String(level)}${first ? '' : ' multiclass'}`, ex);
          }
        }
      }
    }
    const foundry = foundryEntryData(
      index.getAux('data/class/foundry.json', 'classFeature'),
      index.getAux('data/class/foundry.json', 'subclassFeature'),
    );
    expect(foundry.size).toBeGreaterThan(100);
    // Optional-feature and feat progressions of each class and its subclasses, by class name.
    const progressions = new Map<string, Set<string>>();
    for (const e of [...index.ofType('class'), ...index.ofType('subclass')]) {
      const cls = String(e.data.className ?? e.data.name).toLowerCase();
      const names = progressions.get(cls) ?? new Set<string>();
      for (const field of ['optionalfeatureProgression', 'featProgression'])
        for (const p of Array.isArray(e.data[field]) ? (e.data[field] as unknown[]) : [])
          if (isObj(p)) names.add(String(p.name).toLowerCase());
      progressions.set(cls, names);
    }
    for (const type of ['classFeature', 'subclassFeature']) {
      for (const e of index.ofType(type)) {
        const names = progressions.get(String(e.data.className).toLowerCase());
        const ex = readFeature(
          e.data,
          e.key,
          {
            edition: e.edition,
            ...entryDataOf(foundry, e.key),
            ...(names ? { progressions: names } : {}),
          },
          issues,
        );
        extractions.set(e.key, ex);
        const name = String(e.data.name).toLowerCase();
        if (ex.choices.length || ex.grants.length || names?.has(name)) continue;
        if (CHOICE_TEXT.test(stripTagsPlain(JSON.stringify(e.data.entries ?? []))))
          textOnly.push(e.key);
      }
    }
  }, 300_000);

  it('knows every field of the entities a character is built from', () => {
    const unknown = new Set<string>();
    for (const [type, known] of Object.entries(KNOWN_FIELDS)) {
      const entities: EntityDetail[] = index.ofType(type);
      expect(entities.length, type).toBeGreaterThan(0);
      for (const e of entities)
        for (const field of Object.keys(e.data))
          if (!known.includes(field)) unknown.add(`${type}.${field}`);
    }
    expect([...unknown].sort()).toEqual([]);
  });

  it('lists the class features whose choices exist only as text', () => {
    // Shrinks as patches are added; grows (and fails) when new 5etools content needs a look.
    expect(textOnly.sort()).toEqual([...TEXT_ONLY].sort());
  });

  it('understands every structured field', () => {
    expect(found).toEqual([]);
  });

  it('makes well-formed choices with unique ids', () => {
    const problems: string[] = [];
    for (const [where, ex] of extractions) {
      const choices = allChoices(ex);
      const ids = choices.map((c) => c.id);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (dupes.length) problems.push(`${where}: duplicate ids ${dupes.join(', ')}`);
      for (const c of choices) problems.push(...problemsWith(c));
    }
    expect(problems).toEqual([]);
  });

  it('points only at entities that exist', () => {
    const missing = new Set<string>();
    for (const ex of extractions.values())
      for (const g of allGrants(ex)) {
        const key =
          g.kind === 'feat' ||
          g.kind === 'optionalfeature' ||
          g.kind === 'spell' ||
          g.kind === 'item'
            ? g.key
            : g.kind === 'weapon' && g.value.startsWith('item:')
              ? g.value
              : undefined;
        // Mundane items are `baseitem`s and "a holy symbol" an `itemgroup`; links name them all
        // `item`.
        const found = [
          key,
          key?.replace(/^item:/, 'baseitem:'),
          key?.replace(/^item:/, 'itemgroup:'),
        ];
        if (key && !found.some((k) => k !== undefined && index.hasKey(k))) missing.add(key);
      }
    expect([...missing].sort()).toEqual([]);
  });

  it('finds the subclass level of every class with subclasses', () => {
    for (const cls of index.ofType('class')) {
      if (cls.data.isSidekick === true) continue;
      expect(subclassLevel(cls.data), cls.key).toBeGreaterThan(0);
    }
  });
});
