import { create } from 'zustand';
import { CAMPAIGNS_DIR } from '../campaigns/model';
import { userStore } from '../userStore';
import {
  characterDir,
  characterPath,
  newCharacterFile,
  parseCharacter,
  serializeCharacter,
  type CharacterFile,
} from './model';

/**
 * Every character: the library and each campaign's copies, kept in memory and written back on
 * every change. A character is found by its id (ids are unique across the library and campaigns).
 */

interface CharactersStore {
  characters: CharacterFile[];
  loaded: boolean;
  load: () => Promise<void>;
  /** Reads every file again (after a sync brought changes). */
  reload: () => Promise<void>;
  /** A new character, in the library or in a campaign. */
  create: (name: string, edition: '2014' | '2024', campaign?: string) => Promise<CharacterFile>;
  /** Replaces a character in memory and writes it. */
  save: (character: CharacterFile) => void;
  /** Writes pending saves now (before a sync, or when leaving). */
  flush: () => Promise<void>;
  /**
   * A copy with a new id, in the library (`undefined`) or a campaign. The copy keeps every
   * decision; the original is untouched.
   */
  copyTo: (id: string, campaign: string | undefined) => Promise<CharacterFile | undefined>;
  remove: (id: string) => Promise<void>;
}

const pending = new Map<string, CharacterFile>();
/** Writes run one after another; a burst of edits ends in one write of the latest version. */
let writing: Promise<void> = Promise.resolve();
let loading: Promise<void> | null = null;

async function readDir(campaign?: string): Promise<CharacterFile[]> {
  const store = await userStore();
  const out: CharacterFile[] = [];
  for (const entry of await store.list(characterDir(campaign))) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const c = parseCharacter(await store.readText(entry.path), entry.name.slice(0, -5), campaign);
    if (c) out.push(c);
  }
  return out;
}

async function readAll(): Promise<CharacterFile[]> {
  const store = await userStore();
  const campaigns = (await store.list(CAMPAIGNS_DIR)).filter((e) => e.kind === 'directory');
  const lists = await Promise.all([readDir(), ...campaigns.map((c) => readDir(c.name))]);
  return sortCharacters(lists.flat());
}

const sortCharacters = (list: CharacterFile[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'en'));

/** Writes what is pending, after any write already under way. Files are small: no delay. */
function writeNow(): Promise<void> {
  writing = writing
    .then(async () => {
      const batch = [...pending.values()];
      pending.clear();
      if (batch.length === 0) return;
      const store = await userStore();
      for (const c of batch)
        await store.writeFile(characterPath(c.id, c.campaign), serializeCharacter(c));
    })
    .catch((error: unknown) => {
      console.warn('Could not save a character', error);
    });
  return writing;
}

export const useCharacters = create<CharactersStore>()((set, get) => {
  /** Writes a new file and adds it to the list. */
  const add = async (c: CharacterFile) => {
    const store = await userStore();
    await store.writeFile(characterPath(c.id, c.campaign), serializeCharacter(c));
    set({ characters: sortCharacters([...get().characters, c]) });
    return c;
  };
  const ids = () => get().characters.map((c) => c.id);

  return {
    characters: [],
    loaded: false,

    load: () => {
      loading ??= readAll()
        .then((characters) => {
          set({ characters, loaded: true });
        })
        .catch((error: unknown) => {
          console.warn('Could not load characters', error);
          set({ loaded: true });
        });
      return loading;
    },

    reload: async () => {
      await writeNow();
      loading = null;
      await get().load();
    },

    create: (name, edition, campaign) => {
      const c = newCharacterFile(name, edition, ids(), new Date().toISOString());
      return add(campaign ? { ...c, campaign } : c);
    },

    save: (character) => {
      const next = { ...character, updatedAt: new Date().toISOString() };
      set({
        characters: sortCharacters(get().characters.map((c) => (c.id === next.id ? next : c))),
      });
      pending.set(next.id, next);
      void writeNow();
    },

    flush: writeNow,

    copyTo: async (id, campaign) => {
      const source = get().characters.find((c) => c.id === id);
      if (!source) return undefined;
      const now = new Date().toISOString();
      const fresh = newCharacterFile(source.name, source.decisions.edition, ids(), now);
      const { campaign: _from, ...rest } = structuredClone(source);
      // In the same place a copy needs another name to tell them apart.
      const name = campaign === source.campaign ? `${source.name} (copy)` : source.name;
      return add({
        ...rest,
        id: fresh.id,
        name,
        createdAt: now,
        updatedAt: now,
        ...(campaign ? { campaign } : {}),
      });
    },

    remove: async (id) => {
      const c = get().characters.find((x) => x.id === id);
      if (!c) return;
      pending.delete(id);
      const store = await userStore();
      await store.remove(characterPath(id, c.campaign));
      set({ characters: get().characters.filter((x) => x.id !== id) });
    },
  };
});

export function useCharacter(id: string): CharacterFile | undefined {
  return useCharacters((s) => s.characters.find((c) => c.id === id));
}

// Leaving the page (closing the tab, reloading, switching app on a phone) saves edits right away.
if (typeof document !== 'undefined') {
  const saveNow = () => {
    void writeNow();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);
}
