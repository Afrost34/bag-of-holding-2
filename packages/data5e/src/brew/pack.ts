import type { Edition } from '../editions';
import type { RawEntity } from '../identity';

/**
 * Homebrew packs made in the app: 5etools homebrew files (`_meta.sources` plus entity arrays), so
 * they import into 5etools and other tools too. A pack made here declares one source.
 */

export interface PackMeta {
  /** Source id used in keys and links (`item:Sunblade@RS`): letters and digits. */
  id: string;
  /** Shown name, e.g. "Rust & Sunfire". */
  name: string;
  edition: Edition;
  author: string;
}

/** The kinds of entries the editors make, and the arrays they live in. */
export const BREW_TYPES = [
  'item',
  'monster',
  'spell',
  'feat',
  'background',
  'race',
  'class',
] as const;
export type BrewType = (typeof BREW_TYPES)[number];

const isObj = (v: unknown): v is RawEntity =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A source id from a name: `Rust & Sunfire` → `RustSunfire`. */
export function sourceIdFor(name: string): string {
  const id = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return (id || 'Homebrew').slice(0, 24);
}

export function newPack(meta: PackMeta, now = new Date()): RawEntity {
  const seconds = Math.floor(now.getTime() / 1000);
  return {
    _meta: {
      sources: [
        {
          json: meta.id,
          abbreviation: meta.id,
          full: meta.name,
          authors: meta.author ? [meta.author] : [],
          version: '1.0.0',
          edition: meta.edition === '2024' ? 'one' : 'classic',
          dateReleased: now.toISOString().slice(0, 10),
        },
      ],
      dateAdded: seconds,
      dateLastModified: seconds,
    },
  };
}

/** The pack's own source (the first one it declares). */
export function packMeta(pack: RawEntity): PackMeta | null {
  const meta = isObj(pack._meta) ? pack._meta : null;
  const source = Array.isArray(meta?.sources) ? meta.sources.find(isObj) : undefined;
  if (!source || typeof source.json !== 'string') return null;
  return {
    id: source.json,
    name: typeof source.full === 'string' ? source.full : source.json,
    edition: source.edition === 'one' ? '2024' : '2014',
    author: Array.isArray(source.authors) ? source.authors.map(String).join(', ') : '',
  };
}

/** Every entry in the pack, of the kinds the editors know first. */
export function packEntries(pack: RawEntity): { type: string; name: string; entity: RawEntity }[] {
  const out: { type: string; name: string; entity: RawEntity }[] = [];
  for (const [type, list] of Object.entries(pack)) {
    // Pictures and lore (`itemFluff`…) belong to their entries, not listed apart.
    // Class features are listed with their class.
    if (
      type.startsWith('_') ||
      type.endsWith('Fluff') ||
      type === 'classFeature' ||
      !Array.isArray(list)
    )
      continue;
    for (const entity of list) {
      if (isObj(entity) && typeof entity.name === 'string')
        out.push({ type, name: entity.name, entity });
    }
  }
  return out.sort(
    (a, b) =>
      Number(!(BREW_TYPES as readonly string[]).includes(a.type)) -
        Number(!(BREW_TYPES as readonly string[]).includes(b.type)) ||
      a.type.localeCompare(b.type) ||
      a.name.localeCompare(b.name),
  );
}

function touched(pack: RawEntity, now: Date): RawEntity {
  const meta = isObj(pack._meta) ? pack._meta : {};
  return { ...pack, _meta: { ...meta, dateLastModified: Math.floor(now.getTime() / 1000) } };
}

/**
 * Adds an entry, or replaces the one it was (`previousName`, for a rename). The entry gets the
 * pack's source. Throws when another entry of that kind already has the name.
 */
export function putEntry(
  pack: RawEntity,
  type: string,
  entity: RawEntity,
  previousName?: string,
  now = new Date(),
): RawEntity {
  const meta = packMeta(pack);
  if (!meta) throw new Error('This pack has no source');
  const name = typeof entity.name === 'string' ? entity.name.trim() : '';
  if (!name) throw new Error('A name is needed');
  const list = Array.isArray(pack[type]) ? (pack[type] as unknown[]).filter(isObj) : [];
  const same = (e: RawEntity, n: string) => String(e.name).toLowerCase() === n.toLowerCase();
  const old = previousName ?? name;
  if (name.toLowerCase() !== old.toLowerCase() && list.some((e) => same(e, name))) {
    throw new Error(`There is already one called “${name}” in this pack`);
  }
  const next = { ...entity, name, source: meta.id };
  const index = list.findIndex((e) => same(e, old));
  const updated = index === -1 ? [...list, next] : list.map((e, i) => (i === index ? next : e));
  return touched({ ...pack, [type]: updated }, now);
}

