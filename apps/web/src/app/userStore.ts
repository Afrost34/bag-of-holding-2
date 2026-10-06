import type { FileStore } from '@boh/storage';
import { openUserStore } from './platform';

let storePromise: Promise<FileStore> | null = null;

/**
 * The store holding the user's own data (homebrew packs now; campaigns, characters and boards
 * later). It becomes the local clone of the private data repo in M4.
 */
export function userStore(): Promise<FileStore> {
  storePromise ??= openUserStore();
  return storePromise;
}
