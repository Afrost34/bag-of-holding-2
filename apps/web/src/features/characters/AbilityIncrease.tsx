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
  const counts = new Map<string, number>();
  for (const s of slots) if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  const tooMany = [...counts.values()].some((n) => n > 2);

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
            {from.map((a) => (
              <option key={a} value={a}>
                +1 {abilityName(a)}
              </option>
            ))}
          </select>
        ))}
      </div>
      {tooMany && (
        <p role="alert" className="text-sm font-semibold text-accent">
          One ability can get at most +2.
        </p>
      )}
    </div>
  );
}
