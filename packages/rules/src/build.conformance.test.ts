/**
 * The builder over the pinned 5etools release: every class and subclass to level 20, every
 * species and background, and Glubs (a real level 3 character) rebuilt from decisions alone.
 */
import type { EntityDetail, EntityIndex } from '@boh/data5e';
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
import { optionsFor, type OptionCatalog } from './options';
import { computeSheet } from './sheet';

vi.setConfig({ testTimeout: 300_000 });

/** Answers every open choice that has fixed options with its first options, until none are left. */
function autoBuild(
  data: RulesData,
  start: CharacterDecisions,
  /** With a catalog, choices with filtered options are answered too (first options listed). */
  catalog?: OptionCatalog,
): BuiltCharacter {
  const decisions = structuredClone(start);
  let built = buildCharacter(data, decisions);
  for (let round = 0; round < 12; round++) {
    const open = built.pending.flatMap((c) => {
      const ids = c.options ?? (catalog ? optionsFor(c, built, catalog).map((o) => o.id) : []);
      return ids.length > 0 && !(ids.length === 1 && ids[0] === decisions.choices[c.id]?.[0])
        ? [{ c, ids }]
        : [];
    });
    if (open.length === 0) break;
    for (const { c, ids } of open) decisions.choices[c.id] = ids.slice(0, c.count);
    built = buildCharacter(data, decisions);
  }
  return built;
}

/** Entity lists for option filters, cached per type like the data worker does. */
function catalogOf(index: EntityIndex): OptionCatalog {
  const types = new Map<string, EntityDetail[]>();
  return {
    get: (key) => index.getEntity(key),
    ofType: (type) => {
      let list = types.get(type);
      if (!list) types.set(type, (list = index.ofType(type)));
      return list;
    },
    spellClasses: index.spellClasses(),
  };
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

  it('gives single-class casters the slots of their own class table', () => {
    const problems: string[] = [];
    for (const cls of index.ofType('class')) {
      const groups = Array.isArray(cls.data.classTableGroups)
        ? (cls.data.classTableGroups as unknown[])
        : [];
      const rows = groups.flatMap((g) =>
        typeof g === 'object' &&
        g !== null &&
        'rowsSpellProgression' in g &&
        Array.isArray(g.rowsSpellProgression)
          ? [g.rowsSpellProgression as number[][]]
          : [],
      )[0];
      if (!rows) continue;
      for (let level = 1; level <= 20; level++) {
        const decisions = {
          ...newCharacter(cls.edition),
          classes: [{ class: cls.key, levels: level }],
        };
        const sheet = computeSheet(data, decisions, buildCharacter(data, decisions));
        const want = (rows[level - 1] ?? []).filter(
          (n, i, all) => n > 0 || all.slice(i).some((x) => x > 0),
        );
        const got = sheet.slots.slice(1);
        if (JSON.stringify(got) !== JSON.stringify(want))
          problems.push(
            `${cls.key} ${String(level)}: ${JSON.stringify(got)} instead of ${JSON.stringify(want)}`,
          );
      }
    }
    expect(problems).toEqual([]);
  });

  it('offers options for every choice a level 5 character of each class makes', () => {
    const catalog = catalogOf(index);
    const empty: string[] = [];
    for (const cls of index.ofType('class')) {
      if (cls.data.isSidekick === true || cls.source.startsWith('UA')) continue;
      const decisions = { ...newCharacter(cls.edition), classes: [{ class: cls.key, levels: 5 }] };
      const built = autoBuild(data, decisions, catalog);
      for (const c of built.choices)
        if (optionsFor(c, built, catalog).length === 0 && c.kind !== 'subclass')
          empty.push(`${cls.key}: ${c.label} (${c.id})`);
    }
    expect(empty).toEqual([]);
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

  it('computes the sheet of Glubs as the rules give it', () => {
    const sheet = computeSheet(data, GLUBS, buildCharacter(data, GLUBS));
    const per = <T>(f: (a: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha') => T) =>
      (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(f);
    // These match the PDF from the old app.
    expect(per((a) => sheet.abilities[a].score.value)).toEqual([12, 16, 14, 14, 14, 18]);
    expect(per((a) => sheet.abilities[a].save.value)).toEqual([2, 6, 3, 3, 3, 7]);
    expect(sheet.proficiencyBonus).toBe(2);
    expect(sheet.spellcasting.map((s) => [s.ability, s.dc.value, s.attack.value])).toEqual([
      ['cha', 14, 6],
    ]);
    expect(sheet.slots).toEqual([0, 4, 2]);
    expect(sheet.hp.value).toBe(26);
    expect(sheet.hitDice).toEqual([{ faces: 8, count: 3 }]);
    expect(sheet.speed).toEqual({ walk: 30 });
    expect(sheet.senses).toEqual({ darkvision: 60 });
    expect(sheet.size).toBe('Small');
    expect(sheet.proficiencies.languages).toEqual(['common', 'dwarvish', 'goblin']);
    // The PDF's ability checks (2, 4, 3, 3, 3, 5) leave out Jack of All Trades (+1), which the
    // rules apply to every check without proficiency.
    expect(per((a) => sheet.abilities[a].check.value)).toEqual([3, 5, 4, 4, 4, 6]);
    // The old app added the Stone of Good Luck to armour class and attack rolls (AC 14, Club +4,
    // Dagger +6) and left it and Jack of All Trades out of initiative (+3) and passive Perception
    // (12). By the rules the stone only helps ability checks and saving throws.
    expect(sheet.ac.value).toBe(13);
    expect(sheet.initiative.value).toBe(5);
    expect(sheet.passive.perception.value).toBe(14);
    expect(
      sheet.attacks.map((a) => [a.name, a.toHit?.value ?? a.save?.dc.value, a.damage ?? '']),
    ).toEqual([
      ['Club', 3, '1d4+1 bludgeoning'],
      ['Dagger', 5, '1d4+3 piercing'],
      ['Mind Sliver', 14, ''],
      ['Vicious Mockery', 14, ''],
    ]);
    expect(sheet.skills.deception).toMatchObject({ value: 9, proficiency: 2 });
    expect(sheet.skills.stealth).toMatchObject({ value: 6, proficiency: 1 });
    expect(sheet.skills.history).toMatchObject({ value: 4, proficiency: 0.5 });
    expect(sheet.classTable).toContainEqual({
      from: 'class:bard@xphb',
      label: 'Bardic Die',
      value: 'd6',
    });
  });

  it('keeps hand-set values, with what the rules give', () => {
    const sheet = computeSheet(
      data,
      { ...GLUBS, overrides: { ac: 14 } },
      buildCharacter(data, GLUBS),
    );
    expect(sheet.ac).toMatchObject({ value: 14, computed: 13 });
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
