import type { AnsweredChoice } from '@boh/rules';

/**
 * Ability increases as one "+1" dropdown per point, mapped onto the rules' bundles: the 2024
 * background's "+2/+1 or +1/+1/+1" (three dropdowns) and the Ability Score Improvement's "+2 or
 * +1/+1" (two dropdowns). Picking an ability twice means the bundle with the +2.
 */

interface Bundle {
  /** Branch id ("0", "plus2"). */
  branch: string;
  /** The ability choice inside it. */
  id: string;
  options: readonly string[];
}

export interface Increase {
  /** The bundle with a +2 (+2/+1, or +2 alone). */
  double: Bundle;
  /** The bundle of +1s, one per dropdown. */
  singles: Bundle;
  /** How many dropdowns: the number of +1s. */
  slots: number;
  /** Other ways to spend it (the 2014 ASI's feat): branch id and label. */
  others: { id: string; label: string }[];
}

const amountsOf = (branch: NonNullable<AnsweredChoice['branches']>[number]) => {
  const inner = branch.choices.length === 1 ? branch.choices[0] : undefined;
  return inner?.kind === 'ability' ? (inner.amounts ?? []) : undefined;
};

export function increaseOf(choice: AnsweredChoice): Increase | undefined {
  if (choice.kind !== 'alternative' || !choice.branches) return undefined;
  const bundle = (b: NonNullable<AnsweredChoice['branches']>[number]): Bundle | undefined => {
    const inner = b.choices[0];
    return inner ? { branch: b.id, id: inner.id, options: inner.options ?? [] } : undefined;
  };
  const singlesBranch = choice.branches.find((b) => {
    const a = amountsOf(b);
    return a !== undefined && a.length >= 2 && a.every((n) => n === 1);
  });
  const slots = singlesBranch ? (amountsOf(singlesBranch)?.length ?? 0) : 0;
  const doubleBranch = choice.branches.find((b) => {
    const a = amountsOf(b);
    return (
      a?.length === slots - 1 &&
      a.filter((n) => n === 2).length === 1 &&
      a.filter((n) => n === 1).length === slots - 2
    );
  });
  const singles = singlesBranch && bundle(singlesBranch);
  const double = doubleBranch && bundle(doubleBranch);
  if (!singles || !double) return undefined;
  const others = choice.branches
    .filter((b) => b !== singlesBranch && b !== doubleBranch)
    .map((b) => ({ id: b.id, label: b.label }));
  return { double, singles, slots, others };
}

/** Whether a choice is an increase shown as "+1" dropdowns. */
export function isAbilityIncrease(choice: AnsweredChoice): boolean {
  return increaseOf(choice) !== undefined;
}

/**
 * A list without the ability choices inside increases (the increase's dropdowns stand for them),
 * looking for the increases in `all`.
 */
export function withoutIncreaseParts(
  list: readonly AnsweredChoice[],
  all: readonly AnsweredChoice[] = list,
): AnsweredChoice[] {
  const inner = new Set(
    all.flatMap((c) => {
      const inc = increaseOf(c);
      return inc ? [inc.double.id, inc.singles.id] : [];
    }),
  );
  return list.filter((c) => !inner.has(c.id));
}

/** The picks a character's decisions stand for (empty strings where nothing is picked). */
export function slotsFrom(
  choice: AnsweredChoice,
  choices: Readonly<Record<string, string[]>>,
): string[] {
  const inc = increaseOf(choice);
  if (!inc) return [];
  const empty = Array.from({ length: inc.slots }, () => '');
  const picked = choices[choice.id]?.[0];
  if (picked === inc.double.branch) {
    const [a = '', ...rest] = choices[inc.double.id] ?? [];
    return [a, a, ...rest, ...empty].slice(0, inc.slots);
  }
  if (picked === inc.singles.branch)
    return [...(choices[inc.singles.id] ?? []), ...empty].slice(0, inc.slots);
  return empty;
}

/** Decisions without this choice or anything inside it. */
function cleared(
  choice: AnsweredChoice,
  choices: Readonly<Record<string, string[]>>,
): Record<string, string[]> {
  const inner = new Set((choice.branches ?? []).flatMap((b) => b.choices.map((c) => c.id)));
  const next = { ...choices };
  for (const id of Object.keys(next))
    if (id === choice.id || id.startsWith(`${choice.id}/`) || inner.has(id))
      Reflect.deleteProperty(next, id);
  return next;
}

/**
 * Decisions for the dropdowns: the bundle and its abilities once every dropdown is picked and the
 * picks are allowed (no ability more than twice, at most one twice), nothing for this choice
 * otherwise.
 */
export function choicesFor(
  choice: AnsweredChoice,
  choices: Readonly<Record<string, string[]>>,
  slots: readonly string[],
): Record<string, string[]> {
  const inc = increaseOf(choice);
  const next = cleared(choice, choices);
  const filled = slots.filter(Boolean);
  if (filled.length !== inc?.slots) return next;
  const counts = new Map<string, number>();
  for (const s of filled) counts.set(s, (counts.get(s) ?? 0) + 1);
  const doubled = [...counts].filter(([, n]) => n === 2).map(([a]) => a);
  if (doubled.length === 1 && counts.size === inc.slots - 1) {
    const [twice = ''] = doubled;
    next[choice.id] = [inc.double.branch];
    next[inc.double.id] = [twice, ...[...counts.keys()].filter((s) => s !== twice)];
  } else if (counts.size === inc.slots) {
    next[choice.id] = [inc.singles.branch];
    next[inc.singles.id] = [...filled];
  }
  return next;
}

/** Decisions for one of the other branches (a feat instead of the increase). */
export function otherFor(
  choice: AnsweredChoice,
  choices: Readonly<Record<string, string[]>>,
  branch: string,
): Record<string, string[]> {
  return { ...cleared(choice, choices), [choice.id]: [branch] };
}
