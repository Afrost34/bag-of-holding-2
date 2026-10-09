import type { CharacterView } from '../../../app/data/protocol';

export { ordinal as ORDINAL } from '../../../app/format';

export function sourceLabel(from: string, view: CharacterView): string {
  if (from.startsWith('race:') || from.startsWith('subrace:')) return 'Species';
  if (from.startsWith('background:')) return 'Background';
  if (from.startsWith('feat:')) return 'Feat';
  if (from.startsWith('optionalfeature:')) return 'Option';
  return view.entities.find((e) => e.key === from)?.name ?? '';
}

/**
 * A long table split into pages: `first` rows on the first page (which has a header above the
 * table), `rest` on each page after. Always at least one page, so an empty table still prints.
 */
export function pageRows<T>(rows: readonly T[], first: number, rest: number): T[][] {
  const pages: T[][] = [rows.slice(0, first)];
  for (let i = first; i < rows.length; i += rest) pages.push(rows.slice(i, i + rest));
  return pages;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A spell's casting time as a table cell: "Action", "Bonus action", "Reaction", "1 minute",
 * without the conditions (they are on the spell's card).
 */
export function shortCast(spell: Record<string, unknown>): string {
  const times = Array.isArray(spell.time) ? spell.time.filter(isObj) : [];
  return times
    .map((t) => {
      const n = typeof t.number === 'number' ? t.number : 1;
      const unit = typeof t.unit === 'string' ? t.unit : '';
      if (n === 1 && unit === 'action') return 'Action';
      if (n === 1 && unit === 'bonus') return 'Bonus action';
      if (n === 1 && unit === 'reaction') return 'Reaction';
      return `${String(n)} ${unit}${n === 1 ? '' : 's'}`;
    })
    .join(' or ');
}

/** A spell's range as a table cell: "120 feet", "Self", "Touch"; an area from you is its size. */
export function shortRange(spell: Record<string, unknown>): string {
  const range = isObj(spell.range) ? spell.range : {};
  const dist = isObj(range.distance) ? range.distance : {};
  const amount = typeof dist.amount === 'number' ? dist.amount : undefined;
  const type = typeof dist.type === 'string' ? dist.type : '';
  if (range.type === 'special') return 'Special';
  if (range.type !== 'point')
    return amount !== undefined
      ? `${String(amount)} ${type === 'miles' ? 'miles' : 'feet'}`
      : 'Self';
  if (amount !== undefined)
    return `${String(amount)} ${amount === 1 ? type.replace(/s$/, '').replace('feet', 'foot') : type}`;
  return cap(type || 'self');
}
