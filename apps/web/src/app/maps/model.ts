import { newId } from '../cards/model';

/**
 * Maps: battle, city and world maps made in the app (prep only: no live play).
 *
 *   maps/<id>.json                        maps kept outside any campaign
 *   campaigns/<campaign>/maps/<id>.json   a campaign's maps
 *   …/maps/assets/<file>                  their background pictures
 *   stamps/<category>/…/<file>            the stamp library, shared by every map
 *   stamps/library.json                   stamp tags
 *
 * A map is a background picture (or a blank canvas), a grid, and layers of items drawn bottom to
 * top: stamps, brush strokes, walls, text, spell templates and pins. Positions are in map pixels
 * (the background's own pixels).
 */

export const MAPS_DIR = 'maps';
export const MAP_ASSETS = 'assets';
export const STAMPS_DIR = 'stamps';

export type GridType = 'square' | 'hex' | 'none';

export interface Grid {
  type: GridType;
  /** Square: the side of a cell; hex: the distance between two neighbouring centres. */
  size: number;
  offsetX: number;
  offsetY: number;
  /** Feet per cell. */
  feet: number;
  /** 0–1. */
  opacity: number;
}

export type TemplateShape = 'cone' | 'sphere' | 'cube' | 'line';

export type MapItem =
  | {
      kind: 'stamp';
      id: string;
      /** Path in the stamp library, e.g. `Forest/Trees/oak.png`. */
      stamp: string;
      /** Centre. */
      x: number;
      y: number;
      w: number;
      h: number;
      /** Degrees, clockwise. */
      rotation: number;
      flipX?: boolean;
      flipY?: boolean;
    }
  | {
      kind: 'stroke';
      id: string;
      /** x0, y0, x1, y1… */
      points: number[];
      color: string;
      width: number;
      /** Terrain strokes are wide and soft, for grass, water, rubble… */
      brush: 'pen' | 'terrain';
      opacity: number;
    }
  | { kind: 'wall'; id: string; points: number[] }
  | { kind: 'text'; id: string; x: number; y: number; text: string; size: number; color: string }
  | {
      kind: 'template';
      id: string;
      shape: TemplateShape;
      /** Where it starts (cone, line, cube) or its centre (sphere). */
      x: number;
      y: number;
      /** Length, radius or side, in feet. */
      feet: number;
      /** Degrees: where it points. */
      angle: number;
      color: string;
    }
  | {
      kind: 'pin';
      id: string;
      x: number;
      y: number;
      label: string;
      /** A journal note's path. */
      note?: string;
      /** Another map (a nested map: the inside of a building, a region). */
      map?: string;
      /** A compendium entry ("Send to → Map"): its key. */
      entity?: string;
    };

export type MapItemKind = MapItem['kind'];

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  items: MapItem[];
}

export interface MapDoc {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** A picture in the map assets; its size is the map's size. */
  background?: { path: string; width: number; height: number };
  width: number;
  height: number;
  grid: Grid;
  /** Bottom first. */
  layers: Layer[];
  /** The encounter fought here. */
  encounter?: string;
  /** The campaign it belongs to; absent outside campaigns. Not stored: it is where the file is. */
  campaign?: string;
}

export function mapDir(campaign?: string): string {
  return campaign ? `campaigns/${campaign}/${MAPS_DIR}` : MAPS_DIR;
}

export function mapPath(id: string, campaign?: string): string {
  return `${mapDir(campaign)}/${id}.json`;
}

export function mapAssetPath(name: string, campaign?: string): string {
  return `${mapDir(campaign)}/${MAP_ASSETS}/${name}`;
}

export const DEFAULT_GRID: Grid = {
  type: 'square',
  size: 70,
  offsetX: 0,
  offsetY: 0,
  feet: 5,
  opacity: 0.35,
};

export function newMap(name: string, existingIds: readonly string[], now: string): MapDoc {
  const ids: string[] = [];
  const layer = (n: string): Layer => {
    const id = newId(ids);
    ids.push(id);
    return { id, name: n, visible: true, locked: false, items: [] };
  };
  return {
    version: 1,
    id: newId(existingIds),
    name: name.trim() || 'Map',
    createdAt: now,
    updatedAt: now,
    width: 2800,
    height: 2100,
    grid: { ...DEFAULT_GRID },
    layers: [layer('Ground'), layer('Objects'), layer('Walls and notes')],
  };
}

const allIds = (doc: MapDoc) => [
  ...doc.layers.map((l) => l.id),
  ...doc.layers.flatMap((l) => l.items.map((i) => i.id)),
];

/** A new item's id, unique in the map. */
export function itemId(doc: MapDoc): string {
  return newId(allIds(doc));
}

export function addItem(doc: MapDoc, layerId: string, item: MapItem): MapDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) => (l.id === layerId ? { ...l, items: [...l.items, item] } : l)),
  };
}

