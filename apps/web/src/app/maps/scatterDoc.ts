import { glyphAspect, glyphRef, isGlyphRef, type GlyphId } from './glyphs';
import type { MapDoc, MapItem } from './model';
import { parsePackRef, squaresOf } from './packModel';
import { insetPolygon } from './polyclip';
import { pointInPolygon } from './polygon';
import { scatterInstances, type Instance, type Obstacles, type ScatterSpec } from './scatter';
import { bounds, growPolygon, splinePoints } from './spline';
import type { TerrainRef } from './terrain';

/**
 * How a scatter item meets the rest of its map: the outline it fills or the line it follows (its
 * own points, or those of a shape or path it is tied to, so moving that moves the scatter), what
 * it keeps clear of (roads, rivers, trails, and ground that is water), and where it may stand
 * (`onlyOn` a kind of terrain).
 */

export type ScatterItem = Extract<MapItem, { kind: 'scatter' }>;

type PathItem = Extract<MapItem, { kind: 'path' }>;

const allItems = (doc: MapDoc): MapItem[] => doc.layers.flatMap((l) => l.items);

/** The outline (area) or line (along) a scatter uses, rounded, in map pixels. */
export function scatterLine(doc: MapDoc, item: ScatterItem): number[] {
  if (item.within) {
    const target = allItems(doc).find((i) => i.id === item.within);
    if (target?.kind === 'shape') return splinePoints(target.points, true, target.smooth);
    // A room: its floor, a little in from the walls.
    if (target?.kind === 'room') {
      const floor = splinePoints(target.points, true, target.smooth);
      // In from the walls by half a piece too, so furniture does not spill over them.
      return (
        insetPolygon(floor, target.wall * 1.2 + item.sizeMax * 0.5) ??
        growPolygon(floor, -target.wall * 1.4)
      );
    }
  }
  if (item.follow) {
    const path = allItems(doc).find(
      (i): i is PathItem => i.kind === 'path' && i.id === item.follow,
    );
    if (path) return splinePoints(path.points, false, path.smooth);
  }
  return splinePoints(item.points, item.mode === 'area', item.smooth);
}

/** Whether the scatter is tied to another item (its own points are then not used). */
export const isTied = (item: ScatterItem): boolean => Boolean(item.within ?? item.follow);

interface Ground {
  texture: TerrainRef | undefined;
  outline: number[];
  box: { x0: number; y0: number; x1: number; y1: number };
}

/** Shapes in drawing order, bottom first, with their outlines. */
function grounds(doc: MapDoc): Ground[] {
  const out: Ground[] = [];
  for (const layer of doc.layers)
    for (const item of layer.items)
      if (item.kind === 'shape') {
        const outline = splinePoints(item.points, true, item.smooth);
        out.push({ texture: item.texture, outline, box: bounds(outline) });
      }
  return out;
}

/** The terrain at a point: the texture of the last (top) shape that covers it. */
function terrainAt(list: readonly Ground[], x: number, y: number): TerrainRef | undefined | null {
  let found: TerrainRef | undefined | null = null;
  for (const g of list) {
    if (x < g.box.x0 || x > g.box.x1 || y < g.box.y0 || y > g.box.y1) continue;
    if (pointInPolygon({ x, y }, g.outline)) found = g.texture;
  }
  return found;
}

/** Where things may stand on a map: clear of roads, rivers and buildings, off water. */
export interface PlacementOptions {
  /** Keep clear of paths, buildings and water (auto), or not. */
  avoid: 'auto' | 'none';
  /** Only on these kinds of ground. */
  onlyOn?: readonly TerrainRef[] | undefined;
  /** A path to ignore (the one a scatter follows). */
  skipPath?: string | undefined;
}

export function placementRules(
  doc: MapDoc,
  options: PlacementOptions,
): { obstacles: Obstacles; allowed: (x: number, y: number) => boolean } {
  const onlyOn = options.onlyOn;
  const list = options.avoid === 'none' && !onlyOn?.length ? [] : grounds(doc);
  const lines =
    options.avoid === 'none'
      ? []
      : allItems(doc).flatMap((i) =>
          i.kind === 'path' && i.style !== 'fence' && i.id !== options.skipPath
            ? [{ points: splinePoints(i.points, false, i.smooth), half: i.width / 2 }]
            : [],
        );
  const polygons =
    options.avoid === 'none'
      ? []
      : allItems(doc).flatMap((i) => (i.kind === 'building' ? [i.points] : []));
  return {
    obstacles: { lines, polygons },
    allowed: (x, y) => {
      if (options.avoid === 'none' && !onlyOn?.length) return true;
      const ground = terrainAt(list, x, y);
      // Water is not stood on (unless the thing is for reeds and the like: `onlyOn` says).
      if (options.avoid !== 'none' && ground === 'water' && !onlyOn?.includes('water'))
        return false;
      if (onlyOn?.length) return ground !== null && ground !== undefined && onlyOn.includes(ground);
      return true;
    },
  };
}

