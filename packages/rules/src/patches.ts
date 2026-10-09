import type { Edition, RawEntity } from '@boh/data5e';
import { ABILITIES, type Extraction } from './model';
import { readAbilities } from './extract/abilities';
import { WEAPON_FILTER } from './extract/classes';
import { readEntity } from './extract/entity';

/**
 * Choices that 5etools (and its Foundry data) only describe in text, written down by hand.
 *
 * Patches are keyed by feature name (lowercase), optionally narrowed to a class. Each returns
 * grants and choices in the same shapes the extractor produces; most are written in 5etools'
 * own field vocabulary and run through `readEntity`, so they behave like real data.
 *
 * `patches.conformance.test.ts` lists class features whose text reads like a choice but that
 * have neither structured data nor a patch. When it grows after a 5etools bump, add patches here
 * (or, for features that really are not a character-building choice, to its NOT_A_CHOICE list).
 */

export type Patch = (key: string, edition: Edition) => Extraction;

/** Writes a patch in 5etools' field vocabulary (`skillProficiencies`, `expertise`…). */
const fields =
  (data: RawEntity): Patch =>
  (key) =>
    readEntity(data, key, { add: () => undefined });

/**
 * Ability Score Improvement. 2024: any feat (the book offers General feats; the owner opened it up
 * to every category, e.g. Dragonmark feats).
 * 2014: +2 to one score or +1 to two, or a feat where the campaign allows feats.
 */
const abilityScoreImprovement: Patch = (key, edition) => {
  if (edition === '2024') return fields({ feats: [{ any: 1 }] })(key, edition);
  const scores = readAbilities(
    [
      { choose: { from: [...ABILITIES], count: 1, amount: 2 } },
      { choose: { from: [...ABILITIES], count: 2, amount: 1 } },
    ],
    `${key}/ability`,
    { add: () => undefined },
  );
  const [two, ones] = scores.choices[0]?.branches ?? [];
  return {
    grants: [],
    choices: [
      {
        id: `${key}/asi`,
        kind: 'alternative',
        count: 1,
        label: 'Increase ability scores or take a feat',
        options: ['plus2', 'plus1', 'feat'],
        branches: [
          { ...(two ?? { grants: [], choices: [] }), id: 'plus2', label: '+2 to one ability' },
          { ...(ones ?? { grants: [], choices: [] }), id: 'plus1', label: '+1 to two abilities' },
          {
            id: 'feat',
            label: 'A feat',
            grants: [],
            choices: [
              {
                id: `${key}/feat`,
                kind: 'feat',
                count: 1,
                label: 'Choose a feat',
                filter: { type: 'feat' },
              },
            ],
          },
        ],
      },
    ],
  };
};

const pick = (from: string[], count = 1) => [{ choose: { from, count } }];
const known = (...items: unknown[]) => [{ known: { _: items } }];
const spellPick = (filter: string, count = 1) => ({ choose: filter, count });

/** 2024 Weapon Mastery where the class table has no column for it (always two weapons). */
const weaponMastery: Patch = (key) => ({
  grants: [],
  choices: [
    {
      id: `${key}/weaponMastery`,
      kind: 'weaponMastery',
      count: 2,
      label: 'Choose 2 weapons to master',
      filter: { type: 'items', filter: WEAPON_FILTER },
    },
  ],
});

interface Rule {
  /** Only for this class (lowercase); any class when absent. */
  className?: string;
  /** Only for this subclass short name (lowercase). */
  subclass?: string;
  /** Only for features from this source (lowercase). */
  source?: string;
  patch: Patch;
}

