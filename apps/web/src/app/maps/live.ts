import { useEffect } from 'react';
import type { MapDoc } from './model';
import { useMaps } from './store';

/**
 * The player window shows maps the DM changes live (fog revealed, another variant, a pin shown):
 * the DM's window sends the map it just changed over a BroadcastChannel (works offline) and the
 * player window swaps it in memory. It never writes it: the DM's window owns the file.
 */
const CHANNEL = 'boh-map';

let channel: BroadcastChannel | null = null;
const shared = (): BroadcastChannel | null => {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(CHANNEL);
  return channel;
};

/** Tells other windows (the player window) about a map just changed here. */
export function publishMap(doc: MapDoc): void {
  shared()?.postMessage({ type: 'map', doc });
}

/** The player window's side: takes in the maps the DM changes. */
export function useLiveMaps(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === 'undefined') return;
    const receiver = new BroadcastChannel(CHANNEL);
    receiver.onmessage = (e: MessageEvent<{ type: string; doc?: MapDoc }>) => {
      const doc = e.data.doc;
      if (e.data.type !== 'map' || !doc) return;
      useMaps.setState((s) => ({
        maps: s.maps.map((m) => (m.id === doc.id ? doc : m)),
      }));
    };
    return () => {
      receiver.close();
    };
  }, [enabled]);
}
