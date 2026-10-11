import { create } from 'zustand';
import { newId } from '../cards/model';
import { docStore } from '../docStore';
import {
  legacyPrefabs,
  parsePrefab,
  prefabDir,
  prefabPath,
  serializePrefab,
  type Prefab,
} from './prefabs';

/** Every saved map prefab, in `map-prefabs/` of the data repo (see `docStore`), so every device has them. */

/** Where prefabs were kept before they were synced: moved into files once, then removed. */
const LEGACY_KEY = 'boh.map.prefabs';

interface PrefabStore {
  prefabs: Prefab[];
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  /** Writes a new prefab (made with `freshId`). */
  add: (prefab: Prefab) => Promise<Prefab>;
  save: (prefab: Prefab) => void;
  flush: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** An id no prefab has yet. */
  freshId: () => string;
}

function readLegacy(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

function dropLegacy(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing kept there, or no storage.
  }
}

export const usePrefabs = create<PrefabStore>()((set, get) => {
  const docs = docStore(
    {
      one: 'a prefab',
      many: 'prefabs',
      dir: prefabDir,
      path: prefabPath,
      parse: parsePrefab,
      serialize: serializePrefab,
    },
    {
      get: () => get().prefabs,
      set: (prefabs, loaded) => {
        set(loaded ? { prefabs, loaded } : { prefabs });
      },
    },
  );
  return {
    prefabs: [],
    loaded: false,
    ...docs.actions,
    load: async () => {
      await docs.actions.load();
      const old = legacyPrefabs(readLegacy(), docs.ids(), new Date().toISOString());
      for (const p of old) await docs.add(p);
      dropLegacy();
    },
    add: docs.add,
    freshId: () => newId(docs.ids()),
  };
});
