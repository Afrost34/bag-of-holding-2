import { CopyError, CopyResolver } from '../copy';
import { entityEdition, type Edition } from '../editions';
import type { ExtractContext, ExtractResult } from '../extract';
import type { RawEntity } from '../identity';
import { parseKey } from '../keys';
import type { RegistryEntry } from '../sourceRegistry';
import { buildSourceCatalog, indexSources, sourceFromMetadata, type SourceInfo } from '../sources';
import type { Category } from '../lists/categories';
import { buildRow, spellClassLookup, type ListRow } from '../lists/rows';
import { migrate } from './schema';
import type { SqlDatabase, SqlValue } from './types';

export type Layer = '5etools' | 'homebrew';

export interface EntitySummary {
  key: string;
  type: string;
  name: string;
  source: string;
  edition: Edition;
  page: number | null;
  layer: Layer;
}

export interface EntityDetail extends EntitySummary {
  /** Resolved JSON (after `_copy`). */
  data: RawEntity;
}

export interface SourceSummary extends SourceInfo {
  entities: number;
}

export interface SearchOptions {
  /** Only these types (5etools array names). */
  types?: readonly string[];
  /** Never these types; defaults to fluff and book text. */
  excludeTypes?: readonly string[];
  /** Only these sources (case-insensitive). Undefined = all sources. */
  sources?: readonly string[];
  /** Never these sources (case-insensitive), e.g. the ones the user turned off. */
  excludeSources?: readonly string[];
  limit?: number;
}

/** File and name under which the parsed parser.js source registry is stored. */
export const REGISTRY_FILE = 'js/parser.js';
const REGISTRY_AUX = 'sourceRegistry';

const SUMMARY_COLUMNS = 'key, type, name, source, edition, page, layer';
const DEFAULT_EXCLUDED_TYPES = ['bookData', 'adventureData'];

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

/** Turns free text into an FTS5 prefix query: `fire bal` → `"fire"* "bal"*`. */
export function toFtsQuery(text: string): string | null {
  const terms = text
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}']+/u)
    .map((t) => t.replaceAll("'", ''))
    .filter(Boolean);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t}"*`).join(' ');
}

/**
 * The searchable store of every entity: 5etools data plus homebrew. Synchronous; runs in the
 * data worker (or in Node tests).
 */
export class EntityIndex {
  private constructor(readonly db: SqlDatabase) {}

  static open(db: SqlDatabase): EntityIndex {
    migrate(db);
    return new EntityIndex(db);
  }

  // region Meta

