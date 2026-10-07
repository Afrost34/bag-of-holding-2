import type { Category, ListRow } from '@boh/data5e';
import { Button, cn, IconButton } from '@boh/ui';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ExternalLink, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useEntity, entityPath } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { useAppNavigate } from '../../app/navigation';
import { EntityCard } from '../../app/renderer/EntityCard';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { FilterPanel } from './FilterPanel';
import { ListTable } from './ListTable';
import {
  filterRows,
  searchFromState,
  sortRows,
  SOURCE_FIELD,
  stateFromSearch,
  valueLabel,
  type ListState,
} from './listModel';

/** Wide screens show the selected entry beside the list; narrow ones open its page. */
function useIsWide(): boolean {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => {
      setWide(mq.matches);
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, []);
  return wide;
}

export function ListPage({
  category,
  search,
}: {
  category: Category;
  search: Record<string, unknown>;
}) {
  const navigate = useNavigate();
  const appNavigate = useAppNavigate();
  const rows = useListRows(category.id);
  const { sources, load } = useSourceList();
  const overrides = useSourcePrefs((s) => s.overrides);
  // The router keeps `search` referentially stable per URL, so this only changes with the URL.
  const state = useMemo(() => stateFromSearch(search, category), [search, category]);
  const wide = useIsWide();
  const [filtersOpen, setFiltersOpen] = useState(
    () => window.matchMedia('(min-width: 768px)').matches,
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
  // Counts reflect text search and enabled sources, not the field filters themselves.
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

  const onSort = (field: string) => {
    update(
      state.sort === field
        ? { dir: state.dir === 'asc' ? 'desc' : 'asc' }
        : { sort: field, dir: 'asc' },
    );
  };

  const onSelect = (row: ListRow) => {
    if (!wide) return false;
    update({ sel: row.key });
    return true;
  };

  const chips = Object.entries(state.filters).flatMap(([field, values]) =>
    values.map((v) => ({ field, v })),
  );
  const label = (field: string, v: string) =>
    field === SOURCE_FIELD ? (sources.find((s) => s.id === v)?.name ?? v) : valueLabel(field, v);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <AppLink to="/compendium" className="text-muted hover:text-text" aria-label="Compendium">
            <ArrowLeft className="h-5 w-5" />
          </AppLink>
          <h1 className="font-serif text-xl font-bold">{category.label}</h1>
          <span className="text-sm text-muted" aria-live="polite">
            {rows
              ? `${visible.length.toLocaleString('en-US')} ${visible.length === 1 ? category.noun : `${category.noun}s`}`
              : 'Loading…'}
          </span>
          <span className="flex-1" />
          <input
            type="search"
            value={state.q}
            onChange={(e) => {
              update({ q: e.target.value });
            }}
            placeholder={`Search ${category.label.toLowerCase()}`}
            aria-label={`Search ${category.label}`}
            className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm sm:w-64"
          />
          <Button
            size="sm"
            variant={filtersOpen ? 'primary' : 'secondary'}
            onClick={() => {
              setFiltersOpen(!filtersOpen);
            }}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
            {chips.length > 0 && (
              <span className="rounded-full bg-surface/30 px-1.5 text-[11px]">{chips.length}</span>
            )}
          </Button>
        </div>
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Active filters">
            {chips.map(({ field, v }) => (
              <button
                key={`${field}:${v}`}
                type="button"
                onClick={() => {
                  toggle(field, v);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent"
              >
                {category.fields.find((f) => f.id === field)?.label ?? 'Source'}: {label(field, v)}
                <X className="h-3 w-3" aria-label="Remove filter" />
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {filtersOpen && (
          <aside
            aria-label="Filters"
            className={cn(
              'overflow-y-auto border-r border-border bg-surface',
              'fixed inset-0 z-30 md:static md:z-auto md:w-64 md:shrink-0',
            )}
          >
            <div className="flex justify-end p-2 md:hidden">
              <IconButton
                label="Close filters"
                icon={<X className="h-5 w-5" />}
                onClick={() => {
                  setFiltersOpen(false);
                }}
              />
            </div>
            <FilterPanel
              category={category}
              rows={base}
              filters={state.filters}
              onToggle={toggle}
              onClear={() => {
                update({ filters: {} });
              }}
            />
          </aside>
        )}

        {rows === null ? (
          <p className="p-6 text-muted">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-muted">No {category.noun}s match these filters.</p>
        ) : (
          <ListTable
            category={category}
            rows={visible}
            sort={state.sort}
            dir={state.dir}
            selected={wide ? state.sel : null}
            onSort={onSort}
            onSelect={onSelect}
            compact={wide && state.sel !== null}
          />
        )}

        {wide && state.sel && (
          <DetailPane
            entityKey={state.sel}
            onClose={() => {
              update({ sel: null });
            }}
            onOpen={(key, newTab) => {
              appNavigate(entityPath(key), { newTab });
            }}
          />
        )}
      </div>
    </div>
  );
}

function DetailPane({
  entityKey,
  onClose,
  onOpen,
}: {
  entityKey: string;
  onClose: () => void;
  onOpen: (key: string, newTab: boolean) => void;
}) {
  const state = useEntity(entityKey);
  return (
    <aside
      aria-label="Selected entry"
      className="w-[30rem] shrink-0 overflow-y-auto border-l border-border bg-bg p-3"
    >
      <div className="mb-2 flex justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            onOpen(entityKey, e.ctrlKey || e.metaKey);
          }}
        >
          <ExternalLink className="h-4 w-4" aria-hidden /> Open page
        </Button>
        <IconButton
          label="Close"
          size="icon-sm"
          icon={<X className="h-4 w-4" />}
          onClick={onClose}
        />
      </div>
      {state.status === 'found' ? (
        <EntityCard entity={state.entity} />
      ) : (
        <p className="p-3 text-muted">{state.status === 'loading' ? 'Loading…' : 'Not found.'}</p>
      )}
    </aside>
  );
}
