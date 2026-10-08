import {
  evaluate,
  requiredInputs,
  secureRng,
  tryParse,
  type Expression,
  type Rng,
} from '@boh/dice';
import { newId } from '../cards/model';

/**
 * Roll tables: loot, a shop's wares, or random encounters for a region.
 *
 *   tables/<id>.json                       tables kept outside any campaign
 *   campaigns/<campaign>/tables/<id>.json  a campaign's tables
 *
 * A row is a compendium entry (`item:longsword@xphb`, `monster:goblin@xphb`) or some text, with
 * an optional count in dice (`2d6`, `3d6*10`) and, in shops, a price. Rows have a weight: a row
 * of weight 3 comes up three times as often as a row of weight 1, and takes three numbers on
 * the die.
 *
 * A table is linked to what it belongs to: journal notes (an NPC, a location: the region of an
 * encounter table), encounters and creatures. Each of those then shows the table, ready to roll.
 */

export const TABLES_DIR = 'tables';

export type TableKind = 'loot' | 'shop' | 'encounter';

export const TABLE_KINDS: readonly { id: TableKind; label: string; entry: string }[] = [
  { id: 'loot', label: 'Loot', entry: 'item' },
  { id: 'shop', label: 'Shop', entry: 'item' },
  { id: 'encounter', label: 'Random encounters', entry: 'monster' },
];

export interface TableRow {
  id: string;
  /** How many numbers it takes on the die (at least 1). */
  weight: number;
  /** A compendium entry. */
  key?: string;
  /** Shown instead of the entry's name, or after it ("led by a hobgoblin"). */
  text?: string;
  /** Dice for how many: `1d4`, `2d6*10`; one when absent. */
  count?: string;
  /** Shops: what it costs ("15 gp"); the item's own value when absent. */
  price?: string;
}

/**
 * What a table is linked to:
 *   `journal:<path>`  a note of the table's campaign
 *   `encounter:<id>`  an encounter
 *   anything else     a compendium entry (`monster:goblin@xphb`)
 */
export type TableLink = string;

export const noteLink = (path: string): TableLink => `journal:${path}`;
export const encounterLink = (id: string): TableLink => `encounter:${id}`;

export function describeLink(
  link: TableLink,
):
  | { kind: 'note'; path: string }
  | { kind: 'encounter'; id: string }
  | { kind: 'entity'; key: string } {
  if (link.startsWith('journal:')) return { kind: 'note', path: link.slice(8) };
  if (link.startsWith('encounter:')) return { kind: 'encounter', id: link.slice(10) };
  return { kind: 'entity', key: link };
}

export interface RollTable {
  version: 1;
  id: string;
  name: string;
  kind: TableKind;
  createdAt: string;
  updatedAt: string;
  rows: TableRow[];
  links: TableLink[];
  notes?: string;
  /** The campaign it belongs to; absent outside campaigns. Not stored: it is where the file is. */
  campaign?: string;
}

export function tableDir(campaign?: string): string {
  return campaign ? `campaigns/${campaign}/${TABLES_DIR}` : TABLES_DIR;
}

export function tablePath(id: string, campaign?: string): string {
  return `${tableDir(campaign)}/${id}.json`;
}

export function newTable(
  name: string,
  kind: TableKind,
  existingIds: readonly string[],
  now: string,
): RollTable {
  return {
    version: 1,
    id: newId(existingIds),
    name: name.trim() || (TABLE_KINDS.find((k) => k.id === kind)?.label ?? 'Table'),
    kind,
    createdAt: now,
    updatedAt: now,
    rows: [],
    links: [],
  };
}

/** Adds a row (a compendium entry or some text) at the end. */
export function addRow(table: RollTable, row: Omit<TableRow, 'id' | 'weight'>): RollTable {
  const clean: TableRow = {
    id: newId(table.rows.map((r) => r.id)),
    weight: 1,
    ...(row.key ? { key: row.key } : {}),
    ...(row.text?.trim() ? { text: row.text.trim() } : {}),
    ...(row.count?.trim() ? { count: row.count.trim() } : {}),
    ...(row.price?.trim() ? { price: row.price.trim() } : {}),
  };
  return { ...table, rows: [...table.rows, clean] };
}

/** Changes a row; empty text, count or price are removed, the weight stays 1–100. */
export function updateRow(
  table: RollTable,
  id: string,
  patch: Partial<Omit<TableRow, 'id'>>,
): RollTable {
  return {
    ...table,
    rows: table.rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      const text = next.text?.trim();
      const count = next.count?.trim();
      const price = next.price?.trim();
      return {
        id: r.id,
        weight: Math.max(1, Math.min(100, Math.round(next.weight) || 1)),
        ...(next.key ? { key: next.key } : {}),
        ...(text ? { text } : {}),
        ...(count ? { count } : {}),
        ...(price ? { price } : {}),
      };
    }),
  };
}

export function removeRow(table: RollTable, id: string): RollTable {
  return { ...table, rows: table.rows.filter((r) => r.id !== id) };
}

/** Moves a row up (-1) or down (+1). */
export function moveRow(table: RollTable, id: string, by: -1 | 1): RollTable {
  const i = table.rows.findIndex((r) => r.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= table.rows.length) return table;
  const rows = [...table.rows];
  rows.splice(j, 0, ...rows.splice(i, 1));
  return { ...table, rows };
}

