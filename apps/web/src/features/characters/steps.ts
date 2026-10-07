import type { AnsweredChoice, CharacterDecisions, HeldGrant } from '@boh/rules';

/**
 * The builder's steps, in the order a player goes through them, and which step each choice
 * belongs to. A choice made inside a feat or an optional feature belongs where that feat came
 * from: Skilled's picks sit with the background that gave it.
 */

export const STEPS = [
  { id: 'class', label: 'Class' },
  { id: 'species', label: 'Species' },
  { id: 'background', label: 'Background' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'spells', label: 'Spells' },
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
  if (choice.kind === 'spell' || choice.kind === 'spellAbility') return 'spells';
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
