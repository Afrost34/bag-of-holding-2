import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Pages seen lately on this device, newest first, for "Continue" on the home page. A per-device
 * convenience (like tabs), so it stays in local storage and is not synced.
 */

export interface RecentPage {
  path: string;
  title: string;
  /** When it was last open (ms). */
  at: number;
}

const MAX = 12;

/** Pages not worth going back to from the home page. */
const SKIPPED = /^\/(\?|$)|^\/settings|^\/player/;

/** The list after a visit: the page moves to the front, without duplicates. */
export function visit(pages: readonly RecentPage[], page: RecentPage): RecentPage[] {
  if (SKIPPED.test(page.path)) return [...pages];
  return [page, ...pages.filter((p) => p.path !== page.path)].slice(0, MAX);
}

interface RecentStore {
  pages: RecentPage[];
  record: (path: string, title: string) => void;
  forget: (path: string) => void;
}

export const useRecent = create<RecentStore>()(
  persist(
    (set, get) => ({
      pages: [],
      record: (path, title) => {
        const first = get().pages[0];
        if (first?.path === path && first.title === title) return;
        set({ pages: visit(get().pages, { path, title, at: Date.now() }) });
      },
      forget: (path) => {
        set({ pages: get().pages.filter((p) => p.path !== path) });
      },
    }),
    { name: 'boh.recent', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
