import { create } from 'zustand';
import { shrinkImage } from '../shrinkImage';
import { userStore } from '../userStore';
import { dataUrlBytes, PICTURES_DIR, pictureFileName } from './model';

/** Longest side of a library picture: large enough for a printed portrait or an NPC card. */
const MAX_SIDE = 1200;

interface PicturesStore {
  /** Library paths (`pictures/…`), by name. */
  pictures: string[];
  loaded: boolean;
  load: () => Promise<void>;
  /** Adds a picture (shrunk to a sensible size) and returns its path. */
  add: (file: Blob, name: string) => Promise<string>;
}

export const usePictures = create<PicturesStore>()((set, get) => ({
  pictures: [],
  loaded: false,

  load: async () => {
    const store = await userStore();
    const entries = await store.list(PICTURES_DIR);
    set({
      pictures: entries.filter((e) => e.kind === 'file').map((e) => e.path),
      loaded: true,
    });
  },

  add: async (file, name) => {
    if (!get().loaded) await get().load();
    const { bytes, ext } = dataUrlBytes(await shrinkImage(file, MAX_SIDE));
    const taken = get().pictures.map((p) => p.split('/').pop() ?? p);
    const path = `${PICTURES_DIR}/${pictureFileName(name, taken, ext)}`;
    await (await userStore()).writeFile(path, bytes);
    set({ pictures: [...get().pictures, path].sort((a, b) => a.localeCompare(b, 'en')) });
    return path;
  },
}));
