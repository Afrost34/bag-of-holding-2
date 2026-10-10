import { create } from 'zustand';
import { userStore } from '../userStore';
import { centroid } from './polyclip';
import type { BuildingItem, RoofStyle } from './cityDoc';

/**
 * Buildings you keep for later: a footprint (round its own middle) with its roof, saved in
 * `buildings/library.json` and placed again anywhere with a click. A small file, so it syncs
 * with the rest of your data.
 */

export interface LibraryBuilding {
  id: string;
  name: string;
  /** The footprint, relative to its middle. */
  points: number[];
  roof: RoofStyle;
  color: string;
}

const FILE = 'buildings/library.json';

/** A building as a library entry: its footprint moved so its middle is the origin. */
export function toLibrary(item: BuildingItem, name: string, id: string): LibraryBuilding {
  const c = centroid(item.points);
  return {
    id,
    name: name.trim() === '' ? (item.name ?? 'Building') : name.trim(),
    points: item.points.map((v, i) => Math.round(v - (i % 2 === 0 ? c.x : c.y))),
    roof: item.roof,
    color: item.color,
  };
}

/** The footprint of a library building with its middle at `at`. */
export function placeFootprint(entry: LibraryBuilding, at: { x: number; y: number }): number[] {
  return entry.points.map((v, i) => Math.round(v + (i % 2 === 0 ? at.x : at.y)));
}

/** A new id for the library, unlike the ones in use. */
export function libraryId(taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`b${String(n)}`)) n++;
  return `b${String(n)}`;
}

interface BuildingsStore {
  entries: LibraryBuilding[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (item: BuildingItem, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

async function write(entries: readonly LibraryBuilding[]) {
  await (await userStore()).writeFile(FILE, `${JSON.stringify(entries, null, 2)}\n`);
}

export const useBuildings = create<BuildingsStore>()((set, get) => ({
  entries: [],
  loaded: false,
  load: async () => {
    let entries: LibraryBuilding[] = [];
    try {
      const text = await (await userStore()).readText(FILE);
      const json: unknown = text ? JSON.parse(text) : [];
      if (Array.isArray(json))
        entries = json.filter(
          (e): e is LibraryBuilding =>
            typeof e === 'object' &&
            e !== null &&
            typeof (e as LibraryBuilding).id === 'string' &&
            Array.isArray((e as LibraryBuilding).points),
        );
    } catch {
      entries = [];
    }
    set({ entries, loaded: true });
  },
  save: async (item, name) => {
    const entry = toLibrary(item, name, libraryId(get().entries.map((e) => e.id)));
    const entries = [...get().entries, entry];
    set({ entries });
    await write(entries);
  },
  remove: async (id) => {
    const entries = get().entries.filter((e) => e.id !== id);
    set({ entries });
    await write(entries);
  },
}));
