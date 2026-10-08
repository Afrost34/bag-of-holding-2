import { create } from 'zustand';
import { userStore } from '../userStore';
import { mapAssetPath, mapThumbPath, STAMPS_DIR } from './model';

/**
 * Pictures for maps: backgrounds (kept with the campaign's maps) and the stamp library (shared by
 * every map). Files are read once per session into object URLs.
 */

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};
const extension = (path: string) => path.slice(path.lastIndexOf('.') + 1).toLowerCase();
export const isPicture = (path: string) => extension(path) in TYPES;

const urls = new Map<string, Promise<string | null>>();

/** An object URL for a file in the user store (null when it is missing). */
export function fileUrl(path: string): Promise<string | null> {
  let url = urls.get(path);
  if (!url) {
    url = userStore()
      .then((store) => store.readFile(path))
      .then((bytes) =>
        bytes
          ? URL.createObjectURL(
              new Blob([bytes as Uint8Array<ArrayBuffer>], {
                type: TYPES[extension(path)] ?? 'application/octet-stream',
              }),
            )
          : null,
      )
      .catch(() => null);
    urls.set(path, url);
  }
  return url;
}

const safeName = (name: string) => name.replace(/[/\\:*?"<>|]/g, '-').trim() || 'picture';

/** Saves a background picture with the maps and returns where it is and its size. */
export async function importBackground(
  file: File,
  campaign?: string,
): Promise<{ path: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  const store = await userStore();
  const name = safeName(file.name);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let path = mapAssetPath(name, campaign);
  for (let n = 1; (await store.stat(path)) !== null; n++)
    path = mapAssetPath(`${stem} ${String(n)}${ext}`, campaign);
  await store.writeFile(path, new Uint8Array(await file.arrayBuffer()));
  return { path, ...size };
}

/** How wide a map's thumbnail is (px). */
const THUMB_WIDTH = 400;

/**
 * The small picture of a map shown in the maps list, made from its picture. Kept apart from the
 * map's assets so every device has it without downloading the full picture (ADR 0008).
 */
export async function saveThumbnail(picture: Blob, mapId: string, campaign?: string) {
  const bitmap = await createImageBitmap(picture);
  const scale = Math.min(1, THUMB_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
  const path = mapThumbPath(mapId, campaign);
  const store = await userStore();
  await store.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  urls.delete(path);
}

/** A map's thumbnail, or null when it has none (a blank canvas, an older map). */
export const thumbnailUrl = (mapId: string, campaign?: string) =>
  fileUrl(mapThumbPath(mapId, campaign));

export interface Stamp {
  /** Path inside the library, e.g. `Forest/Trees/oak.png`. */
  path: string;
  name: string;
  /** Folders, outermost first: `Forest/Trees`. */
  category: string;
}

export const stampFile = (path: string) => `${STAMPS_DIR}/${path}`;
const TAGS_FILE = `${STAMPS_DIR}/library.json`;

async function walk(dir: string, prefix = ''): Promise<Stamp[]> {
  const store = await userStore();
  const out: Stamp[] = [];
  for (const entry of await store.list(dir)) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') out.push(...(await walk(`${dir}/${entry.name}`, rel)));
    else if (isPicture(entry.name))
      out.push({
        path: rel,
        name: entry.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        category: prefix,
      });
  }
  return out;
}

interface StampsStore {
  stamps: Stamp[];
  /** Stamp path → tags. */
  tags: Record<string, string[]>;
  loaded: boolean;
  load: () => Promise<void>;
  /**
   * Adds pictures from a folder the user picked: its sub-folders become categories. Returns how
   * many were added.
   */
  importFiles: (files: readonly File[]) => Promise<number>;
  /** Adds pictures made in the app (from an online pack) at paths in the library. */
  addPictures: (pictures: readonly { path: string; bytes: Uint8Array }[]) => Promise<void>;
  setTags: (path: string, tags: string[]) => Promise<void>;
  remove: (path: string) => Promise<void>;
}

export const useStamps = create<StampsStore>()((set, get) => ({
  stamps: [],
  tags: {},
  loaded: false,

  load: async () => {
    const store = await userStore();
    const stamps = (await walk(STAMPS_DIR)).sort((a, b) => a.path.localeCompare(b.path, 'en'));
    let tags: Record<string, string[]> = {};
    try {
      const text = await store.readText(TAGS_FILE);
      if (text) tags = JSON.parse(text) as Record<string, string[]>;
    } catch {
      tags = {};
    }
    set({ stamps, tags, loaded: true });
  },

  importFiles: async (files) => {
    const store = await userStore();
    let added = 0;
    for (const file of files) {
      if (!isPicture(file.name)) continue;
      // `webkitRelativePath` keeps the folders under the one picked ("Forest/Trees/oak.png").
      const rel = (file.webkitRelativePath || file.name).split('/').map(safeName).join('/');
      await store.writeFile(stampFile(rel), new Uint8Array(await file.arrayBuffer()));
      urls.delete(stampFile(rel));
      added++;
    }
    await get().load();
    return added;
  },

  addPictures: async (pictures) => {
    const store = await userStore();
    for (const p of pictures) {
      const rel = p.path.split('/').map(safeName).join('/');
      await store.writeFile(stampFile(rel), p.bytes);
      urls.delete(stampFile(rel));
    }
    await get().load();
  },

  setTags: async (path, tags) => {
    const next = { ...get().tags, [path]: tags };
    if (tags.length === 0) Reflect.deleteProperty(next, path);
    set({ tags: next });
    const store = await userStore();
    await store.writeFile(TAGS_FILE, `${JSON.stringify(next, null, 2)}\n`);
  },

  remove: async (path) => {
    const store = await userStore();
    await store.remove(stampFile(path));
    urls.delete(stampFile(path));
    await get().load();
  },
}));

/** Stamps matching a search (name, folder or tag) in a category (and its sub-folders). */
export function findStamps(
  stamps: readonly Stamp[],
  tags: Readonly<Record<string, string[]>>,
  query: string,
  category: string,
): Stamp[] {
  const q = query.trim().toLowerCase();
  return stamps.filter(
    (s) =>
      (!category || s.category === category || s.category.startsWith(`${category}/`)) &&
      (!q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (tags[s.path] ?? []).some((t) => t.toLowerCase().includes(q))),
  );
}
