import { parse as parseYaml } from 'yaml';
import {
  compareValues,
  equals,
  evaluate,
  fileName,
  parseExpr,
  propertyOf,
  truthy,
  valueText,
  type EvalContext,
  type Expr,
  type NoteInfo,
  type Value,
} from './expr';

/**
 * Obsidian Bases (`.base` files and ```base blocks): YAML describing views (table, cards, list)
 * over the notes, with filters, sorting and grouping. Also reads the variants found in real
 * vaults: a `columns:` list of `{name, key}` instead of `order:`, `=` for `==`, and property
 * names that differ in case from the notes'.
 */

export type Filter = string | { and: Filter[] } | { or: Filter[] } | { not: Filter[] };

export interface Column {
  /** `file.name`, `role`, `file.tags`… (`note.` is dropped). */
  key: string;
  name: string;
}

export interface BaseView {
  type: 'table' | 'cards' | 'list';
  name: string;
  filters?: Filter;
  columns: Column[];
  sort: { property: string; direction: 'ASC' | 'DESC' }[];
  groupBy?: { property: string; direction: 'ASC' | 'DESC' };
  limit?: number;
  /** Cards: the property holding each card's image. */
  image?: string;
}

export interface BaseFile {
  filters?: Filter;
  views: BaseView[];
  /** Set when the YAML cannot be read; `views` is then empty. */
  error?: string;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const columnKey = (key: string) => key.trim().replace(/^note\./, '');

function readFilter(raw: unknown): Filter | undefined {
  if (typeof raw === 'string') return raw;
  const r = asRecord(raw);
  for (const op of ['and', 'or', 'not'] as const) {
    const list = r[op];
    if (Array.isArray(list)) {
      const items = list.map(readFilter).filter((f): f is Filter => f !== undefined);
      return op === 'and' ? { and: items } : op === 'or' ? { or: items } : { not: items };
    }
  }
  return undefined;
}

const direction = (d: unknown): 'ASC' | 'DESC' =>
  typeof d === 'string' && d.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

/** The name shown for a column without a display name. */
export function defaultColumnName(key: string): string {
  if (key === 'file.name') return 'Name';
  const words = (key.startsWith('file.') ? key.slice(5) : key).replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function parseBase(text: string): BaseFile {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    return { views: [], error: error instanceof Error ? error.message : String(error) };
  }
  const root = asRecord(raw);
  const props = asRecord(root.properties);
  const displayName = (key: string): string | undefined => {
    const entry = asRecord(props[key] ?? props[`note.${key}`]);
    return typeof entry.displayName === 'string' ? entry.displayName : undefined;
  };
  const views = (Array.isArray(root.views) ? root.views : []).map((v, i): BaseView => {
    const view = asRecord(v);
    const legacy = Array.isArray(view.columns) ? view.columns.map(asRecord) : null;
    const columns: Column[] = legacy
      ? legacy
          .filter((c) => typeof c.key === 'string')
          .map((c) => {
            const key = columnKey(String(c.key));
            return {
              key,
              name:
                typeof c.name === 'string' ? c.name : (displayName(key) ?? defaultColumnName(key)),
            };
          })
      : (Array.isArray(view.order) ? view.order : [])
          .filter((k): k is string => typeof k === 'string')
          .map((k) => {
            const key = columnKey(k);
            return { key, name: displayName(key) ?? defaultColumnName(key) };
          });
    const group = asRecord(view.groupBy);
    const type = view.type === 'cards' || view.type === 'list' ? view.type : 'table';
    const out: BaseView = {
      type,
      name: typeof view.name === 'string' ? view.name : `View ${String(i + 1)}`,
      columns: columns.length > 0 ? columns : [{ key: 'file.name', name: 'Name' }],
      sort: (Array.isArray(view.sort) ? view.sort : [])
        .map(asRecord)
        .filter((s) => typeof s.property === 'string')
        .map((s) => ({
          property: columnKey(String(s.property)),
          direction: direction(s.direction),
        })),
    };
    const filters = readFilter(view.filters);
    if (filters) out.filters = filters;
    if (typeof group.property === 'string') {
      out.groupBy = { property: columnKey(group.property), direction: direction(group.direction) };
    }
    if (typeof view.limit === 'number') out.limit = view.limit;
    if (typeof view.image === 'string') out.image = columnKey(view.image);
    return out;
  });
  const base: BaseFile = {
    views:
      views.length > 0
        ? views
        : [
            {
              type: 'table',
              name: 'Table',
              columns: [{ key: 'file.name', name: 'Name' }],
              sort: [],
            },
          ],
  };
  const filters = readFilter(root.filters);
  if (filters) base.filters = filters;
  return base;
}

const parsed = new Map<string, Expr | Error>();

function compile(src: string): Expr {
  let e = parsed.get(src);
  if (!e) {
    try {
      e = parseExpr(src);
    } catch (error) {
      e = error instanceof Error ? error : new Error(String(error));
    }
    parsed.set(src, e);
  }
  if (e instanceof Error) throw new Error(`In “${src}”: ${e.message}`);
  return e;
}

export function matches(filter: Filter | undefined, ctx: EvalContext): boolean {
  if (filter === undefined) return true;
  if (typeof filter === 'string') return truthy(evaluate(compile(filter), ctx));
  if ('and' in filter) return filter.and.every((f) => matches(f, ctx));
  if ('or' in filter) return filter.or.some((f) => matches(f, ctx));
  return !filter.not.some((f) => matches(f, ctx));
}

/** A column's value for a note. */
export function columnValue(key: string, ctx: EvalContext): Value {
  if (key.startsWith('file.') || key.startsWith('this.')) return evaluate(compile(key), ctx);
  if (key.startsWith('formula.')) return null;
  return propertyOf(ctx.note, key);
}

export interface BaseRow {
  path: string;
  values: Value[];
}

export interface BaseGroup {
  /** The group's value as text ('' for notes without one). */
  label: string;
  rows: BaseRow[];
}

export interface BaseResult {
  columns: Column[];
  groups: BaseGroup[];
  total: number;
  /** A filter that could not be read; the view then shows nothing. */
  error?: string;
}

export interface RunOptions {
  /** The note a ```base block is in: `this` in filters. */
  self?: NoteInfo | undefined;
  resolve: (target: string, from: string) => string | null;
  /** Overrides the view's sort (a clicked column header). */
  sort?: { property: string; direction: 'ASC' | 'DESC' } | undefined;
  /** Only rows whose text contains this. */
  search?: string | undefined;
}

export function runView(
  base: BaseFile,
  view: BaseView,
  notes: readonly NoteInfo[],
  options: RunOptions,
): BaseResult {
  const ctxFor = (note: NoteInfo): EvalContext => ({
    note,
    self: options.self,
    resolve: options.resolve,
  });
  let rows: { note: NoteInfo; ctx: EvalContext }[];
  try {
    rows = notes
      .map((note) => ({ note, ctx: ctxFor(note) }))
      .filter(({ ctx }) => matches(base.filters, ctx) && matches(view.filters, ctx));
  } catch (error) {
    return {
      columns: view.columns,
      groups: [],
      total: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const sorts = options.sort ? [options.sort] : view.sort;
  const keyed = rows.map(({ note, ctx }) => ({
    note,
    ctx,
    sortValues: sorts.map((s) => columnValue(s.property, ctx)),
    values: view.columns.map((c) => columnValue(c.key, ctx)),
  }));
  keyed.sort((a, b) => {
    for (let i = 0; i < sorts.length; i++) {
      const c = compareValues(a.sortValues[i] ?? null, b.sortValues[i] ?? null);
      if (c !== 0) return sorts[i]?.direction === 'DESC' ? -c : c;
    }
    return fileName(a.note.path).localeCompare(fileName(b.note.path), 'en', { numeric: true });
  });

  const search = options.search?.trim().toLowerCase();
  const visible = search
    ? keyed.filter((r) =>
        [fileName(r.note.path), ...r.values.map(valueText)].some((t) =>
          t.toLowerCase().includes(search),
        ),
      )
    : keyed;
  const limited = view.limit ? visible.slice(0, view.limit) : visible;

  const groups: BaseGroup[] = [];
  if (view.groupBy) {
    const { property, direction: dir } = view.groupBy;
    const byLabel = new Map<string, { value: Value; rows: BaseRow[] }>();
    for (const r of limited) {
      const value = columnValue(property, r.ctx);
      const label = valueText(value);
      const existing = [...byLabel.entries()].find(([, g]) => equals(g.value, value, r.ctx));
      const group = existing?.[1] ?? { value, rows: [] };
      if (!existing) byLabel.set(label, group);
      group.rows.push({ path: r.note.path, values: r.values });
    }
    // Notes without a value come last, whichever way the groups are sorted.
    const sorted = [...byLabel.entries()].sort(([la, a], [lb, b]) => {
      if (!la || !lb) return Number(!la) - Number(!lb);
      const c = compareValues(a.value, b.value);
      return dir === 'DESC' ? -c : c;
    });
    for (const [label, g] of sorted) groups.push({ label, rows: g.rows });
  } else {
    groups.push({ label: '', rows: limited.map((r) => ({ path: r.note.path, values: r.values })) });
  }
  return { columns: view.columns, groups, total: limited.length };
}

/**
 * Properties a new note made from a view should start with, so it shows up there: the
 * `property == value` conditions of the view's (and base's) `and` filters.
 */
export function propertiesForNew(
  base: BaseFile,
  view: BaseView,
  /** The name of the note a block is in: `location.contains(this)` gives `location: [[It]]`. */
  selfName?: string,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const visit = (f: Filter | undefined) => {
    if (f === undefined) return;
    if (typeof f === 'string') {
      const self =
        /^\s*(?:note\.)?([\p{L}_][\p{L}\p{N}_-]*)\s*(?:==?\s*this|\.contains\(\s*this\s*\))\s*$/u.exec(
          f,
        );
      if (self?.[1] && selfName) {
        out[self[1]] = `[[${selfName}]]`;
        return;
      }
      const m =
        /^\s*(?:note\.)?([\p{L}_][\p{L}\p{N}_-]*)\s*==?\s*(?:"([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?)|(true|false))\s*$/u.exec(
          f,
        );
      if (m?.[1]) {
        const key = m[1];
        if (m[2] !== undefined) out[key] = m[2];
        else if (m[3] !== undefined) out[key] = m[3];
        else if (m[4] !== undefined) out[key] = Number(m[4]);
        else if (m[5] !== undefined) out[key] = m[5] === 'true';
      }
      return;
    }
    if ('and' in f) f.and.forEach(visit);
  };
  visit(base.filters);
  visit(view.filters);
  return out;
}
