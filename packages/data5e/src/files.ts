/**
 * Which files of the 5etools repo we download and how we treat them. Paths are repo-relative
 * (`data/spells/spells-xphb.json`).
 */

/** Files that are tooling for the 5etools site itself, not content. */
const EXCLUDED: readonly RegExp[] = [
  /(^|\/)foundry(-[^/]*)?\.json$/, // Foundry VTT import data (but see FOUNDRY_CLASS_FILE)
  /^data\/makebrew-/, // homebrew-builder helpers
  /^data\/makecards\.json$/,
  /^data\/converter\.json$/,
  /^data\/renderdemo\.json$/,
  /^data\/changelog\.json$/,
  /^data\/msbcr\.json$/,
  /^data\/monsterfeatures\.json$/,
  /(^|\/)index\.json$/, // per-folder source → file maps; we read the git tree instead
  /(^|\/)fluff-index\.json$/,
  /^data\/spells\/sources\.json$/,
];

/**
 * Foundry VTT data for classes, kept as lookup data for the rules engine: its `entryData` holds
 * structured choices for class features that 5etools only describes in text (Expertise, Deft
 * Explorer…). extract.ts trims it to those.
 */
export const FOUNDRY_CLASS_FILE = 'data/class/foundry.json';

export function isDataFile(path: string): boolean {
  if (path === FOUNDRY_CLASS_FILE) return true;
  return path.startsWith('data/') && path.endsWith('.json') && !EXCLUDED.some((r) => r.test(path));
}

/** Generated files that contribute entities; every other generated file is lookup data only. */
const GENERATED_ENTITY_FILES = new Set(['data/generated/gendata-tables.json']);

/**
 * Whether a file's arrays become entities. Files under `data/generated/` are derived from the
 * rest of the data (navigation indexes, lookups) and would duplicate it, so they are kept as aux
 * data unless listed above.
 */
export function yieldsEntities(path: string): boolean {
  if (path === FOUNDRY_CLASS_FILE) return false;
  return !path.startsWith('data/generated/') || GENERATED_ENTITY_FILES.has(path);
}

/**
 * Book and adventure text files (`data/book/book-xphb.json`) hold a `data` array of sections.
 * Returns the content kind and id, or null for any other file.
 */
export function contentFile(path: string): { kind: 'book' | 'adventure'; id: string } | null {
  const match = /^data\/(book|adventure)\/\1-(.+)\.json$/.exec(path);
  if (!match?.[1] || !match[2]) return null;
  return { kind: match[1] as 'book' | 'adventure', id: match[2] };
}
