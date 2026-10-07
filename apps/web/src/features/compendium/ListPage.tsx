import type { Category } from '@boh/data5e';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useListRows } from '../../app/data/lists';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { FilterBar } from './FilterBar';
import { ListRows } from './ListRows';
import { PageHeading } from './PageHeading';
import {
  filterRows,
  searchFromState,
  sortRows,
  stateFromSearch,
  type ListState,
} from './listModel';

/** A compendium list: name search, filters, sortable columns and rows that expand in place. */
export function ListPage({
  category,
  search,
}: {
  category: Category;
  search: Record<string, unknown>;
}) {
  const navigate = useNavigate();
  const rows = useListRows(category.id);
  const { sources, load } = useSourceList();
  const overrides = useSourcePrefs((s) => s.overrides);
  // The router keeps `search` referentially stable per URL, so this only changes with the URL.
  const state = useMemo(() => stateFromSearch(search, category), [search, category]);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  // Advanced filters start open when one of them is in use (e.g. a shared link).
  const [advanced, setAdvanced] = useState(() =>
    Object.keys(state.filters).some(
      (id) => category.fields.find((f) => f.id === id)?.filter !== 'main',
    ),
  );

  usePageTitle(category.label);
  useEffect(() => {
    void load();
  }, [load]);

  const update = (patch: Partial<ListState>) => {
    void navigate({
      to: '.',
      search: searchFromState({ ...state, ...patch }, category),
      replace: true,
    });
  };

  const disabled = useMemo(
    () => new Set(disabledSourceIds(sources, overrides).map((s) => s.toLowerCase())),
    [sources, overrides],
  );
  // Filter value counts reflect the name search and enabled sources, not the filters themselves.
  const base = useMemo(
    () => (rows ? filterRows(rows, { ...state, filters: {} }, disabled) : []),
    [rows, state, disabled],
  );
  const visible = useMemo(
    () => sortRows(filterRows(base, { ...state, q: '' }, new Set()), state, category),
    [base, state, category],
  );

  const toggle = (field: string, value: string) => {
    const current = state.filters[field] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ filters: { ...state.filters, [field]: next } });
  };

  const sourceName = (id: string) =>
    sources.find((s) => s.id.toLowerCase() === id.toLowerCase())?.name ?? id;
  const count = visible.length;

  return (
    <div ref={setScrollElement} className="relative h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <PageHeading
          aside={
            <span aria-live="polite">
              {rows
                ? `${count.toLocaleString('en-US')} ${count === 1 ? category.noun : `${category.noun}s`}`
                : 'Loading…'}
            </span>
          }
        >
          {category.label}
        </PageHeading>

        <FilterBar
          category={category}
          rows={base}
          q={state.q}
          filters={state.filters}
          advanced={advanced}
          onQuery={(q) => {
            update({ q });
          }}
          onToggle={toggle}
          onClearField={(field) => {
            update({ filters: { ...state.filters, [field]: [] } });
          }}
          onReset={() => {
            update({ q: '', filters: {} });
          }}
          onToggleAdvanced={() => {
            setAdvanced(!advanced);
          }}
        />

        {rows === null ? (
          <p className="py-6 text-muted">Loading…</p>
        ) : count === 0 ? (
          <p className="py-6 text-muted">No {category.noun}s match these filters.</p>
        ) : (
          <ListRows
            category={category}
            rows={visible}
            sort={state.sort}
            dir={state.dir}
            onSort={(field) => {
              update(
                state.sort === field
                  ? { dir: state.dir === 'asc' ? 'desc' : 'asc' }
                  : { sort: field, dir: 'asc' },
              );
            }}
            expanded={state.sel}
            onExpand={(sel) => {
              update({ sel });
            }}
            scrollElement={scrollElement}
            sourceName={sourceName}
          />
        )}
      </div>
    </div>
  );
}
