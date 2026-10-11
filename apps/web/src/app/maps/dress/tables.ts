import { addItem, itemId, type MapDoc, type MapItem } from '../model';
import { pickMany, type Wanted } from '../packDefaults';
import { packRef, squaresOf, parsePackRef, type PackEntry } from '../packModel';
import { stampUnit } from '../units';
import { seeded } from '../terrain';
import { distanceToBox, faceTowards, type Box } from './interior';

/**
 * Dressing tables that are already on the map (stamps): a place setting on the table in front of
 * each chair beside it, and something in the middle (candles, a meal, a pitcher). Pure: the seed
 * decides which pictures.
 */

type Stamp = Extract<MapItem, { kind: 'stamp' }>;

const SETTINGS: Wanted = {
  cats: ['clutter'],
  anyWords: ['/dishes/', '/mugs/', '/cups/'],
  not: ['pan', 'pot', 'side', 'broken', 'ceremorph'],
};
const MIDDLES: Wanted = {
  cats: ['lights', 'clutter'],
  anyWords: ['/arranged_candles/', '/prepared_meals/', '/pitchers/'],
  not: ['broken', 'ceremorph'],
};

/** Whether a stamp is a table (a picture from a Tables folder). */
export const isTable = (s: Stamp): boolean =>
  /\/tables\//i.test(s.stamp) && !/legs|bases/i.test(s.stamp);

/** Whether a stamp is something to sit on. */
export const isSeat = (s: Stamp): boolean =>
  /\/(chairs|stools|benches|armchairs|couches)\//i.test(s.stamp);

const boxOf = (s: Stamp): Box => ({
  x: s.x,
  y: s.y,
  w: s.w,
  h: s.h,
  angle: (s.rotation * Math.PI) / 180,
});

/** How far a box reaches from its centre towards (ux, uy). */
function extent(b: Box, ux: number, uy: number): number {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return (Math.abs(ux * c + uy * s) * b.w) / 2 + (Math.abs(-ux * s + uy * c) * b.h) / 2;
}

/** A picture's stamp of its own size on this map, at a place and angle. */
function stampAt(
  doc: MapDoc,
  id: string,
  e: Pick<PackEntry, 'pack' | 'path'>,
  x: number,
  y: number,
  angle: number,
): Stamp {
  const squares = squaresOf(e.path) ?? { w: 1, h: 1 };
  const unit = stampUnit(doc);
  return {
    kind: 'stamp',
    id,
    stamp: packRef(e.pack, e.path),
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(squares.w * unit),
    h: Math.round(squares.h * unit),
    rotation: Math.round(((angle * 180) / Math.PI + 360) % 360),
  };
}

/**
 * The picked tables dressed: for each, a setting in front of every seat within half a square of
 * it, and one piece in the middle. New stamps go on the table's layer, over it. Tables already
 * dressed get another setting on top: dress them once.
 */
export function dressTables(
  doc: MapDoc,
  ids: readonly string[],
  entries: readonly Pick<PackEntry, 'pack' | 'path' | 'cat'>[],
  seed: number,
): MapDoc {
  const settings = pickMany(entries, SETTINGS, 12, false);
  const middles = pickMany(entries, MIDDLES, 12, false);
  if (settings.length === 0 && middles.length === 0) return doc;
  const rand = seeded(seed);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const stamps = doc.layers.flatMap((l) => l.items).filter((i): i is Stamp => i.kind === 'stamp');
  const seats = stamps.filter(isSeat);
  let out = doc;
  for (const id of ids) {
    const table = stamps.find((s) => s.id === id);
    if (!table || !isTable(table) || !parsePackRef(table.stamp)) continue;
    const layer = out.layers.find((l) => l.items.some((i) => i.id === id));
    if (!layer) continue;
    const t = boxOf(table);
    const unit = stampUnit(out);
    const added: Stamp[] = [];
    for (const seat of seats) {
      if (distanceToBox(seat, t) > unit * 0.6) continue;
      const e = pick(settings);
      if (!e) break;
      const dx = seat.x - t.x;
      const dy = seat.y - t.y;
      const len = Math.hypot(dx, dy) || 1;
      const reach = Math.max(0, extent(t, dx / len, dy / len) - unit * 0.33);
      added.push(
        stampAt(
          out,
          '',
          e,
          t.x + (dx / len) * reach,
          t.y + (dy / len) * reach,
          faceTowards(dx, dy),
        ),
      );
    }
    const middle = pick(middles);
    if (middle) added.push(stampAt(out, '', middle, t.x, t.y, rand() * Math.PI * 2));
    for (const s of added) out = addItem(out, layer.id, { ...s, id: itemId(out) });
  }
  return out;
}
