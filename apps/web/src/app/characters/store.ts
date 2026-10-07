import { create } from 'zustand';
import { userStore } from '../userStore';
import {
  characterPath,
  CHARACTERS_DIR,
  newCharacterFile,
  parseCharacter,
  serializeCharacter,
  type CharacterFile,
} from './model';

/** The character library: every character file, kept in memory and written back on change. */

interface CharactersStore {
  characters: CharacterFile[];
  loaded: boolean;
  load: () => Promise<void>;
  /** Reads every file again (after a sync brought changes). */
  reload: () => Promise<void>;
  create: (name: string, edition: '2014' | '2024') => Promise<CharacterFile>;
  /** Replaces a character in memory and writes it. */
  save: (character: CharacterFile) => void;
  /** Writes pending saves now (before a sync, or when leaving). */
  flush: () => Promise<void>;
  duplicate: (id: string) => Promise<CharacterFile | undefined>;
  remove: (id: string) => Promise<void>;
}

const pending = new Map<string, CharacterFile>();
/** Writes run one after another; a burst of edits ends in one write of the latest version. */
let writing: Promise<void> = Promise.resolve();
let loading: Promise<void> | null = null;

async function readAll(): Promise<CharacterFile[]> {
  const store = await userStore();
  const out: CharacterFile[] = [];
  for (const entry of await store.list(CHARACTERS_DIR)) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const c = parseCharacter(await store.readText(entry.path), entry.name.slice(0, -5));
    if (c) out.push(c);
  }
  return sortCharacters(out);
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
      for (const c of batch) await store.writeFile(characterPath(c.id), serializeCharacter(c));
    })
    .catch((error: unknown) => {
      console.warn('Could not save a character', error);
    });
  return writing;
}

export const useCharacters = create<CharactersStore>()((set, get) => ({
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

  create: async (name, edition) => {
    const ids = get().characters.map((c) => c.id);
    const c = newCharacterFile(name, edition, ids, new Date().toISOString());
    const store = await userStore();
    await store.writeFile(characterPath(c.id), serializeCharacter(c));
    set({ characters: sortCharacters([...get().characters, c]) });
    return c;
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

  duplicate: async (id) => {
    const source = get().characters.find((c) => c.id === id);
    if (!source) return undefined;
    const ids = get().characters.map((c) => c.id);
    const now = new Date().toISOString();
    const fresh = newCharacterFile(`${source.name} (copy)`, source.decisions.edition, ids, now);
    const copy: CharacterFile = {
      ...structuredClone(source),
      id: fresh.id,
      name: fresh.name,
      createdAt: now,
      updatedAt: now,
    };
    const store = await userStore();
    await store.writeFile(characterPath(copy.id), serializeCharacter(copy));
    set({ characters: sortCharacters([...get().characters, copy]) });
    return copy;
  },

  remove: async (id) => {
    pending.delete(id);
    const store = await userStore();
    await store.remove(characterPath(id));
    set({ characters: get().characters.filter((c) => c.id !== id) });
  },
}));

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
