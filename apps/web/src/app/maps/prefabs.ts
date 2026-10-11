import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { groupBox, itemsWithIds, pasteItems, translateItem } from './arrange';
import type { MapDoc, MapItem } from './model';

/**
 * Prefabs (Dungeondraft's Prefabs tool): items grouped and saved under a name, to place again as
 * they were. The pictures stay references to packs; positions are kept relative to the middle.
 */
export interface Prefab {
  id: string;
  name: string;
  /** Items with positions relative to the middle of the group. */
  items: MapItem[];
}

/** The picked items as a prefab; null when none of the ids is on the map. */
export function makePrefab(doc: MapDoc, ids: readonly string[], name: string): Prefab | null {
  const items = itemsWithIds(doc, ids);
  const box = groupBox(items);
  if (!box) return null;
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Prefab',
    items: items.map((i) => translateItem(i, -cx, -cy)),
  };
}

/** A copy of the prefab on a layer with its middle at `at`; returns the new ids to pick. */
export function placePrefab(
  doc: MapDoc,
  layerId: string,
  prefab: Prefab,
  at: { x: number; y: number },
): { doc: MapDoc; ids: string[] } {
  return pasteItems(doc, layerId, prefab.items, Math.round(at.x), Math.round(at.y));
}

interface PrefabStore {
  prefabs: Prefab[];
  add: (p: Prefab) => void;
  remove: (id: string) => void;
}

/** The saved prefabs of this device (pictures are packs of this device too). */
export const usePrefabs = create<PrefabStore>()(
  persist(
    (set) => ({
      prefabs: [],
      add: (p) => {
        set((s) => ({ prefabs: [...s.prefabs, p] }));
      },
      remove: (id) => {
        set((s) => ({ prefabs: s.prefabs.filter((x) => x.id !== id) }));
      },
    }),
    { name: 'boh.map.prefabs', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
