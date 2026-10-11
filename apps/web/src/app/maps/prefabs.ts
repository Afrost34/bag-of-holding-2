import { groupBox, itemsWithIds, pasteItems, translateItem } from './arrange';
import type { MapDoc, MapItem } from './model';
import type { FolderIndex } from './packNames';
import { DEFAULT_RANDOMIZE, randomizeStamp } from './randomize';

/**
 * Prefabs (Dungeondraft's Prefabs tool): items grouped and saved under a name, to place again.
 * The pictures stay references to packs; positions are kept relative to the middle. A prefab can
 * `vary`: each pack picture comes down as another shape of its set ("any table of this set"), so
 * copies differ. Saved in the data repo, so they reach every device:
 *
 *   map-prefabs/<id>.json
 *
 * Pure.
 */

export const PREFABS_DIR = 'map-prefabs';

export interface Prefab {
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  /** Not stored: it is where the file is (prefabs are made outside campaigns). */
  campaign?: string;
  /** Items with positions relative to the middle of the group. */
  items: MapItem[];
  /** Each pack picture is swapped for another shape of its set when placed. */
  vary?: boolean;
}

export function prefabDir(campaign?: string): string {
  return campaign ? `campaigns/${campaign}/${PREFABS_DIR}` : PREFABS_DIR;
}

export function prefabPath(id: string, campaign?: string): string {
  return `${prefabDir(campaign)}/${id}.json`;
}

/** The picked items as a prefab; null when none of the ids is on the map. */
export function makePrefab(
  doc: MapDoc,
  ids: readonly string[],
  name: string,
  options: { id: string; now: string; vary?: boolean },
): Prefab | null {
  const items = itemsWithIds(doc, ids);
  const box = groupBox(items);
  if (!box) return null;
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  return {
    version: 1,
    id: options.id,
    name: name.trim() || 'Prefab',
    updatedAt: options.now,
    items: items.map((i) => translateItem(i, -cx, -cy)),
    ...(options.vary ? { vary: true } : {}),
  };
}

/** How a varying prefab finds the other shapes of its pictures, and the numbers it draws. */
export interface PrefabVariety {
  index: FolderIndex;
  rand: () => number;
}

/**
 * A copy of the prefab on a layer with its middle at `at`; returns the new ids to pick. A prefab
 * that varies swaps each pack picture for another shape of its set (same size, same turn).
 */
export function placePrefab(
  doc: MapDoc,
  layerId: string,
  prefab: Prefab,
  at: { x: number; y: number },
  variety?: PrefabVariety,
): { doc: MapDoc; ids: string[] } {
  const items =
    prefab.vary && variety
      ? prefab.items.map((i) =>
          i.kind === 'stamp'
            ? randomizeStamp(i, { ...DEFAULT_RANDOMIZE, turn: false }, variety.index, variety.rand)
            : i,
        )
      : prefab.items;
  return pasteItems(doc, layerId, items, Math.round(at.x), Math.round(at.y));
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A stored prefab; null when the file is not one. */
export function parsePrefab(text: string | null, id: string, campaign?: string): Prefab | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  const items = raw.items.filter(
    (i): i is MapItem => isRecord(i) && typeof i.kind === 'string' && typeof i.id === 'string',
  );
  return {
    version: 1,
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Prefab',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    items,
    ...(raw.vary === true ? { vary: true } : {}),
    ...(campaign ? { campaign } : {}),
  };
}

export function serializePrefab(prefab: Prefab): string {
  const { campaign: _campaign, id: _id, ...rest } = prefab;
  return `${JSON.stringify(rest, null, 2)}\n`;
}

/**
 * Prefabs kept on this device before they were synced (the old `boh.map.prefabs` localStorage
 * entry), as prefabs to write; ids already in use are left out.
 */
export function legacyPrefabs(
  text: string | null,
  taken: readonly string[],
  now: string,
): Prefab[] {
  if (!text) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  const list = isRecord(raw) && isRecord(raw.state) ? raw.state.prefabs : undefined;
  if (!Array.isArray(list)) return [];
  const out: Prefab[] = [];
  for (const p of list) {
    // The id names the file.
    if (!isRecord(p) || typeof p.id !== 'string' || !/^[a-z0-9]+$/i.test(p.id)) continue;
    if (taken.includes(p.id)) continue;
    const prefab = parsePrefab(JSON.stringify({ ...p, updatedAt: now }), p.id);
    if (prefab) out.push(prefab);
  }
  return out;
}
