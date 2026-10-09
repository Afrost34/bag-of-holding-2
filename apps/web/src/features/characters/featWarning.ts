/**
 * The 2024 rules offer General feats at an Ability Score Improvement. This app lets any feat be
 * picked there, so other kinds get a note: they may have prerequisites, and the DM decides.
 */

const KIND: Record<string, string> = {
  O: 'Origin',
  FS: 'Fighting Style',
  'FS:P': 'Fighting Style',
  'FS:R': 'Fighting Style',
  EB: 'Epic Boon',
  D: 'Dragonmark',
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** True when a choice is an Ability Score Improvement (the feature's own choice id says so). */
export const isAsiChoice = (choiceId: string): boolean =>
  choiceId.toLowerCase().includes('ability score improvement');

/**
 * The warning for a feat picked at an Ability Score Improvement, or null when none is needed
 * (a General feat, or one without a category, as in 2014).
 */
export function offCategoryFeatWarning(feat: Record<string, unknown>): string | null {
  const category = typeof feat.category === 'string' ? feat.category : '';
  if (category === '' || category === 'G') return null;
  const kind = KIND[category] ?? 'non-General';
  const prerequisites =
    Array.isArray(feat.prerequisite) && feat.prerequisite.some((p) => isObj(p))
      ? ' It has prerequisites that this app does not check (see the feat).'
      : '';
  return `This is ${/^[AEIOU]/.test(kind) ? 'an' : 'a'} ${kind} feat, and the rules offer only General feats here.${prerequisites} Take it only if your DM allows it.`;
}
