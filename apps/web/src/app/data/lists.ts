import type { ListRow } from '@boh/data5e';
import { useEffect, useState } from 'react';
import { dataWorker } from './client';

/** Compendium list rows, cached per category until the data changes. */

const rowCache = new Map<string, Promise<ListRow[]>>();

export function clearListCaches(): void {
  rowCache.clear();
}

export function loadRows(categoryId: string): Promise<ListRow[]> {
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
