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
import { selectClass } from './styles';
import { StepTitle } from './ui';

const METHODS: { id: AbilityMethod; label: string; hint: string }[] = [
  { id: 'standard', label: 'Standard Array', hint: 'Place 15, 14, 13, 12, 10 and 8, one each.' },
  {
    id: 'pointBuy',
    label: 'Point Buy',
    hint: `Spend ${String(POINT_BUY_BUDGET)} points on scores from 8 to 15.`,
  },
  {
    id: 'rolled',
    label: 'Roll',
    hint: 'Roll 4d6 six times, drop the lowest die, then place them.',
  },
  { id: 'manual', label: 'Manual / Rolled', hint: 'Type the scores in, as your table decided.' },
];

const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));

/** Ability Scores as on D&D Beyond: the method, six score pickers, then how each total is made. */
export function AbilitiesStep({
  character,
  view,
  save,
}: {
  character: CharacterFile;
  view: CharacterView | null;
  save: (next: CharacterFile) => void;
}) {
  const decisions = character.decisions;
  const scores = decisions.baseScores;
  const method = character.abilityMethod;
  const setScores = (next: Record<Ability, number>) => {
    save({ ...character, decisions: { ...decisions, baseScores: next } });
  };
  const setOverride = (a: Ability, value: number | null) => {
    const overrides = { ...(decisions.overrides ?? {}) };
    if (value === null) Reflect.deleteProperty(overrides, `score.${a}`);
    else overrides[`score.${a}`] = value;
    save({ ...character, decisions: { ...decisions, overrides } });
  };
  const pool: readonly number[] =
    method === 'standard' ? STANDARD_ARRAY : method === 'rolled' ? (character.rolls ?? []) : [];
  const poolOk = pool.length === 6 && usesPool(scores, pool);
  const spent = pointsSpent(scores);

  return (
    <div className="space-y-5">
      <StepTitle>Ability Scores</StepTitle>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Ability score method"
          value={method}
          onChange={(e) => {
            const m = e.target.value as AbilityMethod;
            const base =
              m === 'pointBuy'
                ? { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
                : m === 'standard'
                  ? standardArrayDefault()
                  : scores;
            save({ ...character, abilityMethod: m, decisions: { ...decisions, baseScores: base } });
          }}
          className={`${selectClass} max-w-xs`}
        >
          {METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted">{METHODS.find((m) => m.id === method)?.hint}</p>
      </div>

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
              save({ ...character, rolls, decisions: { ...decisions, baseScores: placed } });
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
          className={cn('text-sm font-semibold', spent > POINT_BUY_BUDGET && 'text-accent')}
          role="status"
        >
          Points remaining: {POINT_BUY_BUDGET - spent} / {POINT_BUY_BUDGET}
        </p>
      )}
      {pool.length === 6 && !poolOk && (
        <p className="text-sm font-semibold text-accent" role="status">
          Use each of {pool.join(', ')} once.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ABILITIES.map((a) => (
          <div key={a}>
            <p className="mb-1 text-xs font-bold tracking-wide uppercase">{abilityName(a)}</p>
            <BaseInput
              ability={a}
              method={method}
              value={scores[a]}
              pool={pool}
              canRaise={
                (pointCost(scores[a] + 1) ?? 99) - (pointCost(scores[a]) ?? 0) <=
                POINT_BUY_BUDGET - spent
              }
              onChange={(v) => {
                setScores({ ...scores, [a]: v });
              }}
            />
            <p className="mt-1 text-center text-xs font-bold">
              Total: {view?.sheet.abilities[a].score.value ?? scores[a]}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-serif text-xl">Score Calculations</h3>
        <p className="mb-3 text-sm text-muted">
          What makes each total: the base score you set above and every bonus. An override score
          replaces the total (the rules value stays shown).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ABILITIES.map((a) => {
            const line = view?.sheet.abilities[a];
            const bonus =
              line?.score.parts
                .filter((p) => p.label !== 'Base')
                .reduce((n, p) => n + p.value, 0) ?? 0;
            const override = decisions.overrides?.[`score.${a}`];
            return (
              <section
                key={a}
                aria-label={`${abilityName(a)} calculation`}
                className="overflow-hidden rounded-md border border-border bg-surface text-sm"
              >
                <h4 className="bg-header px-3 py-1.5 font-bold text-header-fg uppercase">
                  {abilityName(a)}
                </h4>
                <dl className="divide-y divide-border">
                  <Row label="Total Score" value={String(line?.score.value ?? scores[a])} strong />
                  <Row label="Modifier" value={line ? signed(line.modifier) : ''} strong />
                  <Row label="Base Score" value={String(scores[a])} />
                  <Row
                    label="Bonus"
                    value={signed(bonus)}
                    title={line?.score.parts
                      .filter((p) => p.label !== 'Base')
                      .map((p) => `${signed(p.value)} ${p.label}`)
                      .join('\n')}
                  />
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <dt>
                      <label htmlFor={`override-${a}`}>Override Score</label>
                    </dt>
                    <dd>
                      <input
                        id={`override-${a}`}
                        type="number"
                        min={1}
                        max={30}
                        placeholder="--"
                        value={override ?? ''}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setOverride(
                            a,
                            e.target.value === '' || !Number.isFinite(n)
                              ? null
                              : Math.max(1, Math.min(30, Math.round(n))),
                          );
                        }}
                        className="w-16 rounded border border-border bg-surface px-2 py-0.5 text-right"
                      />
                    </dd>
                  </div>
                </dl>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  title,
}: {
  label: string;
  value: string;
  strong?: boolean;
  title?: string | undefined;
}) {
  return (
    <div
      className={cn('flex justify-between px-3 py-1.5', strong && 'bg-accent-soft font-bold')}
      title={title}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
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
      <span className="flex items-center justify-between gap-1 rounded-md border border-border px-1 py-1">
        <button
          type="button"
          aria-label={`Lower ${abilityName(ability)}`}
          disabled={value <= 8}
          onClick={() => {
            onChange(value - 1);
          }}
          className="rounded p-1 hover:bg-sunken disabled:opacity-40"
        >
          <Minus className="h-3 w-3" aria-hidden />
        </button>
        <span className="font-bold" aria-label={label}>
          {value}
        </span>
        <button
          type="button"
          aria-label={`Raise ${abilityName(ability)}`}
          disabled={value >= 15 || !canRaise}
          onClick={() => {
            onChange(value + 1);
          }}
          className="rounded p-1 hover:bg-sunken disabled:opacity-40"
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
        className={selectClass}
      />
    );
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        onChange(Number(e.target.value));
      }}
      className={selectClass}
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
