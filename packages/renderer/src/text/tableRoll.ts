import { stripTags } from './splitTags';

/**
 * Random tables: a table whose first column is a die ("d8", "{@dice d100}") and whose rows start
 * with numbers or ranges ("1", "2–3", "96–00") can be rolled on.
 */

export interface RollableTable {
  /** Dice expression for the first column, e.g. `1d100`. */
  expression: string;
  /** Inclusive [min, max] per row, in row order. */
  ranges: [number, number][];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** "d8" / "1d6" / "{@dice 2d6}" → the expression, or null when the column is not a die. */
function dieOf(label: unknown): { expression: string; faces: number } | null {
  if (typeof label !== 'string') return null;
  const m = /^\s*(\d*)\s*d\s*(\d+)\s*$/i.exec(stripTags(label));
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const faces = Number(m[2]);
  return { expression: `${String(count)}d${String(faces)}`, faces };
}

/** "1", "2–3", "01-05", "96–00" (00 = 100 on a d100), "10+" → an inclusive range. */
export function parseRange(value: unknown, faces: number): [number, number] | null {
  if (typeof value === 'number') return [value, value];
  if (isObj(value) && value.type === 'cell' && isObj(value.roll)) {
    const roll = value.roll;
    if (typeof roll.exact === 'number') return [roll.exact, roll.exact];
    if (typeof roll.min === 'number' && typeof roll.max === 'number') return [roll.min, roll.max];
    return null;
  }
  if (typeof value !== 'string') return null;
  const text = stripTags(value).trim();
  const num = (s: string) => (s === '00' && faces === 100 ? 100 : Number(s));
  const plus = /^(\d+)\s*\+$/.exec(text);
  if (plus) return [num(plus[1] ?? '0'), Number.MAX_SAFE_INTEGER];
  const m = /^(\d+)(?:\s*[–—-]\s*(\d+))?$/.exec(text);
  if (!m) return null;
  const min = num(m[1] ?? '');
  const max = m[2] === undefined ? min : num(m[2]);
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;
}

export function rollableTable(entry: Obj): RollableTable | null {
  const labels = Array.isArray(entry.colLabels) ? entry.colLabels : [];
  const die = dieOf(labels[0]);
  const rows = Array.isArray(entry.rows) ? entry.rows : [];
  if (!die || rows.length === 0) return null;
  const ranges: [number, number][] = [];
  for (const row of rows) {
    const cells: unknown[] =
      isObj(row) && Array.isArray(row.row) ? row.row : Array.isArray(row) ? row : [];
    const range = parseRange(cells[0], die.faces);
    if (!range) return null;
    ranges.push(range);
  }
  return { expression: die.expression, ranges };
}

/** The row a total lands on, or -1. */
export function rowForTotal(table: RollableTable, total: number): number {
  return table.ranges.findIndex(([min, max]) => total >= min && total <= max);
}
