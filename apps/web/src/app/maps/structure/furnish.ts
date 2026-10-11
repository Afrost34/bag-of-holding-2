/**
 * Furniture for whole buildings: each room type's interior recipe (`dress/interiors.ts`), its
 * pictures picked once when the building is made (kept in the spec, so importing packs later
 * changes nothing), laid in each room from the room's seed. The building's dressing adds clutter;
 * its condition breaks or knocks over some pieces (`dress/decay.ts`) and, ruined, adds rubble.
 * Pure.
 */
import { ageStampTo } from '../dress/decay';
import { dressPieces, type DressTarget } from '../dress/engine';
import { recipeById, recipeRules, type RecipeOptions } from '../dress/recipes';
import type { BuildingSpec, DressRule, MapDoc, MapItem } from '../model';
import { packRef, parsePackRef, type PackEntry } from '../packModel';
import { folderIndex, stateVariant } from '../packNames';
import { insetPolygon } from '../polyclip';
import { instanceStamp, pieceBox } from '../scatterDoc';
import { seeded } from '../terrain';
import { archetypeById } from './archetypes';

type Entries = readonly Pick<PackEntry, 'path' | 'pack' | 'cat'>[];
type Stamp = Extract<MapItem, { kind: 'stamp' }>;

/** The furnish keys of the clutter a cluttered building adds, and of a ruined one's rubble. */
export const CLUTTER = '~clutter';
export const RUIN = '~ruin';

/** How likely each piece is to be broken or knocked over, by condition. */
const WEAR: Record<BuildingSpec['condition'], number> = { kept: 0, worn: 0.25, ruined: 0.6 };

const recipeOf = (key: string): string =>
  key === CLUTTER ? 'clutter' : key === RUIN ? 'ruin' : key;

/** Every room type an archetype's programme gives, on any floor. */
export function roomTypes(archetype: string): string[] {
  const p = archetypeById(archetype).programme;
  return [...new Set([...p.ground, ...p.upper, ...p.cellar])];
}

function rulesFor(keys: readonly string[], entries: Entries, options: RecipeOptions) {
  const out: Record<string, DressRule[]> = {};
  for (const key of keys) {
    const recipe = recipeById(recipeOf(key));
    if (recipe) out[key] = recipeRules(recipe, entries, options);
  }
  return out;
}

/** For every pack picture of the furniture, its broken or fallen picture where the packs have one. */
function brokenOf(furnish: Record<string, DressRule[]>, entries: Entries): Record<string, string> {
  const index = folderIndex(entries);
  const out: Record<string, string> = {};
  for (const [key, rules] of Object.entries(furnish)) {
    if (key === RUIN) continue;
    for (const rule of rules)
      for (const piece of rule.pieces) {
        const ref = parsePackRef(piece.ref);
        const broken = ref ? stateVariant(index, ref.pack, ref.path) : null;
        if (ref && broken) out[piece.ref] = packRef(ref.pack, broken);
      }
  }
  return out;
}

/**
 * The furniture of a building picked afresh: its archetype's room types and any `extra` ones
 * (rooms given another type), clutter and rubble.
 */
export function pickFurnishing(
  spec: Pick<BuildingSpec, 'archetype'>,
  entries: Entries,
  options: RecipeOptions,
  extra: readonly string[] = [],
): Required<Pick<BuildingSpec, 'furnish' | 'broken'>> {
  // A dungeon's corridors are rooms too.
  const corridors = archetypeById(spec.archetype).layout ? ['corridor'] : [];
  const keys = [...new Set([...roomTypes(spec.archetype), ...corridors, ...extra, CLUTTER, RUIN])];
  const furnish = rulesFor(keys, entries, options);
  return { furnish, broken: brokenOf(furnish, entries) };
}

/** The spec with furniture for these room types too (the ones it has are kept); itself when none is missing. */
export function withFurnishing(
  spec: BuildingSpec,
  types: readonly string[],
  entries: Entries,
  options: RecipeOptions,
): BuildingSpec {
  const known = spec.furnish ?? {};
  const missing = types.filter((t) => !(t in known) && recipeById(recipeOf(t)));
  if (missing.length === 0) return spec;
  const added = rulesFor(missing, entries, options);
  return {
    ...spec,
    furnish: { ...known, ...added },
    broken: { ...spec.broken, ...brokenOf(added, entries) },
  };
}

/**
 * One room's furniture as stamps: `outline` is its floor (map pixels, walls drawn on it), `doors`
 * its doorways (kept clear). Ids are `idBase` and a number.
 */
export function roomFurniture(
  doc: MapDoc,
  spec: BuildingSpec,
  room: { type: string; seed: number },
  outline: readonly number[],
  doors: readonly { x: number; y: number }[],
  idBase: string,
): Stamp[] {
  if (spec.dressing === 'bare') return [];
  const own = spec.furnish?.[room.type];
  if (!own?.length) return [];
  const rules = [
    ...own,
    ...(spec.dressing === 'cluttered' ? (spec.furnish?.[CLUTTER] ?? []) : []),
    ...(spec.condition === 'ruined' ? (spec.furnish?.[RUIN] ?? []) : []),
  ];
  const target: DressTarget = {
    // Furniture stands up to the wall's inner face, as in a room furnished by hand.
    line: insetPolygon(outline, spec.wall * 0.6) ?? outline,
    mode: 'area',
    seed: room.seed,
    obstacles: { lines: [], polygons: [] },
    allowed: () => true,
    clearance: 0,
    cell: doc.grid.size,
    reach: (rule, piece) => pieceBox(doc, rule, piece).w / 2,
    box: (rule, piece) => pieceBox(doc, rule, piece),
    doors,
  };
  const wear = WEAR[spec.condition];
  const rand = seeded(room.seed + 104729);
  return dressPieces(rules, target).flatMap((inst, n) => {
    const stamp = instanceStamp(doc, rules, inst, `${idBase}${String(n)}`);
    if (!stamp) return [];
    // Only the room's own furniture wears; clutter and rubble are already what they are.
    if (wear === 0 || inst.rule >= own.length || rand() >= wear) return [stamp];
    const broken = spec.broken?.[stamp.stamp];
    return [ageStampTo(doc, stamp, broken ? (parsePackRef(broken)?.path ?? null) : null, rand)];
  });
}
