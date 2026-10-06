import * as Comlink from 'comlink';
import type { DataWorkerApi } from './protocol';

let remote: Comlink.Remote<DataWorkerApi> | null = null;

/** The data worker, started on first use. */
export function dataWorker(): Comlink.Remote<DataWorkerApi> {
  if (!remote) {
    const worker = new Worker(new URL('./data.worker.ts', import.meta.url), {
      type: 'module',
      name: 'boh-data',
    });
    remote = Comlink.wrap<DataWorkerApi>(worker);
  }
  return remote;
}

/** Wraps a callback so the worker can call it back across the thread boundary. */
export const proxy = Comlink.proxy;
