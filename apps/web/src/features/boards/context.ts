import { createContext, useContext } from 'react';
import type { BoardCard, CardContent } from '../../app/boards/model';

/**
 * What cards can do to their board. Provided by the board page so card components stay small
 * and React Flow's node data holds only the card itself.
 */
export interface BoardActions {
  update: (id: string, change: (card: BoardCard) => BoardCard) => void;
  remove: (id: string) => void;
  /** Takes a card out of its stack. */
  unstack: (id: string) => void;
  /** Takes a card out of its frame. */
  unframe: (id: string) => void;
  /** Adds cards beside a card (a combat started from an encounter). */
  addBeside: (id: string, contents: CardContent[]) => void;
  /** Shows a card in the player window. */
  show: (card: BoardCard) => void;
  /** Opens what the card shows (a compendium page, a journal note) in the app. */
  open: (card: BoardCard, newTab: boolean) => void;
}

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
  const actions = useContext(BoardActionsContext);
  if (!actions) throw new Error('useBoardActions outside a board');
  return actions;
}
