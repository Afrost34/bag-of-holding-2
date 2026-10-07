import { cn } from '@boh/ui';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

export interface MultiSelectProps {
  label: string;
  /** Values with how many rows have each, in display order. */
  options: readonly [string, number][];
  selected: readonly string[];
  display: (value: string) => string;
  onToggle: (value: string) => void;
  onClear: () => void;
}

/** A labelled dropdown of checkboxes, the filter control of compendium lists. */
export function MultiSelect({
  label,
  options,
  selected,
  display,
  onToggle,
  onClear,
}: MultiSelectProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const searchable = options.length > 12;
  const shown = query
    ? options.filter(([v]) => display(v).toLowerCase().includes(query.toLowerCase()))
    : options;
  const summary =
    selected.length === 0
      ? 'Any'
      : selected.length <= 2
        ? selected.map(display).join(', ')
        : `${String(selected.length)} selected`;

  return (
    <div className="min-w-0">
      <span id={id} className="mb-1 block text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      <Popover.Root
        onOpenChange={(open) => {
          if (!open) setQuery('');
        }}
      >
        <Popover.Trigger
          aria-labelledby={id}
          aria-describedby={`${id}-value`}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-md border bg-surface px-3 text-left text-sm',
            selected.length > 0 ? 'border-accent' : 'border-border hover:border-border-strong',
          )}
        >
          <span
            id={`${id}-value`}
            className={cn('min-w-0 flex-1 truncate', selected.length === 0 && 'text-faint')}
          >
            {summary}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            aria-label={label}
            className="z-50 flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),14rem)] flex-col rounded-md border border-border bg-surface shadow-card"
          >
            {searchable && (
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                placeholder={`Find ${label.toLowerCase()}`}
                aria-label={`Find ${label}`}
                className="m-2 h-8 rounded border border-border bg-surface-2 px-2 text-sm"
              />
            )}
            <ul className="min-h-0 flex-1 overflow-y-auto p-1" role="group" aria-label={label}>
              {shown.map(([value, count]) => {
                const on = selected.includes(value);
                return (
                  <li key={value}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          onToggle(value);
                        }}
                        className="h-4 w-4 shrink-0 accent-accent"
                      />
                      <span className="min-w-0 flex-1 truncate">{display(value)}</span>
                      <span className="text-xs text-faint">{count}</span>
                    </label>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-2 py-1.5 text-sm text-muted">No match.</li>}
            </ul>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="border-t border-border px-3 py-2 text-left text-xs font-semibold text-accent hover:bg-surface-2"
              >
                Clear {label.toLowerCase()}
              </button>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
