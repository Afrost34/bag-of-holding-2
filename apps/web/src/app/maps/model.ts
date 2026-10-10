import { newId } from '../cards/model';
import type { Elevation } from './elevation';
import { pointInPolygon } from './polygon';
import type { RouteDash } from './lettering';
import type { PathEnd } from './pathEnds';
import type { Door } from './rooms';
import type { TerrainRef } from './terrain';
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
 * A map is a canvas, a grid, and layers drawn bottom to top. A layer is a picture or holds items:
 * stamps, brush strokes, walls, text, routes and pins. Positions are in map pixels. Variants are
 * named sets of what is shown (a night version, another floor). Version 2 turned the background
 * and the extra pictures of version 1 into picture layers (see `upgradeV1`).
 */

export const MAPS_DIR = 'maps';
export const MAP_ASSETS = 'assets';
export const STAMPS_DIR = 'stamps';

export type GridType = 'square' | 'hex';

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
  /** Drawn or hidden; hidden it still snaps and measures. */
  visible: boolean;
}

export type TemplateShape = 'cone' | 'sphere' | 'cube' | 'line';

/** What every item can be: drawn under the other items of its layer (Dungeondraft's Over/Under). */
export interface ItemOrder {
  under?: boolean;
}

export type MapItem = ItemOrder & MapItemBody;

