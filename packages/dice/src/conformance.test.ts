/**
 * Every dice expression in the pinned 5etools data must parse and roll.
 * Skipped without local data (`pnpm data:fetch`).
 */
import { hasLocalData, listLocalDataFiles, readLocalJson } from '@boh/data5e/testing/local';
import { describe, expect, it } from 'vitest';
import { evaluate, parseAlternatives, requiredInputs, sequenceRng } from './index';

/** Tag name → how to turn its first argument(s) into dice expressions. */
const DICE_TAGS: Record<string, (args: string[]) => string[]> = {
  dice: (a) => [a[0] ?? ''],
  damage: (a) => [a[0] ?? ''],
  autodice: (a) => [a[0] ?? ''],
  hit: (a) => [`1d20 + ${a[0] ?? '0'}`.replace('+ +', '+ ').replace('+ -', '- ')],
  d20: (a) => [`1d20 + ${a[0] ?? '0'}`.replace('+ +', '+ ').replace('+ -', '- ')],
  scaledice: (a) => [a[0] ?? '', a[2] ?? ''],
  scaledamage: (a) => [a[0] ?? '', a[2] ?? ''],
};

function collect(): { expression: string; file: string }[] {
  const out: { expression: string; file: string }[] = [];
  const re = /\{@(\w+) ([^{}]*)\}/g;
  const visit = (v: unknown, file: string): void => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(re)) {
        const handler = DICE_TAGS[m[1] ?? ''];
        if (!handler) continue;
        for (const expression of handler((m[2] ?? '').split('|').map((s) => s.trim()))) {
          out.push({ expression, file });
        }
      }
    } else if (Array.isArray(v)) {
      v.forEach((x) => {
        visit(x, file);
      });
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach((x) => {
        visit(x, file);
      });
    }
  };
  for (const file of listLocalDataFiles()) {
    if (/foundry|makebrew|converter|renderdemo|changelog/.test(file)) continue;
    visit(readLocalJson(file), file);
  }
  return out;
}

describe.runIf(hasLocalData())('dice conformance', () => {
  it('parses and rolls every dice expression in the data', () => {
    const found = collect();
    const failures: string[] = [];
    for (const { expression, file } of found) {
      // Unresolved template placeholders only exist inside raw `_copy` mods.
      if (expression.includes('<$')) continue;
      try {
        for (const expr of parseAlternatives(expression)) {
          const needs = requiredInputs(expr);
          const result = evaluate(expr, {
            rng: sequenceRng([1]),
            variables: Object.fromEntries(needs.variables.map((v) => [v, 3])),
            prompts: Object.fromEntries(needs.prompts.map((p) => [p.title, 1])),
          });
          expect(Number.isFinite(result.total)).toBe(true);
        }
      } catch (error) {
        failures.push(
          `${file}: "${expression}" — ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    expect(found.length).toBeGreaterThan(30_000);
    expect(failures).toEqual([]);
  });
});
