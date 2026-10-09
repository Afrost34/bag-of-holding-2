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
