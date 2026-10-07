import type { Category, FieldDef, ListRow } from '@boh/data5e';
import { cn } from '@boh/ui';
import { Search } from 'lucide-react';
import { useId } from 'react';
import { useSourceList } from '../../app/data/sourceList';
import { MultiSelect } from './MultiSelect';
import { SOURCE_FIELD, valueCounts, valueLabel } from './listModel';

export interface FilterBarProps {
  category: Category;
  /** Rows after source and text filtering, for value counts. */
  rows: readonly ListRow[];
  q: string;
  filters: Record<string, string[]>;
  advanced: boolean;
  onQuery: (q: string) => void;
  onToggle: (field: string, value: string) => void;
  onClearField: (field: string) => void;
  onReset: () => void;
  onToggleAdvanced: () => void;
}

const SOURCE: FieldDef = { id: SOURCE_FIELD, label: 'Source', kind: 'enum', filter: 'more' };

/** Name search and the main filters, with the rest under "Show advanced filters". */
export function FilterBar({
  category,
  rows,
  q,
  filters,
  advanced,
  onQuery,
  onToggle,
  onClearField,
  onReset,
  onToggleAdvanced,
}: FilterBarProps) {
  const nameId = useId();
  const sources = useSourceList((s) => s.sources);
  const sourceName = (id: string) =>
    sources.find((s) => s.id.toLowerCase() === id.toLowerCase())?.name ?? id;
  const main = category.fields.filter((f) => f.filter === 'main');
  const more = [...category.fields.filter((f) => f.filter === 'more'), SOURCE];
  const advancedActive = more.reduce((n, f) => n + (filters[f.id]?.length ?? 0), 0);
  const anyActive = q !== '' || Object.values(filters).some((v) => v.length > 0);

  const select = (field: FieldDef) => (
    <MultiSelect
      key={field.id}
      label={field.label}
      options={valueCounts(rows, field)}
      selected={filters[field.id] ?? []}
      display={(v) => (field.id === SOURCE_FIELD ? sourceName(v) : valueLabel(field.id, v))}
      onToggle={(v) => {
        onToggle(field.id, v);
      }}
      onClear={() => {
        onClearField(field.id);
      }}
    />
  );

  return (
    <div className="mb-6">
      <section aria-label="Filters" className="rounded-lg border border-border bg-surface-2 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <label
              htmlFor={nameId}
              className="mb-1 block text-[11px] font-semibold tracking-wider uppercase"
            >
              {category.noun} name
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-2.5 left-2.5 h-5 w-5 text-faint"
                aria-hidden
              />
              <input
                id={nameId}
                type="search"
                value={q}
                onChange={(e) => {
                  onQuery(e.target.value);
                }}
                placeholder={`Search ${category.label.toLowerCase()}`}
                className="h-10 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-sm"
              />
            </div>
          </div>
          {main.map(select)}
          {advanced && more.map(select)}
        </div>
        {anyActive && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-semibold tracking-wide text-accent uppercase hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </section>
      <div className="flex justify-center">
        <button
          type="button"
          aria-expanded={advanced}
          onClick={onToggleAdvanced}
          className={cn(
            '-mt-px rounded-b-md border border-t-0 border-border bg-surface-2 px-5 py-1.5',
            'text-xs font-semibold tracking-wide text-accent uppercase hover:text-accent-hover',
          )}
        >
          {advanced ? 'Hide advanced filters' : 'Show advanced filters'}
          {!advanced && advancedActive > 0 && ` (${String(advancedActive)})`}
        </button>
      </div>
    </div>
  );
}
