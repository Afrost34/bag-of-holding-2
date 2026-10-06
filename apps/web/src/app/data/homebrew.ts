import { gitBlobSha, type HomebrewPack, type SourceInfo } from '@boh/data5e';
import { create } from 'zustand';
import { userStore } from '../userStore';
import { dataWorker } from './client';

export const HOMEBREW_DIR = 'homebrew';

export interface PackInfo {
  path: string;
  fileName: string;
  sources: SourceInfo[];
  entities: number;
}

interface HomebrewStore {
  packs: PackInfo[];
  loaded: boolean;
  error: string | null;
  /** Reads every pack from the user store and brings the index in line with it. */
  load: () => Promise<void>;
  /** Validates and saves a pack file, then indexes it. Returns an error message on failure. */
  importFile: (file: File) => Promise<string | null>;
  remove: (path: string) => Promise<void>;
}

const encoder = new TextEncoder();

/** `My Brew (v2).json` → `my-brew-v2.json` */
export function packFileName(name: string): string {
  const base = name
    .replace(/\.json$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'homebrew'}.json`;
}

async function readPacks(): Promise<HomebrewPack[]> {
  const store = await userStore();
  const entries = await store.list(HOMEBREW_DIR);
  const packs: HomebrewPack[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const text = await store.readText(entry.path);
    if (text === null) continue;
    try {
      packs.push({
        path: entry.path,
        sha: await gitBlobSha(encoder.encode(text)),
        json: JSON.parse(text),
      });
    } catch {
      // A broken file is skipped; it stays on disk for the user to fix.
    }
  }
  return packs;
}

export const useHomebrew = create<HomebrewStore>()((set, get) => ({
  packs: [],
  loaded: false,
  error: null,

  load: async () => {
    try {
      const packs = await readPacks();
      await dataWorker().syncHomebrew(packs);
      const sources = await dataWorker().sources();
      const infos: PackInfo[] = [];
      for (const pack of packs) {
        const declared = await dataWorker().validateHomebrew(pack.json);
        const ids = new Set(declared.map((s) => s.id.toLowerCase()));
        infos.push({
          path: pack.path,
          fileName: pack.path.slice(HOMEBREW_DIR.length + 1),
          sources: declared,
          entities: sources
            .filter((s) => ids.has(s.id.toLowerCase()))
            .reduce((sum, s) => sum + s.entities, 0),
        });
      }
      set({ packs: infos, loaded: true, error: null });
    } catch (error) {
      set({ loaded: true, error: error instanceof Error ? error.message : String(error) });
    }
  },

  importFile: async (file) => {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return `${file.name} is not valid JSON.`;
    }
    try {
      await dataWorker().validateHomebrew(json);
    } catch (error) {
      return error instanceof Error ? error.message.replace(/^.*?Error: /, '') : String(error);
    }
    const store = await userStore();
    await store.writeFile(
      `${HOMEBREW_DIR}/${packFileName(file.name)}`,
      JSON.stringify(json, null, 2),
    );
    await get().load();
    return null;
  },

  remove: async (path) => {
    const store = await userStore();
    await store.remove(path);
    await get().load();
  },
}));
