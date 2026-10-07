import type { AnsweredChoice, CharacterDecisions, OptionSummary } from '@boh/rules';
import { EntityView } from '@boh/renderer';
import { cn } from '@boh/ui';
import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEntity } from '../../app/data/entities';
import { pickName } from './steps';
import { useChoiceOptions } from './useCharacterView';

const ORDINAL = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/**
 * A spell choice as D&D Beyond's Spells tab shows it: "Cantrips 1/3", the spells taken, then the
 * spells that can be taken, filtered by name and level, each opening to its full text.
 */
export function SpellChoicePanel({
  choice,
  decisions,
  isEnabled,
  onChange,
}: {
  choice: AnsweredChoice;
  decisions: CharacterDecisions;
  isEnabled: (source: string | undefined) => boolean;
  onChange: (picks: string[]) => void;
}) {
  const [adding, setAdding] = useState(choice.picks.length < choice.count);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const options = useChoiceOptions(decisions, choice.id, true);
  const full = choice.picks.length >= choice.count;

  const levels = useMemo(
    () => [...new Set((options ?? []).map((o) => o.level ?? 0))].sort((a, b) => a - b),
    [options],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (options ?? []).filter(
      (o) =>
        !choice.picks.includes(o.id) &&
        isEnabled(o.source) &&
        (level === null || o.level === level) &&
        (!q || o.name.toLowerCase().includes(q)),
    );
  }, [options, choice.picks, isEnabled, level, query]);
  const byId = new Map((options ?? []).map((o) => [o.id, o]));

  return (
    <section aria-label={choice.label} className="space-y-2">
      <div className="flex items-center gap-3 rounded-md bg-sunken px-3 py-2">
        <h4 className="flex-1 font-semibold">
          {choice.label
            .replace(/^(Choose|Prepare) \d+ /, (m) => (m.startsWith('Prepare') ? 'Prepared ' : ''))
            .replace(/^\w/, (m) => m.toUpperCase())}
        </h4>
        <span
          className={cn('text-sm font-bold', full ? 'text-text' : 'text-accent')}
          aria-label="Taken"
        >
          {choice.picks.length}/{choice.count}
        </span>
        <button
          type="button"
          aria-expanded={adding}
          onClick={() => {
            setAdding(!adding);
          }}
          className="rounded border border-border px-2 py-0.5 text-xs font-bold uppercase hover:border-accent"
        >
          {adding ? 'Done' : 'Add'}
        </button>
      </div>

      {choice.picks.length > 0 && (
        <ul className="space-y-1">
          {choice.picks.map((id) => (
            <SpellRow
              key={id}
              id={id}
              option={byId.get(id)}
              action="Remove"
              onAction={() => {
                onChange(choice.picks.filter((p) => p !== id));
              }}
            />
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              placeholder="Spell name"
              aria-label={`Search ${choice.label}`}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
            />
          </label>
          {levels.length > 1 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Spell level">
              {levels.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={level === l}
                  onClick={() => {
                    setLevel(level === l ? null : l);
                  }}
                  className={cn(
                    'rounded border px-2 py-0.5 text-xs font-bold',
                    level === l
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border hover:border-accent',
                  )}
                >
                  {l === 0 ? '0' : ORDINAL[l]}
                </button>
              ))}
            </div>
          )}
          {options === null ? (
            <p className="text-sm text-muted">Loading spells…</p>
          ) : (
            <ul
              className="max-h-[28rem] space-y-1 overflow-y-auto"
              aria-label={`${choice.label} options`}
            >
              {shown.map((o) => (
                <SpellRow
                  key={o.id}
                  id={o.id}
                  option={o}
                  action="Learn"
                  disabled={full}
                  onAction={() => {
                    onChange([...choice.picks, o.id]);
                  }}
                />
              ))}
              {shown.length === 0 && <li className="px-2 text-sm text-muted">No spell matches.</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function SpellRow({
  id,
  option,
  action,
  disabled = false,
  onAction,
}: {
  id: string;
  option: OptionSummary | undefined;
  action: 'Learn' | 'Remove';
  disabled?: boolean;
  onAction: () => void;
}) {
  const [open, setOpen] = useState(false);
  const state = useEntity(open ? id : null);
  const name = option?.name ?? pickName(id);
  return (
    <li className="rounded-md border border-border bg-surface">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium italic">{name}</span>
            {option?.note && (
              <span className="block text-xs text-muted">
                {option.note}
                {option.source && ` · ${option.source}`}
                {option.legacy && ' · Legacy'}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-faint transition', open && 'rotate-180')}
            aria-hidden
          />
        </button>
        <button
          type="button"
          aria-label={`${action} ${name}`}
          disabled={disabled}
          onClick={onAction}
          className={cn(
            'rounded border px-2 py-0.5 text-xs font-bold uppercase disabled:opacity-40',
            action === 'Learn' ? 'border-accent text-accent' : 'border-border text-muted',
          )}
        >
          {action}
        </button>
      </div>
      {open && state.status === 'found' && (
        <div className="border-t border-border px-3 py-2 text-sm">
          <EntityView
            type={state.entity.type}
            data={state.entity.data}
            edition={state.entity.edition}
          />
        </div>
      )}
    </li>
  );
}