  getMeta(key: string): string | undefined {
    return this.db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key])?.value;
  }

  setMeta(key: string, value: string): void {
    this.db.exec('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)', [key, value]);
  }

  deleteMeta(key: string): void {
    this.db.exec('DELETE FROM meta WHERE key = ?', [key]);
  }

  // endregion

  // region Files

  /** path → git blob sha of every indexed file in a layer. */
  fileShas(layer: Layer): Map<string, string> {
    const rows = this.db.all<{ path: string; sha: string }>(
      'SELECT path, sha FROM files WHERE layer = ?',
      [layer],
    );
    return new Map(rows.map((r) => [r.path, r.sha]));
  }

  /**
   * Replaces everything indexed from `path` with a fresh extraction, atomically.
   * Entities whose key already belongs to another file are skipped and returned.
   */
  replaceFile(path: string, sha: string, layer: Layer, result: ExtractResult): string[] {
    const skipped: string[] = [];
    this.db.transaction(() => {
      this.deleteFileRows(path);
      for (const e of result.entities) {
        const owner = this.db.get<{ file: string }>('SELECT file FROM entities WHERE key = ?', [
          e.key,
        ]);
        if (owner) {
          skipped.push(`${e.key} (already from ${owner.file})`);
          continue;
        }
        const isCopy = typeof e.data._copy === 'object' && e.data._copy !== null;
        this.db.exec(
          `INSERT INTO entities (key, type, name, source, page, edition, layer, file, raw, is_copy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.key,
            e.type,
            e.name,
            e.source,
            e.page,
            e.edition,
            layer,
            path,
            JSON.stringify(e.data),
            isCopy ? 1 : 0,
          ],
        );
      }
      for (const a of result.aux) {
        this.db.exec('INSERT OR REPLACE INTO aux (file, name, data) VALUES (?, ?, ?)', [
          path,
          a.name,
          JSON.stringify(a.data ?? null),
        ]);
      }
      this.db.exec(
        `INSERT OR REPLACE INTO files (path, sha, layer, entities, indexed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [path, sha, layer, result.entities.length - skipped.length, new Date().toISOString()],
      );
    });
    return skipped;
  }

  removeFile(path: string): void {
    this.db.transaction(() => {
      this.deleteFileRows(path);
      this.db.exec('DELETE FROM files WHERE path = ?', [path]);
    });
  }

  private deleteFileRows(path: string): void {
    this.db.exec('DELETE FROM entities WHERE file = ?', [path]);
    this.db.exec('DELETE FROM aux WHERE file = ?', [path]);
  }

  /** Removes every file of a layer (or everything). */
  clear(layer?: Layer): void {
    this.db.transaction(() => {
      if (layer) {
        for (const path of this.fileShas(layer).keys()) this.removeFile(path);
      } else {
        for (const table of ['entities', 'aux', 'files', 'sources']) {
          this.db.exec(`DELETE FROM ${table}`);
        }
        this.db.exec("DELETE FROM meta WHERE key <> 'schema_version'");
      }
    });
  }

  // endregion

  // region Aux

  getAux(file: string, name: string): unknown {
    const row = this.db.get<{ data: string }>('SELECT data FROM aux WHERE file = ? AND name = ?', [
      file,
      name,
    ]);
    return row ? (JSON.parse(row.data) as unknown) : undefined;
  }

  setRegistry(sha: string, registry: Map<string, RegistryEntry>): void {
    this.replaceFile(REGISTRY_FILE, sha, '5etools', {
      entities: [],
      aux: [{ name: REGISTRY_AUX, data: [...registry.entries()] }],
      issues: [],
    });
  }

  getRegistry(): Map<string, RegistryEntry> {
    const entries = this.getAux(REGISTRY_FILE, REGISTRY_AUX) as
      [string, RegistryEntry][] | undefined;
    return new Map(entries ?? []);
  }

  // endregion

  // region Context: editions and content ids derived from book/adventure metadata

  private metadataSources(): { sources: SourceInfo[]; contentIds: Map<string, string> } {
    const rows = this.db.all<{ type: string; raw: string }>(
      "SELECT type, raw FROM entities WHERE type IN ('book', 'adventure')",
    );
    const sources: SourceInfo[] = [];
    const contentIds = new Map<string, string>();
    for (const row of rows) {
      const kind = row.type as 'book' | 'adventure';
      const meta = JSON.parse(row.raw) as RawEntity;
      const source = sourceFromMetadata(kind, meta);
      if (!source) continue;
      sources.push(source);
      if (typeof meta.id === 'string')
        contentIds.set(`${kind}:${meta.id.toLowerCase()}`, source.id);
    }
    return { sources, contentIds };
  }

  /** Extraction context from what is currently indexed (metadata files + source registry). */
  extractContext(extraSources: Iterable<SourceInfo> = []): ExtractContext {
    const { sources, contentIds } = this.metadataSources();
    const registry = this.getRegistry();
    const known = indexSources(
      buildSourceCatalog({
        metadata: [...sources, ...extraSources],
        registry,
        seen: registry.keys(),
      }),
    );
    return {
      sourceEdition: (s) => known.get(s.toLowerCase())?.edition,
      contentSource: (kind, id) => contentIds.get(`${kind}:${id.toLowerCase()}`),
    };
  }

  /** Re-derives every entity's edition (after metadata or the registry changed). */
  recomputeEditions(ctx: ExtractContext): number {
    let changed = 0;
    this.db.transaction(() => {
      const rows = this.db.all<{
        key: string;
        source: string;
        edition: string;
        raw: string;
        type: string;
      }>('SELECT key, source, edition, raw, type FROM entities');
      for (const row of rows) {
        const sourceEdition = ctx.sourceEdition(row.source);
        const edition =
          row.type === 'bookData' || row.type === 'adventureData'
            ? (sourceEdition ?? '2014')
            : entityEdition(JSON.parse(row.raw) as RawEntity, sourceEdition);
        if (edition !== row.edition) {
          this.db.exec('UPDATE entities SET edition = ? WHERE key = ?', [edition, row.key]);
          changed++;
        }
      }
    });
    return changed;
  }

  // endregion

  // region Copies

  /**
   * Resolves `_copy` entities (all, or one layer's); returns the ones that failed (they keep
   * their raw form). Official data never copies homebrew, so a homebrew change only needs its own.
   */
  resolveCopies(layer?: Layer): string[] {
    const errors: string[] = [];
    const lookup = (_type: string, key: string) => this.getRaw(key);
    const resolver = new CopyResolver(lookup);
    const rows = this.db.all<{ key: string; type: string; raw: string }>(
      `SELECT key, type, raw FROM entities WHERE is_copy = 1${layer ? ' AND layer = ?' : ''}`,
      layer ? [layer] : [],
    );
    this.db.transaction(() => {
      for (const row of rows) {
        try {
          const data = resolver.resolve(row.type, row.key, JSON.parse(row.raw) as RawEntity);
          this.db.exec('UPDATE entities SET resolved = ? WHERE key = ?', [
            JSON.stringify(data),
            row.key,
          ]);
        } catch (error) {
          if (!(error instanceof CopyError)) throw error;
          errors.push(error.message);
          this.db.exec('UPDATE entities SET resolved = NULL WHERE key = ?', [row.key]);
        }
      }
    });
    return errors;
  }

  // endregion

  // region Sources

  /** Rebuilds the source list from metadata, the registry, homebrew sources and entity usage. */
  rebuildSources(homebrewSources: Iterable<SourceInfo> = []): void {
    const { sources: metadata } = this.metadataSources();
    const counts = this.db.all<{ source: string; n: number }>(
      'SELECT source, COUNT(*) AS n FROM entities GROUP BY source COLLATE NOCASE',
    );
    const catalog = buildSourceCatalog({
      metadata: [...metadata, ...homebrewSources],
      registry: this.getRegistry(),
      seen: counts.map((c) => c.source),
    });
    const countBySource = new Map(counts.map((c) => [c.source.toLowerCase(), c.n]));
    this.db.transaction(() => {
      this.db.exec('DELETE FROM sources');
      for (const s of catalog) {
        this.db.exec(
          `INSERT OR REPLACE INTO sources (id, name, kind, grp, published, edition, playtest, entities)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.name,
            s.kind,
            s.group,
            s.published ?? null,
            s.edition ?? null,
            s.playtest ? 1 : 0,
            countBySource.get(s.id.toLowerCase()) ?? 0,
          ],
        );
      }
    });
  }

  listSources(): SourceSummary[] {
    const rows = this.db.all<{
      id: string;
      name: string;
      kind: SourceInfo['kind'];
      grp: string;
      published: string | null;
      edition: Edition | null;
      playtest: number;
      entities: number;
    }>('SELECT * FROM sources ORDER BY name COLLATE NOCASE');
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      group: r.grp,
      ...(r.published ? { published: r.published } : {}),
      ...(r.edition ? { edition: r.edition } : {}),
      playtest: r.playtest === 1,
      entities: r.entities,
    }));
  }

  // endregion

  // region Reads

  getRaw(key: string): RawEntity | undefined {
    const row = this.db.get<{ raw: string }>('SELECT raw FROM entities WHERE key = ?', [key]);
    return row ? (JSON.parse(row.raw) as RawEntity) : undefined;
  }

  getEntity(key: string): EntityDetail | undefined {
    const row = this.db.get<EntitySummary & { raw: string; resolved: string | null }>(
      `SELECT ${SUMMARY_COLUMNS}, raw, resolved FROM entities WHERE key = ?`,
      [key],
    );
    if (!row) return undefined;
    const { raw, resolved, ...summary } = row;
    return { ...summary, data: JSON.parse(resolved ?? raw) as RawEntity };
  }

  /**
   * The first candidate that exists. A `*` in a candidate matches any run of characters within
   * one identity part (link tags that omit a parent source or pantheon).
   */
  resolveCandidates(candidates: readonly string[]): string | undefined {
    for (const candidate of candidates) {
      if (!candidate.includes('*')) {
        if (this.hasKey(candidate)) return candidate;
        continue;
      }
      const pattern = likeEscape(candidate).replaceAll('*', '%');
      const row = this.db.get<{ key: string }>(
        "SELECT key FROM entities WHERE key LIKE ? ESCAPE '\\' ORDER BY key LIMIT 1",
        [pattern],
      );
      if (row) return row.key;
    }
    return undefined;
  }

  hasKey(key: string): boolean {
    return this.db.get('SELECT 1 AS x FROM entities WHERE key = ?', [key]) !== undefined;
  }

  countsByType(): Record<string, number> {
    const rows = this.db.all<{ type: string; n: number }>(
      'SELECT type, COUNT(*) AS n FROM entities GROUP BY type ORDER BY type',
    );
    return Object.fromEntries(rows.map((r) => [r.type, r.n]));
  }

  totalEntities(): number {
    return this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM entities')?.n ?? 0;
  }

  /** Name search with prefix matching; best matches first, exact names before partial ones. */
  search(text: string, options: SearchOptions = {}): EntitySummary[] {
    const fts = toFtsQuery(text);
    if (!fts) return [];
    const where: string[] = ['entity_search MATCH ?'];
    const params: SqlValue[] = [fts];
    if (options.types?.length) {
      where.push(`e.type IN (${placeholders(options.types.length)})`);
      params.push(...options.types);
    }
    const excluded = options.excludeTypes ?? (options.types ? [] : DEFAULT_EXCLUDED_TYPES);
    if (excluded.length) {
      where.push(`e.type NOT IN (${placeholders(excluded.length)})`);
      params.push(...excluded);
      where.push("e.type NOT LIKE '%Fluff'");
    }
    if (options.sources) {
      if (options.sources.length === 0) return [];
      where.push(`e.source COLLATE NOCASE IN (${placeholders(options.sources.length)})`);
      params.push(...options.sources);
    }
    if (options.excludeSources?.length) {
      where.push(`e.source COLLATE NOCASE NOT IN (${placeholders(options.excludeSources.length)})`);
      params.push(...options.excludeSources);
    }
    params.push(text.trim(), options.limit ?? 50);
    return this.db.all<EntitySummary>(
      `SELECT ${SUMMARY_COLUMNS.split(', ')
        .map((c) => `e.${c}`)
        .join(', ')}
       FROM entity_search
       JOIN entities e ON e.rowid = entity_search.rowid
       WHERE ${where.join(' AND ')}
       ORDER BY (e.name = ? COLLATE NOCASE) DESC, bm25(entity_search), length(e.name), e.name
       LIMIT ?`,
      params,
    );
  }

  /**
   * Other entities that could stand in for a missing key: the same identity from another
   * source first (e.g. a reprint), then same-type name matches.
   */
  alternatives(key: string, limit = 3): EntitySummary[] {
    const parsed = parseKey(key);
    if (!parsed) return [];
    const sameIdentity = this.db.all<EntitySummary>(
      `SELECT ${SUMMARY_COLUMNS} FROM entities
       WHERE key LIKE ? ESCAPE '\\' AND key <> ?
       ORDER BY edition DESC, source
       LIMIT ?`,
      [`${likeEscape(`${parsed.type}:${parsed.identity}@`)}%`, key, limit],
    );
    if (sameIdentity.length > 0) return sameIdentity;
    const name = parsed.identity.split('|')[0] ?? parsed.identity;
    const type = this.db.get<{ type: string }>(
      'SELECT type FROM entities WHERE lower(type) = ? LIMIT 1',
      [parsed.type],
    )?.type;
    return type ? this.search(name, { types: [type], limit }) : [];
  }

  // endregion

  // region Lists

  /** Rows for a compendium list (all sources; the UI filters by enabled sources). */
  listRows(category: Category): ListRow[] {
    const lookupCache = new Map<string, Record<string, unknown> | undefined>();
    const spellClasses = spellClassLookup((source) => {
      if (!lookupCache.has(source)) {
        lookupCache.set(
          source,
          this.getAux(SPELL_LOOKUP_FILE, source) as Record<string, unknown> | undefined,
        );
      }
      return lookupCache.get(source);
    });
    const rows = this.db.all<EntitySummary & { raw: string; resolved: string | null }>(
      `SELECT ${SUMMARY_COLUMNS}, raw, resolved FROM entities
       WHERE type IN (${placeholders(category.types.length)})`,
      [...category.types],
    );
    return rows.map(({ raw, resolved, ...summary }) =>
      buildRow({ ...summary, data: JSON.parse(resolved ?? raw) as RawEntity }, { spellClasses }),
    );
  }

  /** Entity counts per list category, for the compendium landing page. */
  countTypes(types: readonly string[]): number {
    return (
      this.db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM entities WHERE type IN (${placeholders(types.length)})`,
        [...types],
      )?.n ?? 0
    );
  }

  // endregion
}

/** 5etools' generated spell → class lookup, kept as aux data keyed by source. */
const SPELL_LOOKUP_FILE = 'data/generated/gendata-spell-source-lookup.json';

function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
