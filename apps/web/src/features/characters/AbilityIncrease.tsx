import { abilityName, isAbility, type AnsweredChoice, type CharacterDecisions } from '@boh/rules';
import { useState } from 'react';
import { choicesFor, increaseOf, otherFor, slotsFrom } from './increaseModel';
import { selectClass } from './styles';

const SCORES = 'scores';

/**
 * An ability increase as one dropdown per +1: different abilities, or the same one twice (+2).
 * The 2024 background has three (+2/+1 or +1/+1/+1), the Ability Score Improvement two (+2 or
 * +1/+1). Where the increase can be a feat instead (2014), a first dropdown says which.
 */
export function AbilityIncrease({
  choice,
  decisions,
  update,
}: {
  /** The `alternative` between the bundles (see `increaseOf`). */
  choice: AnsweredChoice;
  decisions: CharacterDecisions;
  update: (next: CharacterDecisions) => void;
}) {
  const inc = increaseOf(choice);
  const from = (inc?.singles.options ?? []).filter(isAbility);
  const [slots, setSlots] = useState<string[]>(() => slotsFrom(choice, decisions.choices));
  const picked = decisions.choices[choice.id]?.[0];
  const other = inc?.others.find((o) => o.id === picked);
  const [mode, setMode] = useState(other ? other.id : SCORES);
  if (!inc) return null;
  /** Abilities another dropdown already has twice: +2 is the most one ability can get. */
  const full = (i: number) => {
    const counts = new Map<string, number>();
    slots.forEach((s, j) => {
      if (s && j !== i) counts.set(s, (counts.get(s) ?? 0) + 1);
    });
    const twice = [...counts].filter(([, n]) => n >= 2).map(([a]) => a);
    // Only one ability may get the +2.
    const hasDouble = [...counts.values()].some((n) => n >= 2);
    return new Set(hasDouble ? [...twice, ...slots.filter((s, j) => s && j !== i)] : twice);
  };
  const total = inc.slots === 3 ? 'three' : 'two';

  return (
    <div className="space-y-2">
      {inc.others.length > 0 && (
        <select
          aria-label="Ability scores or a feat"
          value={mode}
          onChange={(e) => {
            const next = e.target.value;
            setMode(next);
            setSlots(slotsFrom(choice, {}));
            update({
              ...decisions,
              choices:
                next === SCORES
                  ? choicesFor(choice, decisions.choices, [])
                  : otherFor(choice, decisions.choices, next),
            });
          }}
          className={selectClass}
        >
          <option value={SCORES}>Increase ability scores</option>
          {inc.others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {mode === SCORES && (
        <>
          <p className="text-sm text-muted">
            Increase {total} different abilities by 1, or one ability by 2
            {inc.slots === 3 ? ' and another by 1' : ''} (pick it twice). No score goes above 20.
          </p>
          <div
            className={inc.slots === 3 ? 'grid gap-2 sm:grid-cols-3' : 'grid gap-2 sm:grid-cols-2'}
          >
            {slots.map((value, i) => (
              <select
                key={i}
                aria-label={`Ability score increase ${String(i + 1)}`}
                value={value}
                onChange={(e) => {
                  const next = slots.map((s, j) => (j === i ? e.target.value : s));
                  setSlots(next);
                  update({ ...decisions, choices: choicesFor(choice, decisions.choices, next) });
                }}
                className={selectClass}
              >
                <option value="">- +1 to… -</option>
                {from
                  .filter((a) => a === value || !full(i).has(a))
                  .map((a) => (
                    <option key={a} value={a}>
                      +1 {abilityName(a)}
                    </option>
                  ))}
              </select>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
