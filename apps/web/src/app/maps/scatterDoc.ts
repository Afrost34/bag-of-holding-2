import { stampUnit } from './units';
import { glyphAspect, isGlyphRef } from './glyphs';
import type { DressRule, MapDoc, MapItem } from './model';
import { parsePackRef, squaresOf } from './packModel';
import { insetPolygon } from './polyclip';
import { pointInPolygon } from './polygon';
import { pickIndex, randomAngle, type Instance, type Obstacles } from './scatter';
import { bounds, growPolygon, nearestOnPolyline, splinePoints } from './spline';
import { seeded, type TerrainRef } from './terrain';
import { dressPieces, type DressInstance, type DressTarget } from './dress/engine';
import { INTERIOR_PLACES } from './dress/interior';
import { isPortalPicture } from './portal';

/**
 * A dressing (scatter item) on its map: the outline it fills or the line it follows (its own
 * points, or those of a shape, room or path it is tied to, so moving that moves the dressing),
 * what it keeps clear of (roads, rivers, trails, buildings, and ground that is water), where it
 * may stand (`onlyOn` a kind of terrain), making it from the tool's settings, and baking it into
 * stamps. The pieces themselves come from the dress engine (`dress/engine.ts`).
 */

export type ScatterItem = Extract<MapItem, { kind: 'scatter' }>;

type PathItem = Extract<MapItem, { kind: 'path' }>;

const allItems = (doc: MapDoc): MapItem[] => doc.layers.flatMap((l) => l.items);

/** The biggest glyph of a dressing: a room's furniture stays this far in from the walls. */
const largestGlyph = (item: ScatterItem): number =>
  Math.max(0, ...item.rules.map((r) => (r.pieces.some((p) => isGlyphRef(p.ref)) ? r.sizeMax : 0)));

