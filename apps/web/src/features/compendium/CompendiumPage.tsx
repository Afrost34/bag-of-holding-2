import type { EntitySummary } from '@boh/data5e';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BookmarkList } from '../../app/annotations/BookmarkList';
import { AppLink } from '../../app/AppLink';
import { BROWSE_LINKS, LIBRARY_LINKS, type CompendiumLink } from '../../app/compendiumLinks';
import { BusyNotice } from '../../app/data/BusyNotice';
import { dataWorker } from '../../app/data/client';
import { entityPath } from '../../app/data/entities';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { useData } from '../../app/data/store';
import { typeLabel } from '../../app/format';
import { PageHeading } from './PageHeading';

/** Compendium home: search everything, or pick something to browse. */
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
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <PageHeading>Compendium</PageHeading>

      {status?.storage === 'busy' ? (
        <BusyNotice />
      ) : status?.installed === false ? (
        <p className="rounded-md bg-sunken p-4 text-sm">
          Download the 5etools data first:{' '}
          <AppLink to="/settings/data" className="font-medium text-link hover:underline">
            Data & sources
          </AppLink>
          .
        </p>
      ) : (
        <>
          <label className="relative block max-w-xl">
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
              className="h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-10 text-base"
            />
          </label>
          <ul
            hidden={query.length < 2}
            className="mt-3 max-w-xl divide-y divide-border rounded-lg border border-border bg-surface"
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
            <>
              <BookmarkList />
              <Tiles label="Browse" links={BROWSE_LINKS} />
              <Tiles label="Library" links={LIBRARY_LINKS} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Tiles({ label, links }: { label: string; links: readonly CompendiumLink[] }) {
  return (
    <nav aria-label={label} className="mt-8">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">{label}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {links.map(({ to, label: name, icon: Icon }) => (
          <li key={to}>
            <AppLink
              to={to}
              className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-semibold group-hover:text-accent-ink">{name}</span>
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
