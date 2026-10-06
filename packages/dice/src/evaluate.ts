import type { Expression, KeepMode, Node, Prompt } from './ast';
import { secureRng, type Rng } from './random';

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface DieResult {
  value: number;
  /** False for dice dropped by advantage/disadvantage or keep/drop notation. */
  kept: boolean;
}

export interface DiceTerm {
  count: number;
  faces: number;
  keep?: { mode: KeepMode; count: number };
  dice: DieResult[];
  total: number;
}

export interface RollResult {
  expression: string;
  mode: RollMode;
  total: number;
  /** Every dice group rolled, in the order they appear. */
  terms: DiceTerm[];
  /** Values substituted for variables and prompts. */
  inputs: Record<string, number>;
  /** e.g. `1d20 + 5 → [14] + 5 = 19` */
  breakdown: string;
}

export interface EvaluateOptions {
  rng?: Rng;
  mode?: RollMode;
  /** Values for named variables such as `PB` or `summonSpellLevel` (case-insensitive). */
  variables?: Readonly<Record<string, number>>;
  /** Answers for `#$prompt_number...$#` placeholders, keyed by prompt title. */
  prompts?: Readonly<Record<string, number>>;
}

/** Thrown when an expression needs a value nobody provided; the UI should ask for it. */
export class MissingInputError extends Error {
  constructor(
    readonly input: { kind: 'variable'; name: string } | { kind: 'prompt'; prompt: Prompt },
  ) {
    super(
      input.kind === 'variable'
        ? `Needs a value for ${input.name}`
        : `Needs a value: ${input.prompt.title}`,
    );
    this.name = 'MissingInputError';
  }
}

export const MAX_DICE = 1000;
export const MAX_FACES = 10_000;

/** Lists the variables and prompts an expression needs, so the UI can ask before rolling. */
export function requiredInputs(expr: Expression): { variables: string[]; prompts: Prompt[] } {
  const variables = new Set<string>();
  const prompts: Prompt[] = [];
  const visit = (n: Node): void => {
    switch (n.kind) {
      case 'variable':
        variables.add(n.name);
        return;
      case 'prompt':
        if (!prompts.some((p) => p.title === n.prompt.title)) prompts.push(n.prompt);
        return;
      case 'dice':
        visit(n.count);
        visit(n.faces);
        return;
      case 'binary':
        visit(n.left);
        visit(n.right);
        return;
      case 'negate':
        visit(n.operand);
        return;
      case 'call':
        visit(n.arg);
        return;
      case 'number':
        return;
    }
  };
  visit(expr.root);
  return { variables: [...variables], prompts };
}

/** True when the expression contains a single d20 that advantage/disadvantage can apply to. */
export function hasD20(expr: Expression): boolean {
  let found = false;
  const visit = (n: Node): void => {
    if (n.kind === 'dice') {
      if (
        n.count.kind === 'number' &&
        n.count.value === 1 &&
        n.faces.kind === 'number' &&
        n.faces.value === 20 &&
        !n.keep
      ) {
        found = true;
      }
      return;
    }
    if (n.kind === 'binary') {
      visit(n.left);
      visit(n.right);
    } else if (n.kind === 'negate') visit(n.operand);
    else if (n.kind === 'call') visit(n.arg);
  };
  visit(expr.root);
  return found;
}

