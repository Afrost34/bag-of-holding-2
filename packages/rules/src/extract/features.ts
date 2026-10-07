import {
  classFeatureRef,
  makeKey,
  subclassFeatureRef,
  type Edition,
  type RawEntity,
} from '@boh/data5e';
import {
  emptyExtraction,
  isObj,
  merge,
  num,
  refKey,
  type Choice,
  type Extraction,
  type Issues,
} from '../model';
import { readEntity } from './entity';
import { patchFor } from '../patches';

/**
 * Class and subclass features. 5etools describes their choices in text only ("you gain
 * proficiency in two skills of your choice"); the structured version comes from 5etools' Foundry
 * data (`entryData` in data/class/foundry.json), then from our own patches (patches.ts).
 */

/** The 5etools key of a Foundry record, so its `entryData` can be found by feature key. */
export function foundryRecordKey(type: 'classFeature' | 'subclassFeature', rec: RawEntity): string {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const lvl = typeof rec.level === 'number' ? rec.level : 0;
  return type === 'classFeature'
    ? makeKey(
        type,
        [s(rec.name), s(rec.className), s(rec.classSource) || 'PHB', lvl],
        s(rec.source) || 'PHB',
      )
    : makeKey(
        type,
        [
          s(rec.name),
          s(rec.className),
          s(rec.classSource) || 'PHB',
          s(rec.subclassShortName),
          s(rec.subclassSource) || 'PHB',
          lvl,
        ],
        s(rec.source) || 'PHB',
      );
}

/** Foundry `entryData` by feature key, from the aux records of data/class/foundry.json. */
export function foundryEntryData(
  classFeatures: unknown,
  subclassFeatures: unknown,
): Map<string, RawEntity> {
  const map = new Map<string, RawEntity>();
  for (const [type, list] of [
    ['classFeature', classFeatures],
    ['subclassFeature', subclassFeatures],
  ] as const) {
    if (!Array.isArray(list)) continue;
    for (const rec of list)
      if (isObj(rec) && isObj(rec.entryData)) map.set(foundryRecordKey(type, rec), rec.entryData);
  }
  return map;
}

/** Foundry fields that are not about the character's choices (resource trackers, senses). */
const FOUNDRY_IGNORED = new Set(['resources', 'senses']);

/** The option an `options` entry offers, as an id: a feature key, or the inline entry's name. */
function optionOf(entry: unknown): string | undefined {
  if (!isObj(entry)) return undefined;
  switch (entry.type) {
    case 'refClassFeature':
      return classFeatureRef(entry.classFeature)?.key;
    case 'refSubclassFeature':
      return subclassFeatureRef(entry.subclassFeature)?.key;
    case 'refOptionalfeature':
      return typeof entry.optionalfeature === 'string'
        ? refKey('optionalfeature', entry.optionalfeature)
        : undefined;
    default:
      return typeof entry.name === 'string' ? entry.name.toLowerCase() : undefined;
  }
}

/**
 * `{ "type": "options", "count": 1, "entries": [refs…] }` blocks in a feature's text: "choose
 * one of the following". Blocks listing optional features are skipped when the class already
 * asks for them through `optionalfeatureProgression` (Fighting Style, Metamagic…).
 */
function optionChoices(feature: RawEntity, key: string, skipOptionalFeatures: boolean): Choice[] {
  const found: Choice[] = [];
  const walk = (e: unknown) => {
    if (Array.isArray(e)) {
      e.forEach(walk);
      return;
    }
    if (!isObj(e)) return;
    if (e.type === 'options' && Array.isArray(e.entries)) {
      const refsOptional = e.entries.some((x) => isObj(x) && x.type === 'refOptionalfeature');
      const options = e.entries.map(optionOf).filter((o): o is string => o !== undefined);
      if (!(refsOptional && skipOptionalFeatures) && options.length > 0) {
        const count = num(e.count) ?? 1;
        found.push({
          id: `${key}/options${found.length ? `:${String(found.length)}` : ''}`,
          kind: refsOptional ? 'optionalfeature' : 'feature',
          count,
          label: count === 1 ? 'Choose an option' : `Choose ${String(count)} options`,
          options,
        });
      }
      return;
    }
    for (const v of Object.values(e)) walk(v);
  };
  walk(feature.entries);
  return found;
}

export interface FeatureContext {
  edition: Edition;
  /** Foundry `entryData` for this feature, if any. */
  entryData?: RawEntity;
  /** Lowercase names of the class's and subclass's `optionalfeatureProgression`s. */
  progressions?: ReadonlySet<string>;
}

export function readFeature(
  feature: RawEntity,
  key: string,
  { edition, entryData, progressions }: FeatureContext,
  issues: Issues,
): Extraction {
  const out = emptyExtraction();
  const name = typeof feature.name === 'string' ? feature.name.toLowerCase() : '';
  // "Eldritch Invocation Options" lists what "Eldritch Invocations" asks for: skip it too.
  const covered = [...(progressions ?? [])].some(
    (p) => name === p || name.startsWith(p.replace(/s$/, '')),
  );
  out.choices.push(...optionChoices(feature, key, covered));
  if (entryData) {
    const kept: RawEntity = {};
    for (const [k, v] of Object.entries(entryData)) if (!FOUNDRY_IGNORED.has(k)) kept[k] = v;
    merge(out, readEntity(kept, key, issues));
  }
  const patch = patchFor(feature);
  if (patch) merge(out, patch(key, edition));
  return out;
}
