import type { ListRow } from '@boh/data5e';
import { useEffect, useState } from 'react';
import { dataWorker } from './client';

/** Compendium list rows and counts, cached per category until the data changes. */

const rowCache = new Map<string, Promise<ListRow[]>>();
let countsCache: Promise<Record<string, number>> | null = null;

export function clearListCaches(): void {
  rowCache.clear();
  countsCache = null;
}

function loadRows(categoryId: string): Promise<ListRow[]> {
  let promise = rowCache.get(categoryId);
  if (!promise) {
    promise = dataWorker().listRows(categoryId);
    rowCache.set(categoryId, promise);
  }
  return promise;
}

export function useListRows(categoryId: string): ListRow[] | null {
  const [state, setState] = useState<{ for: string; rows: ListRow[] | null }>({
    for: categoryId,
    rows: null,
  });
  useEffect(() => {
    let cancelled = false;
    void loadRows(categoryId).then((rows) => {
      if (!cancelled) setState({ for: categoryId, rows });
    });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);
  return state.for === categoryId ? state.rows : null;
}

export function useCategoryCounts(): Record<string, number> | null {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    countsCache ??= dataWorker().categoryCounts();
    void countsCache.then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return counts;
}
