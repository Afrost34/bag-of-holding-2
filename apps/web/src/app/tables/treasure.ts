import { evaluate, secureRng, tryParse, type Rng } from '@boh/dice';

/**
 * Treasure by challenge rating, from the Dungeon Master's Guide tables in 5etools' `loot.json`
 * (2014: DMG, 2024: XDMG): an individual creature's pocket money, or a hoard with gems, art
 * objects and magic items. Pure: the tables come in through `TreasureTables`.
 */

export type TreasureKind = 'individual' | 'hoard';
export type Coin = 'cp' | 'sp' | 'ep' | 'gp' | 'pp';
export const COINS: readonly Coin[] = ['cp', 'sp', 'ep', 'gp', 'pp'];

/** A row of `loot.json`'s magic item tables. */
export interface MagicRow {
  min: number;
  max: number;
  item?: string;
  choose?: {
    fromItems?: string[];
    fromGroup?: string[];
    fromGeneric?: string[];
    fromMatching?: { rarity?: string };
  };
  /** A table inside the row ("roll a d8"): pick one of them. */
  table?: unknown[];
}

interface LootRow {
  min: number;
  max: number;
  coins?: Partial<Record<Coin, string>>;
  gems?: { type: number; amount: string };
  artObjects?: { type: number; amount: string };
  magicItems?: { type: string; amount: string }[];
}

/** An individual or hoard table of `loot.json`. */
export interface LootTable {
  name: string;
  source: string;
  crMin: number;
  crMax: number;
  coins?: Partial<Record<Coin, string>>;
  table: LootRow[];
}

export interface TreasureTables {
  /** Gemstones or art objects worth `value` gp each: their descriptions (5etools text). */
  valuables: (kind: 'gems' | 'artObjects', value: number) => string[] | undefined;
  /** A magic item table by its type (`A`, `arcana.rare`, `byLevel.1-4`). */
  magic: (type: string) => MagicRow[] | undefined;
  /** Magic items of a rarity (entity keys), for "any uncommon item" rows. */
  ofRarity: (rarity: string) => string[];
}

/** One thing found: 5etools text (with {@item} links) or a compendium entry. */
export type Found = { text: string } | { key: string };

