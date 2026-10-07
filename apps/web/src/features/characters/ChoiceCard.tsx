import type { AnsweredChoice, CharacterDecisions, OptionSummary } from '@boh/rules';
import { cn } from '@boh/ui';
import { Check, ChevronDown, Minus, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { pickName } from './steps';
import { useChoiceOptions } from './useCharacterView';

/** Lists longer than this get a search box. */
const SEARCH_FROM = 20;

/**
 * One choice the rules engine asks for: its options (loaded from the data worker when opened)
 * and the picks made so far. Open while it still needs picks; click the header to review a
 * finished one.
 */
export function ChoiceCard({
  choice,
  decisions,
  origin,
  isEnabled,
  onChange,
}: {
  choice: AnsweredChoice;
  decisions: CharacterDecisions;
  /** Name of what asks: "Bard", "Skilled". */
  origin?: string;
  /** Whether an option's source is turned on (picked options always show). */
  isEnabled: (source: string | undefined) => boolean;
  onChange: (picks: string[]) => void;
}) {
  const done = choice.picks.length >= choice.count;
  const [open, setOpen] = useState(!done);
  const options = useChoiceOptions(decisions, choice.id, open);
  const [query, setQuery] = useState('');
  const single = choice.count === 1;
  const picks = choice.picks;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (options ?? []).filter(
      (o) =>
        (picks.includes(o.id) || isEnabled(o.source)) &&
        (!q || o.name.toLowerCase().includes(q) || (o.note ?? '').toLowerCase().includes(q)),
    );
  }, [options, picks, query, isEnabled]);

  const nameOf = (id: string) => options?.find((o) => o.id === id)?.name ?? pickName(id);
  const toggle = (o: OptionSummary) => {
    if (single) onChange(picks[0] === o.id ? [] : [o.id]);
    else if (picks.includes(o.id)) onChange(picks.filter((p) => p !== o.id));
    else if (picks.length < choice.count) onChange([...picks, o.id]);
  };
  // "Any skill" can be taken more than once (Skilled: any three skills or tools).
  const countOf = (id: string) => picks.filter((p) => p === id).length;
  const repeatable = (o: OptionSummary) => o.id.startsWith('pool:') && !single;

  return (
    <section
      aria-label={choice.label}
      className={cn('rounded-lg border bg-surface', done ? 'border-border' : 'border-accent')}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            done ? 'bg-accent text-accent-fg' : 'border-2 border-accent text-accent',
          )}
          aria-hidden
        >
          {done ? <Check className="h-4 w-4" /> : choice.count - picks.length}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{choice.label}</span>
          <span className="block truncate text-sm text-muted">
            {picks.length > 0 ? picks.map(nameOf).join(', ') : origin}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-faint transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          {options === null ? (
            <p className="text-sm text-muted">Loading options…</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted">Nothing in your sources matches this choice.</p>
          ) : (
            <>
              {options.length > SEARCH_FROM && (
                <label className="relative mb-2 block">
                  <Search
                    className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    placeholder="Search"
                    aria-label={`Search ${choice.label}`}
                    onChange={(e) => {
                      setQuery(e.target.value);
                    }}
                    className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
                  />
                </label>
              )}
              <ul
                className={cn(
                  'grid gap-1',
                  options.length > SEARCH_FROM ? 'max-h-80 overflow-y-auto' : 'sm:grid-cols-2',
                )}
              >
                {visible.map((o) => {
                  const picked = picks.includes(o.id);
                  const full = picks.length >= choice.count;
                  if (repeatable(o))
                    return (
                      <li key={o.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                        <span className="flex-1 text-sm">{o.name}</span>
                        <button
                          type="button"
                          aria-label={`One less: ${o.name}`}
                          disabled={countOf(o.id) === 0}
                          onClick={() => {
                            const i = picks.lastIndexOf(o.id);
                            onChange(picks.filter((_, j) => j !== i));
                          }}
                          className="rounded border border-border p-1 disabled:opacity-40"
                        >
                          <Minus className="h-3 w-3" aria-hidden />
                        </button>
                        <span className="w-4 text-center text-sm">{countOf(o.id)}</span>
                        <button
                          type="button"
                          aria-label={`One more: ${o.name}`}
                          disabled={full}
                          onClick={() => {
                            onChange([...picks, o.id]);
                          }}
                          className="rounded border border-border p-1 disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" aria-hidden />
                        </button>
                      </li>
                    );
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        role={single ? 'radio' : 'checkbox'}
                        aria-checked={picked}
                        disabled={!picked && full && !single}
                        onClick={() => {
                          toggle(o);
                        }}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-40',
                          picked ? 'bg-accent-soft text-accent' : 'hover:bg-sunken',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border',
                            single ? 'rounded-full' : 'rounded',
                            picked ? 'border-accent bg-accent text-accent-fg' : 'border-border',
                          )}
                          aria-hidden
                        >
                          {picked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{o.name}</span>
                          {o.legacy && (
                            <span className="ml-1.5 rounded bg-sunken px-1 text-xs text-muted">
                              Legacy
                            </span>
                          )}
                          {(o.note ?? o.source) && (
                            <span className="block text-xs text-muted">
                              {[o.note, o.source].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
