import type * as Comlink from 'comlink';
import type { DataWorkerApi } from './protocol';

/**
 * The 5etools index can be open in one window only. The player window (a board of its own, on a
 * second screen) asks the DM's window for what it needs instead: each data call goes over a
 * BroadcastChannel and the DM's window answers from its worker. Calls that take callbacks
 * (installing data) are the DM's window's alone.
 */

const CHANNEL = 'boh-data-relay';
const TIMEOUT_MS = 20_000;

interface Request {
  type: 'call';
  id: string;
  method: string;
  args: unknown[];
}
interface Answer {
  type: 'answer';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** The DM's side: answers the player window's data calls from this window's worker. */
export function startDataRelay(worker: () => Comlink.Remote<DataWorkerApi>): () => void {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent<Request | Answer>) => {
    const msg = e.data;
    if (msg.type !== 'call') return;
    void (async () => {
      try {
        const fn: unknown = Reflect.get(worker(), msg.method);
        if (typeof fn !== 'function') throw new Error(`No data call ${msg.method}`);
        const result: unknown = await (fn as (...a: unknown[]) => Promise<unknown>)(...msg.args);
        channel.postMessage({ type: 'answer', id: msg.id, ok: true, result } satisfies Answer);
      } catch (error) {
        channel.postMessage({
          type: 'answer',
          id: msg.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies Answer);
      }
    })();
  };
  return () => {
    channel.close();
  };
}

/** The player window's side: the data API, answered by the DM's window. */
export function relayedDataWorker(): Comlink.Remote<DataWorkerApi> {
  const channel = new BroadcastChannel(CHANNEL);
  const waiting = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let next = 0;
  channel.onmessage = (e: MessageEvent<Request | Answer>) => {
    const msg = e.data;
    if (msg.type !== 'answer') return;
    const call = waiting.get(msg.id);
    // Two DM windows may answer: the first answer counts.
    if (!call) return;
    waiting.delete(msg.id);
    if (msg.ok) call.resolve(msg.result);
    else call.reject(new Error(msg.error ?? 'The DM’s window could not answer'));
  };
  const call = (method: string, args: unknown[]) =>
    new Promise<unknown>((resolve, reject) => {
      const id = `${String(Date.now())}-${String(next++)}`;
      waiting.set(id, { resolve, reject });
      channel.postMessage({ type: 'call', id, method, args } satisfies Request);
      setTimeout(() => {
        if (!waiting.delete(id)) return;
        reject(new Error('The DM’s window did not answer: is it open?'));
      }, TIMEOUT_MS);
    });
  return new Proxy(
    {},
    {
      get: (_target, method) =>
        typeof method === 'string' && method !== 'then'
          ? (...args: unknown[]) => call(method, args)
          : undefined,
    },
  ) as Comlink.Remote<DataWorkerApi>;
}
