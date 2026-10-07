import { updateLinksForRename } from '@boh/journal';
import type { FileStore } from '@boh/storage';
import { create } from 'zustand';
import { campaignDir } from '../campaigns/model';
import { useCampaigns } from '../campaigns/store';
import { userStore } from '../userStore';

/**
 * The open campaign's journal: Markdown notes and their attachments in
 * `campaigns/<id>/journal/`. Notes are kept in memory (a campaign has hundreds, not millions) so
 * links, backlinks and search are instant; changes are written shortly after typing stops.
 */

const SAVE_AFTER_MS = 500;

export function journalRoot(campaignId: string): string {
  return `${campaignDir(campaignId)}/journal`;
}

interface JournalStore {
  /** The campaign whose journal is loaded; null without a campaign. */
  campaignId: string | null;
  loaded: boolean;
  /** Note path (relative to the journal root, e.g. `Places/Waterdeep.md`) → Markdown. */
  notes: Map<string, string>;
  /** Other files: images, PDFs. */
  attachments: string[];
  /** Every folder, including empty ones. */
  folders: string[];
  load: (campaignId: string | null) => Promise<void>;
  /** Edits a note; saved shortly after. */
  setText: (path: string, text: string) => void;
  /** Creates a note (a free name in `folder`), returning its path. */
  createNote: (folder: string, name?: string, text?: string) => Promise<string>;
  createFolder: (path: string) => Promise<void>;
  /** Moves or renames a note or folder; links pointing at moved notes are updated. */
  move: (from: string, to: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let loadingFor: string | null | undefined;

async function walk(
  store: FileStore,
  root: string,
  dir = '',
): Promise<{ files: string[]; folders: string[] }> {
  const files: string[] = [];
  const folders: string[] = [];
  for (const entry of await store.list(dir ? `${root}/${dir}` : root)) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      folders.push(rel);
      const inner = await walk(store, root, rel);
      files.push(...inner.files);
      folders.push(...inner.folders);
    } else {
      files.push(rel);
    }
  }
  return { files, folders };
}

const isNote = (path: string) => path.toLowerCase().endsWith('.md');
const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const within = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);

/** Every parent folder of a path: `a/b/c.md` → `a`, `a/b`. */
function parentsOf(path: string): string[] {
  const parts = path.split('/').slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}

export const useJournal = create<JournalStore>()((set, get) => {
  const root = () => {
    const id = get().campaignId;
    if (!id) throw new Error('No campaign is open');
    return journalRoot(id);
  };

  const flush = async (path: string) => {
    const timer = timers.get(path);
    if (timer) clearTimeout(timer);
    timers.delete(path);
    const text = get().notes.get(path);
    if (text === undefined) return;
    const store = await userStore();
    await store.writeFile(`${root()}/${path}`, text);
  };

  const flushAll = async () => {
    await Promise.all([...timers.keys()].map(flush));
  };

  return {
    campaignId: null,
    loaded: false,
    notes: new Map(),
    attachments: [],
    folders: [],

    load: async (campaignId) => {
      if (loadingFor === campaignId && (get().loaded || campaignId === null)) return;
      if (get().campaignId && get().campaignId !== campaignId) await flushAll();
      loadingFor = campaignId;
      set({ campaignId, loaded: false, notes: new Map(), attachments: [], folders: [] });
      if (!campaignId) {
        set({ loaded: true });
        return;
      }
      const store = await userStore();
      const base = journalRoot(campaignId);
      const { files, folders } = await walk(store, base);
      const notes = new Map<string, string>();
      for (const f of files.filter(isNote))
        notes.set(f, (await store.readText(`${base}/${f}`)) ?? '');
      if (loadingFor !== campaignId) return; // switched again meanwhile
      set({
        notes,
        attachments: files.filter((f) => !isNote(f)),
        folders: folders.sort((a, b) => a.localeCompare(b)),
        loaded: true,
      });
    },

    setText: (path, text) => {
      const notes = new Map(get().notes);
      notes.set(path, text);
      set({ notes });
      const timer = timers.get(path);
      if (timer) clearTimeout(timer);
      timers.set(
        path,
        setTimeout(() => {
          void flush(path).catch((error: unknown) => {
            console.warn('Could not save note', path, error);
          });
        }, SAVE_AFTER_MS),
      );
    },

    createNote: async (folder, name = 'Untitled', text = '') => {
      const taken = new Set([...get().notes.keys()].map((p) => p.toLowerCase()));
      const prefix = folder ? `${folder}/` : '';
      let path = `${prefix}${name}.md`;
      for (let n = 1; taken.has(path.toLowerCase()); n++) path = `${prefix}${name} ${String(n)}.md`;
      const store = await userStore();
      await store.writeFile(`${root()}/${path}`, text);
      const notes = new Map(get().notes);
      notes.set(path, text);
      set({ notes, folders: [...new Set([...get().folders, ...parentsOf(path)])].sort() });
      return path;
    },

    createFolder: async (path) => {
      const store = await userStore();
      await store.mkdir(`${root()}/${path}`);
      set({ folders: [...new Set([...get().folders, ...parentsOf(`${path}/x`)])].sort() });
    },

    move: async (from, to) => {
      if (from === to) return;
      await flushAll();
      const store = await userStore();
      const base = root();
      const { notes, attachments, folders } = get();
      const isFolder = folders.includes(from);
      const rename = (p: string) =>
        isFolder && within(p, from) ? `${to}${p.slice(from.length)}` : p === from ? to : p;

      const before = [...notes.keys(), ...attachments];
      const moved = before.filter((p) => (isFolder ? within(p, from) : p === from));
      const after = before.map(rename);

      // Move the files themselves.
      for (const p of moved) {
        const bytes = await store.readFile(`${base}/${p}`);
        if (bytes) await store.writeFile(`${base}/${rename(p)}`, bytes);
      }
      for (const p of moved) await store.remove(`${base}/${p}`);
      if (isFolder) await store.remove(`${base}/${from}`, { recursive: true });

      // Rewrite links that pointed at moved notes.
      const nextNotes = new Map<string, string>();
      for (const [path, text] of notes) {
        let next = text;
        for (const old of moved.filter(isNote)) {
          next = updateLinksForRename(next, path, old, rename(old), before, after);
        }
        nextNotes.set(rename(path), next);
        if (next !== text) await store.writeFile(`${base}/${rename(path)}`, next);
      }
      set({
        notes: nextNotes,
        attachments: attachments.map(rename),
        folders: [
          ...new Set([
            ...folders.map((f) =>
              isFolder && within(f, from) ? `${to}${f.slice(from.length)}` : f,
            ),
            ...parentsOf(to),
          ]),
        ].sort(),
      });
    },

    remove: async (path) => {
      const timer = timers.get(path);
      if (timer) clearTimeout(timer);
      timers.delete(path);
      const store = await userStore();
      const { notes, attachments, folders } = get();
      const isFolder = folders.includes(path);
      await store.remove(`${root()}/${path}`, { recursive: isFolder });
      const keep = (p: string) => (isFolder ? !within(p, path) : p !== path);
      set({
        notes: new Map([...notes].filter(([p]) => keep(p))),
        attachments: attachments.filter(keep),
        folders: folders.filter((f) => (isFolder ? !within(f, path) : true)),
      });
    },
  };
});

/** The journal follows the open campaign. */
useCampaigns.subscribe((state, previous) => {
  if (state.activeId !== previous.activeId || (state.loaded && !previous.loaded)) {
    if (useJournal.getState().campaignId !== null || state.activeId !== null) {
      void useJournal.getState().load(state.activeId);
    }
  }
});

export { parentOf as folderOfPath };
