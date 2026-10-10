import { glyphAspect, glyphRef, isGlyphRef, type GlyphId } from './glyphs';
import type { MapDoc, MapItem } from './model';
import { parsePackRef, squaresOf } from './packModel';
import { pointInPolygon } from './polygon';
import { scatterInstances, type Instance, type Obstacles, type ScatterSpec } from './scatter';
import { bounds, splinePoints } from './spline';
import type { TerrainId } from './terrain';

/**
 * How a scatter item meets the rest of its map: the outline it fills or the line it follows (its
 * own points, or those of a shape or path it is tied to, so moving that moves the scatter), what
 * it keeps clear of (roads, rivers, trails, and ground that is water), and where it may stand
 * (`onlyOn` a kind of terrain).
 */

export type ScatterItem = Extract<MapItem, { kind: 'scatter' }>;

type ShapeItem = Extract<MapItem, { kind: 'shape' }>;
type PathItem = Extract<MapItem, { kind: 'path' }>;

const allItems = (doc: MapDoc): MapItem[] => doc.layers.flatMap((l) => l.items);

/** The outline (area) or line (along) a scatter uses, rounded, in map pixels. */
export function scatterLine(doc: MapDoc, item: ScatterItem): number[] {
  if (item.within) {
    const shape = allItems(doc).find(
      (i): i is ShapeItem => i.kind === 'shape' && i.id === item.within,
    );
    if (shape) return splinePoints(shape.points, true, shape.smooth);
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
  texture: TerrainId | undefined;
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
function terrainAt(list: readonly Ground[], x: number, y: number): TerrainId | undefined | null {
  let found: TerrainId | undefined | null = null;
  for (const g of list) {
    if (x < g.box.x0 || x > g.box.x1 || y < g.box.y0 || y > g.box.y1) continue;
    if (pointInPolygon({ x, y }, g.outline)) found = g.texture;
  }
  return found;
}

/** What a scatter keeps clear of: roads, trails and rivers (and, below, water ground). */
function obstaclesOf(doc: MapDoc, item: ScatterItem): Obstacles {
  if (item.avoid === 'none') return { lines: [], polygons: [] };
  const lines = allItems(doc).flatMap((i) =>
    i.kind === 'path' && i.style !== 'fence' && i.id !== item.follow
      ? [{ points: splinePoints(i.points, false, i.smooth), half: i.width / 2 }]
      : [],
  );
  return { lines, polygons: [] };
}

/** Everything needed to make the pieces of a scatter item. */
export function scatterSetup(
  doc: MapDoc,
  item: ScatterItem,
): { spec: ScatterSpec; obstacles: Obstacles; allowed: (x: number, y: number) => boolean } {
  const list = grounds(doc);
  const onlyOn = item.onlyOn;
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
      cluster: item.cluster,
      offset: item.offset,
      sides: item.sides,
      jitter: item.jitter,
      clearance: item.clearance,
      max: 6000,
    },
    obstacles: obstaclesOf(doc, item),
    allowed: (x, y) => {
      if (item.avoid === 'none' && !onlyOn?.length) return true;
      const ground = terrainAt(list, x, y);
      // Water is not stood on (unless the scatter is for reeds and the like: `onlyOn` says).
      if (item.avoid !== 'none' && ground === 'water' && !onlyOn?.includes('water')) return false;
      if (onlyOn?.length) return ground !== null && ground !== undefined && onlyOn.includes(ground);
      return true;
    },
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
  rotation: 'none' | 'random' | 'along';
  cluster: number;
  offset: number;
  sides: 'center' | 'both' | 'left' | 'right';
  jitter: number;
  onlyOn?: TerrainId[];
}

const g = (id: GlyphId, weight = 1) => ({ ref: glyphRef(id), weight });

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
  rotation: 'none' | 'random' | 'along';
  cluster: number;
  offset: number;
  sides: 'center' | 'both' | 'left' | 'right';
  jitter: number;
  avoid: 'auto' | 'none';
  onlyOn?: TerrainId[] | undefined;
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
    cluster: s.cluster,
    offset: Math.round(s.offset * s.scale),
    sides: s.sides,
    jitter: s.jitter,
    clearance: 0,
    avoid: s.avoid,
    ...(s.onlyOn?.length ? { onlyOn: s.onlyOn } : {}),
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
    const glyph = isGlyphRef(ref);
    const parsed = parsePackRef(ref);
    const squares = parsed ? squaresOf(parsed.path) : null;
    const aspect = glyph ? glyphAspect(ref) : squares ? squares.w / squares.h : 1;
    const h = inst.size / aspect;
    return {
      kind: 'stamp',
      id: fresh(),
      stamp: ref,
      x: Math.round(inst.x),
      // A glyph stands on its base: its centre is above where it stands.
      y: Math.round(glyph ? inst.y - h * 0.42 : inst.y),
      w: Math.round(inst.size),
      h: Math.round(h),
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
