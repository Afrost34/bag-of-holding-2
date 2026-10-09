import type { FileStore } from '@boh/storage';
import { openUserStore } from './platform';

let rawPromise: Promise<FileStore> | null = null;
let countedPromise: Promise<FileStore> | null = null;

/** Writes and removals made by the app since the counter was last taken (see `takeWrites`). */
let writes = 0;

function raw(): Promise<FileStore> {
  rawPromise ??= openUserStore();
  return rawPromise;
}

/**
 * The store holding the user's own data: the local copy of the private data repo. Every write
 * through it is counted, so the sync knows when this device changed nothing.
 */
export function userStore(): Promise<FileStore> {
  countedPromise ??= raw().then(
    (store): FileStore =>
      new Proxy(store, {
        get(target, prop, receiver) {
          const value: unknown = Reflect.get(target, prop, receiver);
          if (typeof value !== 'function') return value;
          const method = value as (...args: unknown[]) => unknown;
          if (prop === 'writeFile' || prop === 'remove' || prop === 'mkdir')
            return (...args: unknown[]) => {
              writes++;
              return method.apply(target, args);
            };
          return method.bind(target);
        },
      }),
  );
  return countedPromise;
}

/** The same store without the counting: for the sync's own reads and writes. */
export const syncedStore = raw;

/** How many writes the app made since the last call, and starts counting again. */
export function takeWrites(): number {
  const n = writes;
  writes = 0;
  return n;
}

/** Puts writes back (a sync that failed did not send them). */
export function returnWrites(n: number): void {
  writes += n;
}
