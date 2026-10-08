/**
 * Undo and redo for a document edited in place (a board, a map): the versions before and after
 * the one shown. Pure: the page keeps it and saves the version undo or redo returns.
 */

export interface History<T> {
  past: readonly T[];
  future: readonly T[];
  /** When the last change was recorded (ms), to fold quick runs of changes into one step. */
  at: number;
}

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [], at: 0 });

/** How many steps are kept. */
export const HISTORY_LIMIT = 50;

/**
 * Keeps `before` (the version a change replaces) as a step back. Changes within `foldMs` of
 * the last one (typing in a card) fold into the same step. A new change drops the redo steps.
 */
export function record<T>(h: History<T>, before: T, now: number, foldMs = 600): History<T> {
  const fold = h.past.length > 0 && h.future.length === 0 && now - h.at < foldMs;
  return {
    past: fold ? h.past : [...h.past, before].slice(-HISTORY_LIMIT),
    future: [],
    // A change that never folds starts no run for the next one to fold into.
    at: foldMs > 0 ? now : 0,
  };
}

/** The version to go back to from `current`, or null when there is none. */
export function undo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = h.past.at(-1);
  if (value === undefined) return null;
  return { history: { past: h.past.slice(0, -1), future: [...h.future, current], at: 0 }, value };
}

/** The version undone last, back again, or null when there is none. */
export function redo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = h.future.at(-1);
  if (value === undefined) return null;
  return { history: { past: [...h.past, current], future: h.future.slice(0, -1), at: 0 }, value };
}

/** Whether a key press belongs to a text field (its own undo), not to the page. */
export function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}