export function updateItem(doc: MapDoc, id: string, change: (item: MapItem) => MapItem): MapDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      l.items.some((i) => i.id === id)
        ? { ...l, items: l.items.map((i) => (i.id === id ? change(i) : i)) }
        : l,
    ),
  };
}

export function removeItem(doc: MapDoc, id: string): MapDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      l.items.some((i) => i.id === id) ? { ...l, items: l.items.filter((i) => i.id !== id) } : l,
    ),
  };
}

export function findItem(doc: MapDoc, id: string): { item: MapItem; layer: Layer } | undefined {
  for (const layer of doc.layers) {
    const item = layer.items.find((i) => i.id === id);
    if (item) return { item, layer };
  }
  return undefined;
}

export function addLayer(doc: MapDoc, name: string): MapDoc {
  const layer: Layer = { id: newId(allIds(doc)), name, visible: true, locked: false, items: [] };
  return { ...doc, layers: [...doc.layers, layer] };
}

export function updateLayer(doc: MapDoc, id: string, change: Partial<Omit<Layer, 'id'>>): MapDoc {
  return { ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, ...change } : l)) };
}

/** Moves a layer one place up (+1, drawn later) or down (-1). */
export function moveLayer(doc: MapDoc, id: string, by: -1 | 1): MapDoc {
  const i = doc.layers.findIndex((l) => l.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= doc.layers.length) return doc;
  const layers = [...doc.layers];
  const [layer] = layers.splice(i, 1);
  if (layer) layers.splice(j, 0, layer);
  return { ...doc, layers };
}

/** Removes a layer and what is on it; the last layer stays. */
export function removeLayer(doc: MapDoc, id: string): MapDoc {
  if (doc.layers.length <= 1) return doc;
  return { ...doc, layers: doc.layers.filter((l) => l.id !== id) };
}

/** Moves an item to another layer (on top of it). */
export function moveItemToLayer(doc: MapDoc, id: string, layerId: string): MapDoc {
  const found = findItem(doc, id);
  if (!found || found.layer.id === layerId) return doc;
  return addItem(removeItem(doc, id), layerId, found.item);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const KINDS = new Set(['stamp', 'stroke', 'wall', 'text', 'template', 'pin']);

export function parseMap(text: string | null, id: string, campaign?: string): MapDoc | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(json)) return null;
  const g = isObj(json.grid) ? json.grid : {};
  const type: GridType = g.type === 'hex' || g.type === 'none' ? g.type : 'square';
  const layers = (Array.isArray(json.layers) ? json.layers : []).flatMap((l): Layer[] =>
    isObj(l) && typeof l.id === 'string'
      ? [
          {
            id: l.id,
            name: typeof l.name === 'string' ? l.name : 'Layer',
            visible: l.visible !== false,
            locked: l.locked === true,
            items: (Array.isArray(l.items) ? l.items : []).filter(
              (i): i is MapItem =>
                isObj(i) &&
                typeof i.id === 'string' &&
                typeof i.kind === 'string' &&
                KINDS.has(i.kind),
            ),
          },
        ]
      : [],
  );
  const bg =
    isObj(json.background) && typeof json.background.path === 'string' ? json.background : null;
  return {
    version: 1,
    id,
    name: typeof json.name === 'string' ? json.name : 'Map',
    createdAt: typeof json.createdAt === 'string' ? json.createdAt : '',
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '',
    ...(bg
      ? {
          background: {
            path: String(bg.path),
            width: num(bg.width, 1000),
            height: num(bg.height, 1000),
          },
        }
      : {}),
    width: num(json.width, 2800),
    height: num(json.height, 2100),
    grid: {
      type,
      size: Math.max(4, num(g.size, DEFAULT_GRID.size)),
      offsetX: num(g.offsetX, 0),
      offsetY: num(g.offsetY, 0),
      feet: num(g.feet, 5),
      opacity: num(g.opacity, DEFAULT_GRID.opacity),
    },
    layers: layers.length ? layers : newMap('', [], '').layers,
    ...(typeof json.encounter === 'string' ? { encounter: json.encounter } : {}),
    ...(campaign ? { campaign } : {}),
  };
}

export function serializeMap(doc: MapDoc): string {
  const { campaign: _campaign, ...rest } = doc;
  return `${JSON.stringify(rest)}\n`;
}

/** A pin for a compendium entry, in the middle of the map (Send to → Map). */
export function addEntityPin(doc: MapDoc, entity: string, label: string): MapDoc {
  const layer = doc.layers.at(-1);
  if (!layer) return doc;
  return addItem(doc, layer.id, {
    kind: 'pin',
    id: itemId(doc),
    x: Math.round(doc.width / 2),
    y: Math.round(doc.height / 2),
    label,
    entity,
  });
}
