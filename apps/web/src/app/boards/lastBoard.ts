import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The library's key in the map (campaign ids are slugs, never start with @). */
const LIBRARY = '@library';

interface LastBoard {
  /** The board last opened, by campaign (or the library). */
  byCampaign: Record<string, string>;
  remember: (boardId: string, campaign: string | undefined) => void;
}

/** The board each campaign had open last, per device: Boards opens it again. */
export const useLastBoard = create<LastBoard>()(
  persist(
    (set) => ({
      byCampaign: {},
      remember: (boardId, campaign) => {
        set((s) => ({ byCampaign: { ...s.byCampaign, [campaign ?? LIBRARY]: boardId } }));
      },
    }),
    { name: 'boh.last-board', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export const lastBoardOf = (byCampaign: Record<string, string>, campaign: string | undefined) =>
  byCampaign[campaign ?? LIBRARY];
