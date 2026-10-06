import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SidebarPrefs {
  collapsed: boolean;
  toggle: () => void;
}

/** Sidebar collapsed state, remembered per device. */
export const useSidebarPrefs = create<SidebarPrefs>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => {
        set((s) => ({ collapsed: !s.collapsed }));
      },
    }),
    { name: 'boh.sidebar', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
