import type { Category, ListRow } from '@boh/data5e';
import { Button, cn } from '@boh/ui';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useSourceList } from '../../app/data/sourceList';
import { SOURCE_FIELD, valueCounts, valueLabel } from './listModel';

export interface FilterPanelProps {
  category: Category;
  /** Rows after source and text filtering, for value counts. */
  rows: readonly ListRow[];
  filters: Record<string, string[]>;
  onToggle: (field: string, value: string) => void;
  onClear: () => void;
}

/** Faceted filters: one section per filterable field, values as toggle chips with counts. */
export function FilterPanel({ category, rows, filters, onToggle, onClear }: FilterPanelProps) {
  const sources = useSourceList((s) => s.sources);
  const sourceName = (id: string) =>
    sources.find((s) => s.id.toLowerCase() === id.toLowerCase())?.name ?? id;
  const fields = [
    ...category.fields.filter((f) => f.filter),
    { id: SOURCE_FIELD, label: 'Source', kind: 'enum' as const },
  ];
  const activeCount = Object.values(filters).reduce((n, v) => n + v.length, 0);

  return (
    <div className="space-y-1 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif font-bold">Filters</h2>
        {activeCount > 0 && (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear all
          </Button>
        )}
      </div>
      {fields.map((field) => (
        <FilterSection
          key={field.id}
          label={field.label}
          defaultOpen={field.id !== SOURCE_FIELD}
          values={valueCounts(rows, field)}
          selected={filters[field.id] ?? []}
          display={(v) => (field.id === SOURCE_FIELD ? sourceName(v) : valueLabel(field.id, v))}
          onToggle={(v) => {
            onToggle(field.id, v);
          }}
        />
      ))}
    </div>
  );
}

function FilterSection({
  label,
  values,
  selected,
  display,
  onToggle,
  defaultOpen,
}: {
  label: string;
  values: [string, number][];
  selected: string[];
  display: (value: string) => string;
  onToggle: (value: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || selected.length > 0);
  const [showAll, setShowAll] = useState(false);
  if (values.length === 0) return null;
  const limit = 16;
  const shown = showAll ? values : values.slice(0, limit);

  return (
    <section className="border-b border-border py-2 last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex w-full items-center gap-1 text-left text-sm font-semibold"
      >
        <ChevronRight
          className={cn('h-4 w-4 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
        <span className="flex-1">{label}</span>
        {selected.length > 0 && (
          <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-fg">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={label}>
          {shown.map(([value, count]) => {
            const on = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onToggle(value);
                }}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  on
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-border bg-surface hover:border-accent',
                )}
              >
                {display(value)}{' '}
                <span className={cn(on ? 'opacity-80' : 'text-faint')}>{count}</span>
              </button>
            );
          })}
          {values.length > limit && (
            <button
              type="button"
              onClick={() => {
                setShowAll(!showAll);
              }}
              className="px-1 text-xs text-link hover:underline"
            >
              {showAll ? 'Show fewer' : `+${String(values.length - limit)} more`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