/** Everything needed to make the pieces of a scatter item. */
export function scatterSetup(
  doc: MapDoc,
  item: ScatterItem,
): { spec: ScatterSpec; obstacles: Obstacles; allowed: (x: number, y: number) => boolean } {
  return {
    spec: {
      mode: item.mode,
      line: scatterLine(doc, item),
      seed: item.seed,
      spacing: item.spacing,
      sizeMin: item.sizeMin,
      sizeMax: item.sizeMax,
      weights: item.pieces.map((p) => p.weight),
      rotation: item.rotation,
      rotMin: item.rotMin,
      rotMax: item.rotMax,
      cluster: item.cluster,
      offset: item.offset,
      sides: item.sides,
      jitter: item.jitter,
      clearance: item.clearance,
      max: 6000,
    },
    ...placementRules(doc, {
      avoid: item.avoid,
      onlyOn: item.onlyOn,
      skipPath: item.follow,
    }),
  };
}

export function scatterOf(doc: MapDoc, item: ScatterItem): Instance[] {
  const { spec, obstacles, allowed } = scatterSetup(doc, item);
  return scatterInstances(spec, obstacles, allowed);
}

/**
 * A short text that changes when anything a scatter reacts to changes: the paths and shapes of
 * the map. Scatter pieces are drawn again when it does (a road moved, an island reshaped).
 */
