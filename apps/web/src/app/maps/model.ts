import { newId } from '../cards/model';
import type { TerrainId } from './terrain';
import type { MapScale, TravelSpeed } from './travel';

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
      /** Terrain strokes are wide, for grass, water, rubble… */
      brush: 'pen' | 'terrain';
      opacity: number;
      /** A terrain stroke painted with a texture (see `terrain.ts`) rather than a colour. */
      texture?: TerrainId;
    }
  | { kind: 'wall'; id: string; points: number[] }
  /** A way across a world or city map, stop by stop: its length says how long the journey is. */
  | { kind: 'route'; id: string; points: number[]; label: string; color: string }
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
      /** Its own icon (see `pinIcons.ts`); otherwise its category's, otherwise a plain pin. */
      icon?: string;
      /** A pin category's id. */
      category?: string;
      /** Left off the map in the player window (a secret door, a hidden lair). */
      secret?: true;
    };

/** A kind of pin on a world or city map (Cities, Dungeons, Taverns…): its icon and colour. */
export interface PinCategory {
  id: string;
  name: string;
  icon: string;
  /** A hex colour. */
  color: string;
  /** Its pins are left off the map. */
  hidden?: boolean;
}

export type MapItemKind = MapItem['kind'];

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  items: MapItem[];
}

export interface MapPicture {
  name: string;
  /** In the map assets, like the background. */
  path: string;
  visible: boolean;
}

/**
 * A battle map (a grid, walls, spell templates) or a world or city map (a real scale, travel
 * times, routes). Each kind shows only its own tools.
 */
export type MapKind = 'battle' | 'world';

export interface MapDoc {
  version: 1;
  id: string;
  name: string;
  /** Absent in older maps: see `mapKind`. */
  kind?: MapKind;
  createdAt: string;
  updatedAt: string;
  /** A picture in the map assets; its size is the map's size. */
  background?: { path: string; width: number; height: number };
  /**
   * More pictures of the same place, drawn over the background bottom first and each shown or
   * hidden: a night version, snow, an overlay with a transparent background.
   */
  pictures?: MapPicture[];
  width: number;
  height: number;
  grid: Grid;
  /** Bottom first. */
  layers: Layer[];
  /** The encounter fought here. */
  encounter?: string;
  /** Kinds of pins, with the icon and colour their pins take. */
  pinCategories?: PinCategory[];
  /** How pins are drawn: markers (absent), or as on a fantasy map (inked icons, italic names). */
  pinStyle?: 'fantasy';
  /** Where it is filed in the maps list ('Battle maps/Dungeons'). */
  folder?: string;
  /** Words to find it by ('tavern', 'night'). */
  tags?: string[];
  /** Its real size (a world or region map): measures say how far and how long. */
  scale?: MapScale;
  /** How fast a party goes on this map, for the measure; on foot when absent. */
  travel?: TravelSpeed[];
  /** The campaign it belongs to; absent outside campaigns. Not stored: it is where the file is. */
  campaign?: string;
}

export function mapDir(campaign?: string): string {
  return campaign ? `campaigns/${campaign}/${MAPS_DIR}` : MAPS_DIR;
}