type MapItemBody =
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
      texture?: TerrainRef;
      /** 0–1: how far the edge fades into what is under it (smooth blending); hard when absent. */
      soft?: number;
    }
  | {
      kind: 'wall';
      id: string;
      points: number[];
      /** A pack's wall strip (`pack:<id>:<path>`); absent: a drawn ink line. */
      texture?: string;
    }
  /** A closed area of terrain (land, water, a forest floor) with a rounded outline. */
  | {
      kind: 'shape';
      id: string;
      /** Control points of the outline: x0, y0, x1, y1… */
      points: number[];
      /** 0 straight corners, 1 fully rounded. */
      smooth: number;
      texture?: TerrainRef;
      color: string;
      /** 0.1–1. */
      opacity: number;
      /** A shore glow with wave lines, an ink line, or none. */
      edge: 'none' | 'ink' | 'shore';
      /** Areas cut out of it (a lake in a forest): control points of each, as the outline's. */
      holes?: number[][];
    }
  /**
   * Pieces (trees, rocks, mountains) scattered from a seed over an area or along a line, kept
   * clear of roads and rivers. Made again whenever what it reacts to changes; "bake" turns it
   * into loose stamps.
   */
  | {
      kind: 'scatter';
      id: string;
      mode: 'area' | 'along';
      /** Control points of its own outline or line (unused while tied to another item). */
      points: number[];
      smooth: number;
      /** Fill this shape (by id) instead: reshaping the shape reshapes the scatter. */
      within?: string;
      /** Follow this path (by id) instead. */
      follow?: string;
      seed: number;
      /** Glyphs (`glyph:tree`) or stamps, with the weight each is picked with. */
      pieces: { ref: string; weight: number }[];
      spacing: number;
      sizeMin: number;
      sizeMax: number;
      rotation: 'none' | 'random' | 'along' | 'quarter';
      /** Random turning between these (degrees); all the way round when absent. */
      rotMin?: number;
      rotMax?: number;
      /** 0 even, 1 groves with clearings. */
      cluster: number;
      offset: number;
      sides: 'center' | 'both' | 'left' | 'right';
      jitter: number;
      clearance: number;
      /** Keep clear of roads, rivers and water (auto), or not. */
      avoid: 'auto' | 'none';
      /** Only on these kinds of ground. */
      onlyOn?: TerrainRef[];
    }
  /**
   * A district of a town: from its outline, streets cut it into blocks and each block is divided
   * into lots with a building each, from the seed. Keeps clear of roads, rivers and water, and
   * can have a wall. Buildings erased are listed in `removed`; "bake" turns the rest into
   * buildings of their own.
   */
  | {
      kind: 'district';
      id: string;
      points: number[];
      smooth: number;
      seed: number;
      style: 'town' | 'dense' | 'noble' | 'market' | 'ward';
      blockSize: number;
      streetWidth: number;
      lotArea: number;
      gap: number;
      density: number;
      jitter: number;
      angle: number;
      plaza: number;
      wall: boolean;
      avoid: 'auto' | 'none';
      removed?: string[];
    }
  /** A building drawn by hand (or baked from a district): its footprint and roof. */
  | {
      kind: 'building';
      id: string;
      points: number[];
      roof: 'tiles' | 'thatch' | 'slate' | 'flat';
      color: string;
      name?: string;
    }
  /**
   * A room for a battle map: a footprint with a floor, walls and doors. Walls of all the rooms on
   * a layer go under all their floors, so rooms that touch join up.
   */
  | {
      kind: 'room';
      id: string;
      points: number[];
      /** 0 straight walls, up to 1 a rounded cave. */
      smooth: number;
      floor: TerrainRef;
      /** Wall thickness, in map pixels. */
      wall: number;
      wallStyle: 'stone' | 'cave' | 'wood';
      /** A pack's wall strip for the walls, instead of the drawn style. */
      wallTexture?: string;
      doors?: Door[];
    }
  /** A road, trail, river or fence along control points. */
  | {
      kind: 'path';
      id: string;
      points: number[];
      smooth: number;
      style: 'road' | 'trail' | 'river' | 'fence';
      width: number;
      color: string;
      /** A river that widens along its way (default); false keeps one width. */
      taper?: boolean;
      /** The path this one flows into. */
      into?: string;
      /** How it begins and ends; hard when absent. */
      start?: PathEnd;
      end?: PathEnd;
      /** The last point joins the first: a ring road, a moat. */
      loop?: boolean;
    }
  /** A way across a world or city map, stop by stop: its length says how long the journey is. */
  | {
      kind: 'route';
      id: string;
      points: number[];
      label: string;
      color: string;
      /** A solid line otherwise. */
      dash?: RouteDash;
    }
  | {
      kind: 'text';
      id: string;
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
      /** Lettered as on an old map (a region's name), rather than bold. */
      font?: 'fantasy';
      /** Space between letters, in hundredths of the size. */
      spacing?: number;
      /** Degrees, clockwise. */
      rotation?: number;
      /** −100 (a bowl) to 100 (an arch): see `arcLayout`. */
      curve?: number;
      /** A path or shape (by id) the lettering runs along: `x`, `y` and `curve` are then not used. */
      follow?: string;
      /** Where the middle of the label sits along it: 0 (start) to 1 (end). */
      along?: number;
      /** How far to the side of the line it stands (negative: above). */
      lift?: number;
    }
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
      /** A page of the app (a character, a board, an encounter…): its route. */
      page?: string;
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

/** The paper a map is drawn on. */
export const PAPERS = [
  { id: 'parchment', name: 'Parchment', color: '#f3efe6' },
  { id: 'aged', name: 'Aged paper', color: '#e7d8b4' },
  { id: 'clean', name: 'Clean white', color: '#ffffff' },
  { id: 'night', name: 'Night', color: '#1f2636' },
] as const;
export type MapPaper = (typeof PAPERS)[number]['id'];

/** A picture in the map assets; the layer shows it from the map's top-left corner. */
export interface LayerPicture {
  path: string;
  width: number;
  height: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  items: MapItem[];
  /** A picture layer shows this picture and holds no items. */
  picture?: LayerPicture;
}

/** What a variant of the map shows: a layer or an item not listed follows its own flag. */
export interface Variant {
  id: string;
  name: string;
  layers: Record<string, boolean>;
  /** Pins, routes and other items shown (true) or hidden (false). */
  items: Record<string, boolean>;
}

