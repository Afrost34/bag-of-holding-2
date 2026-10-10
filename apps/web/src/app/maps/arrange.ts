import { newId } from '../cards/model';
import { addItem, type MapDoc, type MapItem } from './model';
import { bounds } from './spline';

/**
 * Working with several items at once, and drawing symmetrically: where an item is, moving it,
 * lining a group up or spacing it out, and mirrored copies of what was just drawn. Pure.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The box an item covers (roughly: pins and text count as a point with a little size). */
export function itemBox(item: MapItem): Box {
  switch (item.kind) {
    case 'stamp': {
      const r = Math.hypot(item.w, item.h) / 2;
      // A turned stamp covers the box of its turned corners; this is that, near enough.
      const a = (item.rotation * Math.PI) / 180;
      const hw = (Math.abs(item.w * Math.cos(a)) + Math.abs(item.h * Math.sin(a))) / 2;
      const hh = (Math.abs(item.w * Math.sin(a)) + Math.abs(item.h * Math.cos(a))) / 2;
      return {
        x0: item.x - Math.min(hw, r),
        y0: item.y - Math.min(hh, r),
        x1: item.x + Math.min(hw, r),
        y1: item.y + Math.min(hh, r),
      };
    }
    case 'pin':
    case 'text':
    case 'template':
      return { x0: item.x - 10, y0: item.y - 10, x1: item.x + 10, y1: item.y + 10 };
    case 'stroke': {
      const b = bounds(item.points);
      const h = item.width / 2;
      return { x0: b.x0 - h, y0: b.y0 - h, x1: b.x1 + h, y1: b.y1 + h };
    }
    default: {
      const b = bounds(item.points);
      return { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
    }
  }
}

/** The item moved by (dx, dy). */
export function translateItem(item: MapItem, dx: number, dy: number): MapItem {
  const shift = (points: readonly number[]) =>
    points.map((v, i) => Math.round(v + (i % 2 === 0 ? dx : dy)));
  switch (item.kind) {
    case 'stamp':
    case 'pin':
    case 'text':
    case 'template':
      return { ...item, x: Math.round(item.x + dx), y: Math.round(item.y + dy) };
    case 'room':
      return {
        ...item,
        points: shift(item.points),
        ...(item.doors
          ? {
              doors: item.doors.map((d) => ({
                ...d,
                x: Math.round(d.x + dx),
                y: Math.round(d.y + dy),
              })),
            }
          : {}),
      };
    default:
      return { ...item, points: shift(item.points) };
  }
}

/** The items of a map with these ids, in drawing order. */
export function itemsWithIds(doc: MapDoc, ids: readonly string[]): MapItem[] {
  const wanted = new Set(ids);
  return doc.layers.flatMap((l) => l.items.filter((i) => wanted.has(i.id)));
}

/** The box round several items. */
export function groupBox(items: readonly MapItem[]): Box | null {
  const boxes = items.map(itemBox);
  if (boxes.length === 0) return null;
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Moves the items so their edges (or middles) line up with the group's. */
export function alignItems(doc: MapDoc, ids: readonly string[], mode: AlignMode): MapDoc {
  const items = itemsWithIds(doc, ids);
  const group = groupBox(items);
  if (!group || items.length < 2) return doc;
  const moves = new Map<string, [number, number]>();
  for (const item of items) {
    const b = itemBox(item);
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = group.x0 - b.x0;
    else if (mode === 'right') dx = group.x1 - b.x1;
    else if (mode === 'center') dx = (group.x0 + group.x1) / 2 - (b.x0 + b.x1) / 2;
    else if (mode === 'top') dy = group.y0 - b.y0;
    else if (mode === 'bottom') dy = group.y1 - b.y1;
    else dy = (group.y0 + group.y1) / 2 - (b.y0 + b.y1) / 2;
    moves.set(item.id, [dx, dy]);
  }
  return applyMoves(doc, moves);
}

/** Spaces the items evenly between the outermost two along an axis (needs three or more). */
export function distributeItems(doc: MapDoc, ids: readonly string[], axis: 'x' | 'y'): MapDoc {
  const items = itemsWithIds(doc, ids);
  if (items.length < 3) return doc;
  const centre = (i: MapItem) => {
    const b = itemBox(i);
    return axis === 'x' ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2;
  };
  const sorted = [...items].sort((a, b) => centre(a) - centre(b));
  const firstItem = sorted[0];
  const lastItem = sorted.at(-1);
  if (!firstItem || !lastItem) return doc;
  const first = centre(firstItem);
  const last = centre(lastItem);
  const step = (last - first) / (sorted.length - 1);
  const moves = new Map<string, [number, number]>();
  sorted.forEach((item, k) => {
    const delta = first + step * k - centre(item);
    moves.set(item.id, axis === 'x' ? [delta, 0] : [0, delta]);
  });
  return applyMoves(doc, moves);
}

function applyMoves(doc: MapDoc, moves: ReadonlyMap<string, [number, number]>): MapDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.map((i) => {
        const m = moves.get(i.id);
        return m && (m[0] !== 0 || m[1] !== 0) ? translateItem(i, m[0], m[1]) : i;
      }),
    })),
  };
}