/** A small picture of the map for lists: synced whole (pictures in `assets` download on open). */
export function mapThumbPath(id: string, campaign?: string): string {
  return `${mapDir(campaign)}/thumbs/${id}.webp`;
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

/** A map's kind; older maps without one are world maps when they have a real scale. */
export const mapKind = (doc: Pick<MapDoc, 'kind' | 'scale'>): MapKind =>
  doc.kind ?? (doc.scale ? 'world' : 'battle');

export function newMap(
  name: string,
  existingIds: readonly string[],
  now: string,
  kind: MapKind = 'battle',
): MapDoc {
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
    kind,
    grid: kind === 'world' ? { ...DEFAULT_GRID, type: 'none' } : { ...DEFAULT_GRID },
    layers:
      kind === 'world'
        ? [layer('Land'), layer('Routes'), layer('Places and labels')]
        : [layer('Ground'), layer('Objects'), layer('Walls and notes')],
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
const KINDS = new Set(['stamp', 'stroke', 'wall', 'route', 'text', 'template', 'pin']);

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
    ...(json.kind === 'battle' || json.kind === 'world' ? { kind: json.kind } : {}),
    ...(json.pinStyle === 'fantasy' ? { pinStyle: 'fantasy' as const } : {}),
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
    ...(typeof json.folder === 'string' && json.folder.trim()
      ? { folder: json.folder.trim() }
      : {}),
    ...(Array.isArray(json.tags)
      ? { tags: json.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '') }
      : {}),
    ...(isObj(json.scale) &&
    (json.scale.unit === 'km' || json.scale.unit === 'mi') &&
    num(json.scale.perPixel, 0) > 0
      ? { scale: { unit: json.scale.unit, perPixel: num(json.scale.perPixel, 1) } }
      : {}),
    ...(Array.isArray(json.travel)
      ? {
          travel: json.travel.flatMap((t) =>
            isObj(t) && typeof t.name === 'string' && num(t.perDay, 0) > 0
              ? [{ name: t.name, perDay: num(t.perDay, 1) }]
              : [],
          ),
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
    ...(Array.isArray(json.pinCategories)
      ? {
          pinCategories: json.pinCategories.flatMap((c): PinCategory[] =>
            isObj(c) && typeof c.id === 'string' && typeof c.name === 'string'
              ? [
                  {
                    id: c.id,
                    name: c.name,
                    icon: typeof c.icon === 'string' ? c.icon : 'map-pin',
                    color: typeof c.color === 'string' ? c.color : PIN_COLOR,
                    ...(c.hidden === true ? { hidden: true } : {}),
                  },
                ]
              : [],
          ),
        }
      : {}),
    ...(Array.isArray(json.pictures)
      ? {
          pictures: json.pictures.flatMap((p) =>
            isObj(p) && typeof p.path === 'string'
              ? [
                  {
                    name: typeof p.name === 'string' ? p.name : 'Picture',
                    path: p.path,
                    visible: p.visible === true,
                  },
                ]
              : [],
          ),
        }
      : {}),
    ...(campaign ? { campaign } : {}),
  };
}

/** Adds a picture layer over the background (hidden or shown). */
export function addPicture(doc: MapDoc, picture: MapPicture): MapDoc {
  return { ...doc, pictures: [...(doc.pictures ?? []), picture] };
}

export function updatePicture(doc: MapDoc, index: number, change: Partial<MapPicture>): MapDoc {
  return {
    ...doc,
    pictures: (doc.pictures ?? []).map((p, i) => (i === index ? { ...p, ...change } : p)),
  };
}

export function removePicture(doc: MapDoc, index: number): MapDoc {
  const pictures = (doc.pictures ?? []).filter((_, i) => i !== index);
  if (pictures.length > 0) return { ...doc, pictures };
  const { pictures: _p, ...rest } = doc;
  return rest;
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

// region Pin categories

/** A plain pin's colour; a pin to a map inside is violet. */
export const PIN_COLOR = '#c2410c';
export const MAP_PIN_COLOR = '#7c3aed';
/** Colours offered for pin categories (any colour can be picked too). */
export const PIN_CATEGORY_COLORS = [
  '#c2410c',
  '#b91c1c',
  '#7c3aed',
  '#1d4ed8',
  '#0f766e',
  '#15803d',
  '#a16207',
  '#374151',
];

export function addPinCategory(
  doc: MapDoc,
  category: Omit<PinCategory, 'id'>,
): { doc: MapDoc; id: string } {
  const id = newId([...allIds(doc), ...(doc.pinCategories ?? []).map((c) => c.id)]);
  return {
    doc: { ...doc, pinCategories: [...(doc.pinCategories ?? []), { ...category, id }] },
    id,
  };
}

export function updatePinCategory(
  doc: MapDoc,
  id: string,
  change: Partial<Omit<PinCategory, 'id'>>,
): MapDoc {
  return {
    ...doc,
    pinCategories: (doc.pinCategories ?? []).map((c) => (c.id === id ? { ...c, ...change } : c)),
  };
}

/** Removes a category; its pins stay, as plain pins. */
export function removePinCategory(doc: MapDoc, id: string): MapDoc {
  return {
    ...doc,
    pinCategories: (doc.pinCategories ?? []).filter((c) => c.id !== id),
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.map((i) => {
        if (i.kind !== 'pin' || i.category !== id) return i;
        const { category: _c, ...rest } = i;
        return rest;
      }),
    })),
  };
}

/** How a pin looks: its own icon, else its category's; its category's colour; whether it shows. */
export function pinStyle(
  doc: MapDoc,
  pin: Extract<MapItem, { kind: 'pin' }>,
): { icon: string | null; color: string; hidden: boolean } {
  const category = pin.category ? doc.pinCategories?.find((c) => c.id === pin.category) : undefined;
  return {
    icon: pin.icon ?? category?.icon ?? null,
    color: category?.color ?? (pin.map ? MAP_PIN_COLOR : PIN_COLOR),
    hidden: category?.hidden === true,
  };
}

// endregion

// region Finding maps

export interface MapFilter {
  /** Words in the name, folder or tags. */
  q: string;
  /** A folder and everything in it; empty for all. */
  folder: string;
  /** Tags a map must all have. */
  tags: readonly string[];
  /** Only battle maps or only world and city maps. */
  kind?: MapKind;
}

const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

export function filterMaps<M extends Pick<MapDoc, 'name' | 'folder' | 'tags' | 'kind' | 'scale'>>(
  maps: readonly M[],
  filter: MapFilter,
): M[] {
  const wanted = words(filter.q);
  return maps.filter((m) => {
    const inFolder = m.folder === filter.folder || m.folder?.startsWith(`${filter.folder}/`);
    if (filter.folder && !inFolder) return false;
    if (filter.tags.some((t) => !(m.tags ?? []).includes(t))) return false;
    if (filter.kind && mapKind(m) !== filter.kind) return false;
    const text = [m.name, m.folder ?? '', ...(m.tags ?? [])].join(' ').toLowerCase();
    return wanted.every((w) => text.includes(w));
  });
}

/** Every folder in use, with the folders above them (`A`, `A/B`), sorted. */
export function mapFolders(maps: readonly Pick<MapDoc, 'folder'>[]): string[] {
  const out = new Set<string>();
  for (const m of maps) {
    const parts = (m.folder ?? '').split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) out.add(parts.slice(0, i).join('/'));
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'en'));
}

/** Every tag in use, with how many maps have it, most used first. */
export function mapTags(maps: readonly Pick<MapDoc, 'tags'>[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const m of maps) for (const t of m.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'));
}

// endregion