/**
 * A flat picture of the map's art, made on the device that draws it (the Creator), so devices
 * without the stamp packs (a phone) see the map as it was drawn: one picture for each variant
 * (`-` when there are none). It is only used while `hash` still matches the art.
 */
export interface MapRender {
  hash: string;
  width: number;
  height: number;
  /** Variant id (or `-`) → picture in the map assets. */
  images: Record<string, string>;
}

/** A part of the map the players cannot see yet: a polygon, x0, y0, x1, y1… */
export interface RevealShape {
  id: string;
  points: number[];
  /** True once the DM has shown it to the players. */
  revealed: boolean;
}

export interface MapDoc {
  version: 2;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  grid: Grid;
  /** Bottom first. */
  layers: Layer[];
  /** Named sets of what is shown (a night version, a floor). */
  variants?: Variant[];
  /** The variant shown now (absent: each layer's own flag). */
  activeVariant?: string;
  /** The flat picture of the art for devices without the packs (see `MapRender`). */
  render?: MapRender;
  /** Hidden areas the players have not seen yet (the Viewer's fog); absent: nothing hidden. */
  reveal?: RevealShape[];
  /** The encounter fought here. */
  encounter?: string;
  /** Kinds of pins, with the icon and colour their pins take. */
  pinCategories?: PinCategory[];
  /** How pins are drawn: markers (absent), or as on a fantasy map (inked icons, italic names). */
  pinStyle?: 'fantasy';
  /** A scale bar in the bottom-left corner: plain, or as on an old map (absent: none). */
  scaleBar?: 'plain' | 'fantasy';
  /** Heights under the map, shown as hill shading (absent: flat). */
  elevation?: Elevation;
  /** The paper under the map (absent: parchment). */
  paper?: MapPaper;
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

/** A flat picture of a map (`key`: a variant's id, or `-`). */
export function mapRenderPath(id: string, key: string, campaign?: string): string {
  return `${mapDir(campaign)}/${MAP_ASSETS}/render-${id}-${key}.webp`;
}

/**
 * The map as it is after moving to a campaign (or to the library, `undefined`): its pictures and
 * flat pictures get paths in the new place. Returns the map and which files to copy (and the
 * old ones to delete after). `exists` says whether a path in the new place is already taken.
 */
export function relocateMap(
  doc: MapDoc,
  to: string | undefined,
  exists: (path: string) => boolean,
): { doc: MapDoc; copies: [from: string, to: string][] } {
  const copies: [string, string][] = [];
  const used = new Set<string>();
  const place = (from: string): string => {
    const name = from.slice(from.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let path = mapAssetPath(name, to);
    for (let n = 1; used.has(path) || exists(path); n++)
      path = mapAssetPath(`${stem} ${String(n)}${ext}`, to);
    used.add(path);
    copies.push([from, path]);
    return path;
  };
  const layers = doc.layers.map((l) =>
    l.picture ? { ...l, picture: { ...l.picture, path: place(l.picture.path) } } : l,
  );
  const render = doc.render
    ? {
        ...doc.render,
        images: Object.fromEntries(
          Object.entries(doc.render.images).map(([key, path]): [string, string] => {
            const next = mapRenderPath(doc.id, key, to);
            used.add(next);
            copies.push([path, next]);
            return [key, next];
          }),
        ),
      }
    : undefined;
  // The thumbnail has a place of its own.
  copies.push([mapThumbPath(doc.id, doc.campaign), mapThumbPath(doc.id, to)]);
  const { campaign: _c, render: _r, ...rest } = doc;
  return {
    doc: { ...rest, layers, ...(render ? { render } : {}), ...(to ? { campaign: to } : {}) },
    copies,
  };
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
  visible: true,
};

/** The largest side of a map, in squares. */
export const MAX_SQUARES = 200;

/** A side in pixels for a number of squares of the default grid (1–200 squares). */
export const sizeInSquares = (n: number): number =>
  Math.round(Math.min(MAX_SQUARES, Math.max(1, n))) * DEFAULT_GRID.size;

export function newMap(
  name: string,
  existingIds: readonly string[],
  now: string,
  squares?: { w: number; h: number },
): MapDoc {
  const ids: string[] = [];
  const layer = (n: string): Layer => {
    const id = newId(ids);
    ids.push(id);
    return { id, name: n, visible: true, locked: false, items: [] };
  };
  return {
    version: 2,
    id: newId(existingIds),
    name: name.trim() || 'Map',
    createdAt: now,
    updatedAt: now,
    width: sizeInSquares(squares?.w ?? 40),
    height: sizeInSquares(squares?.h ?? 30),
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
const boolMap = (v: unknown): Record<string, boolean> =>
  isObj(v)
    ? Object.fromEntries(
        Object.entries(v).filter((e): e is [string, boolean] => typeof e[1] === 'boolean'),
      )
    : {};
const KINDS = new Set([
  'stamp',
  'stroke',
  'wall',
  'shape',
  'path',
  'scatter',
  'district',
  'building',
  'room',
  'route',
  'text',
  'template',
  'pin',
]);

/** True when a stored map is older than this build's format (it is saved again once read). */
export function mapIsStale(text: string | null): boolean {
  if (!text) return false;
  try {
    const json: unknown = JSON.parse(text);
    return isObj(json) && num(json.version, 1) < 2;
  } catch {
    return false;
  }
}

/**
 * Version 1 had a `background` picture and `pictures` over it, shown or hidden. They become
 * picture layers at the bottom. With extra pictures, what was shown becomes the variant "As it
 * was", and each extra picture gets a variant of its own (the background and that picture).
 */
export function upgradeV1(
  json: Record<string, unknown>,
  used: readonly string[],
): { layers: Layer[]; variants: Variant[]; active?: string } {
  const taken = [...used];
  const fresh = () => {
    const id = newId(taken);
    taken.push(id);
    return id;
  };
  const bg =
    isObj(json.background) && typeof json.background.path === 'string' ? json.background : null;
  const size = { width: num(bg?.width, 1000), height: num(bg?.height, 1000) };
  const layers: Layer[] = [];
  if (bg)
    layers.push({
      id: fresh(),
      name: 'Background',
      visible: true,
      locked: true,
      items: [],
      picture: { path: String(bg.path), ...size },
    });
  const extra = (Array.isArray(json.pictures) ? json.pictures : []).flatMap((p) =>
    isObj(p) && typeof p.path === 'string'
      ? [
          {
            name: typeof p.name === 'string' ? p.name : 'Picture',
            path: p.path,
            shown: p.visible === true,
          },
        ]
      : [],
  );
  for (const p of extra)
    layers.push({
      id: fresh(),
      name: p.name,
      visible: p.shown,
      locked: true,
      items: [],
      picture: { path: p.path, ...size },
    });
  const base = layers[0];
  if (!bg || !base || extra.length === 0) return { layers, variants: [] };
  const asWas: Variant = {
    id: fresh(),
    name: 'As it was',
    layers: Object.fromEntries(layers.map((l) => [l.id, l.visible])),
    items: {},
  };
  const each = layers.slice(1).map((l): Variant => ({
    id: fresh(),
    name: l.name,
    layers: Object.fromEntries(layers.map((x) => [x.id, x.id === base.id || x.id === l.id])),
    items: {},
  }));
  return { layers, variants: [asWas, ...each], active: asWas.id };
}

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
  const type: GridType = g.type === 'hex' ? 'hex' : 'square';
  const drawn = (Array.isArray(json.layers) ? json.layers : []).flatMap((l): Layer[] =>
    isObj(l) && typeof l.id === 'string'
      ? [
          {
            id: l.id,
            name: typeof l.name === 'string' ? l.name : 'Layer',
            visible: l.visible !== false,
            locked: l.locked === true,
            ...(isObj(l.picture) && typeof l.picture.path === 'string'
              ? {
                  picture: {
                    path: l.picture.path,
                    width: num(l.picture.width, 1000),
                    height: num(l.picture.height, 1000),
                  },
                }
              : {}),
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
  const v1 =
    num(json.version, 1) < 2
      ? upgradeV1(
          json,
          drawn.map((l) => l.id),
        )
      : null;
  const layers = [...(v1?.layers ?? []), ...drawn];
  const bg =
    v1 && isObj(json.background) && typeof json.background.path === 'string'
      ? json.background
      : null;
  const variants = [
    ...(v1?.variants ?? []),
    ...(Array.isArray(json.variants) ? json.variants : []).flatMap((v): Variant[] =>
      isObj(v) && typeof v.id === 'string' && typeof v.name === 'string'
        ? [{ id: v.id, name: v.name, layers: boolMap(v.layers), items: boolMap(v.items) }]
        : [],
    ),
  ];
  const active =
    typeof json.activeVariant === 'string' && variants.some((v) => v.id === json.activeVariant)
      ? json.activeVariant
      : v1?.active;
  return {
    version: 2,
    id,
    name: typeof json.name === 'string' ? json.name : 'Map',
    ...(json.pinStyle === 'fantasy' ? { pinStyle: 'fantasy' as const } : {}),
    ...(PAPERS.some((p) => p.id === json.paper) ? { paper: json.paper as MapPaper } : {}),
    ...(isObj(json.elevation) &&
    typeof json.elevation.data === 'string' &&
    num(json.elevation.w, 0) > 0 &&
    num(json.elevation.h, 0) > 0 &&
    num(json.elevation.cell, 0) > 0
      ? {
          elevation: {
            w: num(json.elevation.w, 1),
            h: num(json.elevation.h, 1),
            cell: num(json.elevation.cell, 8),
            data: json.elevation.data,
            sea: num(json.elevation.sea, 90),
            strength: num(json.elevation.strength, 0.6),
            tint: json.elevation.tint === true,
          },
        }
      : {}),
    ...(json.scaleBar === 'plain' || json.scaleBar === 'fantasy'
      ? { scaleBar: json.scaleBar }
      : {}),
    createdAt: typeof json.createdAt === 'string' ? json.createdAt : '',
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '',
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
    width: bg ? num(bg.width, 2800) : num(json.width, 2800),
    height: bg ? num(bg.height, 2100) : num(json.height, 2100),
    grid: {
      type,
      size: Math.max(4, num(g.size, DEFAULT_GRID.size)),
      offsetX: num(g.offsetX, 0),
      offsetY: num(g.offsetY, 0),
      feet: num(g.feet, 5),
      opacity: num(g.opacity, DEFAULT_GRID.opacity),
      // Older maps without a grid (world maps) had type 'none': the grid stays hidden.
      visible: g.type === 'none' ? false : g.visible !== false,
    },
    layers: layers.length ? layers : newMap('', [], '').layers,
    ...(variants.length ? { variants } : {}),
    ...(active ? { activeVariant: active } : {}),
    ...(isObj(json.render) && typeof json.render.hash === 'string' && isObj(json.render.images)
      ? {
          render: {
            hash: json.render.hash,
            width: num(json.render.width, 1),
            height: num(json.render.height, 1),
            images: Object.fromEntries(
              Object.entries(json.render.images).filter(
                (e): e is [string, string] => typeof e[1] === 'string',
              ),
            ),
          },
        }
      : {}),
    ...(Array.isArray(json.reveal)
      ? {
          reveal: json.reveal.flatMap((r): RevealShape[] =>
            isObj(r) &&
            typeof r.id === 'string' &&
            Array.isArray(r.points) &&
            r.points.length >= 4 &&
            r.points.every((v) => typeof v === 'number')
              ? [{ id: r.id, points: r.points, revealed: r.revealed === true }]
              : [],
          ),
        }
      : {}),
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
    ...(campaign ? { campaign } : {}),
  };
}

/**
 * Adds a picture layer above the other pictures and below everything drawn, so a night version
 * or an overlay lies over the first picture. The map takes the size of the first picture.
 */
export function addPictureLayer(doc: MapDoc, name: string, picture: LayerPicture): MapDoc {
  const layer: Layer = {
    id: newId(allIds(doc)),
    name,
    visible: true,
    locked: true,
    items: [],
    picture,
  };
  const first = !doc.layers.some((l) => l.picture);
  const at = doc.layers.reduce((n, l, i) => (l.picture ? i + 1 : n), 0);
  const layers = [...doc.layers.slice(0, at), layer, ...doc.layers.slice(at)];
  return first
    ? { ...doc, layers, width: picture.width, height: picture.height }
    : { ...doc, layers };
}

/** Pins and routes are the Viewer's; everything else is the map's art. */
export const isArt = (item: MapItem): boolean => item.kind !== 'pin' && item.kind !== 'route';

/**
 * A short fingerprint of what the art is: sizes, picture layers, art items, which layers each
 * variant shows. Pins, routes, fog and names do not change it.
 */
export function artHash(doc: MapDoc): string {
  const text = JSON.stringify([
    doc.width,
    doc.height,
    doc.paper ?? '',
    doc.elevation ?? null,
    doc.layers.map((l) => [l.id, l.visible, l.picture ?? null, l.items.filter(isArt)]),
    (doc.variants ?? []).map((v) => [v.id, v.layers]),
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${h.toString(36)}-${text.length.toString(36)}`;
}

/** Whether the map has anything to draw (a blank map needs no flat picture). */
export const hasArt = (doc: MapDoc): boolean =>
  doc.elevation !== undefined ||
  doc.layers.some((l) => l.picture !== undefined || l.items.some(isArt));

/** A layer that holds items (not a picture): where things can be drawn. */
export const isDrawable = (layer: Layer): boolean => layer.picture === undefined;

// region Variants

/** The variant shown now, if any. */
export function activeVariant(doc: MapDoc): Variant | undefined {
  return doc.variants?.find((v) => v.id === doc.activeVariant);
}

/** Whether a layer is shown: the active variant's say, otherwise the layer's own flag. */
export function layerShown(doc: MapDoc, layer: Layer): boolean {
  return activeVariant(doc)?.layers[layer.id] ?? layer.visible;
}

/** Whether an item is shown (hidden only when the active variant says so). */
export function itemShown(doc: MapDoc, itemId: string): boolean {
  return activeVariant(doc)?.items[itemId] ?? true;
}

/** Shows or hides a layer: in the active variant when there is one, else on the layer. */
export function setLayerShown(doc: MapDoc, layerId: string, shown: boolean): MapDoc {
  const v = activeVariant(doc);
  if (!v) return updateLayer(doc, layerId, { visible: shown });
  return updateVariant(doc, v.id, (x) => ({ ...x, layers: { ...x.layers, [layerId]: shown } }));
}

/** Shows or hides one item (a pin, a route) in the active variant; without one, hiding does nothing. */
export function setItemShown(doc: MapDoc, itemId: string, shown: boolean): MapDoc {
  const v = activeVariant(doc);
  if (!v) return doc;
  return updateVariant(doc, v.id, (x) => ({ ...x, items: { ...x.items, [itemId]: shown } }));
}

export function updateVariant(doc: MapDoc, id: string, change: (v: Variant) => Variant): MapDoc {
  return { ...doc, variants: (doc.variants ?? []).map((v) => (v.id === id ? change(v) : v)) };
}

/** A new variant remembering what is shown now (layers and hidden items); it becomes active. */
export function addVariant(doc: MapDoc, name: string): MapDoc {
  const id = newId([...allIds(doc), ...(doc.variants ?? []).map((v) => v.id)]);
  const now = activeVariant(doc);
  const variant: Variant = {
    id,
    name: name.trim() || `Variant ${String((doc.variants?.length ?? 0) + 1)}`,
    layers: Object.fromEntries(doc.layers.map((l) => [l.id, layerShown(doc, l)])),
    items: { ...(now?.items ?? {}) },
  };
  return { ...doc, variants: [...(doc.variants ?? []), variant], activeVariant: id };
}

/** Switches to a variant; `undefined` goes back to each layer's own flag. */
export function setActiveVariant(doc: MapDoc, id: string | undefined): MapDoc {
  if (id === undefined) {
    const { activeVariant: _a, ...rest } = doc;
    return rest;
  }
  return doc.variants?.some((v) => v.id === id) ? { ...doc, activeVariant: id } : doc;
}

/** Steps to the next (+1) or previous (-1) variant, wrapping round. */
export function stepVariant(doc: MapDoc, by: 1 | -1): MapDoc {
  const list = doc.variants ?? [];
  if (list.length === 0) return doc;
  const i = list.findIndex((v) => v.id === doc.activeVariant);
  const next = list[(i + by + list.length) % list.length];
  return next ? { ...doc, activeVariant: next.id } : doc;
}

export function removeVariant(doc: MapDoc, id: string): MapDoc {
  const variants = (doc.variants ?? []).filter((v) => v.id !== id);
  const { variants: _v, activeVariant: _a, ...rest } = doc;
  return {
    ...rest,
    ...(variants.length ? { variants } : {}),
    ...(doc.activeVariant && doc.activeVariant !== id && variants.length
      ? { activeVariant: doc.activeVariant }
      : {}),
  };
}

// endregion

// region Fog (areas the players cannot see until revealed)

/**
 * Hides an area from the players (a polygon), or with `revealed` cuts a hole in the fog laid
 * before it. Shapes apply in order, so a later one wins.
 */
export function addFog(doc: MapDoc, points: number[], revealed = false): MapDoc {
  const id = newId([...allIds(doc), ...(doc.reveal ?? []).map((r) => r.id)]);
  return { ...doc, reveal: [...(doc.reveal ?? []), { id, points, revealed }] };
}

/** Whether the fog hides a point from the players (the last shape over it decides). */
export function fogHides(doc: MapDoc, x: number, y: number): boolean {
  let hidden = false;
  for (const r of doc.reveal ?? []) if (pointInPolygon({ x, y }, r.points)) hidden = !r.revealed;
  return hidden;
}

export function setFogRevealed(doc: MapDoc, id: string, revealed: boolean): MapDoc {
  return {
    ...doc,
    reveal: (doc.reveal ?? []).map((r) => (r.id === id ? { ...r, revealed } : r)),
  };
}

export function removeFog(doc: MapDoc, id: string): MapDoc {
  const reveal = (doc.reveal ?? []).filter((r) => r.id !== id);
  if (reveal.length > 0) return { ...doc, reveal };
  const { reveal: _r, ...rest } = doc;
  return rest;
}

/** A rectangle's corners as a polygon. */
export const rectPoints = (x0: number, y0: number, x1: number, y1: number): number[] => [
  x0,
  y0,
  x1,
  y0,
  x1,
  y1,
  x0,
  y1,
];

// endregion

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
}

const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

export function filterMaps<M extends Pick<MapDoc, 'name' | 'folder' | 'tags'>>(
  maps: readonly M[],
  filter: MapFilter,
): M[] {
  const wanted = words(filter.q);
  return maps.filter((m) => {
    const inFolder = m.folder === filter.folder || m.folder?.startsWith(`${filter.folder}/`);
    if (filter.folder && !inFolder) return false;
    if (filter.tags.some((t) => !(m.tags ?? []).includes(t))) return false;
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
