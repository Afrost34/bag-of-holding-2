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

/** Where bookmarks and notes live in the user's data (moves into the campaign in M4). */
export const ANNOTATIONS_FILE = 'annotations.json';
const SAVE_AFTER_MS = 400;

interface AnnotationsStore extends Annotations {
  loaded: boolean;
  load: () => Promise<void>;
  toggleBookmark: (path: string, label: string) => void;
  setNote: (id: string, text: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let loading: Promise<void> | null = null;

function scheduleSave(get: () => Annotations): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const { version, bookmarks, notes } = get();
    void userStore()
      .then((store) =>
        store.writeFile(ANNOTATIONS_FILE, serializeAnnotations({ version, bookmarks, notes })),
      )
      .catch((error: unknown) => {
        console.warn('Could not save bookmarks and notes', error);
      });
  }, SAVE_AFTER_MS);
}

/** Bookmarks and personal notes, loaded once and saved shortly after each change. */
export const useAnnotations = create<AnnotationsStore>()((set, get) => {
  const apply = (next: Annotations) => {
    set({ version: next.version, bookmarks: next.bookmarks, notes: next.notes });
    scheduleSave(get);
  };
  return {
    ...EMPTY_ANNOTATIONS,
    loaded: false,
    load: () => {
      loading ??= userStore()
        .then((store) => store.readText(ANNOTATIONS_FILE))
        .then((text) => {
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
      return loading;
    },
    toggleBookmark: (path, label) => {
      apply(toggleBookmark(get(), path, label, new Date().toISOString()));
    },
    setNote: (id, text) => {
      apply(setNote(get(), id, text, new Date().toISOString()));
    },
  };
});