const BY_NAME: Record<string, Rule[]> = {
  'ability score improvement': [{ patch: abilityScoreImprovement }],
  'weapon mastery': ['paladin', 'ranger', 'rogue'].map((className) => ({
    className,
    patch: weaponMastery,
  })),
  'signature spells': [
    {
      className: 'wizard',
      patch: fields({ additionalSpells: known(spellPick('level=3|class=Wizard', 2)) }),
    },
  ],
  'bonus cantrip': [
    {
      className: 'druid',
      patch: fields({ additionalSpells: known(spellPick('level=0|class=Druid')) }),
    },
    { className: 'cleric', patch: fields({ additionalSpells: known('light|phb#c') }) },
  ],
  // "You learn Minor Illusion; if you already know it, another Wizard cantrip" — the builder
  // offers the alternative when the cantrip is already known.
  'improved minor illusion': [
    { patch: fields({ additionalSpells: known('minor illusion|phb#c') }) },
  ],
  'improved illusions': [{ patch: fields({ additionalSpells: known('minor illusion|xphb#c') }) }],
  'additional magical secrets': [
    {
      className: 'bard',
      patch: fields({ additionalSpells: known(spellPick('level=0;1;2;3', 2)) }),
    },
  ],
  'magical discoveries': [
    {
      className: 'bard',
      patch: fields({
        additionalSpells: [
          { prepared: { _: [spellPick('level=0;1;2;3|class=Cleric;Druid;Wizard', 2)] } },
        ],
      }),
    },
  ],
  'arcane mastery': [
    {
      className: 'cleric',
      patch: fields({
        additionalSpells: [
          {
            prepared: { _: [6, 7, 8, 9].map((l) => spellPick(`level=${String(l)}|class=Wizard`)) },
          },
        ],
      }),
    },
  ],
  'enchanting conversationalist': [
    { patch: fields({ skillProficiencies: pick(['deception', 'intimidation', 'persuasion']) }) },
  ],
  "genie's splendor": [
    {
      patch: fields({
        skillProficiencies: pick(['acrobatics', 'intimidation', 'performance', 'persuasion']),
      }),
    },
  ],
  'training in war and song': [
    {
      patch: fields({
        skillProficiencies: pick(['acrobatics', 'athletics', 'performance', 'persuasion']),
      }),
    },
  ],
  'knightly envoy': [
    {
      patch: fields({
        skillProficiencies: pick(['insight', 'intimidation', 'persuasion', 'performance']),
        languageProficiencies: [{ anyStandard: 1 }],
        additionalSpells: [
          { ability: 'cha', innate: { _: { ritual: ['comprehend languages|xphb'] } } },
        ],
      }),
    },
  ],
  'primal lore': [
    {
      subclass: 'moon',
      patch: fields({
        languageProficiencies: [{ druidic: true }],
        additionalSpells: known(spellPick('level=0|class=Druid')),
        skillProficiencies: pick([
          'animal handling', 'insight', 'medicine', 'nature', 'perception', 'survival',
        ]), // prettier-ignore
      }),
    },
  ],
  'blessings of knowledge': [
    {
      source: 'frhof',
      patch: fields({
        toolProficiencies: [{ anyArtisansTool: 1 }],
        skillProficiencies: pick(['arcana', 'history', 'nature', 'religion'], 2),
        expertise: [{ anyProficientSkill: 2 }],
      }),
    },
  ],
  'student of arcana': [
    {
      patch: fields({
        skillProficiencies: pick([
          'arcana',
          'history',
          'insight',
          'medicine',
          'persuasion',
          'religion',
        ]),
        additionalSpells: known(spellPick('level=0|class=Wizard', 2)),
      }),
    },
  ],
  'arcane archer lore': [
    {
      // The skill pick is in 5etools' Foundry data; the cantrip pick is not.
      source: 'xge',
      patch: fields({
        additionalSpells: [
          { known: { _: [{ choose: { from: ['prestidigitation', 'druidcraft'] } }] } },
        ],
      }),
    },
    {
      source: 'au',
      patch: fields({
        skillProficiencies: [{ arcana: true, nature: true }],
        additionalSpells: [
          {
            ability: 'int',
            known: { _: [{ choose: { from: ['prestidigitation|xphb', 'druidcraft|xphb'] } }] },
          },
        ],
      }),
    },
  ],
  'giant power': [
    {
      patch: fields({
        languageProficiencies: [{ giant: true }],
        additionalSpells: [
          { ability: 'wis', known: { _: [{ choose: { from: ['druidcraft', 'thaumaturgy'] } }] } },
        ],
      }),
    },
  ],
  'bonus proficiency': [
    { subclass: 'solidarity (psa)', patch: fields({ armorProficiencies: [{ heavy: true }] }) },
  ],
  'sharp mind': [{ patch: fields({ savingThrowProficiencies: pick(['int', 'wis', 'cha']) }) }],
};

export function patchFor(feature: RawEntity): Patch | undefined {
  const lower = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '');
  const name = lower(feature.name);
  return BY_NAME[name]?.find(
    (r) =>
      (r.className === undefined || r.className === lower(feature.className)) &&
      (r.subclass === undefined || r.subclass === lower(feature.subclassShortName)) &&
      (r.source === undefined || r.source === lower(feature.source)),
  )?.patch;
}

export const patchedNames = () => Object.keys(BY_NAME);