/** The items moved together by (dx, dy). */
export function moveItems(doc: MapDoc, ids: readonly string[], dx: number, dy: number): MapDoc {
  const moves = new Map(ids.map((id): [string, [number, number]] => [id, [dx, dy]]));
  return applyMoves(doc, moves);
}

/** Every item with these ids taken off the map. */
export function removeItems(doc: MapDoc, ids: readonly string[]): MapDoc {
  const gone = new Set(ids);
  return {
    ...doc,
    layers: doc.layers.map((l) => ({ ...l, items: l.items.filter((i) => !gone.has(i.id)) })),
  };
}

// region Mirroring

export type Mirror = 'off' | 'x' | 'y' | 'xy';

export const MIRRORS: { id: Mirror; name: string }[] = [
  { id: 'off', name: 'No mirror' },
  { id: 'x', name: 'Left and right' },
  { id: 'y', name: 'Top and bottom' },
  { id: 'xy', name: 'All four' },
];

/** The item reflected across a vertical (`x`) or horizontal (`y`) line through `axis`. */
export function reflectItem(
  item: MapItem,
  across: 'x' | 'y',
  axis: { x: number; y: number },
  id: string,
): MapItem {
  const fx = (x: number) => Math.round(2 * axis.x - x);
  const fy = (y: number) => Math.round(2 * axis.y - y);
  const flip = (points: readonly number[]) =>
    points.map((v, i) =>
      i % 2 === 0
        ? across === 'x'
          ? fx(v)
          : Math.round(v)
        : across === 'y'
          ? fy(v)
          : Math.round(v),
    );
  switch (item.kind) {
    case 'stamp':
      return {
        ...item,
        id,
        x: across === 'x' ? fx(item.x) : item.x,
        y: across === 'y' ? fy(item.y) : item.y,
        rotation: (360 - item.rotation) % 360,
        ...(across === 'x' ? { flipX: !item.flipX } : { flipY: !item.flipY }),
      };
    case 'pin':
    case 'text':
    case 'template':
      return item;
    case 'room':
      return {
        ...item,
        id,
        points: flip(item.points),
        ...(item.doors
          ? {
              doors: item.doors.map((d) => ({
                ...d,
                x: across === 'x' ? fx(d.x) : d.x,
                y: across === 'y' ? fy(d.y) : d.y,
                angle: across === 'x' ? Math.PI - d.angle : -d.angle,
              })),
            }
          : {}),
      };
    case 'scatter':
      // Its own outline is mirrored, and it is rolled again so the copy is not a perfect twin.
      return { ...item, id, points: flip(item.points), seed: (item.seed + 7919) % 1_000_000_007 };
    default:
      return { ...item, id, points: flip(item.points) };
  }
}

/** The copies of an item a mirror setting asks for (none for `off`, pins and text). */
export function mirrorCopies(
  item: MapItem,
  mirror: Mirror,
  axis: { x: number; y: number },
  newId: (taken: readonly string[]) => string,
): MapItem[] {
  if (mirror === 'off' || item.kind === 'pin' || item.kind === 'text' || item.kind === 'template')
    return [];
  const taken = [item.id];
  const make = (item0: MapItem, across: 'x' | 'y'): MapItem => {
    const id = newId(taken);
    taken.push(id);
    return reflectItem(item0, across, axis, id);
  };
  const out: MapItem[] = [];
  if (mirror === 'x' || mirror === 'xy') out.push(make(item, 'x'));
  if (mirror === 'y' || mirror === 'xy') out.push(make(item, 'y'));
  if (mirror === 'xy') out.push(make(make(item, 'x'), 'y'));
  return out;
}

// endregion

/** A point moved so the line from `from` runs at a multiple of `step` degrees. */
export function constrainAngle(
  from: { x: number; y: number },
  to: { x: number; y: number },
  step = 15,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return to;
  const stepRad = (step * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / stepRad) * stepRad;
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}

/**
 * The nearest control point (of a shape, path, room, building, wall…) within `radius`, to snap a
 * new point to: so a room meets the wall of another exactly.
 */
export function nearestVertex(
  doc: MapDoc,
  p: { x: number; y: number },
  radius: number,
  ignore?: string,
): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (const layer of doc.layers)
    for (const item of layer.items) {
      if (item.id === ignore || !('points' in item)) continue;
      for (let i = 0; i + 1 < item.points.length; i += 2) {
        const x = item.points[i] ?? 0;
        const y = item.points[i + 1] ?? 0;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d <= radius && (!best || d < best.d)) best = { x, y, d };
      }
    }
  return best ? { x: best.x, y: best.y } : null;
}

/** An item added to a layer, with the mirrored copies a mirror setting asks for. */
export function addMirrored(doc: MapDoc, layerId: string, item: MapItem, mirror: Mirror): MapDoc {
  let next = addItem(doc, layerId, item);
  if (mirror === 'off') return next;
  const ids = () => next.layers.flatMap((l) => l.items.map((i) => i.id));
  const copies = mirrorCopies(item, mirror, { x: doc.width / 2, y: doc.height / 2 }, (taken) =>
    newId([...ids(), ...taken]),
  );
  for (const copy of copies) next = addItem(next, layerId, copy);
  return next;
}
