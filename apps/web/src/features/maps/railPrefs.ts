import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Per device: whether the tool bar shows the names beside the icons (it is a narrow icon column otherwise). */
export const useRailPrefs = create<{ names: boolean; toggle: () => void }>()(
  persist(
    (set) => ({
      names: false,
      toggle: () => {
        set((s) => ({ names: !s.names }));
      },
    }),
    { name: 'boh.map-rail', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
