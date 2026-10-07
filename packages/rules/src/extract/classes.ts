import { classFeatureRef, type RawEntity } from '@boh/data5e';
import {
  emptyExtraction,
  isAbility,
  isObj,
  merge,
  refKey,
  type Extraction,
  type Issues,
} from '../model';
import { readClassEquipment } from './equipment';
import { readProficiencies, type ProficiencyField } from './proficiencies';
import { readAdditionalSpells } from './spells';

/**
 * What a class (or subclass) gives and asks at one class level. Level 1 of the first class brings
 * saving throws, proficiencies and equipment; later classes bring their multiclass proficiencies.
 */

export type CasterProgression = 'full' | '1/2' | '1/3' | 'pact' | 'artificer';

/** The highest spell level a class (on its own) can cast at a class level. */
export function maxSpellLevel(
  progression: CasterProgression | undefined,
  level: number,
  edition: '2014' | '2024',
): number {
  switch (progression) {
    case 'full':
      return Math.min(9, Math.ceil(level / 2));
    case 'artificer':
      return Math.min(5, Math.ceil(level / 4));
    case '1/2':
      // 2014 half casters start casting at level 2; 2024 ones at level 1.
      return edition === '2014' && level < 2 ? 0 : Math.min(5, Math.ceil(level / 4));
    case '1/3':
      return level < 3 ? 0 : Math.min(4, Math.ceil(level / 6));
    case 'pact':
      return Math.min(5, Math.ceil(level / 2));
    default:
      return 0;
  }
}

export const isCasterProgression = (v: unknown): v is CasterProgression =>
  v === 'full' || v === '1/2' || v === '1/3' || v === 'pact' || v === 'artificer';

const at = (list: unknown, level: number): number => {
  if (!Array.isArray(list)) return 0;
  const v: unknown = list[level - 1];
  return typeof v === 'number' ? v : 0;
};

/** How many picks a progression adds at a level: arrays and `{ "3": 2, "7": 3 }` are totals. */
export function progressionDelta(progression: unknown, level: number): number {
  if (Array.isArray(progression)) return at(progression, level) - at(progression, level - 1);
  if (!isObj(progression)) return 0;
  if ('*' in progression)
    return level === 1 && typeof progression['*'] === 'number' ? progression['*'] : 0;
  const total = (l: number) => {
    let best = 0;
    for (const [k, v] of Object.entries(progression))
      if (Number(k) <= l && typeof v === 'number') best = Math.max(best, v);
    return best;
  };
  return total(level) - total(level - 1);
}

