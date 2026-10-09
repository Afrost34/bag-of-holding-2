import type { MapDoc } from './model';

/**
 * The player window shows maps the DM changes live (fog revealed, another variant, a pin shown):
 * the DM's window sends the map it just changed over a BroadcastChannel (works offline) and the
 * player window swaps it in memory (`useLiveMaps`). It never writes it: the DM's window owns
 * the file.
 */
export const MAP_CHANNEL = 'boh-map';

let channel: BroadcastChannel | null = null;

/** Tells other windows (the player window) about a map just changed here. */
export function publishMap(doc: MapDoc): void {
  if (typeof BroadcastChannel === 'undefined') return;
  channel ??= new BroadcastChannel(MAP_CHANNEL);
  channel.postMessage({ type: 'map', doc });
}
