import { fetchLazyFile } from '@boh/storage';
import { syncedStore } from '../userStore';
import { remoteIdOf, repoFor, useSyncSettings } from './settings';

/**
 * Map pictures (in the library or a campaign) are big: a device downloads one only when a map
 * shows it, not with every sync. Everything else syncs whole.
 */
export const isLazy = (path: string) => /(^|\/)maps\/assets\//.test(path);

const pending = new Map<string, Promise<Uint8Array | null>>();

/** A lazy file this device does not have yet, from the data repository; null when offline. */
export function fetchMissing(path: string): Promise<Uint8Array | null> {
  const settings = useSyncSettings.getState().settings;
  if (!settings || !isLazy(path)) return Promise.resolve(null);
  let job = pending.get(path);
  if (!job) {
    // A picture already in the repository: fetching it is not a change to send.
    job = syncedStore()
      .then((store) => fetchLazyFile(store, repoFor(settings), remoteIdOf(settings), path))
      .catch(() => null)
      .finally(() => {
        pending.delete(path);
      });
    pending.set(path, job);
  }
  return job;
}
