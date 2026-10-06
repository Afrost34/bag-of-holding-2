import { editionFromDate, type Edition } from './editions';
import type { RawEntity } from './identity';
import type { RegistryEntry } from './sourceRegistry';

export type SourceKind = 'book' | 'adventure' | 'other' | 'homebrew';

export interface SourceInfo {
  /** Source code as used on entities, e.g. `XPHB`, `CoS`, `UA2024Arcana`. */
  id: string;
  name: string;
  kind: SourceKind;
  /** 5etools group (`core`, `supplement`, `setting`, `prerelease`…) or our own for others. */
  group: string;
  published?: string;
  edition?: Edition;
  /** Unearthed Arcana / playtest material: off by default. */
  playtest: boolean;
}

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** Playtest sources: Unearthed Arcana and prerelease material. */
export function isPlaytestSource(id: string, group?: string): boolean {
  return /^UA/i.test(id) || group === 'prerelease' || group === 'ua';
}

/** A source entry from a `book` or `adventure` metadata entity (books.json / adventures.json). */
export function sourceFromMetadata(kind: 'book' | 'adventure', meta: RawEntity): SourceInfo | null {
  const id = str(meta.source) ?? str(meta.id);
  const name = str(meta.name);
  if (!id || !name) return null;
  const group = str(meta.group) ?? (kind === 'adventure' ? 'adventure' : 'other');
  const published = str(meta.published);
  const edition = editionFromDate(published);
  return {
    id,
    name,
    kind,
    group,
    ...(published ? { published } : {}),
    ...(edition ? { edition } : {}),
    playtest: isPlaytestSource(id, group),
  };
}

/** A source we only know from entities that cite it (no book/adventure metadata). */
export function unknownSource(id: string): SourceInfo {
  return { id, name: id, kind: 'other', group: 'other', playtest: isPlaytestSource(id) };
}

export interface CatalogInput {
  /** Sources from book/adventure metadata (most complete). */
  metadata: Iterable<SourceInfo>;
  /** Names and dates from 5etools' parser.js, for sources without metadata. */
  registry?: ReadonlyMap<string, RegistryEntry>;
  /** Every source code seen on an entity. */
  seen: Iterable<string>;
}

/**
 * One entry per source code: metadata first, then the parser.js registry, then a bare
 * "unknown" entry so every entity's source can be toggled.
 */
export function buildSourceCatalog({ metadata, registry, seen }: CatalogInput): SourceInfo[] {
  const byId = indexSources(metadata);
  const registryLower = new Map<string, [string, RegistryEntry]>();
  for (const [id, entry] of registry ?? []) registryLower.set(id.toLowerCase(), [id, entry]);

  for (const id of seen) {
    const lower = id.toLowerCase();
    if (byId.has(lower)) continue;
    const reg = registryLower.get(lower);
    if (!reg) {
      byId.set(lower, unknownSource(id));
      continue;
    }
    const [regId, entry] = reg;
    const edition = editionFromDate(entry.date);
    byId.set(lower, {
      id: regId,
      name: entry.full ?? regId,
      kind: 'other',
      group: 'other',
      ...(entry.date ? { published: entry.date } : {}),
      ...(edition ? { edition } : {}),
      playtest: isPlaytestSource(regId),
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive lookup map; 5etools source codes are compared case-insensitively. */
export function indexSources(sources: Iterable<SourceInfo>): Map<string, SourceInfo> {
  const map = new Map<string, SourceInfo>();
  for (const source of sources) {
    const key = source.id.toLowerCase();
    // Books win over adventures with the same code; keep the first otherwise.
    const existing = map.get(key);
    if (!existing || (existing.kind !== 'book' && source.kind === 'book')) map.set(key, source);
  }
  return map;
}