export function removeEntry(
  pack: RawEntity,
  type: string,
  name: string,
  now = new Date(),
): RawEntity {
  const list = Array.isArray(pack[type]) ? (pack[type] as unknown[]).filter(isObj) : [];
  const rest = list.filter((e) => String(e.name).toLowerCase() !== name.toLowerCase());
  const next: RawEntity = { ...pack };
  if (rest.length > 0) next[type] = rest;
  else Reflect.deleteProperty(next, type);
  return touched(next, now);
}

/** The first picture of an entry (its `<type>Fluff` images), as a URL, or null. */
export function fluffImage(pack: RawEntity, type: string, name: string): string | null {
  const list = pack[`${type}Fluff`];
  if (!Array.isArray(list)) return null;
  const fluff = list.filter(isObj).find((f) => String(f.name).toLowerCase() === name.toLowerCase());
  const image = Array.isArray(fluff?.images) ? fluff.images.find(isObj) : undefined;
  const href = isObj(image?.href) ? image.href : null;
  return typeof href?.url === 'string' ? href.url : null;
}

/**
 * Sets an entry's picture (null removes it), as 5etools keeps art: a `<type>Fluff` entry with
 * the same name. `previousName` follows a rename.
 */
export function putFluffImage(
  pack: RawEntity,
  type: string,
  name: string,
  url: string | null,
  previousName?: string,
  now = new Date(),
): RawEntity {
  let next = removeEntry(pack, `${type}Fluff`, previousName ?? name, now);
  if (previousName && previousName !== name) next = removeEntry(next, `${type}Fluff`, name, now);
  if (!url) return next;
  return putEntry(
    next,
    `${type}Fluff`,
    { name, images: [{ type: 'image', href: { type: 'external', url } }] },
    undefined,
    now,
  );
}

/**
 * Adds or replaces a class with its features (`previousName` follows a rename): 5etools keeps
 * features in `classFeature`, tied to the class by name and source, and names can repeat
 * (Ability Score Improvement at several levels), so they are swapped as a set.
 */
export function putClass(
  pack: RawEntity,
  cls: RawEntity,
  features: readonly RawEntity[],
  previousName?: string,
  now = new Date(),
): RawEntity {
  const name = typeof cls.name === 'string' ? cls.name.trim() : '';
  const withClass = putEntry(pack, 'class', cls, previousName, now);
  const old = (previousName ?? name).toLowerCase();
  const kept = (Array.isArray(withClass.classFeature) ? (withClass.classFeature as unknown[]) : [])
    .filter(isObj)
    .filter(
      (f) =>
        String(f.className).toLowerCase() !== old &&
        String(f.className).toLowerCase() !== name.toLowerCase(),
    );
  const meta = packMeta(pack);
  const next: RawEntity = {
    ...withClass,
    classFeature: [...kept, ...features.map((f) => ({ ...f, source: meta?.id ?? f.source }))],
  };
  if ((next.classFeature as unknown[]).length === 0) Reflect.deleteProperty(next, 'classFeature');
  return next;
}

/** Removes a class and its features. */
export function removeClass(pack: RawEntity, name: string, now = new Date()): RawEntity {
  const next = removeEntry(pack, 'class', name, now);
  const features = (Array.isArray(next.classFeature) ? (next.classFeature as unknown[]) : [])
    .filter(isObj)
    .filter((f) => String(f.className).toLowerCase() !== name.toLowerCase());
  const out: RawEntity = { ...next };
  if (features.length) out.classFeature = features;
  else Reflect.deleteProperty(out, 'classFeature');
  return out;
}

/** A class's features in the pack. */
export function classFeatures(pack: RawEntity, className: string): RawEntity[] {
  return (Array.isArray(pack.classFeature) ? (pack.classFeature as unknown[]) : [])
    .filter(isObj)
    .filter((f) => String(f.className).toLowerCase() === className.toLowerCase());
}

/** The pack's cover picture (a data URL kept on its source), shown with the books. */
export function packCover(pack: RawEntity): string | null {
  const meta = isObj(pack._meta) ? pack._meta : null;
  const source = Array.isArray(meta?.sources) ? meta.sources.find(isObj) : undefined;
  return typeof source?.cover === 'string' ? source.cover : null;
}

/** Sets or clears the pack's cover. */
export function setPackCover(pack: RawEntity, cover: string | null, now = new Date()): RawEntity {
  const meta = isObj(pack._meta) ? pack._meta : {};
  const sources: unknown[] = Array.isArray(meta.sources) ? meta.sources : [];
  const first = sources.findIndex(isObj);
  if (first < 0) return pack;
  const source: RawEntity = { ...(sources[first] as RawEntity) };
  if (cover) source.cover = cover;
  else Reflect.deleteProperty(source, 'cover');
  return {
    ...pack,
    _meta: {
      ...meta,
      sources: sources.map((s, i) => (i === first ? source : s)),
      dateLastModified: Math.floor(now.getTime() / 1000),
    },
  };
}
