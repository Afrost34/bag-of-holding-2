import { create } from 'zustand';
import { CAMPAIGNS_DIR } from '../campaigns/model';
import { userStore } from '../userStore';
import {
  newTable,
  parseTable,
  serializeTable,
  tableDir,
  tablePath,
  type RollTable,
  type TableKind,
} from './model';

/**
 * Every table, in the library and in each campaign, kept in memory and written back on
 * every change (files are small).
 */

interface TablesStore {
  tables: RollTable[];
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  create: (name: string, kind: TableKind, campaign?: string) => Promise<RollTable>;
  save: (table: RollTable) => void;
  flush: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const pending = new Map<string, RollTable>();
let writing: Promise<void> = Promise.resolve();
let loading: Promise<void> | null = null;

async function readDir(campaign?: string): Promise<RollTable[]> {
  const store = await userStore();
  const out: RollTable[] = [];
  for (const entry of await store.list(tableDir(campaign))) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const s = parseTable(await store.readText(entry.path), entry.name.slice(0, -5), campaign);
    if (s) out.push(s);
  }
  return out;
}

async function readAll(): Promise<RollTable[]> {
  const store = await userStore();
  const campaigns = (await store.list(CAMPAIGNS_DIR)).filter((e) => e.kind === 'directory');
  const lists = await Promise.all([readDir(), ...campaigns.map((c) => readDir(c.name))]);
  return sortTables(lists.flat());
}

const sortTables = (list: RollTable[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'en'));

function writeNow(): Promise<void> {
  writing = writing
    .then(async () => {
      const batch = [...pending.values()];
      pending.clear();
      if (batch.length === 0) return;
      const store = await userStore();
      for (const s of batch) await store.writeFile(tablePath(s.id, s.campaign), serializeTable(s));
    })
    .catch((error: unknown) => {
      console.warn('Could not save a table', error);
    });
  return writing;
}

export const useTables = create<TablesStore>()((set, get) => ({
  tables: [],
  loaded: false,

  load: () => {
    loading ??= readAll()
      .then((tables) => {
        set({ tables, loaded: true });
      })
      .catch((error: unknown) => {
        console.warn('Could not load tables', error);
        set({ loaded: true });
      });
    return loading;
  },

  reload: async () => {
    await writeNow();
    loading = null;
    await get().load();
  },

  create: async (name, kind, campaign) => {
    const base = newTable(
      name,
      kind,
      get().tables.map((s) => s.id),
      new Date().toISOString(),
    );
    const table = campaign ? { ...base, campaign } : base;
    const store = await userStore();
    await store.writeFile(tablePath(table.id, table.campaign), serializeTable(table));
    set({ tables: sortTables([...get().tables, table]) });
    return table;
  },

  save: (table) => {
    const next = { ...table, updatedAt: new Date().toISOString() };
    set({ tables: sortTables(get().tables.map((s) => (s.id === next.id ? next : s))) });
    pending.set(next.id, next);
    void writeNow();
  },

  flush: writeNow,

  remove: async (id) => {
    const table = get().tables.find((s) => s.id === id);
    if (!table) return;
    pending.delete(id);
    const store = await userStore();
    await store.remove(tablePath(id, table.campaign));
    set({ tables: get().tables.filter((s) => s.id !== id) });
  },
}));

export function useTable(id: string): RollTable | undefined {
  return useTables((s) => s.tables.find((x) => x.id === id));
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
