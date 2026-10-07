import type { ClassPage, EntitySummary, SpeciesPage, SubclassPage } from '@boh/data5e';
import { useEffect, useState } from 'react';
import { dataWorker } from './client';

/** Class, subclass and species pages: one worker call each, cached until the data changes. */

export type PageState<T> =
  { status: 'loading' } | { status: 'found'; page: T } | { status: 'missing' };

const cache = new Map<string, Promise<unknown>>();

export function clearPageCaches(): void {
  cache.clear();
}

function usePage<T>(kind: string, key: string, load: () => Promise<T | undefined>): PageState<T> {
  const cacheKey = `${kind}:${key}`;
  const [state, setState] = useState<{ for: string; value: PageState<T> }>({
    for: cacheKey,
    value: { status: 'loading' },
  });
  useEffect(() => {
    let cancelled = false;
    let promise = cache.get(cacheKey) as Promise<T | undefined> | undefined;
    if (!promise) {
      promise = load();
      cache.set(cacheKey, promise);
    }
    void promise.then((page) => {
      if (!cancelled) {
        setState({
          for: cacheKey,
          value: page ? { status: 'found', page } : { status: 'missing' },
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // `load` is a fresh closure every render; the cache key identifies the request.
  }, [cacheKey]);
  return state.for === cacheKey ? state.value : { status: 'loading' };
}

export function useClassPage(key: string): PageState<ClassPage> {
  return usePage('class', key, () => dataWorker().classPage(key));
}

export function useSubclassPage(key: string): PageState<SubclassPage> {
  return usePage('subclass', key, () => dataWorker().subclassPage(key));
}

export function useSpeciesPage(key: string): PageState<SpeciesPage> {
  return usePage('species', key, () => dataWorker().speciesPage(key));
}

export function useSpecificVariants(key: string): PageState<EntitySummary[]> {
  return usePage('variants', key, () => dataWorker().specificVariants(key));
}
