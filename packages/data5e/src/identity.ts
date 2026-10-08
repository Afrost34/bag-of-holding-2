import { makeKey, type EntityKey } from './keys';

/** A raw 5etools object. Fields are read defensively; the data is not validated upfront. */
export type RawEntity = Record<string, unknown>;

export interface Identity {
  key: EntityKey;
  /** Display name. */
  name: string;
  source: string;
}

type IdentityRule = (
  entity: RawEntity,
) => { name: string; parts: (string | number)[]; source: string } | null;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/** Name + source: the default for almost every type. */
const byName: IdentityRule = (e) => {
  const name = str(e.name);
  const source = str(e.source);
  return name && source ? { name, parts: [name], source } : null;
};

/**
 * Types whose name alone is not unique. Parts mirror the 5etools tag/uid format for the type
 * (see `{@classFeature name|className|classSource|level|source}` etc.).
 */
const rules: Record<string, IdentityRule> = {
  classFeature: (e) => {
    const [name, className, classSource, level, source] = [
      str(e.name),
      str(e.className),
      str(e.classSource),
      num(e.level),
      str(e.source),
    ];
    if (!name || !className || !classSource || level === null || !source) return null;
    return { name, parts: [name, className, classSource, level], source };
  },
  subclass: (e) => {
    const [name, shortName, className, classSource, source] = [
      str(e.name),
      str(e.shortName),
      str(e.className),
      str(e.classSource),
      str(e.source),
    ];
    if (!name || !shortName || !className || !classSource || !source) return null;
    return { name, parts: [shortName, className, classSource], source };
  },
  subclassFeature: (e) => {
    const [name, className, classSource, scName, scSource, level, source] = [
      str(e.name),
      str(e.className),
      str(e.classSource),
      str(e.subclassShortName),
      str(e.subclassSource),
      num(e.level),
      str(e.source),
    ];
    if (!name || !className || !classSource || !scName || !scSource || level === null || !source) {
      return null;
    }
    return { name, parts: [name, className, classSource, scName, scSource, level], source };
  },
  subrace: (e) => {
    // Some subraces are unnamed "base" variants of their race.
    const [raceName, raceSource, source] = [str(e.raceName), str(e.raceSource), str(e.source)];
    if (!raceName || !raceSource || !source) return null;
    const name = str(e.name) ?? '';
    return { name: name || raceName, parts: [name, raceName, raceSource], source };
  },
  card: (e) => {
    const [name, set, source] = [str(e.name), str(e.set), str(e.source)];
    if (!name || !set || !source) return null;
    return { name, parts: [name, set], source };
  },
  deity: (e) => {
    const [name, pantheon, source] = [str(e.name), str(e.pantheon), str(e.source)];
    if (!name || !pantheon || !source) return null;
    return { name, parts: [name, pantheon], source };
  },
  magicvariant: (e) => {
    // Most magic variants carry their source inside `inherits`.
    const name = str(e.name);
    const inherits = e.inherits as RawEntity | undefined;
    const source = str(e.source) ?? str(inherits?.source);
    return name && source ? { name, parts: [name], source } : null;
  },
  itemProperty: (e) => {
    const [abbreviation, source] = [str(e.abbreviation), str(e.source)];
    if (!abbreviation || !source) return null;
    return { name: str(e.name) ?? abbreviation, parts: [abbreviation], source };
  },
  // Book and adventure text inside a homebrew file: `{ id, source, data }`, no name. (The
  // official text comes one book per file and is keyed in `extractFile`, the same way.)
  bookData: (e) => {
    const [id, source] = [str(e.id), str(e.source)];
    return id && source ? { name: id, parts: [id], source } : null;
  },
  adventureData: (e) => {
    const [id, source] = [str(e.id), str(e.source)];
    return id && source ? { name: id, parts: [id], source } : null;
  },
  itemType: (e) => {
    const [abbreviation, source] = [str(e.abbreviation), str(e.source)];
    if (!abbreviation || !source) return null;
    return { name: str(e.name) ?? abbreviation, parts: [abbreviation], source };
  },
};

/** Builds the key for an entity of a 5etools array type, or null when required fields are missing. */
export function identify(type: string, entity: RawEntity): Identity | null {
  const rule = rules[type] ?? byName;
  const result = rule(entity);
  if (!result) return null;
  return {
    key: makeKey(type, result.parts, result.source),
    name: result.name,
    source: result.source,
  };
}
