import { updateItem, type MapDoc, type MapItem } from '../model';
import { stateVariant, type FolderIndex } from '../packNames';
import { packRef, parsePackRef, squaresOf } from '../packModel';
import { seeded } from '../terrain';
import { stampUnit } from '../units';
import { isSeat, isTable } from './tables';

/**
 * Ageing what is already on the map (Age / decay): each picked stamp, by chance (`strength`),
 * becomes its broken or fallen picture where the packs have one (a broken barrel, a fallen
 * stool, a smashed display case), is knocked over (seats and tables without one), or gets a
 * grimy tint. The ruin recipes (`recipes.ts`, Decay) add rubble, cobwebs and ivy on top. Pure.
 */

type Stamp = Extract<MapItem, { kind: 'stamp' }>;

/** A dull brown multiply: soot and grime. */
const GRIME = '#cfc3ad';

/** One stamp aged, with numbers from `rand`. */
export function ageStamp(doc: MapDoc, stamp: Stamp, index: FolderIndex, rand: () => number): Stamp {
  const ref = parsePackRef(stamp.stamp);
  return ageStampTo(doc, stamp, ref ? stateVariant(index, ref.pack, ref.path) : null, rand);
}

/** One stamp aged, its broken picture (a path in the same pack) given, or null when it has none. */
export function ageStampTo(
  doc: MapDoc,
  stamp: Stamp,
  broken: string | null,
  rand: () => number,
): Stamp {
  const ref = parsePackRef(stamp.stamp);
  if (ref && broken) {
    // The broken picture keeps its own size (a barrel on its side is longer), scaled as the
    // whole one was.
    const squares = squaresOf(broken);
    const natural = squaresOf(ref.path);
    const unit = stampUnit(doc);
    const k = natural ? stamp.w / (natural.w * unit) : 1;
    return {
      ...stamp,
      stamp: packRef(ref.pack, broken),
      ...(squares ? { w: squares.w * unit * k, h: squares.h * unit * k } : {}),
      rotation: (stamp.rotation + (rand() * 2 - 1) * 25 + 360) % 360,
    };
  }
  if (isSeat(stamp) || isTable(stamp)) {
    const turn = (25 + rand() * 50) * (rand() < 0.5 ? -1 : 1);
    const unit = stampUnit(doc);
    return {
      ...stamp,
      rotation: (stamp.rotation + turn + 360) % 360,
      x: stamp.x + (rand() * 2 - 1) * unit * 0.25,
      y: stamp.y + (rand() * 2 - 1) * unit * 0.25,
    };
  }
  return { ...stamp, tint: GRIME };
}

/** The picked stamps aged, each with a chance of `strength` (0–1). */
export function ageStamps(
  doc: MapDoc,
  ids: readonly string[],
  index: FolderIndex,
  strength: number,
  seed: number,
): MapDoc {
  const rand = seeded(seed);
  let out = doc;
  for (const id of ids) {
    const roll = rand();
    out = updateItem(out, id, (i) =>
      i.kind === 'stamp' && roll < strength ? ageStamp(out, i, index, rand) : i,
    );
  }
  return out;
}