export function obstacleSignature(doc: MapDoc): string {
  const parts: unknown[] = [];
  for (const layer of doc.layers)
    for (const i of layer.items)
      if (i.kind === 'path') parts.push([i.id, i.points, i.smooth, i.style, i.width]);
      else if (i.kind === 'shape') parts.push([i.id, i.points, i.smooth, i.texture ?? '']);
      else if (i.kind === 'building') parts.push([i.id, i.points]);
  const text = JSON.stringify(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${h.toString(36)}-${text.length.toString(36)}`;
}

// region Presets

export interface ScatterPreset {
  id: string;
  name: string;
  hint: string;
  mode: 'area' | 'along';
  pieces: { ref: string; weight: number }[];
  spacing: number;
  sizeMin: number;
  sizeMax: number;
  rotation: 'none' | 'random' | 'along' | 'quarter';
  cluster: number;
  offset: number;
  sides: 'center' | 'both' | 'left' | 'right';
  jitter: number;
  onlyOn?: TerrainRef[];
}

const g = (id: GlyphId, weight = 1) => ({ ref: glyphRef(id), weight });

const furnish = (
  id: string,
  name: string,
  hint: string,
  pieces: { ref: string; weight: number }[],
  spacing: number,
  sizeMin: number,
  sizeMax: number,
): ScatterPreset => ({
  id,
  name,
  hint,
  mode: 'area',
  pieces,
  spacing,
  sizeMin,
  sizeMax,
  rotation: 'quarter',
  cluster: 0.15,
  offset: 0,
  sides: 'center',
  jitter: 0,
});

/** What a room can be furnished as (sizes are for a grid of 70 pixels). */
export const FURNISH_PRESETS: ScatterPreset[] = [
  furnish(
    'tavern',
    'Tavern',
    'tables, chairs, barrels',
    [g('table', 2), g('chair', 5), g('barrel', 1)],
    175,
    62,
    104,
  ),
  furnish(
    'storage',
    'Storeroom',
    'barrels, crates, chests',
    [g('barrel', 3), g('crate', 3), g('chest', 1)],
    112,
    48,
    70,
  ),
  furnish(
    'bedroom',
    'Bedroom',
    'beds, chests, a shelf',
    [g('bed', 2), g('chest', 1), g('shelf', 1), g('chair', 1)],
    200,
    66,
    120,
  ),
  furnish(
    'workshop',
    'Workshop',
    'benches, crates, shelves',
    [g('table', 3), g('crate', 1), g('barrel', 1), g('shelf', 1)],
    165,
    62,
    104,
  ),
  furnish(
    'study',
    'Library or study',
    'shelves, tables, chairs',
    [g('shelf', 3), g('table', 1), g('chair', 2)],
    170,
    80,
    130,
  ),
];

export const SCATTER_PRESETS: ScatterPreset[] = [
  {
    id: 'forest',
    name: 'Forest',
    hint: 'mixed trees and bushes',
    mode: 'area',
    pieces: [g('tree', 3), g('pine', 1), g('bush', 1)],
    spacing: 46,
    sizeMin: 42,
    sizeMax: 70,
    rotation: 'none',
    cluster: 0.15,
    offset: 0,
    sides: 'center',
    jitter: 0,
  },
  {
    id: 'pines',
    name: 'Pine forest',
    hint: 'dense conifers',
    mode: 'area',
    pieces: [g('pine', 5), g('tree', 0.5)],
    spacing: 38,
    sizeMin: 40,
    sizeMax: 66,
    rotation: 'none',
    cluster: 0.1,
    offset: 0,
    sides: 'center',
    jitter: 0,
  },
  {
    id: 'grove',
    name: 'Groves',
    hint: 'clumps with clearings',
    mode: 'area',
    pieces: [g('tree', 3), g('bush', 1)],
    spacing: 40,
    sizeMin: 40,
    sizeMax: 64,
    rotation: 'none',
    cluster: 0.75,
    offset: 0,
    sides: 'center',
    jitter: 0,
  },
  {
    id: 'hills',
    name: 'Hills',
    hint: 'rolling hills',
    mode: 'area',
    pieces: [g('hill')],
    spacing: 84,
    sizeMin: 80,
    sizeMax: 130,
    rotation: 'none',
    cluster: 0.2,
    offset: 0,
    sides: 'center',
    jitter: 0,
  },
  {
    id: 'mountains',
    name: 'Mountain range',
    hint: 'along a line you draw',
    mode: 'along',
    pieces: [g('mountain', 3), g('peak', 1)],
    spacing: 66,
    sizeMin: 90,
    sizeMax: 150,
    rotation: 'none',
    cluster: 0,
    offset: 0,
    sides: 'center',
    jitter: 0.7,
  },
  {
    id: 'rocks',
    name: 'Rocks',
    hint: 'boulders and rubble',
    mode: 'area',
    pieces: [g('rock')],
    spacing: 52,
    sizeMin: 22,
    sizeMax: 46,
    rotation: 'none',
    cluster: 0.4,
    offset: 0,
    sides: 'center',
    jitter: 0,
  },
  {
    id: 'grass',
    name: 'Grass tufts',
    hint: 'light ground cover',
    mode: 'area',
    pieces: [g('tuft')],
    spacing: 30,
    sizeMin: 16,
    sizeMax: 26,
    rotation: 'none',
    cluster: 0.2,
    offset: 0,
    sides: 'center',
    jitter: 0,
  },
  {
    id: 'reeds',
    name: 'Reeds',
    hint: 'in water',
    mode: 'area',
    pieces: [g('reed')],
    spacing: 26,
    sizeMin: 18,
    sizeMax: 30,
    rotation: 'none',
    cluster: 0.5,
    offset: 0,
    sides: 'center',
    jitter: 0,
    onlyOn: ['water'],
  },
  {
    id: 'hedge',
    name: 'Hedge or tree line',
    hint: 'along a line you draw',
    mode: 'along',
    pieces: [g('bush', 3), g('tree', 1)],
    spacing: 30,
    sizeMin: 26,
    sizeMax: 40,
    rotation: 'none',
    cluster: 0,
    offset: 0,
    sides: 'center',
    jitter: 0.12,
  },
  {
    id: 'roadside',
    name: 'Trees beside a road',
    hint: 'both sides of a line',
    mode: 'along',
    pieces: [g('tree', 3), g('pine', 1)],
    spacing: 62,
    sizeMin: 40,
    sizeMax: 60,
    rotation: 'none',
    cluster: 0,
    offset: 44,
    sides: 'both',
    jitter: 0.25,
  },
];

// endregion

// region Making and baking

/** The settings the Scatter tool makes new scatter items from. */
export interface ScatterSettings {
  preset: string;
  mode: 'area' | 'along';
  pieces: { ref: string; weight: number }[];
  /** Spacing and sizes before `scale`. */
  spacing: number;
  sizeMin: number;
  sizeMax: number;
  rotation: 'none' | 'random' | 'along' | 'quarter';
  rotMin?: number | undefined;
  rotMax?: number | undefined;
  cluster: number;
  offset: number;
  sides: 'center' | 'both' | 'left' | 'right';
  jitter: number;
  avoid: 'auto' | 'none';
  onlyOn?: TerrainRef[] | undefined;
  /** Multiplies spacing, sizes and offset: the same preset for a battle map or a continent. */
  scale: number;
}

export const settingsFromPreset = (p: ScatterPreset, scale = 1): ScatterSettings => ({
  preset: p.id,
  mode: p.mode,
  pieces: p.pieces.map((x) => ({ ...x })),
  spacing: p.spacing,
  sizeMin: p.sizeMin,
  sizeMax: p.sizeMax,
  rotation: p.rotation,
  cluster: p.cluster,
  offset: p.offset,
  sides: p.sides,
  jitter: p.jitter,
  avoid: 'auto',
  ...(p.onlyOn ? { onlyOn: p.onlyOn } : {}),
  scale,
});

/** A scatter item from settings and where it goes (its own points, or a shape or path to tie to). */
export function makeScatter(
  id: string,
  s: ScatterSettings,
  where: { points: number[]; within?: string; follow?: string },
  seed: number,
): ScatterItem {
  return {
    kind: 'scatter',
    id,
    mode: s.mode,
    points: where.points,
    smooth: s.mode === 'area' ? 0.7 : 0.5,
    ...(where.within ? { within: where.within } : {}),
    ...(where.follow ? { follow: where.follow } : {}),
    seed,
    pieces: s.pieces.map((p) => ({ ...p })),
    spacing: Math.round(s.spacing * s.scale),
    sizeMin: Math.round(s.sizeMin * s.scale),
    sizeMax: Math.round(s.sizeMax * s.scale),
    rotation: s.rotation,
    ...(s.rotMin !== undefined ? { rotMin: s.rotMin } : {}),
    ...(s.rotMax !== undefined ? { rotMax: s.rotMax } : {}),
    cluster: s.cluster,
    offset: Math.round(s.offset * s.scale),
    sides: s.sides,
    jitter: s.jitter,
    clearance: 0,
    avoid: s.avoid,
    ...(s.onlyOn?.length ? { onlyOn: s.onlyOn } : {}),
  };
}

/**
 * How big a piece is: a glyph is as wide as its size says. A pack picture whose name gives its
 * size in squares (`Oak_2x2.webp`) keeps that size on the map's grid and the size range only varies
 * it (0.8–1.2 times, say), so a mix of big and small trees keeps each one's proportions. Anything
 * else is as wide as its size says, with the aspect given (or square).
 */
export function pieceBox(
  doc: MapDoc,
  item: ScatterItem,
  inst: Instance,
  aspect = 1,
): { w: number; h: number; base: boolean } {
  const ref = item.pieces[inst.piece]?.ref ?? '';
  if (isGlyphRef(ref)) return { w: inst.size, h: inst.size / glyphAspect(ref), base: true };
  const parsed = parsePackRef(ref);
  const squares = parsed ? squaresOf(parsed.path) : null;
  if (squares) {
    const middle = Math.max(1, (item.sizeMin + item.sizeMax) / 2);
    const w = squares.w * doc.grid.size * (inst.size / middle);
    return { w, h: (w * squares.h) / squares.w, base: false };
  }
  return { w: inst.size, h: inst.size / aspect, base: false };
}

/**
 * Settings that scatter a whole set of pack pictures: spacing from how big they are on the grid,
 * the size range as a variation around each picture's own size, turned any way (top-down art).
 */
export function mixSettings(
  refs: readonly string[],
  base: ScatterSettings,
  gridSize: number,
): ScatterSettings {
  const widths = refs
    .map((r) => {
      const parsed = parsePackRef(r);
      return parsed ? (squaresOf(parsed.path)?.w ?? 1) : 1;
    })
    .sort((a, b) => a - b);
  const typical = widths[Math.floor(widths.length / 2)] ?? 1;
  return {
    ...base,
    preset: 'mix',
    pieces: refs.map((ref) => ({ ref, weight: 1 })),
    spacing: Math.round(Math.max(typical, 1) * gridSize * 1.1),
    sizeMin: 80,
    sizeMax: 120,
    rotation: 'random',
    scale: 1,
  };
}

/** The scatter turned into loose stamps, one for each piece, where it stands now. */
export function bakeScatter(doc: MapDoc, id: string): MapDoc {
  const item = allItems(doc).find((i): i is ScatterItem => i.kind === 'scatter' && i.id === id);
  if (!item) return doc;
  const taken = new Set(allItems(doc).map((i) => i.id));
  const fresh = () => {
    let n = 0;
    let candidate = `${id}-${String(n)}`;
    while (taken.has(candidate)) candidate = `${id}-${String(++n)}`;
    taken.add(candidate);
    return candidate;
  };
  const stamps: MapItem[] = scatterOf(doc, item).map((inst) => {
    const ref = item.pieces[inst.piece]?.ref ?? '';
    const box = pieceBox(doc, item, inst);
    return {
      kind: 'stamp',
      id: fresh(),
      stamp: ref,
      x: Math.round(inst.x),
      // A glyph stands on its base: its centre is above where it stands.
      y: Math.round(box.base ? inst.y - box.h * 0.42 : inst.y),
      w: Math.round(box.w),
      h: Math.round(box.h),
      rotation: Math.round((inst.angle * 180) / Math.PI) % 360,
    };
  });
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.flatMap((i) => (i.id === id ? stamps : [i])),
    })),
  };
}

// endregion

const firstPreset = SCATTER_PRESETS[0];
if (!firstPreset) throw new Error('No scatter presets');
/** What the Scatter tool starts with. */
export const DEFAULT_SCATTER: ScatterSettings = settingsFromPreset(firstPreset);
