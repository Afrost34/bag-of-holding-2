import {
  allNoteTypes,
  parseNoteTypeDefs,
  setCustomNoteTypes,
  type CustomNoteTypeDef,
  type NoteType,
} from '@boh/journal';
import { create } from 'zustand';
import { userStore } from '../userStore';

/**
 * A campaign's own kinds of notes (Ships, Guilds…), next to the built-in NPCs, locations and the
 * rest:
 *
 *   campaigns/<campaign>/note-types.json
 *
 * They are kept in the journal package's list too, so everything that asks for a kind of note
 * (the wizard, bases, search, the compendium) knows them.
 */

export const noteTypesPath = (campaignId: string) => `campaigns/${campaignId}/note-types.json`;

interface NoteTypesStore {
  campaignId: string | null;
  defs: CustomNoteTypeDef[];
  load: (campaignId: string | null) => Promise<void>;
  save: (defs: CustomNoteTypeDef[]) => Promise<void>;
}

export const useNoteTypes = create<NoteTypesStore>()((set, get) => ({
  campaignId: null,
  defs: [],

  load: async (campaignId) => {
    if (!campaignId) {
      setCustomNoteTypes([]);
      set({ campaignId: null, defs: [] });
      return;
    }
    const store = await userStore();
    let defs: CustomNoteTypeDef[];
    try {
      const text = await store.readText(noteTypesPath(campaignId));
      defs = text ? parseNoteTypeDefs(JSON.parse(text)) : [];
    } catch {
      defs = [];
    }
    setCustomNoteTypes(defs);
    set({ campaignId, defs });
  },

  save: async (defs) => {
    const campaignId = get().campaignId;
    if (!campaignId) return;
    setCustomNoteTypes(defs);
    set({ defs });
    const store = await userStore();
    await store.writeFile(noteTypesPath(campaignId), `${JSON.stringify(defs, null, 2)}\n`);
  },
}));

/** Every kind of note of the open campaign, built-in first; updates when kinds are edited. */
export function useAllNoteTypes(): readonly NoteType[] {
  useNoteTypes((s) => s.defs);
  return allNoteTypes();
}
