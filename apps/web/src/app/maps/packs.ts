import { create } from 'zustand';
import {
  commonRoot,
  isPackPicture,
  packId,
  packRef,
  parsePackRef,
  type PackEntry,
} from './packModel';
import { readZipEntry, readZipIndex } from './zip';

/**
 * Asset packs: zips of pictures (Forgotten Adventures and the like) copied into this device's own
 * storage when imported, so the original can be deleted. They are kept as zips and read in place
 * (`zip.ts`): only the pictures being shown are cut out, and a preview is made once and kept.
 * The library lives on this device only: it is never synced (maps keep a flat picture for other
 * devices).
 *
 *   map-assets/packs/<id>.zip          the pack as imported
 *   map-assets/packs/<id>.meta.json    its name and size
 *   map-assets/packs/<id>.index.json   where each picture is in the zip
 *   map-assets/thumbs/<id>/<n>.webp    previews, made when first shown
 */

const ROOT = 'map-assets';

export interface PackMeta {
  id: string;
  name: string;
  /** Pictures in it. */
  files: number;
  bytes: number;
  importedAt: string;
}

type IndexRow = [path: string, offset: number, compressed: number, size: number, method: number];

async function dir(...parts: string[]): Promise<FileSystemDirectoryHandle> {
  let handle = await (
    await navigator.storage.getDirectory()
  ).getDirectoryHandle(ROOT, {
    create: true,
  });
  for (const part of parts) handle = await handle.getDirectoryHandle(part, { create: true });
  return handle;
}

async function readJson<T>(folder: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try {
    const file = await (await folder.getFileHandle(name)).getFile();
    return JSON.parse(await file.text()) as T;
  } catch {
    return null;
  }
}

async function writeText(folder: FileSystemDirectoryHandle, name: string, text: string) {
  const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
  await writable.write(text);
  await writable.close();
}

export interface ImportReport {
  added: string[];
  duplicates: string[];
  failed: { name: string; error: string }[];
}

export interface ImportProgress {
  /** The file being copied and how far. */
  name: string;
  copied: number;
  total: number;
  /** Which file of how many. */
  index: number;
  count: number;
}

interface PacksStore {
  metas: PackMeta[];
  /** Every picture of every pack (the first pack to hold a path wins), sorted by path. */
  entries: PackEntry[];
  loaded: boolean;
  load: () => Promise<void>;
  importFiles: (
    files: readonly File[],
    onProgress?: (p: ImportProgress) => void,
  ) => Promise<ImportReport>;
  remove: (id: string) => Promise<void>;
}

const supported = () => typeof navigator !== 'undefined' && 'storage' in navigator;

export const usePacks = create<PacksStore>()((set, get) => ({
  metas: [],
  entries: [],
  loaded: false,

  load: async () => {
    if (!supported()) {
      set({ loaded: true });
      return;
    }
    const folder = await dir('packs');
    const metas: PackMeta[] = [];
    for await (const [name] of folder.entries())
      if (name.endsWith('.meta.json')) {
        const meta = await readJson<PackMeta>(folder, name);
        if (meta) metas.push(meta);
      }
    metas.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const seen = new Set<string>();
    const entries: PackEntry[] = [];
    for (const meta of metas) {
      const rows = await readJson<IndexRow[]>(folder, `${meta.id}.index.json`);
      for (const [path, offset, compressed, size, method] of rows ?? []) {
        if (seen.has(path)) continue;
        seen.add(path);
        entries.push({ pack: meta.id, path, offset, compressed, size, method });
      }
    }
    entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    entryIndex = null;
    set({ metas, entries, loaded: true });
  },

  importFiles: async (files, onProgress) => {
    const report: ImportReport = { added: [], duplicates: [], failed: [] };
    // Asks the browser not to clear the library when disk space runs short (it may refuse).
    void navigator.storage.persist().catch(() => false);
    const folder = await dir('packs');
    let index = 0;
    for (const file of files) {
      index++;
      const progress = (copied: number) => {
        onProgress?.({ name: file.name, copied, total: file.size, index, count: files.length });
      };
      let id = '';
      try {
        const all = await readZipIndex(file);
        const pictures = all.filter((e) => isPackPicture(e.name));
        if (pictures.length === 0) throw new Error('There are no pictures in it.');
        const root = commonRoot(pictures.map((e) => e.name));
        const cut = root ? root.length + 1 : 0;
        id = packId(
          all.map((e) => e.name),
          file.size,
        );
        if (get().metas.some((m) => m.id === id)) {
          report.duplicates.push(file.name);
          continue;
        }
        progress(0);
        let copied = 0;
        const writable = await (
          await folder.getFileHandle(`${id}.zip`, { create: true })
        ).createWritable();
        await file
          .stream()
          .pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
              transform(chunk, controller) {
                copied += chunk.byteLength;
                progress(copied);
                controller.enqueue(chunk);
              },
            }),
          )
          .pipeTo(writable);
        const rows: IndexRow[] = pictures.map((e) => [
          e.name.slice(cut),
          e.offset,
          e.compressed,
          e.size,
          e.method,
        ]);
        const meta: PackMeta = {
          id,
          name: file.name.replace(/\.zip$/i, '').replace(/[_]+/g, ' '),
          files: rows.length,
          bytes: file.size,
          importedAt: new Date().toISOString(),
        };
        await writeText(folder, `${id}.index.json`, JSON.stringify(rows));
        // The meta file comes last: a pack without one is an import that did not finish.
        await writeText(folder, `${id}.meta.json`, JSON.stringify(meta));
        report.added.push(file.name);
      } catch (error) {
        if (id) await removeFiles(id);
        report.failed.push({ name: file.name, error: await describeFailure(error, file.size) });
      }
    }
    await get().load();
    return report;
  },

  remove: async (id) => {
    await removeFiles(id);
    await get().load();
  },
}));

