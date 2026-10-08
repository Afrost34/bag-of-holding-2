import { create } from 'zustand';
import { docStore, inCampaign } from '../docStore';
import {
  newTable,
  parseTable,
  serializeTable,
  tableDir,
  tablePath,
  type RollTable,
  type TableKind,
} from './model';

/** Every roll table, in the library and in each campaign (see `docStore`). */

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

export const useTables = create<TablesStore>()((set, get) => {
  const docs = docStore(
    {
      one: 'a table',
      many: 'tables',
      dir: tableDir,
      path: tablePath,
      parse: parseTable,
      serialize: serializeTable,
    },
    {
      get: () => get().tables,
      set: (tables, loaded) => {
        set(loaded ? { tables, loaded } : { tables });
      },
    },
  );
  return {
    tables: [],
    loaded: false,
    ...docs.actions,
    create: (name, kind, campaign) =>
      docs.add(inCampaign(newTable(name, kind, docs.ids(), new Date().toISOString()), campaign)),
  };
});

export function useTable(id: string): RollTable | undefined {
  return useTables((s) => s.tables.find((x) => x.id === id));
}
