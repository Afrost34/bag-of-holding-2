import { create } from 'zustand';
import { docStore, inCampaign } from '../docStore';
import {
  addMonsters,
  newEncounter,
  parseEncounter,
  serializeEncounter,
  encounterDir,
  encounterPath,
  type Encounter,
} from './model';

/** Every encounter, in the library and in each campaign (see `docStore`). */

interface EncountersStore {
  encounters: Encounter[];
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  create: (name: string, campaign?: string, keys?: readonly string[]) => Promise<Encounter>;
  save: (encounter: Encounter) => void;
  /** Adds monsters to an encounter. */
  send: (encounterId: string, keys: readonly string[]) => void;
  flush: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useEncounters = create<EncountersStore>()((set, get) => {
  const docs = docStore(
    {
      one: 'an encounter',
      many: 'encounters',
      dir: encounterDir,
      path: encounterPath,
      parse: parseEncounter,
      serialize: serializeEncounter,
    },
    {
      get: () => get().encounters,
      set: (encounters, loaded) => {
        set(loaded ? { encounters, loaded } : { encounters });
      },
    },
  );
  return {
    encounters: [],
    loaded: false,
    ...docs.actions,
    create: (name, campaign, keys = []) => {
      const base = newEncounter(name, docs.ids(), new Date().toISOString());
      return docs.add(addMonsters(inCampaign(base, campaign), keys));
    },
    send: (encounterId, keys) => {
      const encounter = get().encounters.find((s) => s.id === encounterId);
      if (encounter) get().save(addMonsters(encounter, keys));
    },
  };
});

export function useEncounter(id: string): Encounter | undefined {
  return useEncounters((s) => s.encounters.find((x) => x.id === id));
}
