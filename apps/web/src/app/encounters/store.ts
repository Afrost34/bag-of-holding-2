import { create } from 'zustand';
import { CAMPAIGNS_DIR } from '../campaigns/model';
import { userStore } from '../userStore';
import {
  addMonsters,
  newEncounter,
  parseEncounter,
  serializeEncounter,
  encounterDir,
  encounterPath,
  type Encounter,
} from './model';

/**
 * Every encounter, in the library and in each campaign, kept in memory and written back on
 * every change (files are small).
 */

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

const pending = new Map<string, Encounter>();
let writing: Promise<void> = Promise.resolve();
let loading: Promise<void> | null = null;

async function readDir(campaign?: string): Promise<Encounter[]> {
  const store = await userStore();
  const out: Encounter[] = [];
  for (const entry of await store.list(encounterDir(campaign))) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const s = parseEncounter(await store.readText(entry.path), entry.name.slice(0, -5), campaign);
    if (s) out.push(s);
  }
  return out;
}

async function readAll(): Promise<Encounter[]> {
  const store = await userStore();
  const campaigns = (await store.list(CAMPAIGNS_DIR)).filter((e) => e.kind === 'directory');
  const lists = await Promise.all([readDir(), ...campaigns.map((c) => readDir(c.name))]);
  return sortEncounters(lists.flat());
}

const sortEncounters = (list: Encounter[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'en'));

function writeNow(): Promise<void> {
  writing = writing
    .then(async () => {
      const batch = [...pending.values()];
      pending.clear();
      if (batch.length === 0) return;
      const store = await userStore();
      for (const s of batch)
        await store.writeFile(encounterPath(s.id, s.campaign), serializeEncounter(s));
    })
    .catch((error: unknown) => {
      console.warn('Could not save a card encounter', error);
    });
  return writing;
}

export const useEncounters = create<EncountersStore>()((set, get) => ({
  encounters: [],
  loaded: false,

  load: () => {
    loading ??= readAll()
      .then((encounters) => {
        set({ encounters, loaded: true });
      })
      .catch((error: unknown) => {
        console.warn('Could not load card encounters', error);
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
    const base = newEncounter(
      name,
      get().encounters.map((s) => s.id),
      new Date().toISOString(),
    );
    const encounter = addMonsters(campaign ? { ...base, campaign } : base, keys);
    const store = await userStore();
    await store.writeFile(
      encounterPath(encounter.id, encounter.campaign),
      serializeEncounter(encounter),
    );
    set({ encounters: sortEncounters([...get().encounters, encounter]) });
    return encounter;
  },

  save: (encounter) => {
    const next = { ...encounter, updatedAt: new Date().toISOString() };
    set({ encounters: sortEncounters(get().encounters.map((s) => (s.id === next.id ? next : s))) });
    pending.set(next.id, next);
    void writeNow();
  },

  send: (encounterId, keys) => {
    const encounter = get().encounters.find((s) => s.id === encounterId);
    if (encounter) get().save(addMonsters(encounter, keys));
  },

  flush: writeNow,

  remove: async (id) => {
    const encounter = get().encounters.find((s) => s.id === id);
    if (!encounter) return;
    pending.delete(id);
    const store = await userStore();
    await store.remove(encounterPath(id, encounter.campaign));
    set({ encounters: get().encounters.filter((s) => s.id !== id) });
  },
}));

export function useEncounter(id: string): Encounter | undefined {
  return useEncounters((s) => s.encounters.find((x) => x.id === id));
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
