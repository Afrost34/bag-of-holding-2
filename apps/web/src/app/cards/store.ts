import { create } from 'zustand';
import { docStore, inCampaign } from '../docStore';
import {
  addCards,
  newSheet,
  parseSheet,
  serializeSheet,
  sheetDir,
  sheetPath,
  type CardSheet,
} from './model';

/** Every card sheet, in the library and in each campaign (see `docStore`). */

interface CardSheetsStore {
  sheets: CardSheet[];
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  create: (name: string, campaign?: string, keys?: readonly string[]) => Promise<CardSheet>;
  save: (sheet: CardSheet) => void;
  /** Adds entities as cards at the end of a sheet. */
  send: (sheetId: string, keys: readonly string[]) => void;
  flush: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCardSheets = create<CardSheetsStore>()((set, get) => {
  const docs = docStore(
    {
      one: 'a card sheet',
      many: 'card sheets',
      dir: sheetDir,
      path: sheetPath,
      parse: parseSheet,
      serialize: serializeSheet,
    },
    {
      get: () => get().sheets,
      set: (sheets, loaded) => {
        set(loaded ? { sheets, loaded } : { sheets });
      },
    },
  );
  return {
    sheets: [],
    loaded: false,
    ...docs.actions,
    create: (name, campaign, keys = []) => {
      const base = newSheet(name, docs.ids(), new Date().toISOString());
      return docs.add(addCards(inCampaign(base, campaign), keys));
    },
    send: (sheetId, keys) => {
      const sheet = get().sheets.find((s) => s.id === sheetId);
      if (sheet) get().save(addCards(sheet, keys));
    },
  };
});

export function useCardSheet(id: string): CardSheet | undefined {
  return useCardSheets((s) => s.sheets.find((x) => x.id === id));
}
