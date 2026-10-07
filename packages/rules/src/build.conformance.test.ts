/**
 * The builder over the pinned 5etools release: every class and subclass to level 20, every
 * species and background, and Glubs (a real level 3 character) rebuilt from decisions alone.
 */
import type { EntityIndex } from '@boh/data5e';
import { openLocalIndex } from '@boh/data5e/testing/index';
import { hasLocalData } from '@boh/data5e/testing/local';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  buildCharacter,
  FOUNDRY_FILE,
  makeRulesData,
  newCharacter,
  type BuiltCharacter,
  type CharacterDecisions,
  type RulesData,
} from './build';
import { GLUBS } from './glubs.fixture';

vi.setConfig({ testTimeout: 300_000 });

/** Answers every open choice that has fixed options with its first options, until none are left. */
function autoBuild(data: RulesData, start: CharacterDecisions): BuiltCharacter {
  const decisions = structuredClone(start);
  let built = buildCharacter(data, decisions);
  for (let round = 0; round < 12; round++) {
    const open = built.pending.filter((c) => c.options && c.options.length > 0);
    if (open.length === 0) break;
    for (const c of open) decisions.choices[c.id] = c.options?.slice(0, c.count) ?? [];
    built = buildCharacter(data, decisions);
  }
  return built;
}

describe.runIf(hasLocalData())('the builder over the pinned 5etools release', () => {
  let index: EntityIndex;
  let data: RulesData;

  beforeAll(async () => {
    index = await openLocalIndex();
    data = makeRulesData(index.lookup, {
      classFeature: index.getAux(FOUNDRY_FILE, 'classFeature'),
      subclassFeature: index.getAux(FOUNDRY_FILE, 'subclassFeature'),
    });
  }, 300_000);

  it('builds every class with every subclass to level 20', () => {
    const problems: string[] = [];
    let built = 0;
    for (const cls of index.ofType('class')) {
      if (cls.data.isSidekick === true) continue;
      const page = index.classPage(cls.key);
      for (const sub of page?.subclasses ?? [{ key: undefined }]) {
        const decisions = {
          ...newCharacter(cls.edition),
          classes: [{ class: cls.key, levels: 20 }],
        };
        const subclassChoice = buildCharacter(data, decisions).choices.find(
          (c) => c.kind === 'subclass',
        );
        if (subclassChoice && sub.key) decisions.choices[subclassChoice.id] = [sub.key];
        const result = autoBuild(data, decisions);
        built++;
        for (const w of result.warnings)
          if (w.kind !== 'edition') problems.push(`${sub.key ?? cls.key}: ${w.kind} ${w.message}`);
        if (sub.key && !result.classes[0]?.subclass)
          problems.push(`${sub.key}: subclass not applied`);
      }
    }
    expect(built).toBeGreaterThan(250);
    expect([...new Set(problems)].sort()).toEqual([]);
  });

  it('builds every species and background', () => {
    const problems: string[] = [];
    for (const type of ['race', 'background'] as const) {
      for (const e of index.ofType(type)) {
        const decisions: CharacterDecisions = {
          ...newCharacter(e.edition),
          classes: [{ class: 'class:fighter@xphb', levels: 1 }],
          ...(type === 'race' ? { species: e.key } : { background: e.key }),
        };
        for (const w of autoBuild(data, decisions).warnings)
          if (w.kind !== 'edition') problems.push(`${e.key}: ${w.kind} ${w.message}`);
      }
    }
    expect([...new Set(problems)].sort()).toEqual([]);
  });

  it('rebuilds Glubs from decisions alone', () => {
    const glubs = buildCharacter(data, GLUBS);
    expect(glubs.pending.map((c) => c.id)).toEqual([]);
    expect(glubs.warnings.filter((w) => w.kind !== 'edition')).toEqual([]);
    // 2014 options in a 2024 character are allowed but pointed out.
    expect(glubs.warnings.map((w) => w.ref).sort()).toEqual([
      'race:goblin@mpmm',
      'subclass:whispers|bard|xphb@xge',
    ]);
    const held = (kind: string) =>
      glubs.grants.flatMap((g) => (g.kind === kind && 'value' in g ? [g.value] : [])).sort();
    expect(held('language')).toEqual(['common', 'dwarvish', 'goblin']);
    expect(held('save')).toEqual(['cha', 'dex']);
    expect(held('armor')).toEqual(['light']);
    expect(held('weapon')).toEqual(['simple']);
    expect(held('tool')).toEqual(['bagpipes', 'drum', 'forgery kit', 'horn', "thieves' tools"]);
    expect(held('expertise')).toHaveLength(2);
    expect(glubs.features.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        'Bardic Inspiration', 'Spellcasting', 'Expertise', 'Jack of All Trades', 'Psychic Blades',
        'Words of Terror', 'Darkvision', 'Fey Ancestry', 'Fury of the Small', 'Nimble Escape',
        'Skilled',
      ]),
    ); // prettier-ignore
    const spells = glubs.grants.flatMap((g) => (g.kind === 'spell' ? [g.key] : [])).sort();
    expect(spells).toEqual([
      'spell:awaken rope@homebrew',
      'spell:bane@xphb',
      'spell:cause fear@xge',
      'spell:detect thoughts@xphb',
      'spell:enhance ability@xphb',
      'spell:mind sliver@xphb',
      'spell:suggestion@xphb',
      'spell:vicious mockery@xphb',
    ]);
  });
});
