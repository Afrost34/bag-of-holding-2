import type { AnsweredChoice, CharacterDecisions, OptionSummary } from '@boh/rules';
import { cn } from '@boh/ui';
import { useId } from 'react';
import { pickName } from './steps';
import { SpellChoicePanel } from './SpellChoicePanel';
import { selectClass } from './styles';
import { useChoiceOptions } from './useCharacterView';

/**
 * One choice as D&D Beyond shows it inside a feature: a dropdown per pick ("- Choose a Skill -"
 * twice for "choose 2"). Options already taken in another dropdown of the same choice are left
 * out, except "any skill"-style groups, which can be taken more than once.
 */
export function ChoiceControl(props: ChoiceControlProps) {
  // Spells get the spell list's rows, whatever asks for them (a class, Magic Initiate…).
  if (props.choice.kind === 'spell') return <SpellChoicePanel {...props} />;
  return <DropdownChoice {...props} />;
}

interface ChoiceControlProps {
  choice: AnsweredChoice;
  decisions: CharacterDecisions;
  isEnabled: (source: string | undefined) => boolean;
  onChange: (picks: string[]) => void;
  /** The label is already the heading around it. */
  hideLabel?: boolean;
}

function DropdownChoice({
  choice,
  decisions,
  isEnabled,
  onChange,
  hideLabel = false,
}: {
  choice: AnsweredChoice;
  decisions: CharacterDecisions;
  isEnabled: (source: string | undefined) => boolean;
  onChange: (picks: string[]) => void;
  /** The label is already the heading around it. */
  hideLabel?: boolean;
}) {
  const id = useId();
  const options = useChoiceOptions(decisions, choice.id, true);
  // The saved decisions, not the engine's answer: that one can lag behind quick changes.
  const picks = decisions.choices[choice.id] ?? choice.picks;
  const slots = Array.from({ length: choice.count }, (_, i) => picks[i] ?? '');
  const visible = (options ?? []).filter((o) => isEnabled(o.source) || picks.includes(o.id));
  // Same name in several books: say which book.
  const names = new Map<string, number>();
  for (const o of visible) names.set(o.name, (names.get(o.name) ?? 0) + 1);
  const label = (o: OptionSummary) =>
    `${o.name}${(names.get(o.name) ?? 0) > 1 && o.source ? ` (${o.source})` : ''}${o.legacy ? ' · Legacy' : ''}`;
  const placeholder = `- ${choice.label.replace(/^Choose (an? |\d+ )?/i, 'Choose ')} -`;

  const set = (slot: number, value: string) => {
    const next = [...slots];
    next[slot] = value;
    onChange(next.filter(Boolean));
  };

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <p id={id} className="text-sm font-medium">
          {choice.label}
        </p>
      )}
      {options === null ? (
        <p className="text-sm text-muted">Loading options…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">Nothing in your sources matches this choice.</p>
      ) : (
        slots.map((value, slot) => (
          <select
            key={slot}
            aria-label={choice.count > 1 ? `${choice.label} (${String(slot + 1)})` : choice.label}
            value={value}
            onChange={(e) => {
              set(slot, e.target.value);
            }}
            className={cn(selectClass, value ? '' : 'border-accent text-muted')}
          >
            <option value="">{placeholder}</option>
            {visible
              .filter((o) => o.id === value || o.id.startsWith('pool:') || !slots.includes(o.id))
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {label(o)}
                </option>
              ))}
            {value && !visible.some((o) => o.id === value) && (
              <option value={value}>{pickName(value)}</option>
            )}
          </select>
        ))
      )}
    </div>
  );
}
