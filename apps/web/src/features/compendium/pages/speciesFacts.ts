import { ABILITY_NAME } from '@boh/data5e/format';

/** Species facts as text: 5etools stores ability increases as data, not prose. */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const name = (code: string) =>
  (ABILITY_NAME as Partial<Record<string, string>>)[code] ?? code.toUpperCase();
const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));

function choiceText(choose: Obj): string {
  const from = Array.isArray(choose.from) ? choose.from.map((c) => name(String(c))) : [];
  const pool = from.length === 6 ? 'any ability' : from.join(', ');
  if (isObj(choose.weighted)) {
    const weighted = choose.weighted;
    const weights = Array.isArray(weighted.weights) ? weighted.weights.map(Number) : [];
    const wFrom = Array.isArray(weighted.from) ? weighted.from.map((c) => name(String(c))) : [];
    const wPool = wFrom.length === 6 ? 'different abilities' : wFrom.join(', ');
    return `${weights.map(signed).join(' and ')} to ${wPool}`;
  }
  const count = typeof choose.count === 'number' ? choose.count : 1;
  const amount = typeof choose.amount === 'number' ? choose.amount : 1;
  return `${signed(amount)} to ${count === 1 ? 'one' : String(count)} of ${pool}`;
}

/** `[{ dex: 2 }]` → "Dexterity +2"; several options are joined with "or". Empty for 2024. */
export function abilityText(ability: unknown): string {
  if (!Array.isArray(ability)) return '';
  return ability
    .filter(isObj)
    .map((option) =>
      Object.entries(option)
        .map(([key, value]) =>
          key === 'choose' && isObj(value)
            ? choiceText(value)
            : typeof value === 'number'
              ? `${name(key)} ${signed(value)}`
              : '',
        )
        .filter(Boolean)
        .join(', '),
    )
    .filter(Boolean)
    .join('; or ');
}
