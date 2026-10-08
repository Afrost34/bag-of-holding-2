import { useEffect, useRef } from 'react';
import type { CardContent } from './model';
import { useBoards } from './store';

/**
 * The player window: a second browser window (on a second screen or a TV) showing the campaign's
 * players' board, a board like any other that the DM works on there (moves, resizes, rolls,
 * removes). The DM sends it cards from boards, the compendium or the calendar.
 *
 * While it is open, the player window is the only one that writes the players' board, so the
 * two windows never overwrite each other: a card sent from the DM's window goes to it over a
 * BroadcastChannel (works offline). When it is closed, the DM's window adds the card itself and
 * opens it.
 */

type Message =
  { type: 'ping' } | { type: 'pong' } | { type: 'add'; campaign?: string; contents: CardContent[] };

const CHANNEL = 'boh-player';
export const PLAYER_ROUTE = '/player';

let win: Window | null = null;

export function openPlayerWindow(): void {
  const url = `${location.pathname}${location.search}#${PLAYER_ROUTE}`;
  win = window.open(url, 'boh-player', 'popup,width=1000,height=750');
}

/** Whether a player window answers (it may have been opened from another tab). */
function playerWindowAnswers(): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL);
    const done = (answer: boolean) => {
      channel.close();
      resolve(answer);
    };
    const timer = setTimeout(() => {
      done(false);
    }, 400);
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type !== 'pong') return;
      clearTimeout(timer);
      done(true);
    };
    channel.postMessage({ type: 'ping' } satisfies Message);
  });
}

/** Sends copies of cards to the players' board of a campaign, opening the player window. */
export async function sendToPlayers(
  contents: readonly CardContent[],
  campaign?: string,
): Promise<void> {
  if (contents.length === 0) return;
  if (await playerWindowAnswers()) {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({
      type: 'add',
      ...(campaign ? { campaign } : {}),
      contents: [...contents],
    } satisfies Message);
    channel.close();
    win?.focus();
    return;
  }
  // No player window: this window adds the cards (to the board as saved, which it last wrote).
  const boards = useBoards.getState();
  await boards.reload();
  const board = await boards.ensurePlayers(campaign);
  boards.send(board.id, contents);
  await boards.flush();
  openPlayerWindow();
}

/** The player window's side: answers pings, and receives the cards the DM sends. */
export function usePlayerWindow(
  onAdd: (contents: CardContent[], campaign: string | undefined) => void,
): void {
  const latest = useRef(onAdd);
  useEffect(() => {
    latest.current = onAdd;
  });
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === 'ping') channel.postMessage({ type: 'pong' } satisfies Message);
      if (e.data.type === 'add') latest.current(e.data.contents, e.data.campaign);
    };
    return () => {
      channel.close();
    };
  }, []);
}
