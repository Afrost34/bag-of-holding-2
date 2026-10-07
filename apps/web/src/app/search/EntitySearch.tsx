import type { EntitySummary } from '@boh/data5e';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dataWorker } from '../data/client';
import { useSourceList } from '../data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../data/sourcePrefs';
import { typeLabel } from '../format';

/** A search box listing compendium entries to pick (cards for a sheet or a board). */
export function EntitySearch({
  onAdd,
  label = 'Add a card',
  placeholder = 'Add a card: spell, item, creature…',
  types,
}: {
  onAdd: (key: string) => void;
  label?: string;
  placeholder?: string;
  /** Only these entity types (`monster`…). */
  types?: readonly string[];
}) {
  const only = types?.join(',') ?? '';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntitySummary[]>([]);
  const { sources, load } = useSourceList();
  const overrides = useSourcePrefs((s) => s.overrides);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void dataWorker()
        .search(q, {
          excludeSources: disabledSourceIds(sources, overrides),
          limit: 15,
          ...(only ? { types: only.split(',') } : {}),
        })
        .then((r) => {
          if (!cancelled) setResults(r);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sources, overrides, only]);
  const shown = query.trim().length < 2 ? [] : results;
  return (
    <div>
      <label className="relative block">
        <Search
          className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
        />
      </label>
      {shown.length > 0 && (
        <ul
          aria-label="Found"
          className="mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface"
        >
          {shown.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => {
                  onAdd(r.key);
                  setQuery('');
                }}
                className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-sunken"
              >
                <span className="font-medium">{r.name}</span>
                <span className="ml-auto text-xs text-muted">
                  {typeLabel(r.type)} · {r.source}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
