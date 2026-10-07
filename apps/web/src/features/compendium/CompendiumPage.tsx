import type { EntitySummary } from '@boh/data5e';
import { CATEGORIES } from '@boh/data5e';
import { BookOpen, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { dataWorker } from '../../app/data/client';
import { entityPath } from '../../app/data/entities';
import { useCategoryCounts } from '../../app/data/lists';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { BusyNotice } from '../../app/data/BusyNotice';
import { useData } from '../../app/data/store';
import { typeLabel } from '../../app/format';

/** Compendium home: search everything, or pick a list to browse with filters. */
export function CompendiumPage() {
  const [text, setText] = useState('');
  const [results, setResults] = useState<EntitySummary[]>([]);
  const status = useData((s) => s.status);
  const refresh = useData((s) => s.refresh);
  const { sources, load } = useSourceList();
  const overrides = useSourcePrefs((s) => s.overrides);
  const counts = useCategoryCounts();
  const query = text.trim();
  const shown = query.length >= 2 ? results : [];

  useEffect(() => {
    void refresh();
    void load();
  }, [refresh, load]);

  useEffect(() => {
    if (query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void dataWorker()
        .search(query, { limit: 40, excludeSources: disabledSourceIds(sources, overrides) })
        .then((r) => {
          if (!cancelled) setResults(r);
        });
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sources, overrides]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="flex items-center gap-2 font-serif text-2xl font-bold">
        <BookOpen className="h-6 w-6 text-accent" aria-hidden /> Compendium
      </h1>
      <p className="mt-1 text-sm text-muted">Search everything, or browse a list with filters.</p>

      {status?.storage === 'busy' ? (
        <div className="mt-6">
          <BusyNotice />
        </div>
      ) : status?.installed === false ? (
        <p className="mt-6 rounded-md bg-sunken p-4 text-sm">
          Download the 5etools data first:{' '}
          <AppLink to="/settings/data" className="font-medium text-link hover:underline">
            Data & sources
          </AppLink>
          .
        </p>
      ) : (
        <>
          <label className="relative mt-5 block">
            <Search
              className="pointer-events-none absolute top-3 left-3 h-5 w-5 text-faint"
              aria-hidden
            />
            <input
              type="search"
              autoFocus
              value={text}
              onChange={(e) => {
                setText(e.target.value);
              }}
              placeholder="Search everything: fireball, goblin, bag of holding…"
              aria-label="Search the compendium"
              className="h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-10 text-base shadow-card"
            />
          </label>
          <ul
            hidden={query.length < 2}
            className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface"
            aria-label="Results"
          >
            {shown.map((r) => (
              <li key={r.key}>
                <AppLink
                  to={entityPath(r.key)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                  <span className="text-sm text-muted">{typeLabel(r.type)}</span>
                  <span className="w-20 text-right text-xs text-faint">
                    {r.source} <span className="font-semibold">{r.edition}</span>
                  </span>
                </AppLink>
              </li>
            ))}
            {query.length >= 2 && shown.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted">No matches.</li>
            )}
          </ul>
          {query.length < 2 && (
            <nav aria-label="Browse" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.filter((c) => (counts?.[c.id] ?? 1) > 0).map((c) => (
                <AppLink
                  key={c.id}
                  to={`/compendium/list/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 shadow-card hover:border-accent"
                >
                  <span className="font-medium">{c.label}</span>
                  <span className="text-xs text-faint">
                    {counts?.[c.id]?.toLocaleString('en-US') ?? ''}
                  </span>
                </AppLink>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
