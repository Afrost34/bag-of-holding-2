import { entityEdition, type Edition } from './editions';
import { contentFile, yieldsEntities } from './files';
import { identify, type RawEntity } from './identity';
import { makeKey, type EntityKey } from './keys';

export interface EntityRecord {
  key: EntityKey;
  /** 5etools array name, e.g. `spell`, `monster`, `classFeature`, `bookData`. */
  type: string;
  name: string;
  source: string;
  page: number | null;
  edition: Edition;
  data: RawEntity;
}

/** File-level data that is not a list of entities (`_meta`, generator tables, lookups…). */
export interface AuxRecord {
  name: string;
  data: unknown;
}

export interface ExtractIssue {
  file: string;
  kind: 'unidentified' | 'duplicate' | 'not-an-object';
  detail: string;
}

export interface ExtractResult {
  entities: EntityRecord[];
  aux: AuxRecord[];
  issues: ExtractIssue[];
}

export interface ExtractContext {
  /** Edition of a source code (`XPHB` → 2024), when known. */
  sourceEdition: (source: string) => Edition | undefined;
  /**
   * Source code of a book/adventure content file by its id (`ps-a` → `PSA`). Ids and source codes
   * differ for a few books; falls back to the uppercased id.
   */
  contentSource?: (kind: 'book' | 'adventure', id: string) => string | undefined;
}

const isObject = (value: unknown): value is RawEntity =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A `_copy` entity may omit identity fields it inherits from its parent (e.g. a subrace's
 * `raceName`). Fill those from `_copy`, never its name or source.
 */
function identityProbe(item: RawEntity): RawEntity {
  if (!isObject(item._copy)) return item;
  const { name: _name, source: _source, _mod, _templates, _preserve, ...inherited } = item._copy;
  return { ...inherited, ...item };
}

/**
 * Splits one 5etools JSON file into entities and auxiliary data. Generic over entity types:
 * any top-level array of objects that can be identified becomes entities of that type, so new
 * 5etools types are picked up without code changes. Nothing is dropped: everything else is kept
 * as aux data.
 */
export function extractFile(path: string, json: unknown, ctx: ExtractContext): ExtractResult {
  const result: ExtractResult = { entities: [], aux: [], issues: [] };
  if (!isObject(json)) {
    result.aux.push({ name: '$root', data: json });
    return result;
  }

  const content = contentFile(path);
  if (content && Array.isArray(json.data)) {
    const id = content.id;
    const type = content.kind === 'book' ? 'bookData' : 'adventureData';
    const source = ctx.contentSource?.(content.kind, id) ?? id.toUpperCase();
    result.entities.push({
      key: makeKey(type, [id], source),
      type,
      name: id,
      source,
      page: null,
      edition: ctx.sourceEdition(source) ?? '2014',
      data: { id, data: json.data },
    });
    for (const [name, value] of Object.entries(json)) {
      if (name !== 'data') result.aux.push({ name, data: value });
    }
    return result;
  }

  const seen = new Set<string>();
  for (const [type, value] of Object.entries(json)) {
    if (
      !yieldsEntities(path) ||
      type.startsWith('_') ||
      !Array.isArray(value) ||
      !value.some(isObject)
    ) {
      result.aux.push({ name: type, data: value });
      continue;
    }

    const records: EntityRecord[] = [];
    const leftovers: unknown[] = [];
    for (const item of value as unknown[]) {
      if (!isObject(item)) {
        leftovers.push(item);
        continue;
      }
      const id = identify(type, identityProbe(item));
      if (!id) {
        leftovers.push(item);
        continue;
      }
      if (seen.has(id.key)) {
        result.issues.push({ file: path, kind: 'duplicate', detail: id.key });
        continue;
      }
      seen.add(id.key);
      records.push({
        key: id.key,
        type,
        name: id.name,
        source: id.source,
        page: typeof item.page === 'number' ? item.page : null,
        edition: entityEdition(item, ctx.sourceEdition(id.source)),
        data: item,
      });
    }

    if (records.length === 0) {
      // Arrays of unnamed rows (loot tables, trinkets…) are data, not entities.
      result.aux.push({ name: type, data: value });
      continue;
    }
    result.entities.push(...records);
    if (leftovers.length > 0) {
      result.issues.push({
        file: path,
        kind: 'unidentified',
        detail: `${type}: ${String(leftovers.length)} item(s) without a usable identity`,
      });
      result.aux.push({ name: `${type}$unidentified`, data: leftovers });
    }
  }
  return result;
}
