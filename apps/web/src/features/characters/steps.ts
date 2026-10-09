import type { AnsweredChoice, CharacterDecisions, HeldGrant } from '@boh/rules';

/**
 * The builder's steps, in the order a player goes through them, and which step each choice
 * belongs to. A choice made inside a feat or an optional feature belongs where that feat came
 * from: Skilled's picks sit with the background that gave it.
 */

export const STEPS = [
  { id: 'home', label: 'Home' },
  { id: 'class', label: 'Class' },
  { id: 'background', label: 'Background' },
  { id: 'species', label: 'Species' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'sheet', label: 'Sheet' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export const isStep = (v: unknown): v is StepId => STEPS.some((s) => s.id === v);

/** The entity a choice ultimately comes from: a class, species, background or `character`. */
export function rootOf(from: string, grants: readonly HeldGrant[]): string {
  let current = from;
  for (let guard = 0; guard < 20; guard++) {
    if (/^(class|subclass|race|subrace|background):/.test(current) || current === 'character')
      return current;
    const parent = grants.find(
      (g) => (g.kind === 'feat' || g.kind === 'optionalfeature') && g.key === current,
    );
    if (!parent) return current;
    current = parent.from;
  }
  return current;
}

export function stepOf(choice: AnsweredChoice, grants: readonly HeldGrant[]): StepId {
  if (choice.id.includes('/equipment')) return 'equipment';
  if (choice.kind === 'ability' && rootOf(choice.from, grants).startsWith('background:'))
    return 'background';
  const root = rootOf(choice.from, grants);
  if (root.startsWith('race:') || root.startsWith('subrace:')) return 'species';
  if (root.startsWith('background:') || root === 'character') return 'background';
  return 'class';
}

/** Choices grouped by step, in the engine's order. */
export function choicesByStep(
  choices: readonly AnsweredChoice[],
  grants: readonly HeldGrant[],
): Record<StepId, AnsweredChoice[]> {
  const out = Object.fromEntries(STEPS.map((s) => [s.id, [] as AnsweredChoice[]])) as Record<
    StepId,
    AnsweredChoice[]
  >;
  for (const c of choices) out[stepOf(c, grants)].push(c);
  return out;
}

/** Drops the decisions that belong to an entity (when the player picks another). */
export function forget(
  decisions: CharacterDecisions,
  ...keys: (string | undefined)[]
): CharacterDecisions {
  const prefixes = keys.filter((k): k is string => !!k).map((k) => `${k}/`);
  const choices = Object.fromEntries(
    Object.entries(decisions.choices).filter(([id]) => !prefixes.some((p) => id.startsWith(p))),
  );
  return { ...decisions, choices };
}

/**
 * A readable name for a pick before its options are loaded: `arcana` → Arcana,
 * `subclass:lore|bard|phb@phb` → Lore, `pool:artisanTool` → Any artisan tool.
 */
export function pickName(id: string): string {
  if (id.startsWith('pool:'))
    return `Any ${id
      .slice(5)
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()}`;
  const keyed = /^[a-z]+:(.+)@[^@]+$/.exec(id);
  const name = (keyed?.[1] ?? id).split('|')[0] ?? id;
  return name.replace(/(^|[\s(-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

/**
 * The levels that roll for hit points, in the order the sheet adds them: class by class, every
 * level except the first class's first (which takes the highest roll).
 */
export function hitPointLevels(
  hitDice: readonly { faces: number; count: number }[],
  classes: readonly { name: string; levels: number }[],
): { label: string; faces: number }[] {
  return classes.flatMap((c, i) =>
    Array.from({ length: c.levels }, (_, l) => ({
      label: `${c.name} ${String(l + 1)}`,
      faces: hitDice[i]?.faces ?? 8,
    })).slice(i === 0 ? 1 : 0),
  );
}

/**
 * The class or subclass feature a choice is shown in: the one that asks for it, or, for a choice
 * inside a feat or optional feature, the feature where that was picked (an Ability Score
 * Improvement taken as a feat shows the feat's own picks under it).
 */
export function featureOf(
  choice: Pick<AnsweredChoice, 'via' | 'from'>,
  choices: readonly AnsweredChoice[],
  grants: readonly HeldGrant[],
  depth = 0,
): string | undefined {
  if (choice.via) return choice.via;
  if (depth > 10 || !/^(feat|optionalfeature):/.test(choice.from)) return undefined;
  const grant = grants.find(
    (g) => (g.kind === 'feat' || g.kind === 'optionalfeature') && g.key === choice.from,
  );
  if (!grant) return undefined;
  const parent = grant.choice ? choices.find((c) => c.id === grant.choice) : undefined;
  if (parent) return featureOf(parent, choices, grants, depth + 1);
  return /^(classfeature|subclassfeature):/.test(grant.from) ? grant.from : undefined;
}

/** The lowest spell level a spell choice offers (0 for cantrips), from its filter. */
export function spellLevelOf(choice: AnsweredChoice): number {
  if (choice.filter?.type !== 'spell') return choice.kind === 'spell' ? 10 : -1;
  const levels = /(?:^|\|)level=([\d;]+)/.exec(choice.filter.filter)?.[1];
  return levels ? Math.min(...levels.split(';').map(Number)) : 10;
}

/** Choices as a book lists them: other picks first, then spells from cantrips upward. */
export function inBookOrder(list: readonly AnsweredChoice[]): AnsweredChoice[] {
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => spellLevelOf(a.c) - spellLevelOf(b.c) || a.i - b.i)
    .map(({ c }) => c);
}