function keepIndices(values: number[], keep: { mode: KeepMode; count: number }): Set<number> {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
  const n = Math.min(keep.count, values.length);
  let chosen: { v: number; i: number }[];
  switch (keep.mode) {
    case 'kh':
      chosen = order.slice(values.length - n);
      break;
    case 'kl':
      chosen = order.slice(0, n);
      break;
    case 'dh':
      chosen = order.slice(0, values.length - n);
      break;
    case 'dl':
      chosen = order.slice(n);
      break;
  }
  return new Set(chosen.map((c) => c.i));
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Rolls an expression. Never mutates it; the same Expression can be rolled many times. */
export function evaluate(expr: Expression, options: EvaluateOptions = {}): RollResult {
  const rng = options.rng ?? secureRng;
  const mode = options.mode ?? 'normal';
  const variables = new Map(
    Object.entries(options.variables ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const terms: DiceTerm[] = [];
  const inputs: Record<string, number> = {};
  let advantageApplied = mode === 'normal';

  const evalNode = (n: Node): { value: number; text: string } => {
    switch (n.kind) {
      case 'number':
        return { value: n.value, text: formatNumber(n.value) };
      case 'variable': {
        const value = variables.get(n.name.toLowerCase());
        if (value === undefined) throw new MissingInputError({ kind: 'variable', name: n.name });
        inputs[n.name] = value;
        return { value, text: formatNumber(value) };
      }
      case 'prompt': {
        const value = options.prompts?.[n.prompt.title] ?? n.prompt.default;
        if (value === undefined) throw new MissingInputError({ kind: 'prompt', prompt: n.prompt });
        inputs[n.prompt.title] = value;
        return { value, text: formatNumber(value) };
      }
      case 'negate': {
        const inner = evalNode(n.operand);
        return { value: -inner.value, text: `-${inner.text}` };
      }
      case 'call': {
        const inner = evalNode(n.arg);
        const value = Math[n.fn](inner.value);
        return { value, text: formatNumber(value) };
      }
      case 'binary': {
        const left = evalNode(n.left);
        const right = evalNode(n.right);
        const value =
          n.op === '+'
            ? left.value + right.value
            : n.op === '-'
              ? left.value - right.value
              : n.op === '*'
                ? left.value * right.value
                : left.value / right.value;
        const sym = n.op === '*' ? '×' : n.op;
        return { value, text: `${left.text} ${sym} ${right.text}` };
      }
      case 'dice': {
        let count = Math.floor(evalNode(n.count).value);
        const faces = Math.floor(evalNode(n.faces).value);
        if (count < 0) count = 0;
        if (count > MAX_DICE) throw new RangeError(`Too many dice (${String(count)})`);
        if (faces < 1 || faces > MAX_FACES) throw new RangeError(`Invalid die: d${String(faces)}`);
        let keep = n.keep;
        if (!advantageApplied && count === 1 && faces === 20 && !keep) {
          count = 2;
          keep = { mode: mode === 'advantage' ? 'kh' : 'kl', count: 1 };
          advantageApplied = true;
        }
        const values = Array.from({ length: count }, () => rng(faces));
        const kept = keep ? keepIndices(values, keep) : null;
        const dice = values.map((value, i) => ({ value, kept: kept ? kept.has(i) : true }));
        const total = dice.reduce((sum, d) => sum + (d.kept ? d.value : 0), 0);
        terms.push({ count, faces, ...(keep ? { keep } : {}), dice, total });
        const shown = dice.map((d) => (d.kept ? String(d.value) : `~~${String(d.value)}~~`));
        return { value: total, text: `[${shown.join(', ')}]` };
      }
    }
  };

  const result = evalNode(expr.root);
  const total = Math.round(result.value * 100) / 100;
  return {
    expression: expr.source,
    mode,
    total,
    terms,
    inputs,
    breakdown: `${expr.source} → ${result.text} = ${formatNumber(total)}`,
  };
}

/** Expected value, ignoring keep/drop (used for "average" labels like `13 (2d8 + 4)`). */
export function average(
  expr: Expression,
  options: Pick<EvaluateOptions, 'variables' | 'prompts'> = {},
): number {
  const variables = new Map(
    Object.entries(options.variables ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const avg = (n: Node): number => {
    switch (n.kind) {
      case 'number':
        return n.value;
      case 'variable': {
        const v = variables.get(n.name.toLowerCase());
        if (v === undefined) throw new MissingInputError({ kind: 'variable', name: n.name });
        return v;
      }
      case 'prompt': {
        const v = options.prompts?.[n.prompt.title] ?? n.prompt.default;
        if (v === undefined) throw new MissingInputError({ kind: 'prompt', prompt: n.prompt });
        return v;
      }
      case 'negate':
        return -avg(n.operand);
      case 'call':
        return Math[n.fn](avg(n.arg));
      case 'binary': {
        const l = avg(n.left);
        const r = avg(n.right);
        return n.op === '+' ? l + r : n.op === '-' ? l - r : n.op === '*' ? l * r : l / r;
      }
      case 'dice':
        return avg(n.count) * ((avg(n.faces) + 1) / 2);
    }
  };
  return avg(expr.root);
}
