import type { AnsweredChoice } from '@boh/rules';

/**
 * The 2024 background ability increase as three "+1" picks, mapped onto the rules' two bundles
 * ("+2/+1" or "+1/+1/+1"): picking an ability twice means the +2/+1 bundle.
 */

interface Bundle {
  /** Branch id ("0"). */
  branch: string;
  /** The ability choice inside it. */
  id: string;
  options: readonly string[];
}

export function bundles(choice: AnsweredChoice): [Bundle | undefined, Bundle | undefined] {
  if (choice.kind !== 'alternative' || !choice.branches) return [undefined, undefined];
  const find = (amounts: string) => {
    const branch = choice.branches?.find(
      (b) =>
        b.choices.length === 1 &&
        b.choices[0]?.kind === 'ability' &&
        b.choices[0].amounts?.join() === amounts,
    );
    const inner = branch?.choices[0];
    return branch && inner
      ? { branch: branch.id, id: inner.id, options: inner.options ?? [] }
      : undefined;
  };
  return [find('2,1'), find('1,1,1')];
}

/** Whether a choice is the background's "+2/+1 or +1/+1/+1" pick. */
export function isAbilityIncrease(choice: AnsweredChoice): boolean {
  const [a, b] = bundles(choice);
  return a !== undefined && b !== undefined;
}

/** The three picks a character's decisions stand for (empty strings where nothing is picked). */
export function slotsFrom(
  choice: AnsweredChoice,
  choices: Readonly<Record<string, string[]>>,
): string[] {
  const [twoOne, three] = bundles(choice);
  const picked = choices[choice.id]?.[0];
  if (twoOne && picked === twoOne.branch) {
    const [a = '', b = ''] = choices[twoOne.id] ?? [];
    return [a, a, b];
  }
  if (three && picked === three.branch) {
    const [a = '', b = '', c = ''] = choices[three.id] ?? [];
    return [a, b, c];
  }
  return ['', '', ''];
}

/**
 * Decisions for three picks: the bundle and its abilities once all three are picked and allowed
 * (no ability three times), nothing for this choice otherwise.
 */
export function choicesFor(
  choice: AnsweredChoice,
  choices: Readonly<Record<string, string[]>>,
  slots: readonly string[],
): Record<string, string[]> {
  const [twoOne, three] = bundles(choice);
  const next = { ...choices };
  for (const id of Object.keys(next))
    if (id === choice.id || id.startsWith(`${choice.id}/`)) Reflect.deleteProperty(next, id);
  const filled = slots.filter(Boolean);
  if (filled.length !== 3 || !twoOne || !three) return next;
  const counts = new Map<string, number>();
  for (const s of filled) counts.set(s, (counts.get(s) ?? 0) + 1);
  const doubled = [...counts].find(([, n]) => n === 2)?.[0];
  if (doubled) {
    next[choice.id] = [twoOne.branch];
    next[twoOne.id] = [doubled, filled.find((s) => s !== doubled) ?? ''];
  } else if (counts.size === 3) {
    next[choice.id] = [three.branch];
    next[three.id] = [...filled];
  }
  return next;
}
