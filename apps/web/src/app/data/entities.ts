import type { EntityDetail } from '@boh/data5e';
import { useEffect, useState } from 'react';
import { dataWorker } from './client';
import { clearBookCaches } from './books';
import { clearPageCaches } from './pages';
import { clearListCaches } from './lists';

/**
 * Entity loading and link resolution for the UI, with caching and batching: a page of book text
 * holds hundreds of links, which resolve in one worker round trip.
 */

/** Route of an entity page. Keys contain `:` `@` `|` and spaces, so they are URL-encoded. */
export function entityPath(key: string): string {
  return `/compendium/${encodeURIComponent(key)}`;
}

// region Resolution (batched)

const resolved = new Map<string, Promise<string | null>>();
let queue: { candidates: string[]; settle: (key: string | null) => void }[] = [];
let scheduled = false;

function flush(): void {
  scheduled = false;
  const batch = queue;
  queue = [];
  dataWorker()
    .resolve(batch.map((b) => b.candidates))
    .then((keys) => {
      batch.forEach((b, i) => {
        b.settle(keys[i] ?? null);
      });
    })
    .catch(() => {
      batch.forEach((b) => {
        b.settle(null);
      });
    });
}

/** The first existing key among candidates (null when none exists in the index). */
export function resolveLink(candidates: readonly string[]): Promise<string | null> {
  const cacheKey = candidates.join('\n');
  let promise = resolved.get(cacheKey);
  if (!promise) {
    promise = new Promise((settle) => {
      queue.push({ candidates: [...candidates], settle });
      if (!scheduled) {
        scheduled = true;
        setTimeout(flush, 0);
      }
    });
    resolved.set(cacheKey, promise);
  }
  return promise;
}

export type ResolveState =
  { status: 'loading' } | { status: 'found'; key: string } | { status: 'missing' };

export function useResolvedLink(candidates: readonly string[]): ResolveState {
  const cacheKey = candidates.join('\n');
  const [state, setState] = useState<{ for: string; value: ResolveState }>({
    for: cacheKey,
    value: { status: 'loading' },
  });
  useEffect(() => {
    let cancelled = false;
    void resolveLink(cacheKey.split('\n')).then((key) => {
      if (!cancelled)
        setState({ for: cacheKey, value: key ? { status: 'found', key } : { status: 'missing' } });
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);
  return state.for === cacheKey ? state.value : { status: 'loading' };
}

// endregion

// region Entities

const entityCache = new Map<string, Promise<EntityDetail | undefined>>();

export function loadEntity(key: string): Promise<EntityDetail | undefined> {
  let promise = entityCache.get(key);
  if (!promise) {
    promise = dataWorker().entity(key);
    entityCache.set(key, promise);
  }
  return promise;
}

/** Forget cached lookups after the data changes (install, update, homebrew). */
export function clearEntityCaches(): void {
  entityCache.clear();
  resolved.clear();
  clearListCaches();
  clearBookCaches();
  clearPageCaches();
}

export type EntityState =
  { status: 'loading' } | { status: 'found'; entity: EntityDetail } | { status: 'missing' };

export function useEntity(key: string | null): EntityState {
  const [state, setState] = useState<{ for: string | null; value: EntityState }>({
    for: key,
    value: { status: 'loading' },
  });
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void loadEntity(key).then((entity) => {
      if (!cancelled)
        setState({ for: key, value: entity ? { status: 'found', entity } : { status: 'missing' } });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  if (!key) return { status: 'missing' };
  return state.for === key ? state.value : { status: 'loading' };
}

// endregion
