import { create } from 'zustand';
import { CAMPAIGNS_DIR } from '../campaigns/model';
import { userStore } from '../userStore';
import {
  newMap,
  parseMap,
  serializeMap,
  mapDir,
  mapPath,
  mapThumbPath,
  type MapDoc,
  type MapKind,
} from './model';

/**
 * Every map, in the library and in each campaign, kept in memory and written back on
 * every change (files are small).
 */

interface MapsStore {
  maps: MapDoc[];
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  create: (name: string, campaign?: string, kind?: MapKind) => Promise<MapDoc>;
  save: (map: MapDoc) => void;
  flush: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const pending = new Map<string, MapDoc>();
let writing: Promise<void> = Promise.resolve();
let loading: Promise<void> | null = null;

async function readDir(campaign?: string): Promise<MapDoc[]> {
  const store = await userStore();
  const out: MapDoc[] = [];
  for (const entry of await store.list(mapDir(campaign))) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const s = parseMap(await store.readText(entry.path), entry.name.slice(0, -5), campaign);
    if (s) out.push(s);
  }
  return out;
}

async function readAll(): Promise<MapDoc[]> {
  const store = await userStore();
  const campaigns = (await store.list(CAMPAIGNS_DIR)).filter((e) => e.kind === 'directory');
  const lists = await Promise.all([readDir(), ...campaigns.map((c) => readDir(c.name))]);
  return sortMapDocs(lists.flat());
}

const sortMapDocs = (list: MapDoc[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'en'));

function writeNow(): Promise<void> {
  writing = writing
    .then(async () => {
      const batch = [...pending.values()];
      pending.clear();
      if (batch.length === 0) return;
      const store = await userStore();
      for (const s of batch) await store.writeFile(mapPath(s.id, s.campaign), serializeMap(s));
    })
    .catch((error: unknown) => {
      console.warn('Could not save a card map', error);
    });
  return writing;
}

export const useMaps = create<MapsStore>()((set, get) => ({
  maps: [],
  loaded: false,

  load: () => {
    loading ??= readAll()
      .then((maps) => {
        set({ maps, loaded: true });
      })
      .catch((error: unknown) => {
        console.warn('Could not load card maps', error);
        set({ loaded: true });
      });
    return loading;
  },

  reload: async () => {
    await writeNow();
    loading = null;
    await get().load();
  },

  create: async (name, campaign, kind) => {
    const base = newMap(
      name,
      get().maps.map((s) => s.id),
      new Date().toISOString(),
      kind,
    );
    const map = campaign ? { ...base, campaign } : base;
    const store = await userStore();
    await store.writeFile(mapPath(map.id, map.campaign), serializeMap(map));
    set({ maps: sortMapDocs([...get().maps, map]) });
    return map;
  },

  save: (map) => {
    const next = { ...map, updatedAt: new Date().toISOString() };
    set({ maps: sortMapDocs(get().maps.map((s) => (s.id === next.id ? next : s))) });
    pending.set(next.id, next);
    void writeNow();
  },

  flush: writeNow,

  remove: async (id) => {
    const map = get().maps.find((s) => s.id === id);
    if (!map) return;
    pending.delete(id);
    const store = await userStore();
    await store.remove(mapPath(id, map.campaign));
    // A map without a picture has no thumbnail.
    await store.remove(mapThumbPath(id, map.campaign)).catch(() => undefined);
    set({ maps: get().maps.filter((s) => s.id !== id) });
  },
}));

export function useMapDoc(id: string): MapDoc | undefined {
  return useMaps((s) => s.maps.find((x) => x.id === id));
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
