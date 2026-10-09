import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { absolutePosition, COLLAPSED_H, moveBoardCards, type Board, type BoardCard } from './model';

/** Snapping on boards: a per-device preference, the grid the board's dots are drawn on. */
export const SNAP_GRID = 24;

export const useBoardSnap = create<{ snap: boolean; toggle: () => void }>()(
  persist(
    (set) => ({
      snap: false,
      toggle: () => {
        set((s) => ({ snap: !s.snap }));
      },
    }),
    { name: 'boh.board-snap', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export type AlignMode =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  /** Equal gaps from left to right, the outer cards staying put. */
  | 'row'
  /** Equal gaps from top to bottom. */
  | 'column';

interface Box {
  card: BoardCard;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lines the cards up (by their edges or middles) or spaces them evenly, on the canvas: cards in
 * a frame stay in it, moved relative to it.
 */
export function alignCards(board: Board, ids: readonly string[], mode: AlignMode): Board {
  const boxes: Box[] = board.cards
    .filter((c) => ids.includes(c.id) && !c.inStack)
    .map((card) => ({
      card,
      ...absolutePosition(board, card),
      w: card.w,
      h: card.collapsed ? COLLAPSED_H : card.h,
    }));
  if (boxes.length < 2) return board;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  const target = new Map<string, { x: number; y: number }>();
  const put = (b: Box, x: number, y: number) => target.set(b.card.id, { x, y });
  switch (mode) {
    case 'left':
      for (const b of boxes) put(b, left, b.y);
      break;
    case 'center':
      for (const b of boxes) put(b, (left + right) / 2 - b.w / 2, b.y);
      break;
    case 'right':
      for (const b of boxes) put(b, right - b.w, b.y);
      break;
    case 'top':
      for (const b of boxes) put(b, b.x, top);
      break;
    case 'middle':
      for (const b of boxes) put(b, b.x, (top + bottom) / 2 - b.h / 2);
      break;
    case 'bottom':
      for (const b of boxes) put(b, b.x, bottom - b.h);
      break;
    case 'row':
    case 'column': {
      if (boxes.length < 3) return board;
      const across = mode === 'row';
      const sorted = [...boxes].sort((a, b) => (across ? a.x - b.x : a.y - b.y));
      const size = (b: Box) => (across ? b.w : b.h);
      const span = across ? right - left : bottom - top;
      const gap = (span - sorted.reduce((n, b) => n + size(b), 0)) / (sorted.length - 1);
      let at = across ? left : top;
      for (const b of sorted) {
        put(b, across ? at : b.x, across ? b.y : at);
        at += size(b) + gap;
      }
      break;
    }
  }
  // Back to frame-relative positions for cards in frames.
  const relative = new Map<string, { x: number; y: number }>();
  for (const b of boxes) {
    const t = target.get(b.card.id);
    if (!t) continue;
    const frame = b.card.parent ? board.cards.find((c) => c.id === b.card.parent) : undefined;
    relative.set(b.card.id, frame ? { x: t.x - frame.x, y: t.y - frame.y } : t);
  }
  return moveBoardCards(board, relative);
}