/** A reason a person can act on: a full storage says how much room there is. */
async function describeFailure(error: unknown, needed: number): Promise<string> {
  const text = error instanceof Error ? error.message : String(error);
  if (
    !/quota/i.test(text) &&
    !(error instanceof DOMException && error.name === 'QuotaExceededError')
  )
    return text;
  const estimate: StorageEstimate = await navigator.storage.estimate().catch(() => ({}));
  const { quota = 0, usage = 0 } = estimate;
  const free = Math.max(0, quota - usage);
  return `not enough room in the app's storage: it needs ${megabytes(needed)} and ${megabytes(free)} is free (the browser allows ${megabytes(quota)}). Free some disk space or remove packs you do not use.`;
}

const megabytes = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${String(Math.round(bytes / 1e6))} MB`;

async function removeFiles(id: string): Promise<void> {
  const folder = await dir('packs');
  for (const name of [`${id}.zip`, `${id}.index.json`, `${id}.meta.json`])
    await folder.removeEntry(name).catch(() => undefined);
  await (await dir('thumbs')).removeEntry(id, { recursive: true }).catch(() => undefined);
  packFiles.delete(id);
}

// region Reading pictures

const packFiles = new Map<string, Promise<File>>();

function packFile(id: string): Promise<File> {
  let file = packFiles.get(id);
  if (!file) {
    file = dir('packs')
      .then((folder) => folder.getFileHandle(`${id}.zip`))
      .then((handle) => handle.getFile());
    packFiles.set(id, file);
  }
  return file;
}

let entryIndex: Map<string, PackEntry> | null = null;
function entryFor(pack: string, path: string): PackEntry | undefined {
  if (!entryIndex) {
    entryIndex = new Map();
    for (const e of usePacks.getState().entries) entryIndex.set(`${e.pack}:${e.path}`, e);
  }
  return entryIndex.get(`${pack}:${path}`);
}

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  gif: 'image/gif',
};
const typeOf = (path: string) => TYPES[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? '';

/** The bytes of a picture of a pack. */
export async function readPackPicture(entry: PackEntry): Promise<Uint8Array> {
  return readZipEntry(await packFile(entry.pack), {
    name: entry.path,
    offset: entry.offset,
    compressed: entry.compressed,
    size: entry.size,
    method: entry.method,
  });
}

const urls = new Map<string, Promise<string | null>>();

/** An object URL for a stamp reference (`pack:<id>:<path>`), null when its pack is gone. */
export function packPictureUrl(ref: string): Promise<string | null> {
  let url = urls.get(ref);
  if (!url) {
    url = (async () => {
      const parsed = parsePackRef(ref);
      if (!parsed) return null;
      if (!usePacks.getState().loaded) await usePacks.getState().load();
      const entry = entryFor(parsed.pack, parsed.path);
      if (!entry) return null;
      const bytes = await readPackPicture(entry);
      return URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: typeOf(entry.path) }),
      );
    })().catch(() => null);
    urls.set(ref, url);
  }
  return url;
}

export const entryRef = (e: PackEntry) => packRef(e.pack, e.path);

// endregion

// region Previews

const THUMB = 160;
const thumbUrls = new Map<string, Promise<string | null>>();
let running = 0;
const waiting: (() => void)[] = [];

/** At most a few previews are made at once, so scrolling a big folder stays smooth. */
async function turn<T>(job: () => Promise<T>): Promise<T> {
  if (running >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** A small picture of a stamp: made when first asked for, kept on disk, then read from there. */
export function packThumbUrl(entry: PackEntry): Promise<string | null> {
  const key = `${entry.pack}/${String(entry.offset)}`;
  let url = thumbUrls.get(key);
  if (!url) {
    url = turn(async () => {
      const folder = await dir('thumbs', entry.pack);
      const name = `${String(entry.offset)}.webp`;
      try {
        const cached = await (await folder.getFileHandle(name)).getFile();
        return URL.createObjectURL(cached);
      } catch {
        // not made yet
      }
      const bytes = await readPackPicture(entry);
      const bitmap = await createImageBitmap(
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: typeOf(entry.path) }),
      );
      const scale = Math.min(1, THUMB / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(
        Math.max(1, Math.round(bitmap.width * scale)),
        Math.max(1, Math.round(bitmap.height * scale)),
      );
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
      const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
      await writable.write(blob);
      await writable.close();
      return URL.createObjectURL(blob);
    }).catch((error: unknown) => {
      console.warn('Could not make a preview', error);
      return null;
    });
    thumbUrls.set(key, url);
  }
  return url;
}

// endregion
