/** Pure helpers of the map maker: erasing, simplifying strokes, the route status line. */
import { eraseStroke, type Point } from '../../app/maps/geometry';
import {
  addItem,
  itemId,
  layerShown,
  removeItem,
  type MapDoc,
  type MapItem,
} from '../../app/maps/model';
import { isTied } from '../../app/maps/scatterDoc';
import { nearestOnPolyline, splinePoints } from '../../app/maps/spline';
import { formatDistance, routeLength, speedsOf, travelTimes } from '../../app/maps/travel';

/** New routes' colour (the item keeps it, so it can be changed later). */
export const ROUTE_COLOR = '#b91c1c';

/** What the status line says while a route is drawn: how far so far, and how long. */
export function routeStatus(points: readonly number[], doc: MapDoc): string {
  const hint = 'Click each stop; double-click or Enter to finish the route.';
  if (!doc.scale || points.length < 4) return hint;
  const distance = routeLength(points, doc.scale);
  const times = travelTimes(distance, speedsOf(doc.scale, doc.travel));
  return [
    formatDistance(distance, doc.scale.unit),
    ...times.map((t) => `${t.name}: ${t.time}`),
  ].join(' · ');
}

export interface Drag {
  mode:
    'pan' | 'move' | 'stroke' | 'erase' | 'measure' | 'template' | 'fog' | 'vertex' | 'calibrate';
  start: Point;
  screen: Point;
  last: Point;
  item?: MapItem;
  points?: number[];
  /** The control point being dragged (mode `vertex`). */
  index?: number;
}

/**
 * The map after the eraser went along `path`: brush strokes it touched, on layers shown and
 * not locked, lose what it went over (and may fall apart into pieces).
 */
export function eraseStrokes(doc: MapDoc, path: readonly number[], radius: number): MapDoc {
  let next = doc;
  for (const layer of doc.layers) {
    if (!layerShown(doc, layer) || layer.locked) continue;
    for (const item of layer.items) {
      if (item.kind !== 'stroke') continue;
      const pieces = eraseStroke(item.points, path, radius + item.width / 2);
      if (pieces.length === 1 && pieces[0] === item.points) continue;
      if (pieces.length === 1 && pieces[0]?.length === item.points.length) continue;
      next = removeItem(next, item.id);
      for (const piece of pieces)
        next = addItem(next, layer.id, { ...item, id: itemId(next), points: simplify(piece) });
    }
  }
  return next;
}

/** Drops points closer than 2 px to the last kept one: brush strokes stay small on disk. */
export function simplify(points: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = Math.round(points[i] ?? 0);
    const y = Math.round(points[i + 1] ?? 0);
    const lx = out.at(-2);
    const ly = out.at(-1);
    if (lx === undefined || ly === undefined || Math.hypot(x - lx, y - ly) >= 2) out.push(x, y);
  }
  return out;
}

/** Points that are less than `min` px from the one before are dropped (a double click adds two). */
export function dedupePoints(points: readonly number[], min = 2): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i] ?? 0;
    const y = points[i + 1] ?? 0;
    const lx = out.at(-2);
    const ly = out.at(-1);
    if (lx === undefined || ly === undefined || Math.hypot(x - lx, y - ly) >= min) out.push(x, y);
  }
  return out;
}

/** The control point within `radius` of `p` (the nearest), or -1. */
export function nearestHandle(points: readonly number[], p: Point, radius: number): number {
  let best = -1;
  let bestDist = radius;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const d = Math.hypot((points[i] ?? 0) - p.x, (points[i + 1] ?? 0) - p.y);
    if (d <= bestDist) {
      best = i / 2;
      bestDist = d;
    }
  }
  return best;
}

/**
 * A control point added on the segment nearest to `p` (between its neighbours), for a closed
 * shape or an open path; null when `p` is farther than `within` from every segment.
 */
export function insertVertex(
  points: readonly number[],
  p: Point,
  closed: boolean,
  within: number,
): number[] | null {
  const n = Math.floor(points.length / 2);
  let best: { index: number; x: number; y: number; dist: number } | null = null;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const ax = points[i * 2] ?? 0;
    const ay = points[i * 2 + 1] ?? 0;
    const j = (i + 1) % n;
    const bx = points[j * 2] ?? 0;
    const by = points[j * 2 + 1] ?? 0;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2));
    const x = ax + dx * u;
    const y = ay + dy * u;
    const dist = Math.hypot(p.x - x, p.y - y);
    if (!best || dist < best.dist) best = { index: i, x, y, dist };
  }
  if (!best || best.dist > within) return null;
  const out = [...points];
  out.splice((best.index + 1) * 2, 0, Math.round(best.x), Math.round(best.y));
  return out;
}

/** A control point taken out; the line keeps at least `min` points. */
export function removeVertex(points: readonly number[], index: number, min: number): number[] {
  if (points.length / 2 <= min) return [...points];
  const out = [...points];
  out.splice(index * 2, 2);
  return out;
}

/**
 * A river that ends close to another river joins it: its last point moves onto that river and it
 * remembers which one it flows into.
 */
export function snapRiverEnd(
  doc: MapDoc,
  points: readonly number[],
  within: number,
): { points: number[]; into?: string } {
  const last = { x: points.at(-2) ?? 0, y: points.at(-1) ?? 0 };
  let best: { id: string; x: number; y: number; dist: number } | null = null;
  for (const layer of doc.layers)
    for (const item of layer.items) {
      if (item.kind !== 'path' || item.style !== 'river') continue;
      const near = nearestOnPolyline(splinePoints(item.points, false, item.smooth), last);
      if (near.dist <= within && (!best || near.dist < best.dist))
        best = { id: item.id, x: near.x, y: near.y, dist: near.dist };
    }
  if (!best) return { points: [...points] };
  return {
    points: [...points.slice(0, -2), Math.round(best.x), Math.round(best.y)],
    into: best.id,
  };
}

/** Items drawn from control points the user can drag (a scatter tied to another item has none). */
export type PointItem = Extract<MapItem, { kind: 'shape' | 'path' | 'scatter' }>;

export const isPointItem = (i: MapItem | null | undefined): i is PointItem =>
  !!i && (i.kind === 'shape' || i.kind === 'path' || (i.kind === 'scatter' && !isTied(i)));

/** A closed outline (a shape, a scatter over an area) rather than an open line. */
export const isClosedItem = (i: PointItem): boolean =>
  i.kind === 'shape' || (i.kind === 'scatter' && i.mode === 'area');

/** The least points a closed outline or an open line keeps. */
export const minPoints = (i: PointItem): number => (isClosedItem(i) ? 3 : 2);

/** The same item with other control points. */
export const withPoints = (i: MapItem, points: number[]): MapItem =>
  i.kind === 'shape' || i.kind === 'path' || i.kind === 'scatter' ? { ...i, points } : i;
