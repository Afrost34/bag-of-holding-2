import type { AnsweredChoice } from '@boh/rules';
import { spellLevelOf } from './steps';

/**
 * Where spells the character has anyway (a feat, the species, a domain) are shown on the
 * class's Spells tab: cantrips in the cantrip list, other spells in the first list of levelled
 * spells (prepared or known). A spell with no such list goes with the "other spells".
 */
export function placeGranted<S extends { key: string }>(
  spells: readonly S[],
  lists: readonly AnsweredChoice[],
  levelOf: (key: string) => number,
): { grantedIn: Map<string, S[]>; unplaced: S[] } {
  const cantrips = lists.find((c) => spellLevelOf(c) === 0);
  const levelled = lists.find((c) => spellLevelOf(c) >= 1);
  const grantedIn = new Map<string, S[]>();
  const unplaced: S[] = [];
  const seen = new Set<string>();
  for (const s of spells) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    const list = levelOf(s.key) === 0 ? cantrips : levelled;
    if (list) grantedIn.set(list.id, [...(grantedIn.get(list.id) ?? []), s]);
    else unplaced.push(s);
  }
  return { grantedIn, unplaced };
}
