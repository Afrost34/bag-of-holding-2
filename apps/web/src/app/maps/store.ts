import { create } from 'zustand';
import { docStore, inCampaign, sortByName } from '../docStore';
import { userStore } from '../userStore';
import { publishMap } from './live';
import {
  newMap,
  parseMap,
  mapIsStale,
  serializeMap,
  mapDir,
  mapPath,
  mapThumbPath,
  relocateMap,
  type MapDoc,
} from './model';

/** Every map, in the library and in each campaign (see `docStore`). */

interface MapsStore {
  maps: MapDoc[];
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  create: (name: string, campaign?: string, squares?: { w: number; h: number }) => Promise<MapDoc>;
  save: (map: MapDoc) => void;
  flush: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Moves a map to a campaign (or the library, with none), with its pictures. */
  move: (id: string, campaign: string | undefined) => Promise<void>;
}

export const useMaps = create<MapsStore>()((set, get) => {
  const docs = docStore(
    {
      one: 'a map',
      many: 'maps',
      dir: mapDir,
      path: mapPath,
      parse: parseMap,
      serialize: serializeMap,
      stale: mapIsStale,
      // Its thumbnail goes with it.
      alongside: (m) => [mapThumbPath(m.id, m.campaign), ...Object.values(m.render?.images ?? {})],
    },
    {
      get: () => get().maps,
      set: (maps, loaded) => {
        set(loaded ? { maps, loaded } : { maps });
      },
    },
  );
  return {
    maps: [],
    loaded: false,
    ...docs.actions,
    save: (map) => {
      docs.actions.save(map);
      publishMap(map);
    },
    move: async (id, campaign) => {
      await docs.actions.flush();
      const map = get().maps.find((m) => m.id === id);
      if (!map || map.campaign === campaign) return;
      const store = await userStore();
      const taken = new Set<string>();
      for (const entry of await store.list(`${mapDir(campaign)}/assets`).catch(() => []))
        taken.add(entry.path);
      const { doc, copies } = relocateMap(map, campaign, (path) => taken.has(path));
      // Pictures first (so nothing is lost if this stops half way), then the map itself.
      for (const [from, to] of copies) {
        const bytes = await store.readFile(from);
        if (bytes) await store.writeFile(to, bytes);
      }
      // The new file first, then the old one and its pictures go. The map in memory is swapped in
      // one step, so a page showing it never sees it vanish.
      const moved = { ...doc, updatedAt: new Date().toISOString() };
      await store.writeFile(mapPath(id, campaign), serializeMap(moved));
      const oldFiles = [
        mapPath(id, map.campaign),
        mapThumbPath(id, map.campaign),
        ...Object.values(map.render?.images ?? {}),
        ...map.layers.flatMap((l) => (l.picture ? [l.picture.path] : [])),
      ];
      for (const path of oldFiles) await store.remove(path).catch(() => undefined);
      set({ maps: sortByName(get().maps.map((m) => (m.id === id ? moved : m))) });
    },
    create: (name, campaign, squares) =>
      docs.add(inCampaign(newMap(name, docs.ids(), new Date().toISOString(), squares), campaign)),
  };
});

export function useMapDoc(id: string): MapDoc | undefined {
  return useMaps((s) => s.maps.find((x) => x.id === id));
}
