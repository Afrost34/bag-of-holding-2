import { create } from 'zustand';
import { userStore } from '../userStore';
import {
  EMPTY_ANNOTATIONS,
  parseAnnotations,
  serializeAnnotations,
  setNote,
  toggleBookmark,
  type Annotations,
} from './model';

/** Bookmarks and notes before any campaign exists; moved into the first campaign. */
export const ROOT_ANNOTATIONS_FILE = 'annotations.json';
const SAVE_AFTER_MS = 400;

interface AnnotationsStore extends Annotations {
  /** The file these belong to: the active campaign's, or the root one without a campaign. */
  file: string;
  loaded: boolean;
  load: () => Promise<void>;
  toggleBookmark: (path: string, label: string) => void;
  setNote: (id: string, text: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let loading: { file: string; promise: Promise<void> } | null = null;

function writeNow(file: string, a: Annotations): Promise<void> {
  return userStore()
    .then((store) => store.writeFile(file, serializeAnnotations(a)))
    .catch((error: unknown) => {
      console.warn('Could not save bookmarks and notes', error);
    });
}

/** Bookmarks and personal notes of the active campaign, saved shortly after each change. */
export const useAnnotations = create<AnnotationsStore>()((set, get) => {
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    const { file, version, bookmarks, notes } = get();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void writeNow(file, { version, bookmarks, notes });
    }, SAVE_AFTER_MS);
  };
  const apply = (next: Annotations) => {
    set({ version: next.version, bookmarks: next.bookmarks, notes: next.notes });
    scheduleSave();
  };
  return {
    ...EMPTY_ANNOTATIONS,
    file: ROOT_ANNOTATIONS_FILE,
    loaded: false,
    load: () => {
      const file = get().file;
      if (loading?.file === file) return loading.promise;
      const promise = userStore()
        .then((store) => store.readText(file))
        .then((text) => {
          if (get().file !== file) return; // switched campaign meanwhile
          // Changes made before the file finished loading win over what it held.
          const fromFile = parseAnnotations(text);
          set((s) => ({
            loaded: true,
            bookmarks: [
              ...s.bookmarks,
              ...fromFile.bookmarks.filter((b) => !s.bookmarks.some((x) => x.path === b.path)),
            ],
            notes: { ...fromFile.notes, ...s.notes },
          }));
        })
        .catch((error: unknown) => {
          console.warn('Could not load bookmarks and notes', error);
          set({ loaded: true });
        });
      loading = { file, promise };
      return promise;
    },
    toggleBookmark: (path, label) => {
      apply(toggleBookmark(get(), path, label, new Date().toISOString()));
    },
    setNote: (id, text) => {
      apply(setNote(get(), id, text, new Date().toISOString()));
    },
  };
});

/** Writes pending changes now (before a sync). */
export async function flushAnnotations(): Promise<void> {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const state = useAnnotations.getState();
  await writeNow(state.file, state);
}

/** Reads the file again, as it is now (after a sync brought changes). */
export async function reloadAnnotations(): Promise<void> {
  const store = await userStore();
  const { file } = useAnnotations.getState();
  const fromFile = parseAnnotations(await store.readText(file));
  if (useAnnotations.getState().file !== file) return;
  loading = { file, promise: Promise.resolve() };
  useAnnotations.setState({ ...fromFile, loaded: true });
}

/**
 * Points bookmarks and notes at another file (switching campaign). Pending changes to the old
 * file are written first.
 */
export async function switchAnnotationsFile(file: string): Promise<void> {
  const state = useAnnotations.getState();
  if (state.file === file) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await writeNow(state.file, state);
  }
  useAnnotations.setState({ ...EMPTY_ANNOTATIONS, file, loaded: false });
  await useAnnotations.getState().load();
}
