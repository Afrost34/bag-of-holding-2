import type { EntityDetail } from './entity';
import { isObj, text } from './json';
import { makeKey } from './keys';

/**
 * Class, subclass and species pages: the entities a page needs, gathered in one call. 5etools
 * keeps class features, subclasses and subraces as separate entries that point at each other.
 */

export interface FeatureEntry {
  key: string;
  name: string;
  level: number;
  /** The feature where the subclass is chosen ("Fighter Subclass", "Martial Archetype"). */
  gainSubclass: boolean;
  /** Undefined when the feature is missing from the data (or its source is removed). */
  entity?: EntityDetail;
}

export interface SubclassSummary {
  key: string;
  name: string;
  shortName: string;
  source: string;
  edition: EntityDetail['edition'];
  /** Superseded by a newer printing. */
  legacy: boolean;
}

export interface ClassPage {
  cls: EntityDetail;
  fluff?: EntityDetail;
  features: FeatureEntry[];
  subclasses: SubclassSummary[];
}

export interface SubclassPage {
  subclass: EntityDetail;
  fluff?: EntityDetail;
  /** The class it belongs to, for the back link and the class table. */
  cls?: EntityDetail;
  features: FeatureEntry[];
}

export interface SpeciesPage {
  race: EntityDetail;
  fluff?: EntityDetail;
  /** Subraces and lineages listed separately in the data, newest first. */
  subraces: EntityDetail[];
}

/** What the page builders need from the index. */
export interface PageLookup {
  get(key: string): EntityDetail | undefined;
  /** Entities of a type whose key ends with `suffix` (e.g. `|fighter|xphb@` + any source). */
  withKeySuffix(type: string, suffix: string): EntityDetail[];
}

/** Empty sources in feature references mean the Player's Handbook (2014), as in 5etools. */
const DEFAULT_SOURCE = 'PHB';

/** Reference parts are often present but empty. */
const orDefault = (value: string | undefined, fallback: string): string =>
  value === undefined || value === '' ? fallback : value;

/**
 * `Action Surge|Fighter|XPHB|2` (source defaults to the class source) or the object form
 * `{ classFeature: '…', gainSubclassFeature: true }`. 2014 data omits sources: `Rage|Barbarian||1`.
 */
export function classFeatureRef(ref: unknown): Omit<FeatureEntry, 'entity'> | null {
  const raw = typeof ref === 'string' ? ref : isObj(ref) ? text(ref.classFeature) : '';
  const [name, className, rawClassSource, level, source] = raw.split('|');
  if (!name || !className || !level) return null;
  const classSource = orDefault(rawClassSource, DEFAULT_SOURCE);
  const lvl = Number(level);
  return {
    key: makeKey(
      'classFeature',
      [name, className, classSource, lvl],
      orDefault(source, classSource),
    ),
    name,
    level: lvl,
    gainSubclass: isObj(ref) && ref.gainSubclassFeature === true,
  };
}

/** `Champion|Fighter|XPHB|Champion|XPHB|3` (source defaults to the subclass source). */
export function subclassFeatureRef(ref: unknown): Omit<FeatureEntry, 'entity'> | null {
  const raw = typeof ref === 'string' ? ref : isObj(ref) ? text(ref.subclassFeature) : '';
  const [name, className, rawClassSource, scName, rawScSource, level, source] = raw.split('|');
  if (!name || !className || !scName || !level) return null;
  const classSource = orDefault(rawClassSource, DEFAULT_SOURCE);
  const scSource = orDefault(rawScSource, DEFAULT_SOURCE);
  const lvl = Number(level);
  return {
    key: makeKey(
      'subclassFeature',
      [name, className, classSource, scName, scSource, lvl],
      orDefault(source, scSource),
    ),
    name,
    level: lvl,
    gainSubclass: false,
  };
}

/** The end of child keys pointing at a parent: `|fighter|xphb@` (any source follows). */
function keySuffix(name: string, source: string): string {
  const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();
  return `|${norm(name)}|${norm(source)}@`;
}

function fluffOf(lookup: PageLookup, entity: EntityDetail): EntityDetail | undefined {
  return lookup.get(makeKey(`${entity.type}Fluff`, [entity.name], entity.source));
}

function features(
  lookup: PageLookup,
  refs: unknown,
  parse: (ref: unknown) => Omit<FeatureEntry, 'entity'> | null,
): FeatureEntry[] {
  if (!Array.isArray(refs)) return [];
  return refs.flatMap((ref) => {
    const parsed = parse(ref);
    if (!parsed) return [];
    const entity = lookup.get(parsed.key);
    return [entity ? { ...parsed, entity } : parsed];
  });
}

const byEditionThenName = (a: EntityDetail, b: EntityDetail) =>
  b.edition.localeCompare(a.edition) || a.name.localeCompare(b.name, 'en');

export function buildClassPage(lookup: PageLookup, key: string): ClassPage | undefined {
  const cls = lookup.get(key);
  if (cls?.type !== 'class') return undefined;
  const suffix = keySuffix(cls.name, cls.source);
  const subclasses = lookup.withKeySuffix('subclass', suffix).sort(byEditionThenName);
  // A 2014 subclass is Legacy when a 2024 one shares its short name.
  const modern = new Set(
    subclasses.filter((s) => s.edition === '2024').map((s) => text(s.data.shortName)),
  );
  const fluff = fluffOf(lookup, cls);
  return {
    cls,
    ...(fluff ? { fluff } : {}),
    features: features(lookup, cls.data.classFeatures, classFeatureRef),
    subclasses: subclasses.map((s) => ({
      key: s.key,
      name: s.name,
      shortName: text(s.data.shortName) || s.name,
      source: s.source,
      edition: s.edition,
      legacy:
        (Array.isArray(s.data.reprintedAs) && s.data.reprintedAs.length > 0) ||
        (s.edition === '2014' && modern.has(text(s.data.shortName))),
    })),
  };
}

export function buildSubclassPage(lookup: PageLookup, key: string): SubclassPage | undefined {
  const subclass = lookup.get(key);
  if (subclass?.type !== 'subclass') return undefined;
  const d = subclass.data;
  const cls = lookup.get(makeKey('class', [text(d.className)], text(d.classSource)));
  const fluff = fluffOf(lookup, subclass);
  return {
    subclass,
    ...(fluff ? { fluff } : {}),
    ...(cls ? { cls } : {}),
    features: features(lookup, d.subclassFeatures, subclassFeatureRef),
  };
}

export function buildSpeciesPage(lookup: PageLookup, key: string): SpeciesPage | undefined {
  const race = lookup.get(key);
  if (race?.type !== 'race') return undefined;
  const suffix = keySuffix(race.name, race.source);
  const fluff = fluffOf(lookup, race);
  return {
    race,
    ...(fluff ? { fluff } : {}),
    // Unnamed subraces only patch their race (5etools' "base" variants); they have no page.
    subraces: lookup
      .withKeySuffix('subrace', suffix)
      .filter((s) => text(s.data.name) !== '')
      .sort(byEditionThenName),
  };
}
