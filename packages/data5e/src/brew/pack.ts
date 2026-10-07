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
export const BREW_TYPES = ['item', 'monster', 'spell'] as const;
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
    if (type.startsWith('_') || !Array.isArray(list)) continue;
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
