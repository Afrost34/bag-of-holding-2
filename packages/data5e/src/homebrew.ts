import type { EntityIndex } from './db/entityIndex';
import { editionFromDate, editionFromField } from './editions';
import { extractFile, type ExtractIssue } from './extract';
import type { RawEntity } from './identity';
import { isPlaytestSource, type SourceInfo } from './sources';

/**
 * Homebrew packs use the 5etools homebrew format: a `_meta.sources` list plus the same entity
 * arrays as official data. Each pack is one file in the user's data repo
 * (`homebrew/<name>.json`) and one indexed file in the `homebrew` layer.
 */

export interface HomebrewPack {
  /** Path in the user store, e.g. `homebrew/my-brew.json`. */
  path: string;
  sha: string;
  json: unknown;
}

export interface HomebrewResult {
  path: string;
  sources: SourceInfo[];
  entities: number;
  issues: ExtractIssue[];
  skipped: string[];
}

export class HomebrewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomebrewError';
  }
}

const isObj = (v: unknown): v is RawEntity =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The sources a pack declares. Throws HomebrewError when the file is not a homebrew pack. */
export function homebrewSources(json: unknown): SourceInfo[] {
  if (!isObj(json) || !isObj(json._meta) || !Array.isArray(json._meta.sources)) {
    throw new HomebrewError('Not a 5etools homebrew file: it has no "_meta.sources" list.');
  }
  const sources: SourceInfo[] = [];
  for (const meta of json._meta.sources as unknown[]) {
    if (!isObj(meta) || typeof meta.json !== 'string' || meta.json === '') continue;
    const name = typeof meta.full === 'string' && meta.full ? meta.full : meta.json;
    const published = typeof meta.dateReleased === 'string' ? meta.dateReleased : undefined;
    const edition = editionFromField(meta.edition) ?? editionFromDate(published);
    sources.push({
      id: meta.json,
      name,
      kind: 'homebrew',
      group: 'homebrew',
      ...(published ? { published } : {}),
      ...(edition ? { edition } : {}),
      playtest: isPlaytestSource(meta.json),
    });
  }
  if (sources.length === 0) throw new HomebrewError('The homebrew file declares no sources.');
  return sources;
}

/** Indexes (or re-indexes) one pack. Official content always wins key conflicts. */
export function indexHomebrew(index: EntityIndex, pack: HomebrewPack): HomebrewResult {
  const sources = homebrewSources(pack.json);
  const ctx = index.extractContext(sources);
  const result = extractFile(pack.path, pack.json, ctx);
  const skipped = index.replaceFile(pack.path, pack.sha, 'homebrew', result);
  return {
    path: pack.path,
    sources,
    entities: result.entities.length - skipped.length,
    issues: result.issues,
    skipped,
  };
}

/**
 * Brings the homebrew layer in line with the packs in the user's store: indexes new or changed
 * packs, drops removed ones, then re-links copies and sources.
 */
export function syncHomebrew(index: EntityIndex, packs: HomebrewPack[]): HomebrewResult[] {
  const installed = index.fileShas('homebrew');
  const wanted = new Set(packs.map((p) => p.path));
  for (const path of installed.keys()) if (!wanted.has(path)) index.removeFile(path);

  const results: HomebrewResult[] = [];
  const allSources: SourceInfo[] = [];
  for (const pack of packs) {
    if (installed.get(pack.path) === pack.sha) {
      allSources.push(...homebrewSources(pack.json));
      continue;
    }
    const result = indexHomebrew(index, pack);
    allSources.push(...result.sources);
    results.push(result);
  }
  index.resolveCopies('homebrew');
  index.rebuildSources(allSources);
  return results;
}
