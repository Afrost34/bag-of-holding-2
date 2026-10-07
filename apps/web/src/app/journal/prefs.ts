import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface JournalPrefs {
  /** Show notes as Markdown text (for editing by hand) instead of formatted. */
  codeMode: boolean;
  setCodeMode: (on: boolean) => void;
}

/** Journal display choices, remembered per device. */
export const useJournalPrefs = create<JournalPrefs>()(
  persist(
    (set) => ({
      codeMode: false,
      setCodeMode: (on) => {
        set({ codeMode: on });
      },
    }),
    { name: 'boh.journal', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
