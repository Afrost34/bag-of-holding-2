import type { ListRow, SourceInfo } from '@boh/data5e';

/** Card pages (classes, species): grouping by source and the name-or-source search. */

export interface SourceGroup {
  source: string;
  info: SourceInfo | undefined;
  rows: ListRow[];
}

function normalise(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function findSource(sources: readonly SourceInfo[], id: string): SourceInfo | undefined {
  const lower = id.toLowerCase();
  return sources.find((s) => s.id.toLowerCase() === lower);
}

/** Matches when every word is in the name, the source code or the source name. */
export function matchesNameOrSource(
  row: ListRow,
  query: string,
  sources: readonly SourceInfo[],
): boolean {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalise(
    `${row.name} ${row.source} ${findSource(sources, row.source)?.name ?? ''}`,
  );
  return words.every((w) => haystack.includes(w));
}

/**
 * Groups rows by source: 2024 books before 2014 ones, core rules first within an edition, then
 * newest first. Rows are sorted by name inside each group.
 */
export function groupBySource(
  rows: readonly ListRow[],
  sources: readonly SourceInfo[],
): SourceGroup[] {
  const groups = new Map<string, ListRow[]>();
  for (const row of rows) groups.set(row.source, [...(groups.get(row.source) ?? []), row]);
  const rank = (g: SourceGroup): [number, number, string] => [
    (g.info?.edition ?? g.rows[0]?.edition) === '2024' ? 0 : 1,
    g.info?.group === 'core' ? 0 : 1,
    g.info?.published ?? '',
  ];
  return [...groups.entries()]
    .map(([source, list]) => ({
      source,
      info: findSource(sources, source),
      rows: [...list].sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }))
    .sort((a, b) => {
      const [ea, ca, pa] = rank(a);
      const [eb, cb, pb] = rank(b);
      return ea - eb || ca - cb || pb.localeCompare(pa) || a.source.localeCompare(b.source);
    });
}