const ordinal = (n: number) =>
  n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${String(n)}th`;

/** `level=1;2;3|class=Bard`: spells of the class up to a level. */
export function classSpellFilter(className: string, min: number, max: number): string {
  const levels = Array.from({ length: max - min + 1 }, (_, i) => String(min + i)).join(';');
  return `level=${levels}|class=${className}`;
}

/** Any simple or martial weapon, as a 5etools item filter. */
export const WEAPON_FILTER = 'type=simple weapon;martial weapon';

/** A numeric column of the class table, by label, as one value per level. */
export function tableColumn(entity: RawEntity, label: RegExp): number[] | undefined {
  if (!Array.isArray(entity.classTableGroups)) return undefined;
  for (const group of entity.classTableGroups) {
    if (!isObj(group) || !Array.isArray(group.colLabels) || !Array.isArray(group.rows)) continue;
    const i = group.colLabels.findIndex((l) => typeof l === 'string' && label.test(l));
    if (i < 0) continue;
    return group.rows.map((row) => (Array.isArray(row) ? Number(row[i]) || 0 : 0));
  }
  return undefined;
}

/** Class weapon proficiencies are sometimes only text: `["simple", "{@item dagger|phb|daggers}"]`. */
function textWeapons(list: unknown): Extraction {
  const out = emptyExtraction();
  if (!Array.isArray(list)) return out;
  for (const w of list) {
    if (typeof w !== 'string') continue; // `{ proficiency: "firearms", optional: true }`: optional rule
    const tag = /^\{@item ([^|}]+)\|?([^|}]*)/.exec(w);
    if (tag?.[1])
      out.grants.push({ kind: 'weapon', value: refKey('item', `${tag[1]}|${tag[2] ?? ''}`) });
    else out.grants.push({ kind: 'weapon', value: w.toLowerCase() });
  }
  return out;
}

const PROFICIENCY_KEYS: Record<string, ProficiencyField | null> = {
  skills: 'skillProficiencies',
  toolProficiencies: 'toolProficiencies',
  armorProficiencies: 'armorProficiencies',
  weaponProficiencies: 'weaponProficiencies',
  // Text versions of the structured fields above.
  tools: null,
  armor: null,
  weapons: null,
};

function startingProficiencies(block: unknown, id: string, issues: Issues): Extraction {
  const out = emptyExtraction();
  if (!isObj(block)) return out;
  for (const [k, v] of Object.entries(block)) {
    if (!(k in PROFICIENCY_KEYS)) {
      issues.add(id, `unknown proficiency field ${k}`);
      continue;
    }
    const field = PROFICIENCY_KEYS[k];
    if (field)
      merge(
        out,
        readProficiencies(field, v, `${id}/${field.replace('Proficiencies', '')}`, issues),
      );
  }
  if (!('weaponProficiencies' in block)) merge(out, textWeapons(block.weapons));
  return out;
}

export interface ClassLevelOptions {
  /** The first class: saving throws, full proficiencies and starting equipment. */
  first: boolean;
  edition: '2014' | '2024';
  /**
   * The character's current level in this class. Cantrips and known or prepared spells are one
   * running list (spells can be swapped as the class levels up), asked at the current level.
   */
  current: boolean;
}

/** The level at which a class picks its subclass, from its `gainSubclassFeature` reference. */
export function subclassLevel(cls: RawEntity): number | undefined {
  if (!Array.isArray(cls.classFeatures)) return undefined;
  for (const ref of cls.classFeatures) {
    const parsed = classFeatureRef(ref);
    if (parsed?.gainSubclass) return parsed.level;
  }
  return undefined;
}

/**
 * Class (or subclass) entity → grants and choices at `level`. `key` is the entity key; choice
 * ids are `<key>/level:<n>/<what>`.
 */
export function readClassLevel(
  entity: RawEntity,
  key: string,
  level: number,
  options: ClassLevelOptions,
  issues: Issues,
): Extraction {
  const out = emptyExtraction();
  const id = `${key}/level:${String(level)}`;
  const isSubclass = typeof entity.className === 'string';
  const className = String(isSubclass ? entity.className : entity.name);

  if (!isSubclass && level === 1) {
    if (options.first) {
      if (Array.isArray(entity.proficiency))
        for (const a of entity.proficiency)
          if (isAbility(a)) out.grants.push({ kind: 'save', value: a });
      merge(out, startingProficiencies(entity.startingProficiencies, id, issues));
      merge(out, readClassEquipment(entity.startingEquipment, `${id}/equipment`, issues));
    } else if (isObj(entity.multiclassing)) {
      merge(out, startingProficiencies(entity.multiclassing.proficienciesGained, id, issues));
    }
  }

  if (!isSubclass) {
    const subclassAt = subclassLevel(entity);
    if (subclassAt === level)
      out.choices.push({
        id: `${id}/subclass`,
        kind: 'subclass',
        count: 1,
        level,
        label: `Choose your ${typeof entity.subclassTitle === 'string' ? entity.subclassTitle : 'subclass'}`,
        filter: { type: 'subclass', className, classSource: String(entity.source) },
      });
  }

  if (Array.isArray(entity.featProgression))
    for (const p of entity.featProgression) {
      if (!isObj(p)) continue;
      const n = progressionDelta(p.progression, level);
      if (n > 0)
        out.choices.push({
          id: `${id}/feat:${String(p.name).toLowerCase()}`,
          kind: 'feat',
          count: n,
          level,
          label: `Choose ${n === 1 ? 'a' : String(n)} ${String(p.name)} feat${n === 1 ? '' : 's'}`,
          filter: {
            type: 'feat',
            ...(Array.isArray(p.category) ? { categories: p.category.map(String) } : {}),
          },
        });
    }

  if (Array.isArray(entity.optionalfeatureProgression))
    for (const p of entity.optionalfeatureProgression) {
      if (!isObj(p)) continue;
      const name = String(p.name);
      const n = progressionDelta(p.progression, level);
      if (n > 0)
        out.choices.push({
          id: `${id}/optionalfeature:${name.toLowerCase()}`,
          kind: 'optionalfeature',
          count: n,
          level,
          label: `Choose ${String(n)} ${name}`,
          filter: {
            type: 'optionalfeature',
            featureTypes: Array.isArray(p.featureType) ? p.featureType.map(String) : [],
          },
        });
      // Way of the Four Elements always has Elemental Attunement.
      const required = isObj(p.required) ? p.required[String(level)] : undefined;
      if (Array.isArray(required))
        for (const r of required)
          if (typeof r === 'string')
            out.grants.push({ kind: 'optionalfeature', key: refKey('optionalfeature', r) });
      for (const k of Object.keys(p))
        if (!['name', 'featureType', 'progression', 'required'].includes(k))
          issues.add(id, `unknown optionalfeatureProgression field ${k}`);
    }

  // 2024 Weapon Mastery: a class-table column ("Weapon Mastery": 2, 2, 2, 3…).
  const mastery = tableColumn(entity, /^weapon mastery$/i);
  const masteries = mastery ? progressionDelta(mastery, level) : 0;
  if (masteries > 0)
    out.choices.push({
      id: `${id}/weaponMastery`,
      kind: 'weaponMastery',
      count: masteries,
      level,
      label: `Choose ${String(masteries)} weapon${masteries === 1 ? '' : 's'} to master`,
      filter: { type: 'items', filter: WEAPON_FILTER },
    });

  // Spells.
  const progression = isCasterProgression(entity.casterProgression)
    ? entity.casterProgression
    : undefined;
  const max = maxSpellLevel(progression, level, options.edition);
  const cantrips = options.current ? at(entity.cantripProgression, level) : 0;
  if (cantrips > 0)
    out.choices.push({
      id: `${key}/cantrips`,
      kind: 'spell',
      count: cantrips,
      level,
      label: `Choose ${String(cantrips)} cantrip${cantrips === 1 ? '' : 's'}`,
      filter: { type: 'spell', filter: classSpellFilter(className, 0, 0) },
    });
  const prepared = Array.isArray(entity.preparedSpellsProgression);
  const known = options.current
    ? at(entity.spellsKnownProgression, level) + at(entity.preparedSpellsProgression, level)
    : 0;
  if (known > 0 && max > 0)
    out.choices.push({
      id: `${key}/spells`,
      kind: 'spell',
      count: known,
      level,
      label: `${prepared ? 'Prepare' : 'Choose'} ${String(known)} spell${known === 1 ? '' : 's'}`,
      filter: { type: 'spell', filter: classSpellFilter(className, 1, max) },
    });
  // Wizards' spellbook: a fixed number of new spells per level.
  const book = at(entity.spellsKnownProgressionFixed, level);
  if (book > 0 && max > 0)
    out.choices.push({
      id: `${id}/spellbook`,
      kind: 'spell',
      count: book,
      level,
      label: `Add ${String(book)} spell${book === 1 ? '' : 's'} to your spellbook`,
      filter: { type: 'spell', filter: classSpellFilter(className, 1, max) },
    });
  // Warlocks' Mystic Arcanum: `{ "11": { "6": 1 } }`.
  const byLevel = isObj(entity.spellsKnownProgressionFixedByLevel)
    ? entity.spellsKnownProgressionFixedByLevel[String(level)]
    : undefined;
  if (isObj(byLevel))
    for (const [spellLevel, count] of Object.entries(byLevel))
      if (typeof count === 'number')
        out.choices.push({
          id: `${id}/spells:${spellLevel}`,
          kind: 'spell',
          count,
          level,
          label: `Choose a ${ordinal(Number(spellLevel))}-level spell`,
          filter: {
            type: 'spell',
            filter: classSpellFilter(className, Number(spellLevel), Number(spellLevel)),
          },
        });

  if (entity.additionalSpells !== undefined) {
    const spells = readAdditionalSpells(entity.additionalSpells, `${key}/spells`, issues);
    out.grants.push(...spells.grants.filter((g) => 'level' in g && g.level === level));
    out.choices.push(
      ...spells.choices.filter((c) => (c.level ?? 1) === level).map((c) => ({ ...c, level })),
    );
  }
  return out;
}
