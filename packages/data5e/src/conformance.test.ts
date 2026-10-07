/**
 * Conformance: runs the extractor over the real, pinned 5etools data. Skipped when the data has
 * not been downloaded (`pnpm data:fetch`); CI always downloads it.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CopyResolver } from './copy';
import { extractFile, type EntityRecord, type ExtractIssue } from './extract';
import { isDataFile } from './files';
import type { RawEntity } from './identity';
import { parseSourceRegistry } from './sourceRegistry';
import { buildSourceCatalog, indexSources, sourceFromMetadata, type SourceInfo } from './sources';
import {
  hasLocalData,
  listLocalDataFiles,
  readLocalJson,
  readLocalText,
} from './testing/localData';

// Each test walks the whole 5etools release: allow time on slower CI machines.
vi.setConfig({ testTimeout: 120_000 });

describe.runIf(hasLocalData())('5etools conformance', () => {
  const entities = new Map<string, EntityRecord & { file: string }>();
  const duplicates: string[] = [];
  const issues: ExtractIssue[] = [];
  let sources: Map<string, SourceInfo>;

  beforeAll(() => {
    const metaSources: SourceInfo[] = [];
    const contentIds = new Map<string, string>();
    for (const [file, kind, field] of [
      ['data/books.json', 'book', 'book'],
      ['data/adventures.json', 'adventure', 'adventure'],
    ] as const) {
      const json = readLocalJson(file) as Record<string, RawEntity[]>;
      for (const meta of json[field] ?? []) {
        const source = sourceFromMetadata(kind, meta);
        if (source) metaSources.push(source);
        if (typeof meta.id === 'string' && source)
          contentIds.set(`${kind}:${meta.id.toLowerCase()}`, source.id);
      }
    }
    const registry = parseSourceRegistry(readLocalText('js/parser.js'));
    const known = indexSources(
      buildSourceCatalog({ metadata: metaSources, registry, seen: registry.keys() }),
    );
    const ctx = {
      sourceEdition: (s: string) => known.get(s.toLowerCase())?.edition,
      contentSource: (kind: string, id: string) => contentIds.get(`${kind}:${id}`),
    };

    for (const file of listLocalDataFiles().filter(isDataFile)) {
      const result = extractFile(file, readLocalJson(file), ctx);
      issues.push(...result.issues);
      for (const entity of result.entities) {
        const existing = entities.get(entity.key);
        if (existing) duplicates.push(`${entity.key}  (${existing.file} & ${file})`);
        else entities.set(entity.key, { ...entity, file });
      }
    }
    sources = known;
  });

  it('indexes every major entity type', () => {
    const counts = new Map<string, number>();
    for (const e of entities.values()) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    for (const type of [
      'spell',
      'monster',
      'item',
      'baseitem',
      'class',
      'subclass',
      'classFeature',
      'subclassFeature',
      'race',
      'background',
      'feat',
      'optionalfeature',
      'condition',
      'bookData',
      'adventureData',
      'book',
      'adventure',
    ]) {
      expect(counts.get(type) ?? 0, type).toBeGreaterThan(0);
    }
  });

  it('gives every entity a unique key', () => {
    expect(duplicates).toEqual([]);
  });

  it('identifies every entity in every array', () => {
    expect(issues).toEqual([]);
  });

  it('knows the 2014 and 2024 core books', () => {
    expect(sources.get('phb')?.edition).toBe('2014');
    expect(sources.get('xphb')?.edition).toBe('2024');
    expect(entities.get('spell:fireball@phb')?.edition).toBe('2014');
    expect(entities.get('spell:fireball@xphb')?.edition).toBe('2024');
  });

  it('resolves every _copy entity', () => {
    const resolver = new CopyResolver((_type, key) => entities.get(key)?.data);
    const failures: string[] = [];
    let resolved = 0;
    for (const e of entities.values()) {
      if (!e.data._copy) continue;
      try {
        const out = resolver.resolve(e.type, e.key, e.data);
        expect(out._copy).toBeUndefined();
        resolved++;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    expect(failures).toEqual([]);
    expect(resolved).toBeGreaterThan(3000);
  });

  it('knows the name and date of every source', () => {
    const unknown = new Set<string>();
    for (const e of entities.values()) {
      if (!sources.has(e.source.toLowerCase())) unknown.add(e.source);
    }
    // "Generic" is 5etools' placeholder source for rules-free entries (e.g. some item groups).
    expect([...unknown].sort()).toEqual(['Generic']);
  });
});