/** The outline (area) or line (along) a dressing uses, rounded, in map pixels. */
export function scatterLine(doc: MapDoc, item: ScatterItem): number[] {
  if (item.within) {
    const target = allItems(doc).find((i) => i.id === item.within);
    if (target?.kind === 'shape') return splinePoints(target.points, true, target.smooth);
    // A room: its floor, a little in from the walls.
    if (target?.kind === 'room') {
      const floor = splinePoints(target.points, true, target.smooth);
      // Furniture placed against the walls needs the floor up to the wall's inner face; pieces
      // scattered over the floor keep half a piece in, so they do not spill over the walls.
      const interior = item.rules.some((r) => INTERIOR_PLACES.has(r.place));
      const inset = interior
        ? target.wall * 0.6
        : target.wall * 1.2 + Math.max(largestGlyph(item), doc.grid.size) * 0.5;
      return insetPolygon(floor, inset) ?? growPolygon(floor, -target.wall * 1.4);
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

/** Whether the dressing is tied to another item (its own points are then not used). */
export const isTied = (item: ScatterItem): boolean => Boolean(item.within ?? item.follow);

interface Ground {
  texture: TerrainRef | undefined;
  outline: number[];
  holes: number[][];
  box: { x0: number; y0: number; x1: number; y1: number };
}

/** Shapes in drawing order, bottom first, with their outlines. */
function grounds(doc: MapDoc): Ground[] {
  const out: Ground[] = [];
  for (const layer of doc.layers)
    for (const item of layer.items)
      if (item.kind === 'shape') {
        const outline = splinePoints(item.points, true, item.smooth);
        const holes = (item.holes ?? [])
          .filter((h) => h.length >= 6)
          .map((h) => splinePoints(h, true, item.smooth));
        out.push({ texture: item.texture, outline, holes, box: bounds(outline) });
      }
  return out;
}

/** The terrain at a point: the texture of the last (top) shape that covers it. */
function terrainAt(list: readonly Ground[], x: number, y: number): TerrainRef | undefined | null {
  let found: TerrainRef | undefined | null = null;
  for (const g of list) {
    if (x < g.box.x0 || x > g.box.x1 || y < g.box.y0 || y > g.box.y1) continue;
    if (pointInPolygon({ x, y }, g.outline) && !g.holes.some((h) => pointInPolygon({ x, y }, h)))
      found = g.texture;
  }
  return found;
}

/** Where things may stand on a map: clear of roads, rivers and buildings, off water. */
export interface PlacementOptions {
  /** Keep clear of paths, buildings and water (auto), or not. */
  avoid: 'auto' | 'none';
  /** Roads and rivers do not count; buildings and water still do. */
  overPaths?: boolean | undefined;
  /** Only on these kinds of ground. */
  onlyOn?: readonly TerrainRef[] | undefined;
  /** A path to ignore (the one a dressing follows). */
  skipPath?: string | undefined;
}

export function placementRules(
  doc: MapDoc,
  options: PlacementOptions,
): { obstacles: Obstacles; allowed: (x: number, y: number) => boolean } {
  const onlyOn = options.onlyOn;
  const list = options.avoid === 'none' && !onlyOn?.length ? [] : grounds(doc);
  const lines =
    options.avoid === 'none' || options.overPaths
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

/** Where a dressing goes and what it keeps clear of, for the dress engine. */
export function dressTarget(doc: MapDoc, item: ScatterItem): DressTarget {
  const rules = placementRules(doc, {
    avoid: item.avoid,
    overPaths: item.overPaths,
    onlyOn: item.onlyOn,
    skipPath: item.follow,
  });
  // Laid over a shape with holes, it keeps out of them.
  const target = item.within ? allItems(doc).find((i) => i.id === item.within) : undefined;
  const holes =
    target?.kind === 'shape'
      ? (target.holes ?? [])
          .filter((h) => h.length >= 6)
          .map((h) => splinePoints(h, true, target.smooth))
      : [];
  return {
    line: scatterLine(doc, item),
    mode: item.mode,
    seed: item.seed,
    obstacles: {
      lines: rules.obstacles.lines,
      polygons: [...rules.obstacles.polygons, ...holes],
    },
    allowed: rules.allowed,
    clearance: item.clearance,
    cell: doc.grid.size,
    reach: (rule, piece) => pieceBox(doc, rule, piece).w / 2,
    box: (rule, piece) => pieceBox(doc, rule, piece),
    ...(target?.kind === 'room' ? { doors: roomDoors(doc, target) } : {}),
  };
}

/**
 * The doorways of a room: its own doors, and pack door pictures standing on its walls (the Door
 * tool puts those on any wall).
 */
export function roomDoors(
  doc: MapDoc,
  room: Extract<MapItem, { kind: 'room' }>,
): { x: number; y: number }[] {
  const outline = splinePoints(room.points, true, room.smooth);
  const ring = outline.length >= 4 ? [...outline, outline[0] ?? 0, outline[1] ?? 0] : outline;
  const near = room.wall + doc.grid.size * 0.5;
  const portals = allItems(doc).flatMap((i) =>
    i.kind === 'stamp' && isPortalPicture(i.stamp) && nearestOnPolyline(ring, i).dist <= near
      ? [{ x: i.x, y: i.y }]
      : [],
  );
  return [...(room.doors ?? []).map((d) => ({ x: d.x, y: d.y })), ...portals];
}

/** The pieces of a dressing, rule by rule. */
export function scatterOf(doc: MapDoc, item: ScatterItem): DressInstance[] {
  return dressPieces(item.rules, dressTarget(doc, item));
}

/**
 * A short text that changes when anything a dressing reacts to changes: the paths, shapes,
 * buildings and rooms of the map. Pieces are drawn again when it does (a road moved, an island
 * reshaped, a room's walls dragged).
 */
export function obstacleSignature(doc: MapDoc): string {
  const parts: unknown[] = [];
  for (const layer of doc.layers)
    for (const i of layer.items)
      if (i.kind === 'path') parts.push([i.id, i.points, i.smooth, i.style, i.width]);
      else if (i.kind === 'shape')
        parts.push([i.id, i.points, i.smooth, i.texture ?? '', i.holes ?? []]);
      else if (i.kind === 'building') parts.push([i.id, i.points]);
      else if (i.kind === 'room') parts.push([i.id, i.points, i.smooth, i.wall, i.doors ?? []]);
      else if (i.kind === 'stamp' && isPortalPicture(i.stamp)) parts.push([i.id, i.x, i.y]);
  const text = JSON.stringify(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${h.toString(36)}-${text.length.toString(36)}`;
}

// region Making and baking

/** The settings the Dress tool makes new dressings from. */
export interface DressSettings {
  /** The recipe picked (or `mix` for a set of pictures, `custom` once rules were edited). */
  recipe: string;
  mode: 'area' | 'along';
  rules: DressRule[];
  avoid: 'auto' | 'none';
  overPaths?: boolean | undefined;
  onlyOn?: TerrainRef[] | undefined;
  /** Multiplies spacing, glyph sizes and offsets: the same recipe for a battle map or a continent. */
  scale: number;
  /** One piece per click, drawn at random, instead of a stroke over an area. */
  single?: boolean;
}

/** A rule with its lengths multiplied (the tool's "size of everything"). */
export function scaleRule(rule: DressRule, k: number): DressRule {
  if (k === 1) return rule;
  const glyphs = rule.pieces.some((p) => isGlyphRef(p.ref));
  return {
    ...rule,
    spacing: Math.round(rule.spacing * k),
    // Pack pictures keep the size their name gives: their sizes are only a variation.
    sizeMin: glyphs ? Math.round(rule.sizeMin * k) : rule.sizeMin,
    sizeMax: glyphs ? Math.round(rule.sizeMax * k) : rule.sizeMax,
    offset: Math.round(rule.offset * k),
    ...(rule.depth !== undefined ? { depth: Math.round(rule.depth * k) } : {}),
  };
}

/** A dressing from settings and where it goes (its own points, or a shape, room or path to tie to). */
export function makeScatter(
  id: string,
  s: DressSettings,
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
    ...(s.recipe !== 'custom' && s.recipe !== 'mix' ? { recipe: s.recipe } : {}),
    rules: s.rules.map((r) =>
      scaleRule({ ...r, pieces: r.pieces.map((p) => ({ ...p })) }, s.scale),
    ),
    clearance: 0,
    avoid: s.avoid,
    ...(s.overPaths ? { overPaths: true as const } : {}),
    ...(s.onlyOn?.length ? { onlyOn: s.onlyOn } : {}),
  };
}

/**
 * How big a piece is: a glyph is as wide as its size says. A pack picture whose name gives its
 * size in squares (`Oak_2x2.webp`) keeps that size on the map's grid and the size range only varies
 * it (0.8–1.2 times, say), so a mix of big and small trees keeps each one's proportions. Anything
 * else is as wide as its size says, with the aspect given (or square). A piece's own `scale`
 * multiplies it.
 */
export function pieceBox(
  doc: MapDoc,
  rule: DressRule,
  inst: Instance,
  aspect = 1,
): { w: number; h: number; base: boolean } {
  const piece = rule.pieces[inst.piece];
  const ref = piece?.ref ?? '';
  const k = piece?.scale ?? 1;
  if (isGlyphRef(ref))
    return { w: inst.size * k, h: (inst.size * k) / glyphAspect(ref), base: true };
  const parsed = parsePackRef(ref);
  const squares = parsed ? squaresOf(parsed.path) : null;
  if (squares) {
    const middle = Math.max(1, (rule.sizeMin + rule.sizeMax) / 2);
    const w = squares.w * stampUnit(doc) * (inst.size / middle) * k;
    return { w, h: (w * squares.h) / squares.w, base: false };
  }
  return { w: inst.size * k, h: (inst.size * k) / aspect, base: false };
}

/**
 * Settings that lay a whole set of pack pictures: spacing from how big they are on the map
 * (`unit`: pixels to a pack square), the size range as a variation around each picture's own size,
 * turned any way (top-down art).
 */
export function mixSettings(
  refs: readonly string[],
  base: DressSettings,
  unit: number,
): DressSettings {
  const widths = refs
    .map((r) => {
      const parsed = parsePackRef(r);
      return parsed ? (squaresOf(parsed.path)?.w ?? 1) : 1;
    })
    .sort((a, b) => a - b);
  const typical = widths[Math.floor(widths.length / 2)] ?? 1;
  return {
    ...base,
    recipe: 'mix',
    mode: 'area',
    rules: [
      {
        place: 'area',
        pieces: refs.map((ref) => ({ ref, weight: 1 })),
        spacing: Math.round(Math.max(typical, 1) * unit * 1.1),
        sizeMin: 80,
        sizeMax: 120,
        rotation: 'random',
        cluster: 0,
        offset: 0,
        sides: 'center',
        jitter: 0,
      },
    ],
    scale: 1,
  };
}

/** A placed piece as a stamp, where it stands; null when its rule is gone. */
export function instanceStamp(
  doc: MapDoc,
  rules: readonly DressRule[],
  inst: DressInstance,
  id: string,
): Extract<MapItem, { kind: 'stamp' }> | null {
  const rule = rules[inst.rule];
  if (!rule) return null;
  const box = pieceBox(doc, rule, inst);
  return {
    kind: 'stamp',
    id,
    stamp: rule.pieces[inst.piece]?.ref ?? '',
    x: Math.round(inst.x),
    // A glyph stands on its base: its centre is above where it stands.
    y: Math.round(box.base ? inst.y - box.h * 0.42 : inst.y),
    w: Math.round(box.w),
    h: Math.round(box.h),
    rotation: Math.round((inst.angle * 180) / Math.PI) % 360,
    ...(inst.flip ? { flipX: true } : {}),
    ...(inst.tint ? { tint: inst.tint } : {}),
  };
}

/** The dressing turned into loose stamps, one for each piece, where it stands now. */
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
  const stamps: MapItem[] = scatterOf(doc, item).flatMap((inst) => {
    const stamp = instanceStamp(doc, item.rules, inst, '');
    return stamp ? [{ ...stamp, id: fresh() }] : [];
  });
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.flatMap((i) => (i.id === id ? stamps : [i])),
    })),
  };
}

/**
 * One piece of the first rule put down at a point, as an ordinary stamp (Dungeondraft's
 * click-once scatter): the piece, size and turn are drawn at random, so the next click is
 * another. Null when the settings have no pieces.
 */
export function singlePiece(
  doc: MapDoc,
  s: DressSettings,
  at: { x: number; y: number },
  id: string,
  seed: number,
): MapItem | null {
  const first = s.rules.find((r) => r.pieces.length > 0);
  if (!first) return null;
  const rule = scaleRule(first, s.scale);
  const rand = seeded(seed);
  const piece = pickIndex(
    rule.pieces.map((p) => p.weight),
    rand(),
  );
  const size = rule.sizeMin + rand() * Math.max(0, rule.sizeMax - rule.sizeMin);
  const angle =
    rule.rotation === 'random'
      ? randomAngle(rand, rule)
      : rule.rotation === 'quarter'
        ? Math.floor(rand() * 4) * (Math.PI / 2)
        : 0;
  const inst: Instance = { x: at.x, y: at.y, angle, size, piece };
  const box = pieceBox(doc, rule, inst);
  return {
    kind: 'stamp',
    id,
    stamp: rule.pieces[piece]?.ref ?? '',
    x: Math.round(at.x),
    y: Math.round(box.base ? at.y - box.h * 0.42 : at.y),
    w: Math.round(box.w),
    h: Math.round(box.h),
    rotation: Math.round((angle * 180) / Math.PI) % 360,
  };
}

// endregion
