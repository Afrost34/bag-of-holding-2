import { create } from 'zustand';
import { CAMPAIGNS_DIR } from '../campaigns/model';
import { userStore } from '../userStore';
import {
  addCards,
  newSheet,
  parseSheet,
  serializeSheet,
  sheetDir,
  sheetPath,
  type CardSheet,
} from './model';

/**
 * Every card sheet, in the library and in each campaign, kept in memory and written back on
 * every change (files are small).
 */

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

const pending = new Map<string, CardSheet>();
let writing: Promise<void> = Promise.resolve();
let loading: Promise<void> | null = null;

async function readDir(campaign?: string): Promise<CardSheet[]> {
  const store = await userStore();
  const out: CardSheet[] = [];
  for (const entry of await store.list(sheetDir(campaign))) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const s = parseSheet(await store.readText(entry.path), entry.name.slice(0, -5), campaign);
    if (s) out.push(s);
  }
  return out;
}

async function readAll(): Promise<CardSheet[]> {
  const store = await userStore();
  const campaigns = (await store.list(CAMPAIGNS_DIR)).filter((e) => e.kind === 'directory');
  const lists = await Promise.all([readDir(), ...campaigns.map((c) => readDir(c.name))]);
  return sortSheets(lists.flat());
}

const sortSheets = (list: CardSheet[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'en'));

function writeNow(): Promise<void> {
  writing = writing
    .then(async () => {
      const batch = [...pending.values()];
      pending.clear();
      if (batch.length === 0) return;
      const store = await userStore();
      for (const s of batch) await store.writeFile(sheetPath(s.id, s.campaign), serializeSheet(s));
    })
    .catch((error: unknown) => {
      console.warn('Could not save a card sheet', error);
    });
  return writing;
}

export const useCardSheets = create<CardSheetsStore>()((set, get) => ({
  sheets: [],
  loaded: false,

  load: () => {
    loading ??= readAll()
      .then((sheets) => {
        set({ sheets, loaded: true });
      })
      .catch((error: unknown) => {
        console.warn('Could not load card sheets', error);
        set({ loaded: true });
      });
    return loading;
  },

  reload: async () => {
    await writeNow();
    loading = null;
    await get().load();
  },

  create: async (name, campaign, keys = []) => {
    const base = newSheet(
      name,
      get().sheets.map((s) => s.id),
      new Date().toISOString(),
    );
    const sheet = addCards(campaign ? { ...base, campaign } : base, keys);
    const store = await userStore();
    await store.writeFile(sheetPath(sheet.id, sheet.campaign), serializeSheet(sheet));
    set({ sheets: sortSheets([...get().sheets, sheet]) });
    return sheet;
  },

  save: (sheet) => {
    const next = { ...sheet, updatedAt: new Date().toISOString() };
    set({ sheets: sortSheets(get().sheets.map((s) => (s.id === next.id ? next : s))) });
    pending.set(next.id, next);
    void writeNow();
  },

  send: (sheetId, keys) => {
    const sheet = get().sheets.find((s) => s.id === sheetId);
    if (sheet) get().save(addCards(sheet, keys));
  },

  flush: writeNow,

  remove: async (id) => {
    const sheet = get().sheets.find((s) => s.id === id);
    if (!sheet) return;
    pending.delete(id);
    const store = await userStore();
    await store.remove(sheetPath(id, sheet.campaign));
    set({ sheets: get().sheets.filter((s) => s.id !== id) });
  },
}));

export function useCardSheet(id: string): CardSheet | undefined {
  return useCardSheets((s) => s.sheets.find((x) => x.id === id));
}

if (typeof document !== 'undefined') {
  const saveNow = () => {
    void writeNow();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);
}
