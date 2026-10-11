import type { MapDoc, MapItem } from '../model';
import { pickOne, type Wanted } from '../packDefaults';
import { packRef, parsePackRef, squaresOf, type PackEntry } from '../packModel';
import { offsetLine, pointAlong, polylineLength, splinePoints } from '../spline';
import { stampUnit } from '../units';
import { kitById, type Kit } from './catalog';

/**
 * Line kits on a map: a `kit` item keeps its line, its kind and the pictures picked when it was
 * made, and is drawn as its parts (`kitParts`): a deck strip down the line, rail strips to both
 * sides, posts every few squares. Moving a point redraws them; Bake turns them into ordinary
 * paths and stamps. Pure.
 */

export type KitItem = Extract<MapItem, { kind: 'kit' }>;

type Pickable = Pick<PackEntry, 'path' | 'pack' | 'cat'>;

function first(entries: readonly Pickable[], wanted: readonly Wanted[]): string | undefined {
  for (const w of wanted) {
    const e = pickOne(entries, w);
    if (e) return packRef(e.pack, e.path);
  }
  return undefined;
}

/** The pictures a kit picks from the packs (none without them: it is drawn). */
export function resolveKit(kit: Kit, entries: readonly Pickable[]): KitItem['palette'] {
  const deck = kit.deck ? first(entries, kit.deck.want) : undefined;
  const rail = kit.rail ? first(entries, kit.rail.want) : undefined;
  const post = kit.post ? first(entries, kit.post.want) : undefined;
  return {
    ...(deck ? { deck } : {}),
    ...(rail ? { rail } : {}),
    ...(post ? { post } : {}),
  };
}

/** A new kit along a line. */
export function makeKit(
  id: string,
  kitId: string,
  points: number[],
  entries: readonly Pickable[],
  options: { drawn?: boolean; loop?: boolean } = {},
): KitItem {
  const kit = kitById(kitId);
  return {
    kind: 'kit',
    id,
    points,
    smooth: 0.5,
    kit: kit.id,
    palette: options.drawn ? {} : resolveKit(kit, entries),
    ...(options.loop ? { loop: true } : {}),
  };
}

/** The line a kit follows (rounded as its `smooth` says). */
export const kitLine = (item: KitItem): number[] =>
  splinePoints(item.points, item.loop === true, item.smooth);

const parts = new WeakMap<KitItem, { unit: number; items: MapItem[] }>();

/** What a kit is drawn as: paths (deck, rails) and stamps (posts), with ids of their own. */
export function kitParts(doc: MapDoc, item: KitItem): MapItem[] {
  const unit = stampUnit(doc);
  const known = parts.get(item);
  if (known?.unit === unit) return known.items;
  const kit = kitById(item.kit);
  const k = (item.scale ?? 1) * unit;
  const line = kitLine(item);
  const loop = item.loop === true;
  const out: MapItem[] = [];
  if (line.length >= 4) {
    const path = (
      id: string,
      points: number[],
      s: { width: number; color: string },
      texture: string | undefined,
    ): MapItem => ({
      kind: 'path',
      id: `${item.id}~${id}`,
      points: points.map(Math.round),
      smooth: 0,
      style: 'trail',
      width: Math.max(2, Math.round(s.width * k)),
      color: s.color,
      ...(texture ? { texture } : {}),
      ...(loop ? { loop: true } : {}),
    });
    if (kit.deck) out.push(path('deck', line, kit.deck, item.palette.deck));
    if (kit.rail)
      for (const [side, name] of [
        [1, 'railL'],
        [-1, 'railR'],
      ] as const)
        out.push(
          path(
            name,
            offsetLine(line, side * kit.rail.offset * k, loop),
            kit.rail,
            item.palette.rail,
          ),
        );
    const post = item.palette.post;
    if (kit.post && post) {
      // A loop goes back to its first point.
      const run = loop ? [...line, line[0] ?? 0, line[1] ?? 0] : line;
      const length = polylineLength(run);
      const step = Math.max(1, kit.post.every * k);
      const count = Math.max(1, Math.floor(length / step + 1e-6));
      const squares = squaresOf(parsePackRef(post)?.path ?? '') ?? { w: 1, h: 1 };
      const size = kit.post.size ?? 1;
      const sides = kit.post.offset > 0 ? [1, -1] : [0];
      // Evenly spread from end to end (a loop has no second end).
      const stops = loop ? count : count + 1;
      for (let n = 0; n < stops; n++) {
        const at = pointAlong(run, n * (length / count));
        for (const side of sides) {
          const off = side * kit.post.offset * k;
          out.push({
            kind: 'stamp',
            id: `${item.id}~p${String(n)}${side < 0 ? 'r' : side > 0 ? 'l' : ''}`,
            stamp: post,
            x: Math.round(at.x - Math.sin(at.angle) * off),
            y: Math.round(at.y + Math.cos(at.angle) * off),
            w: Math.round(squares.w * k * size),
            h: Math.round(squares.h * k * size),
            rotation: Math.round(((at.angle * 180) / Math.PI + 360) % 360),
          });
        }
      }
    }
  }
  parts.set(item, { unit, items: out });
  return out;
}

/** The kit turned into what it is drawn as, in its place, with ids of their own. */
export function bakeKit(doc: MapDoc, id: string): MapDoc {
  const taken = new Set(doc.layers.flatMap((l) => l.items.map((i) => i.id)));
  const fresh = () => {
    let n = 0;
    let candidate = `${id}-${String(n)}`;
    while (taken.has(candidate)) candidate = `${id}-${String(++n)}`;
    taken.add(candidate);
    return candidate;
  };
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.flatMap((i) =>
        i.kind === 'kit' && i.id === id
          ? kitParts(doc, i).map((p) => ({ ...p, id: fresh() }))
          : [i],
      ),
    })),
  };
}

/** The pictures a kit uses, for the "used on this map" list. */
export const kitRefs = (item: KitItem): string[] =>
  Object.values(item.palette).filter((v): v is string => typeof v === 'string');
