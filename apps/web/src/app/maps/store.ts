import { create } from 'zustand';
import { docStore, inCampaign } from '../docStore';
import { publishMap } from './live';
import {
  newMap,
  parseMap,
  mapIsStale,
  serializeMap,
  mapDir,
  mapPath,
  mapThumbPath,
  type MapDoc,
  type MapKind,
} from './model';

/** Every map, in the library and in each campaign (see `docStore`). */

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
      alongside: (m) => [mapThumbPath(m.id, m.campaign)],
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
    create: (name, campaign, kind) =>
      docs.add(inCampaign(newMap(name, docs.ids(), new Date().toISOString(), kind), campaign)),
  };
});

export function useMapDoc(id: string): MapDoc | undefined {
  return useMaps((s) => s.maps.find((x) => x.id === id));
}
