import {
  evaluate,
  hasD20,
  parseAlternatives,
  requiredInputs,
  type DiceTerm,
  type Prompt,
  type RollMode,
  type Rng,
} from '@boh/dice';
import type { RollKind, RollSpec } from '@boh/renderer';

/**
 * Turns a roll request from the UI (a clicked chip, the dice tray) into results. Pure apart from
 * the random source, so it is unit tested directly.
 */

export interface RollEntry {
  id: string;
  at: number;
  kind: RollKind;
  label?: string;
  expression: string;
  mode: RollMode;
  total: number;
  breakdown: string;
  terms: DiceTerm[];
  outcome?: 'success' | 'failure';
  /** Extra results when the expression had `;` alternatives (`d6;d8`). */
  alternatives?: { expression: string; total: number; breakdown: string }[];
}

export interface InputNeeds {
  variables: string[];
  prompts: Prompt[];
  /** Slot level to scale a spell's dice to. */
  scale?: { minLevel: number; maxLevel: number };
}

export interface RollInputs {
  variables?: Record<string, number>;
  prompts?: Record<string, number>;
  level?: number;
}

/** Expression for a spell cast at `level`: the base plus one step per level above the minimum. */
export function scaledExpression(scale: NonNullable<RollSpec['scale']>, level: number): string {
  const extra = Math.max(0, level - scale.minLevel);
  if (extra === 0) return scale.base;
  const step = /^\s*(\d*)d(\d+)\s*$/.exec(scale.step);
  const added = step
    ? `${String((Number(step[1]) || 1) * extra)}d${step[2] ?? '6'}`
    : Array.from({ length: extra }, () => `(${scale.step})`).join(' + ');
  return `${scale.base} + ${added}`;
}

/** What the user must answer before this can be rolled (nothing → roll straight away). */
export function needsFor(spec: RollSpec, inputs: RollInputs = {}): InputNeeds | null {
  if (spec.scale && inputs.level === undefined && spec.scale.maxLevel > spec.scale.minLevel) {
    return {
      variables: [],
      prompts: [],
      scale: { minLevel: spec.scale.minLevel, maxLevel: spec.scale.maxLevel },
    };
  }
  const expression = spec.scale
    ? scaledExpression(spec.scale, inputs.level ?? spec.scale.minLevel)
    : spec.expression;
  const variables = new Set<string>();
  const prompts: Prompt[] = [];
  for (const expr of parseAlternatives(expression)) {
    const req = requiredInputs(expr);
    req.variables
      .filter((v) => inputs.variables?.[v] === undefined)
      .forEach((v) => variables.add(v));
    for (const p of req.prompts) {
      if (
        inputs.prompts?.[p.title] === undefined &&
        p.default === undefined &&
        !prompts.some((x) => x.title === p.title)
      ) {
        prompts.push(p);
      }
    }
  }
  return variables.size > 0 || prompts.length > 0 ? { variables: [...variables], prompts } : null;
}

/** Rolls a spec. Advantage/disadvantage only applies to rolls with a single d20. */
export function rollSpec(
  spec: RollSpec,
  mode: RollMode,
  inputs: RollInputs = {},
  rng?: Rng,
  makeId: () => string = () => crypto.randomUUID(),
): RollEntry {
  const expression = spec.scale
    ? scaledExpression(spec.scale, inputs.level ?? spec.scale.minLevel)
    : spec.expression;
  const [first, ...rest] = parseAlternatives(expression);
  if (!first) throw new Error('Nothing to roll');
  const options = {
    ...(rng ? { rng } : {}),
    ...(inputs.variables ? { variables: inputs.variables } : {}),
    ...(inputs.prompts ? { prompts: inputs.prompts } : {}),
  };
  const effectiveMode = hasD20(first) ? mode : 'normal';
  const main = evaluate(first, { ...options, mode: effectiveMode });
  const success = spec.success;
  const outcome =
    success === undefined
      ? undefined
      : (success.atLeast !== undefined && main.total >= success.atLeast) ||
          (success.atMost !== undefined && main.total <= success.atMost)
        ? 'success'
        : 'failure';
  const label =
    spec.scale && inputs.level !== undefined
      ? `${spec.label ?? 'Roll'} (level ${String(inputs.level)})`
      : spec.label;
  return {
    id: makeId(),
    at: Date.now(),
    kind: spec.kind,
    ...(label ? { label } : {}),
    expression: first.source,
    mode: effectiveMode,
    total: main.total,
    breakdown: main.breakdown,
    terms: main.terms,
    ...(outcome ? { outcome } : {}),
    ...(rest.length > 0
      ? {
          alternatives: rest.map((expr) => {
            const r = evaluate(expr, options);
            return { expression: expr.source, total: r.total, breakdown: r.breakdown };
          }),
        }
      : {}),
  };
}

/** Text for coin flips and success checks shown next to the total. */
export function outcomeText(entry: RollEntry): string | null {
  if (entry.kind === 'coin') return entry.total === 1 ? 'Heads' : 'Tails';
  if (entry.kind === 'recharge') return entry.outcome === 'success' ? 'Recharged' : 'Not recharged';
  if (entry.outcome) return entry.outcome === 'success' ? 'Success' : 'Failure';
  return null;
}
