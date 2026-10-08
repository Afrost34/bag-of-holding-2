import * as Comlink from 'comlink';
import { type DataWorkerApi } from './protocol';
import { relayedDataWorker, startDataRelay } from './relay';

let remote: Comlink.Remote<DataWorkerApi> | null = null;

/**
 * The player window never opens the database (it would leave the DM's window waiting for it after
 * a reload): its data calls are answered by the DM's window (`relay.ts`).
 */
const PLAYER_HASH = /^#\/player(?:[/?]|$)/;
export const isPlayerWindow = () => PLAYER_HASH.test(location.hash);

/** The data worker, started on first use. */
export function dataWorker(): Comlink.Remote<DataWorkerApi> {
  if (!remote) {
    if (isPlayerWindow()) remote = relayedDataWorker();
    else {
      const worker = new Worker(new URL('./data.worker.ts', import.meta.url), {
        type: 'module',
        name: 'boh-data',
      });
      remote = Comlink.wrap<DataWorkerApi>(worker);
      // The player window asks this one for what it shows.
      startDataRelay(() => remote ?? dataWorker());
    }
  }
  return remote;
}

/** Wraps a callback so the worker can call it back across the thread boundary. */
export const proxy = Comlink.proxy;
