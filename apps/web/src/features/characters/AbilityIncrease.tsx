import { abilityName, isAbility, type AnsweredChoice, type CharacterDecisions } from '@boh/rules';
import { useState } from 'react';
import { bundles, choicesFor, slotsFrom } from './increaseModel';
import { selectClass } from './styles';

/**
 * The 2024 background's ability scores as three dropdowns, each worth +1: three different
 * abilities, or the same one twice (+2) and another (+1).
 */
export function AbilityIncrease({
  choice,
  decisions,
  update,
}: {
  /** The `alternative` between the +2/+1 and +1/+1/+1 bundles. */
  choice: AnsweredChoice;
  decisions: CharacterDecisions;
  update: (next: CharacterDecisions) => void;
}) {
  const [twoOne, three] = bundles(choice);
  const from = (three?.options ?? twoOne?.options ?? []).filter(isAbility);
  const [slots, setSlots] = useState<string[]>(() => slotsFrom(choice, decisions.choices));
  /** Abilities another dropdown already has twice: +2 is the most one ability can get. */
  const full = (i: number) => {
    const counts = new Map<string, number>();
    slots.forEach((s, j) => {
      if (s && j !== i) counts.set(s, (counts.get(s) ?? 0) + 1);
    });
    return new Set([...counts].filter(([, n]) => n >= 2).map(([a]) => a));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Increase three different abilities by 1, or one ability by 2 and another by 1 (pick it
        twice). No score goes above 20.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
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
              .filter((a) => !full(i).has(a))
              .map((a) => (
                <option key={a} value={a}>
                  +1 {abilityName(a)}
                </option>
              ))}
          </select>
        ))}
      </div>
    </div>
  );
}
