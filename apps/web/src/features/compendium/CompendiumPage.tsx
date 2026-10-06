import type { EntitySummary } from '@boh/data5e';
import { BookOpen, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { dataWorker } from '../../app/data/client';
import { entityPath } from '../../app/data/entities';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { BusyNotice } from '../../app/data/BusyNotice';
import { useData } from '../../app/data/store';
import { typeLabel } from '../../app/format';

/**
 * Interim compendium: search and open any entry. The full compendium (lists, filters, books)
 * replaces this page in milestone 3.
 */
export function CompendiumPage() {
  const [text, setText] = useState('');
  const [results, setResults] = useState<EntitySummary[]>([]);
  const status = useData((s) => s.status);
  const refresh = useData((s) => s.refresh);
  const { sources, load } = useSourceList();
  const overrides = useSourcePrefs((s) => s.overrides);
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
      <p className="mt-1 text-sm text-muted">
        Search every spell, creature, item, rule and more. Lists, filters and books arrive in
        milestone 3.
      </p>

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
              placeholder="Fireball, goblin, bag of holding…"
              aria-label="Search the compendium"
              className="h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-10 text-base shadow-card"
            />
          </label>
          <ul
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
        </>
      )}
    </div>
  );
}
