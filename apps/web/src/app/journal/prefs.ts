import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface JournalPrefs {
  /** Show notes as Markdown text (for editing by hand) instead of formatted. */
  codeMode: boolean;
  setCodeMode: (on: boolean) => void;
  /** The note last open in each campaign's journal (the journal opens on it again). */
  lastNote: Record<string, string>;
  setLastNote: (campaignId: string, path: string) => void;
}

/** Journal display choices, remembered per device. */
export const useJournalPrefs = create<JournalPrefs>()(
  persist(
    (set) => ({
      codeMode: false,
      setCodeMode: (on) => {
        set({ codeMode: on });
      },
      lastNote: {},
      setLastNote: (campaignId, path) => {
        set((s) =>
          s.lastNote[campaignId] === path ? s : { lastNote: { ...s.lastNote, [campaignId]: path } },
        );
      },
    }),
    { name: 'boh.journal', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
