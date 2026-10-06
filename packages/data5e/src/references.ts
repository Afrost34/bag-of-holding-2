import type { EntityIndex, EntitySummary } from './db/entityIndex';

export interface BrokenReference {
  key: string;
  /** Where the reference lives in the user's data, e.g. `characters/glubs.json`. */
  usedIn: string[];
  /** Likely replacements, best first (a reprint in another source, then name matches). */
  suggestions: EntitySummary[];
}

export interface ReferenceReport {
  checked: number;
  broken: BrokenReference[];
}

/**
 * Checks references from user data against the index. Nothing is changed: broken references are
 * reported with suggestions so the user (or a later fix-up action) can repoint them.
 */
export function checkReferences(
  index: EntityIndex,
  references: Iterable<{ key: string; usedIn: string }>,
): ReferenceReport {
  const usage = new Map<string, Set<string>>();
  for (const { key, usedIn } of references) {
    let set = usage.get(key);
    if (!set) {
      set = new Set();
      usage.set(key, set);
    }
    set.add(usedIn);
  }
  const broken: BrokenReference[] = [];
  for (const [key, usedIn] of usage) {
    if (index.hasKey(key)) continue;
    broken.push({ key, usedIn: [...usedIn].sort(), suggestions: index.alternatives(key) });
  }
  broken.sort((a, b) => a.key.localeCompare(b.key));
  return { checked: usage.size, broken };
}
