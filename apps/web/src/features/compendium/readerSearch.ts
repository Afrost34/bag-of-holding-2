import type { ReaderSearch } from './ReaderPage';

/** The router JSON-parses search values (`ch=3` arrives as a number): keep them as strings. */
export function readerSearch(search: Record<string, unknown>): ReaderSearch {
  const out: ReaderSearch = {};
  for (const key of ['ch', 'h', 'area'] as const) {
    const v = search[key];
    if (typeof v === 'string' || typeof v === 'number') out[key] = String(v);
  }
  return out;
}
