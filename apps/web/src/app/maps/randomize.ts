import { updateItem, type MapDoc, type MapItem } from './model';
import { colourVariants, shapeVariants, type FolderIndex } from './packNames';
import { packRef, parsePackRef } from './packModel';
import { seeded } from './terrain';

/**
 * Breaking up copies: picked stamps swapped for another shape or colour of the same picture,
 * turned, mirrored, resized and tinted a little; and every picked stamp of one material swapped
 * for another (walnut to red wood). Pure: the seed decides.
 */

export interface RandomizeOptions {
  /** Another shape of the same thing (A1 → A3), of the same size. */
  shape: boolean;
  /** Another colour or material of the same thing. */
  colour: boolean;
  /** A small turn (up to `turnBy` degrees either way) and a mirror half the time. */
  turn: boolean;
  /** 0.9 to 1.1 times as big. */
  size: boolean;
  /** A faint tint, so copies of one picture are not quite the same colour. */
  tint: boolean;
}

export const DEFAULT_RANDOMIZE: RandomizeOptions = {
  shape: true,
  colour: false,
  turn: true,
  size: false,
  tint: false,
};

type Stamp = Extract<MapItem, { kind: 'stamp' }>;

const pick = <T>(list: readonly T[], r: number): T | undefined =>
  list[Math.min(list.length - 1, Math.floor(r * list.length))];

/** A faint tint near white: a light colour of a random hue. */
export function faintTint(r: number, s: number): string {
  const hue = r * 360;
  const sat = 0.12 + s * 0.12;
  const light = 0.88;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const hex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/** One stamp changed as the options say, with numbers from `rand`. */
export function randomizeStamp(
  item: Stamp,
  options: RandomizeOptions,
  index: FolderIndex,
  rand: () => number,
  turnBy = 10,
): Stamp {
  const out: Stamp = { ...item };
  const ref = parsePackRef(item.stamp);
  if (ref && (options.colour || options.shape)) {
    let path = ref.path;
    if (options.colour) path = pick(colourVariants(index, ref.pack, path), rand())?.path ?? path;
    if (options.shape) path = pick(shapeVariants(index, ref.pack, path), rand()) ?? path;
    out.stamp = packRef(ref.pack, path);
  }
  if (options.turn) {
    out.rotation = (((item.rotation + (rand() * 2 - 1) * turnBy) % 360) + 360) % 360;
    if (rand() < 0.5) out.flipX = !item.flipX;
  }
  if (options.size) {
    const k = 0.9 + rand() * 0.2;
    out.w = item.w * k;
    out.h = item.h * k;
  }
  if (options.tint) out.tint = faintTint(rand(), rand());
  return out;
}

/** The picked stamps randomized; other items are left as they are. */
export function randomizeStamps(
  doc: MapDoc,
  ids: readonly string[],
  options: RandomizeOptions,
  index: FolderIndex,
  seed: number,
): MapDoc {
  const rand = seeded(seed);
  let out = doc;
  for (const id of ids)
    out = updateItem(out, id, (i) =>
      i.kind === 'stamp' ? randomizeStamp(i, options, index, rand) : i,
    );
  return out;
}

/** The colours and materials the picked stamps come in, with how many of them have each. */
export function materialChoices(
  doc: MapDoc,
  ids: readonly string[],
  index: FolderIndex,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const stamp of pickedStamps(doc, ids)) {
    const ref = parsePackRef(stamp.stamp);
    if (!ref) continue;
    const labels = new Set(
      colourVariants(index, ref.pack, ref.path)
        .map((v) => v.label)
        .filter(Boolean),
    );
    for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Every picked stamp that comes in `label` swapped for that colour or material. */
export function swapMaterial(
  doc: MapDoc,
  ids: readonly string[],
  label: string,
  index: FolderIndex,
): MapDoc {
  let out = doc;
  for (const id of ids)
    out = updateItem(out, id, (i) => {
      if (i.kind !== 'stamp') return i;
      const ref = parsePackRef(i.stamp);
      if (!ref) return i;
      const to = colourVariants(index, ref.pack, ref.path).find((v) => v.label === label);
      return to && to.path !== ref.path ? { ...i, stamp: packRef(ref.pack, to.path) } : i;
    });
  return out;
}

function pickedStamps(doc: MapDoc, ids: readonly string[]): Stamp[] {
  const want = new Set(ids);
  const out: Stamp[] = [];
  for (const layer of doc.layers)
    for (const i of layer.items) if (i.kind === 'stamp' && want.has(i.id)) out.push(i);
  return out;
}