export function addLink(table: RollTable, link: TableLink): RollTable {
  return table.links.includes(link) ? table : { ...table, links: [...table.links, link] };
}

export function removeLink(table: RollTable, link: TableLink): RollTable {
  return { ...table, links: table.links.filter((l) => l !== link) };
}

/** The tables linked to something, by name. */
export function tablesLinkedTo(tables: readonly RollTable[], link: TableLink): RollTable[] {
  return tables
    .filter((t) => t.links.includes(link))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** The die a table is rolled with: its rows' weights added up (`d20`, `d6`, `d7`…). */
export function tableDie(table: RollTable): number {
  return table.rows.reduce((n, r) => n + r.weight, 0);
}

/** The numbers each row takes on the die, in order: `1`, `2–4`… */
export function rowRanges(table: RollTable): { id: string; from: number; to: number }[] {
  let at = 1;
  return table.rows.map((r) => {
    const range = { id: r.id, from: at, to: at + r.weight - 1 };
    at += r.weight;
    return range;
  });
}

export const formatRange = (r: { from: number; to: number }) =>
  r.from === r.to ? String(r.from) : `${String(r.from)}–${String(r.to)}`;

/** Whether a count is dice the roller understands (`3`, `1d4`, `2d6*10`). */
/** The dice of a count, when it has nothing to ask (no variables or prompts). */
function countDice(count: string): Expression | null {
  const expr = tryParse(count.trim());
  if (!expr) return null;
  const inputs = requiredInputs(expr);
  return inputs.variables.length === 0 && inputs.prompts.length === 0 ? expr : null;
}

export function validCount(count: string): boolean {
  return countDice(count) !== null;
}

export interface TableRoll {
  /** The number on the table's die. */
  number: number;
  row: TableRow;
  /** How many came up (1 without a count). */
  count: number;
  /** How the count was rolled (`2d6 → [3, 5] = 8`), when it had dice. */
  countRoll?: string;
}

/** Rolls a table once; null when it has no rows. */
export function rollTable(table: RollTable, rng?: Rng): TableRoll | null {
  const die = tableDie(table);
  if (die === 0) return null;
  const number = (rng ?? secureRng)(die);
  const range = rowRanges(table).find((r) => number >= r.from && number <= r.to);
  const row = table.rows.find((r) => r.id === range?.id) ?? table.rows[0];
  if (!row) return null;
  const expr = row.count ? countDice(row.count) : null;
  if (!expr) return { number, row, count: 1 };
  const result = evaluate(expr, rng ? { rng } : {});
  return {
    number,
    row,
    count: Math.max(0, result.total),
    ...(result.terms.length > 0 ? { countRoll: result.breakdown } : {}),
  };
}

/** The creatures rolls bring, as entity keys repeated by count (for an encounter). */
export function creaturesOf(rolls: readonly TableRoll[]): string[] {
  return rolls.flatMap((r) =>
    r.row.key?.startsWith('monster:') ? Array<string>(Math.min(99, r.count)).fill(r.row.key) : [],
  );
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

export function parseTable(text: string | null, id: string, campaign?: string): RollTable | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(json)) return null;
  const kind = TABLE_KINDS.find((k) => k.id === json.kind)?.id ?? 'loot';
  const rows = (Array.isArray(json.rows) ? json.rows : []).flatMap((r, i): TableRow[] => {
    if (!isObj(r)) return [];
    const key = str(r.key);
    const text = str(r.text);
    if (!key && !text) return [];
    const count = str(r.count);
    const price = str(r.price);
    return [
      {
        id: str(r.id) ?? `r${String(i)}`,
        weight:
          typeof r.weight === 'number' && r.weight >= 1 ? Math.min(100, Math.round(r.weight)) : 1,
        ...(key ? { key } : {}),
        ...(text ? { text } : {}),
        ...(count ? { count } : {}),
        ...(price ? { price } : {}),
      },
    ];
  });
  const links = Array.isArray(json.links)
    ? json.links.filter((l): l is string => typeof l === 'string' && l.length > 0)
    : [];
  return {
    version: 1,
    id,
    name: typeof json.name === 'string' ? json.name : 'Table',
    kind,
    createdAt: typeof json.createdAt === 'string' ? json.createdAt : '',
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '',
    rows,
    links: [...new Set(links)],
    ...(typeof json.notes === 'string' ? { notes: json.notes } : {}),
    ...(campaign ? { campaign } : {}),
  };
}

export function serializeTable(table: RollTable): string {
  const { campaign: _campaign, ...rest } = table;
  return `${JSON.stringify(rest, null, 2)}\n`;
}

/** An item's value in copper (5etools `value`) as a price: `15 gp`, `5 sp`, `2 cp`. */
export function priceOfValue(copper: unknown): string | undefined {
  if (typeof copper !== 'number' || !(copper > 0)) return undefined;
  if (copper % 100 === 0) return `${(copper / 100).toLocaleString('en')} gp`;
  if (copper % 10 === 0) return `${String(copper / 10)} sp`;
  return `${String(copper)} cp`;
}
