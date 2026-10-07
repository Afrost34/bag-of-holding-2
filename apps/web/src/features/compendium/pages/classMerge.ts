import type { FeatureEntry } from '@boh/data5e';

/** A feature on a class page, tagged with where it comes from. */
export interface MergedFeature {
  feature: FeatureEntry;
  from: 'class' | 'subclass';
}

/**
 * Class features where the subclass's feature goes: "Subclass Feature" (2024), or named after
 * the subclass title in 2014: "Arcane Tradition feature", "Path feature" (Primal Path).
 */
export function isSubclassPlaceholder(name: string, subclassTitle: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n.endsWith(' feature')) return false;
  const prefix = n.slice(0, -' feature'.length);
  const title = subclassTitle.trim().toLowerCase();
  return prefix === 'subclass' || prefix === title || prefix === title.split(' ').at(-1);
}

/**
 * The class's features with a subclass's features merged in at their levels. Placeholders are
 * replaced where the subclass has a feature at that level; class features come first at a level.
 */
export function mergeFeatures(
  classFeatures: readonly FeatureEntry[],
  subclassFeatures: readonly FeatureEntry[],
  subclassTitle: string,
): MergedFeature[] {
  const subclassLevels = new Set(subclassFeatures.map((f) => f.level));
  const merged: MergedFeature[] = [
    ...classFeatures
      .filter((f) => !(subclassLevels.has(f.level) && isSubclassPlaceholder(f.name, subclassTitle)))
      .map((feature) => ({ feature, from: 'class' as const })),
    ...subclassFeatures.map((feature) => ({ feature, from: 'subclass' as const })),
  ];
  // Stable sort: by level, class before subclass, original order otherwise.
  return merged
    .map((m, i) => ({ m, i }))
    .sort(
      (a, b) =>
        a.m.feature.level - b.m.feature.level ||
        Number(a.m.from === 'subclass') - Number(b.m.from === 'subclass') ||
        a.i - b.i,
    )
    .map(({ m }) => m);
}
