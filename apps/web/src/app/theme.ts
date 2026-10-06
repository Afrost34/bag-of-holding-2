import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/** Theme preference. The key `boh.theme` is also read by the pre-paint script in index.html. */
export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => {
        set({ mode });
      },
    }),
    { name: 'boh.theme', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Mirrors the theme preference onto <html data-theme>; "system" removes the attribute. */
export function useApplyTheme(): void {
  const mode = useTheme((s) => s.mode);
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') delete root.dataset.theme;
    else root.dataset.theme = mode;
  }, [mode]);
}
