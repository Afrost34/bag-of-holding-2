import { create } from 'zustand';
import { docStore, inCampaign } from '../docStore';
import {
  characterDir,
  characterPath,
  newCharacterFile,
  parseCharacter,
  serializeCharacter,
  type CharacterFile,
} from './model';

/**
 * Every character: the library and each campaign's copies (see `docStore`). A character is found
 * by its id (ids are unique across the library and campaigns).
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

export const useCharacters = create<CharactersStore>()((set, get) => {
  const docs = docStore(
    {
      one: 'a character',
      many: 'characters',
      dir: characterDir,
      path: characterPath,
      parse: parseCharacter,
      serialize: serializeCharacter,
    },
    {
      get: () => get().characters,
      set: (characters, loaded) => {
        set(loaded ? { characters, loaded } : { characters });
      },
    },
  );
  return {
    characters: [],
    loaded: false,
    ...docs.actions,

    create: (name, edition, campaign) =>
      docs.add(
        inCampaign(newCharacterFile(name, edition, docs.ids(), new Date().toISOString()), campaign),
      ),

    copyTo: async (id, campaign) => {
      const source = get().characters.find((c) => c.id === id);
      if (!source) return undefined;
      const now = new Date().toISOString();
      const fresh = newCharacterFile(source.name, source.decisions.edition, docs.ids(), now);
      const { campaign: _from, ...rest } = structuredClone(source);
      // In the same place a copy needs another name to tell them apart.
      const name = campaign === source.campaign ? `${source.name} (copy)` : source.name;
      return docs.add(
        inCampaign({ ...rest, id: fresh.id, name, createdAt: now, updatedAt: now }, campaign),
      );
    },
  };
});

export function useCharacter(id: string): CharacterFile | undefined {
  return useCharacters((s) => s.characters.find((c) => c.id === id));
}
