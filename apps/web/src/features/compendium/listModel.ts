import type { Category, FieldDef, FieldValue, ListRow } from '@boh/data5e';

/**
 * Pure list logic: filter state (kept in the URL so tabs, back/forward and reloads keep it),
 * filtering, sorting, value counts and cell text. Rows come from the data worker.
 */

export interface ListState {
  /** Text typed in the list's search box. */
  q: string;
  /** Selected values per field id; a row matches a field if it has any selected value. */
  filters: Record<string, string[]>;
  sort: string;
  dir: 'asc' | 'desc';
  /** The entry expanded in place in the list. */
  sel: string | null;
}

export const SOURCE_FIELD = 'source';

/** URL search params ↔ state. Filters use `f.<field>=a~b` (values never contain `~`). */
export function stateFromSearch(search: Record<string, unknown>, category: Category): ListState {
  const filters: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(search)) {
    if (k.startsWith('f.') && typeof v === 'string' && v) filters[k.slice(2)] = v.split('~');
  }
  const sort = typeof search.sort === 'string' ? search.sort : (category.defaultSort ?? 'name');
  return {
    q: typeof search.q === 'string' ? search.q : '',
    filters,
    sort,
    dir: search.dir === 'desc' ? 'desc' : 'asc',
    sel: typeof search.sel === 'string' ? search.sel : null,
  };
}

export function searchFromState(state: ListState, category: Category): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.q) out.q = state.q;
  for (const [k, values] of Object.entries(state.filters))
    if (values.length) out[`f.${k}`] = values.join('~');
  if (state.sort !== (category.defaultSort ?? 'name')) out.sort = state.sort;
  if (state.dir === 'desc') out.dir = 'desc';
  if (state.sel) out.sel = state.sel;
  return out;
}

/** The comparable / filterable values of a field on a row, as strings. */
export function valuesOf(row: ListRow, fieldId: string): string[] {
  if (fieldId === SOURCE_FIELD) return [row.source];
  const v: FieldValue | undefined = row.f[fieldId];
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'boolean') return [v ? 'yes' : 'no'];
  return [String(v)];
}

function normalise(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function filterRows(
  rows: readonly ListRow[],
  state: ListState,
  disabledSources: ReadonlySet<string>,
): ListRow[] {
  const words = normalise(state.q).split(/\s+/).filter(Boolean);
  const active = Object.entries(state.filters).filter(([, values]) => values.length > 0);
  return rows.filter((row) => {
    if (disabledSources.has(row.source.toLowerCase())) return false;
    // Thousands of "+1 Longsword"-style items: shown when looked for by name, not when browsing.
    if (row.generated === true && words.length === 0) return false;
    if (words.length) {
      const name = normalise(row.name);
      if (!words.every((w) => name.includes(w))) return false;
    }
    for (const [field, wanted] of active) {
      const have = valuesOf(row, field);
      if (!have.some((v) => wanted.includes(v))) return false;
    }
    return true;
  });
}

function compare(a: FieldValue | undefined, b: FieldValue | undefined): number {
  const empty = (v: FieldValue | undefined) =>
    v === null || v === undefined || (Array.isArray(v) && v.length === 0);
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1; // blanks last
  if (empty(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(b) - Number(a);
  const sa = Array.isArray(a) ? a.join(', ') : String(a);
  const sb = Array.isArray(b) ? b.join(', ') : String(b);
  return sa.localeCompare(sb, 'en', { numeric: true, sensitivity: 'base' });
}

export function sortRows(rows: ListRow[], state: ListState, category: Category): ListRow[] {
  const field = category.fields.find((f) => f.id === state.sort);
  const order = field?.order;
  const sign = state.dir === 'desc' ? -1 : 1;
  const byName = (a: ListRow, b: ListRow) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    let c: number;
    if (state.sort === 'name') c = byName(a, b);
    else if (state.sort === SOURCE_FIELD) c = a.source.localeCompare(b.source);
    else if (order && field.kind === 'enum') {
      const ia = order.indexOf(String(a.f[field.id]));
      const ib = order.indexOf(String(b.f[field.id]));
      c = (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    } else c = compare(a.f[state.sort], b.f[state.sort]);
    if (c !== 0) return sign * c;
    // Ties by name; for the same name the newer edition first, above its Legacy twin.
    return byName(a, b) || b.edition.localeCompare(a.edition) || a.source.localeCompare(b.source);
  });
}

/** Distinct values of a field with how many rows have each, in display order. */
export function valueCounts(
  rows: readonly ListRow[],
  field: FieldDef | { id: string; kind: 'enum'; order?: readonly string[] },
): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const v of valuesOf(row, field.id)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const entries = [...counts.entries()];
  const order = field.order;
  return entries.sort(([a], [b]) => {
    if (field.kind === 'number') return Number(a) - Number(b);
    if (field.kind === 'bool') return a === 'yes' ? -1 : 1;
    const ia = order ? order.indexOf(a) : -1;
    const ib = order ? order.indexOf(b) : -1;
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b, 'en', { numeric: true });
  });
}

const FRACTION_CR: Record<string, string> = { '0.125': '1/8', '0.25': '1/4', '0.5': '1/2' };

const ORDINAL_SUFFIX = ['th', 'st', 'nd', 'rd'];

function ordinal(n: number): string {
  const v = n % 100;
  return `${String(n)}${ORDINAL_SUFFIX[(v - 20) % 10] ?? ORDINAL_SUFFIX[v] ?? 'th'}`;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** How a value is shown in filters and cells. */
export function valueLabel(fieldId: string, value: string): string {
  if (fieldId === 'level') return value === '0' ? 'Cantrip' : ordinal(Number(value));
  if (fieldId === 'cr') return FRACTION_CR[value] ?? value;
  if (fieldId === 'rarity') return value === 'none' ? 'Mundane' : titleCase(value);
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return value;
}

export function cellText(row: ListRow, field: FieldDef): string {
  if (field.display !== undefined) {
    const shown = row.f[field.display];
    if (typeof shown === 'string') return shown;
  }
  const v = row.f[field.id];
  if (v === null || v === undefined) return '';
  if (field.id === 'cr') return valueLabel('cr', String(v));
  if (field.id === 'level' || field.id === 'rarity') return valueLabel(field.id, String(v));
  if (field.id === 'value' && typeof v === 'number')
    return v >= 1 ? v.toLocaleString('en-US') : String(v);
  if (typeof v === 'boolean') return v ? '✓' : '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}
