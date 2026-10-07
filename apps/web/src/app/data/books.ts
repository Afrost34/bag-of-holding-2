import type { BookContent, BookKind, BookSummary } from '@boh/data5e';
import { useEffect, useState } from 'react';
import { dataWorker } from './client';

const libraryCache = new Map<string, Promise<BookSummary[]>>();
const contentCache = new Map<string, Promise<BookContent | undefined>>();

export function clearBookCaches(): void {
  libraryCache.clear();
  contentCache.clear();
}

export function useLibrary(kind: 'book' | 'adventure'): BookSummary[] | null {
  const [state, setState] = useState<{ for: string; books: BookSummary[] | null }>({
    for: kind,
    books: null,
  });
  useEffect(() => {
    let cancelled = false;
    let promise = libraryCache.get(kind);
    if (!promise) {
      promise = dataWorker().library(kind);
      libraryCache.set(kind, promise);
    }
    void promise.then((books) => {
      if (!cancelled) setState({ for: kind, books });
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);
  return state.for === kind ? state.books : null;
}

export type BookState =
  { status: 'loading' } | { status: 'found'; book: BookContent } | { status: 'missing' };

export function useBookContent(kind: BookKind, id: string): BookState {
  const cacheKey = `${kind}:${id.toLowerCase()}`;
  const [state, setState] = useState<{ for: string; value: BookState }>({
    for: cacheKey,
    value: { status: 'loading' },
  });
  useEffect(() => {
    let cancelled = false;
    let promise = contentCache.get(cacheKey);
    if (!promise) {
      promise = dataWorker().bookContent(kind, id);
      contentCache.set(cacheKey, promise);
    }
    void promise.then((book) => {
      if (!cancelled)
        setState({
          for: cacheKey,
          value: book ? { status: 'found', book } : { status: 'missing' },
        });
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, kind, id]);
  return state.for === cacheKey ? state.value : { status: 'loading' };
}
