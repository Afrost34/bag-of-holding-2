import type { EntityDetail } from '@boh/data5e';
import type { BoardCard } from './model';
import { useEffect, useState } from 'react';

/**
 * The player window: a second browser window (on a second screen or a TV) showing what the DM
 * sends it from a board: a picture, a compendium entry, a note or some text. The two windows
 * talk over a BroadcastChannel, so it works offline. A window that opens late asks for what is
 * showing.
 */

export type PlayerShow =
  /** `src` as on image cards; `journal:` pictures are read from `campaignId`'s journal. */
  | { kind: 'image'; src: string; caption?: string; campaignId?: string }
  /**
   * Sent whole: the 5etools index is open in the DM's window and a second window cannot open it
   * too. (Only passed between windows, never stored.)
   */
  | { kind: 'entity'; entity: EntityDetail }
  | { kind: 'note'; campaignId: string; path: string }
  | { kind: 'text'; title?: string; text: string }
  /**
   * The cards the DM marked as shown, laid out for the players. Entries go whole (see above);
   * `campaignId` is where notes, pictures and maps are read from.
   */
  | {
      kind: 'board';
      name: string;
      campaignId?: string;
      cards: { card: BoardCard; title: string; entity?: EntityDetail }[];
    };

type Message = { type: 'show'; item: PlayerShow | null } | { type: 'hello' };

const CHANNEL = 'boh-player';
export const PLAYER_ROUTE = '/player';

let channel: BroadcastChannel | null = null;
let current: PlayerShow | null = null;
let win: Window | null = null;

/** The DM side: answers a new player window with what is showing. */
function dmChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === 'hello') channel?.postMessage({ type: 'show', item: current });
    };
  }
  return channel;
}

/** Shows something in the player window (opening it first unless `open` is false). */
export function showToPlayers(item: PlayerShow | null, open = true): void {
  current = item;
  if (open) openPlayerWindowIfClosed();
  dmChannel().postMessage({ type: 'show', item } satisfies Message);
}

export function openPlayerWindowIfClosed(): void {
  if (!win || win.closed) openPlayerWindow();
}

export function openPlayerWindow(): void {
  dmChannel();
  const url = `${location.pathname}${location.search}#${PLAYER_ROUTE}`;
  win = window.open(url, 'boh-player', 'popup,width=1000,height=750');
}

/** The player side: what the DM is showing, and a count that changes each time it is sent. */
export function usePlayerShow(): { item: PlayerShow | null; seq: number } {
  const [shown, setShown] = useState<{ item: PlayerShow | null; seq: number }>({
    item: null,
    seq: 0,
  });
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === 'show') {
        const item = e.data.item;
        setShown((s) => ({ item, seq: s.seq + 1 }));
      }
    };
    ch.postMessage({ type: 'hello' } satisfies Message);
    return () => {
      ch.close();
    };
  }, []);
  return shown;
}
