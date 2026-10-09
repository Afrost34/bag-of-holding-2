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
  mode: 'pan' | 'move' | 'stroke' | 'erase' | 'measure' | 'template' | 'fog' | 'calibrate';
  start: Point;
  screen: Point;
  last: Point;
  item?: MapItem;
  points?: number[];
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
