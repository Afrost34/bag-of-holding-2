import * as Comlink from 'comlink';
import { GUEST_WORKER, type DataWorkerApi } from './protocol';

let remote: Comlink.Remote<DataWorkerApi> | null = null;

/**
 * The player window gets everything it shows from the DM's window, so its worker is a guest: it
 * never takes the database, which would leave the DM's window waiting for it after a reload.
 */
const PLAYER_HASH = /^#\/player(?:[/?]|$)/;

/** The data worker, started on first use. */
export function dataWorker(): Comlink.Remote<DataWorkerApi> {
  if (!remote) {
    const worker = new Worker(new URL('./data.worker.ts', import.meta.url), {
      type: 'module',
      name: PLAYER_HASH.test(location.hash) ? GUEST_WORKER : 'boh-data',
    });
    remote = Comlink.wrap<DataWorkerApi>(worker);
  }
  return remote;
}

/** Wraps a callback so the worker can call it back across the thread boundary. */
export const proxy = Comlink.proxy;