export interface Treasure {
  /** The table it was rolled on ("Challenge 5-10 (DMG)"). */
  from: string;
  coins: Partial<Record<Coin, number>>;
  /** Gemstones and art objects, with what each is worth in gp. */
  valuables: { found: Found; value: number }[];
  magicItems: Found[];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses `loot.json` tables of a kind (rows it cannot read are left out). */
export function lootTables(data: unknown): LootTable[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((t): LootTable[] =>
    isObj(t) &&
    typeof t.name === 'string' &&
    typeof t.source === 'string' &&
    typeof t.crMin === 'number' &&
    typeof t.crMax === 'number' &&
    Array.isArray(t.table)
      ? [t as unknown as LootTable]
      : [],
  );
}

/** The table for a challenge rating, from the 2014 (DMG) or 2024 (XDMG) book. */
export function tableForCr(
  tables: readonly LootTable[],
  cr: number,
  edition: '2014' | '2024',
): LootTable | undefined {
  const source = edition === '2024' ? 'XDMG' : 'DMG';
  const ofBook = tables.filter((t) => t.source.toUpperCase() === source);
  const band = Math.max(0, Math.min(30, Math.floor(cr)));
  return ofBook.find((t) => band >= t.crMin && band <= t.crMax) ?? ofBook.at(-1);
}

const rollDice = (dice: string, rng: Rng): number => {
  const expr = tryParse(dice);
  return expr ? Math.max(0, evaluate(expr, { rng }).total) : 0;
};

const pick = <T>(list: readonly T[], rng: Rng): T | undefined =>
  list.length ? list[rng(list.length) - 1] : undefined;

/** The row of a d100 table the roll lands on. */
const rowFor = <R extends { min: number; max: number }>(rows: readonly R[], n: number) =>
  rows.find((r) => n >= r.min && n <= r.max);

/** A magic item table's `byLevel` table for 2024 hoards, by the hoard's challenge rating. */
export function byLevelType(crMin: number): string {
  if (crMin >= 17) return 'byLevel.17-20';
  if (crMin >= 11) return 'byLevel.11-16';
  if (crMin >= 5) return 'byLevel.5-10';
  return 'byLevel.1-4';
}

/** What a magic item table row gives. */
export function magicFromRow(
  row: MagicRow,
  source: string,
  tables: TreasureTables,
  rng: Rng,
): Found | undefined {
  const tag = (name: string) =>
    source.toUpperCase() === 'DMG' ? `{@item ${name}}` : `{@item ${name}|${source}}`;
  if (row.table?.length) {
    const inner = pick(row.table, rng);
    if (typeof inner === 'string') return { text: inner };
    if (isObj(inner) && typeof inner.item === 'string') return { text: inner.item };
  }
  if (row.item) return { text: row.item };
  const c = row.choose;
  if (!c) return undefined;
  if (c.fromItems?.length) {
    const name = pick(c.fromItems, rng);
    return name ? { text: tag(name) } : undefined;
  }
  const generic = c.fromGeneric?.[0] ?? c.fromGroup?.[0];
  if (generic) return { text: `${tag(generic)} (of your choice)` };
  if (c.fromMatching?.rarity) {
    const key = pick(tables.ofRarity(c.fromMatching.rarity), rng);
    return key ? { key } : { text: `Any ${c.fromMatching.rarity} magic item` };
  }
  return undefined;
}

/** Rolls a treasure table once. */
export function rollTreasure(
  table: LootTable,
  tables: TreasureTables,
  rng: Rng = secureRng,
): Treasure {
  const coins: Partial<Record<Coin, number>> = {};
  const addCoins = (c: Partial<Record<Coin, string>> | undefined) => {
    for (const coin of COINS) {
      const dice = c?.[coin];
      if (dice) coins[coin] = (coins[coin] ?? 0) + rollDice(dice, rng);
    }
  };
  addCoins(table.coins);
  const row = rowFor(table.table, rng(100));
  addCoins(row?.coins);

  const valuables: Treasure['valuables'] = [];
  for (const kind of ['gems', 'artObjects'] as const) {
    const v = row?.[kind];
    if (!v) continue;
    const list = tables.valuables(kind, v.type) ?? [];
    const n = rollDice(v.amount, rng);
    for (let i = 0; i < n; i++) {
      const text = pick(list, rng);
      valuables.push({
        found: { text: text ?? (kind === 'gems' ? 'Gemstone' : 'Art object') },
        value: v.type,
      });
    }
  }

  const magicItems: Found[] = [];
  for (const m of row?.magicItems ?? []) {
    const type = m.type === 'randomByLevel' ? byLevelType(table.crMin) : m.type;
    const rows = tables.magic(type) ?? [];
    const n = rollDice(m.amount, rng);
    for (let i = 0; i < n; i++) {
      const hit = rowFor(rows, rng(100));
      const found = hit && magicFromRow(hit, table.source, tables, rng);
      if (found) magicItems.push(found);
    }
  }
  return { from: `${table.name} (${table.source})`, coins, valuables, magicItems };
}

/** Coins as text: `1,200 gp, 45 sp`. */
export function formatCoins(coins: Partial<Record<Coin, number>>): string {
  return [...COINS]
    .reverse()
    .flatMap((c) => (coins[c] ? [`${coins[c].toLocaleString('en')} ${c}`] : []))
    .join(', ');
}

/** A challenge rating as a number (`1/4` → 0.25). */
export function crNumber(cr: unknown): number {
  const text = isObj(cr) ? cr.cr : cr;
  if (typeof text === 'number') return text;
  if (typeof text !== 'string') return 0;
  const [a, b] = text.split('/').map(Number);
  return b ? (a ?? 0) / b : (a ?? 0);
}

/** Treasure as plain text, for notes: `{@item}` tags become their names. */
export function treasureText(t: Treasure, names: (found: Found) => string): string {
  const lines = [`Treasure — ${t.from}`];
  const coins = formatCoins(t.coins);
  if (coins) lines.push(`Coins: ${coins}`);
  for (const v of t.valuables) lines.push(`• ${names(v.found)} (${String(v.value)} gp)`);
  for (const m of t.magicItems) lines.push(`• ${names(m)}`);
  return lines.join('\n');
}

export const plainName = (found: Found) =>
  'key' in found
    ? (found.key.split(':')[1]?.split('@')[0] ?? found.key)
    : found.text.replace(/\{@\w+ ([^|}]+)[^}]*\}/g, '$1');
