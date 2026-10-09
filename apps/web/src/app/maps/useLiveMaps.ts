import { useEffect } from 'react';
import { MAP_CHANNEL } from './live';
import type { MapDoc } from './model';
import { useMaps } from './store';

/** The player window's side of `publishMap`: takes in the maps the DM changes. */
export function useLiveMaps(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === 'undefined') return;
    const receiver = new BroadcastChannel(MAP_CHANNEL);
    receiver.onmessage = (e: MessageEvent<{ type: string; doc?: MapDoc }>) => {
      const doc = e.data.doc;
      if (e.data.type !== 'map' || !doc) return;
      useMaps.setState((s) => ({ maps: s.maps.map((m) => (m.id === doc.id ? doc : m)) }));
    };
    return () => {
      receiver.close();
    };
  }, [enabled]);
}
