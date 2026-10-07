import { secureRng } from '@boh/dice';
import { ABILITIES, abilityName, type Ability } from '@boh/rules';
import { Button, cn } from '@boh/ui';
import { Dices, Minus, Plus } from 'lucide-react';
import {
  pointCost,
  pointsSpent,
  POINT_BUY_BUDGET,
  rollAbility,
  STANDARD_ARRAY,
  standardArrayDefault,
  usesPool,
  type AbilityMethod,
  type CharacterFile,
} from '../../app/characters/model';
import type { CharacterView } from '../../app/data/protocol';

const METHODS: { id: AbilityMethod; label: string; hint: string }[] = [
  { id: 'standard', label: 'Standard array', hint: 'Place 15, 14, 13, 12, 10 and 8, one each.' },
  {
    id: 'pointBuy',
    label: 'Point buy',
    hint: `Spend ${String(POINT_BUY_BUDGET)} points on scores from 8 to 15.`,
  },
  {
    id: 'rolled',
    label: 'Roll',
    hint: 'Roll 4d6 six times, drop the lowest die, then place them.',
  },
  { id: 'manual', label: 'Enter scores', hint: 'Type the scores in, as your table decided.' },
];

const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));

/** Ability scores: the method, the base scores, and what increases them. */
export function AbilitiesStep({
  character,
  view,
  save,
}: {
  character: CharacterFile;
  view: CharacterView | null;
  save: (next: CharacterFile) => void;
}) {
  const scores = character.decisions.baseScores;
  const method = character.abilityMethod;
  const setScores = (next: Record<Ability, number>) => {
    save({ ...character, decisions: { ...character.decisions, baseScores: next } });
  };
  const setScore = (a: Ability, v: number) => {
    setScores({ ...scores, [a]: v });
  };
  const pool: readonly number[] =
    method === 'standard' ? STANDARD_ARRAY : method === 'rolled' ? (character.rolls ?? []) : [];
  const poolOk = pool.length === 6 && usesPool(scores, pool);
  const spent = pointsSpent(scores);

  return (
    <div className="space-y-5">
      <fieldset className="rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 font-serif font-bold">Method</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {METHODS.map((m) => (
            <label
              key={m.id}
              className={cn(
                'flex cursor-pointer gap-2 rounded-md border px-3 py-2',
                method === m.id ? 'border-accent bg-accent-soft' : 'border-border',
              )}
            >
              <input
                type="radio"
                name="ability-method"
                checked={method === m.id}
                onChange={() => {
                  const base =
                    m.id === 'pointBuy'
                      ? { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
                      : m.id === 'standard'
                        ? standardArrayDefault()
                        : scores;
                  save({
                    ...character,
                    abilityMethod: m.id,
                    decisions: { ...character.decisions, baseScores: base },
                  });
                }}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{m.label}</span>
                <span className="block text-sm text-muted">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {method === 'rolled' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              const rolls = Array.from({ length: 6 }, () => rollAbility(() => secureRng(6)));
              const sorted = [...rolls].sort((a, b) => b - a);
              const placed = Object.fromEntries(
                ABILITIES.map((a, i) => [a, sorted[i] ?? 10]),
              ) as Record<Ability, number>;
              save({
                ...character,
                rolls,
                decisions: { ...character.decisions, baseScores: placed },
              });
            }}
          >
            <Dices className="h-4 w-4" aria-hidden />{' '}
            {character.rolls ? 'Roll again' : 'Roll scores'}
          </Button>
          {character.rolls && (
            <p className="text-sm">
              Rolled: <span className="font-semibold">{character.rolls.join(', ')}</span>
            </p>
          )}
        </div>
      )}
      {method === 'pointBuy' && (
        <p
          className={cn('text-sm', spent > POINT_BUY_BUDGET && 'font-semibold text-accent')}
          role="status"
        >
          {POINT_BUY_BUDGET - spent} of {POINT_BUY_BUDGET} points left
        </p>
      )}
      {pool.length === 6 && !poolOk && (
        <p className="text-sm font-semibold text-accent" role="status">
          Use each of {pool.join(', ')} once.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted uppercase">
              <th className="px-3 py-2 font-semibold">Ability</th>
              <th className="px-3 py-2 font-semibold">Base</th>
              <th className="px-3 py-2 font-semibold">Bonuses</th>
              <th className="px-3 py-2 font-semibold">Score</th>
              <th className="px-3 py-2 font-semibold">Modifier</th>
            </tr>
          </thead>
          <tbody>
            {ABILITIES.map((a) => {
              const line = view?.sheet.abilities[a];
              const bonuses = line?.score.parts.filter((p) => p.label !== 'Base') ?? [];
              return (
                <tr key={a} className="border-b border-border last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {abilityName(a)}
                  </th>
                  <td className="px-3 py-2">
                    <BaseInput
                      ability={a}
                      method={method}
                      value={scores[a]}
                      pool={pool}
                      onChange={(v) => {
                        setScore(a, v);
                      }}
                      canRaise={
                        method !== 'pointBuy' ||
                        (pointCost(scores[a] + 1) ?? 99) - (pointCost(scores[a]) ?? 0) <=
                          POINT_BUY_BUDGET - spent
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {bonuses.length
                      ? bonuses.map((p) => `${signed(p.value)} ${p.label}`).join(', ')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-base font-bold">
                    {line?.score.value ?? scores[a]}
                  </td>
                  <td className="px-3 py-2">{line ? signed(line.modifier) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BaseInput({
  ability,
  method,
  value,
  pool,
  onChange,
  canRaise,
}: {
  ability: Ability;
  method: AbilityMethod;
  value: number;
  pool: readonly number[];
  onChange: (v: number) => void;
  canRaise: boolean;
}) {
  const label = `${abilityName(ability)} base score`;
  if (method === 'pointBuy')
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          aria-label={`Lower ${abilityName(ability)}`}
          disabled={value <= 8}
          onClick={() => {
            onChange(value - 1);
          }}
          className="rounded border border-border p-1 disabled:opacity-40"
        >
          <Minus className="h-3 w-3" aria-hidden />
        </button>
        <span className="w-5 text-center font-medium" aria-label={label}>
          {value}
        </span>
        <button
          type="button"
          aria-label={`Raise ${abilityName(ability)}`}
          disabled={value >= 15 || !canRaise}
          onClick={() => {
            onChange(value + 1);
          }}
          className="rounded border border-border p-1 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" aria-hidden />
        </button>
      </span>
    );
  if (method === 'manual' || pool.length !== 6)
    return (
      <input
        type="number"
        min={1}
        max={30}
        aria-label={label}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(1, Math.min(30, Math.round(n))));
        }}
        className="w-16 rounded-md border border-border bg-surface px-2 py-1"
      />
    );
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        onChange(Number(e.target.value));
      }}
      className="rounded-md border border-border bg-surface px-2 py-1"
    >
      {[...new Set([...pool, value])]
        .sort((a, b) => b - a)
        .map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
    </select>
  );
}
