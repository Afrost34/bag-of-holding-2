import type { Category, ListRow } from '@boh/data5e';
import { cn } from '@boh/ui';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { entityPath } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { IMAGE_BASE } from '../../app/renderer/services';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { LegacyBadge } from './LegacyBadge';
import { PageHeading } from './PageHeading';
import { groupBySource, matchesNameOrSource } from './cardModel';

/** Classes and species: art cards grouped by source book, newest core books first. */
export function CardGridPage({
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
  const q = typeof search.q === 'string' ? search.q : '';
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  usePageTitle(category.label);
  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const disabled = new Set(disabledSourceIds(sources, overrides).map((s) => s.toLowerCase()));
    const visible = (rows ?? []).filter(
      (r) => !disabled.has(r.source.toLowerCase()) && matchesNameOrSource(r, q, sources),
    );
    return groupBySource(visible, sources);
  }, [rows, sources, overrides, q]);

  const toggle = (source: string) => {
    const next = new Set(collapsed);
    if (next.has(source)) next.delete(source);
    else next.add(source);
    setCollapsed(next);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <PageHeading>{category.label}</PageHeading>
        <label className="relative mb-6 block max-w-md">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              void navigate({
                to: '.',
                search: e.target.value ? { q: e.target.value } : {},
                replace: true,
              });
            }}
            placeholder="Search by name or source"
            aria-label={`Search ${category.label}`}
            className="h-10 w-full rounded-md border border-border bg-surface pr-3 pl-10 text-sm"
          />
        </label>

        {rows === null && <p className="text-muted">Loading…</p>}
        {rows !== null && groups.length === 0 && (
          <p className="text-muted">
            No {category.label.toLowerCase()} match “{q}”.
          </p>
        )}
        {groups.map(({ source, info, rows: list }) => {
          const open = !collapsed.has(source);
          return (
            <section key={source} className="mb-8" aria-label={info?.name ?? source}>
              <h2 className="mb-4">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => {
                    toggle(source);
                  }}
                  className="flex items-center gap-2.5 text-left"
                >
                  <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-fg">
                    {source}
                  </span>
                  <span className="font-serif text-lg font-bold sm:text-xl">
                    {info?.name ?? source}
                  </span>
                  <ChevronDown
                    className={cn('h-5 w-5 text-muted transition-transform', !open && '-rotate-90')}
                    aria-hidden
                  />
                </button>
              </h2>
              {open && (
                <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((row) => (
                    <li key={row.key}>
                      <ArtCard row={row} sourceName={info?.name ?? source} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ArtCard({ row, sourceName }: { row: ListRow; sourceName: string }) {
  const card = row.card;
  const image = card?.image;
  return (
    <div className="relative h-full pb-4">
      <article className="relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-lg border border-border bg-surface-2">
        {image && (
          <img
            src={`${IMAGE_BASE}${image.split('/').map(encodeURIComponent).join('/')}`}
            alt=""
            loading="lazy"
            className="absolute inset-y-0 right-0 h-full w-3/4 object-cover object-top"
          />
        )}
        <div
          className={cn(
            'relative m-3 mb-8 flex flex-1 flex-col rounded-md border border-border/70 bg-surface/90 p-4 backdrop-blur-[2px]',
            image ? 'w-[64%]' : 'w-auto',
          )}
        >
          <h3 className="flex flex-wrap items-center gap-2 font-serif text-xl leading-tight font-bold">
            {row.name}
            {row.legacy && <LegacyBadge />}
          </h3>
          <p className="mt-0.5 text-xs text-faint italic">{sourceName}</p>
          <div className="my-2 h-0.5 bg-accent" aria-hidden />
          {card?.tagline && <p className="mb-1.5 font-serif text-[15px] italic">{card.tagline}</p>}
          {card?.blurb && <p className="mb-2 line-clamp-4 text-sm text-muted">{card.blurb}</p>}
          {card && card.facts.length > 0 && (
            <dl className="mt-auto space-y-0.5 text-[13px]">
              {card.facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="inline font-semibold">{label}: </dt>
                  <dd className="inline text-muted">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </article>
      <AppLink
        to={entityPath(row.key)}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-md bg-accent px-5 py-2 text-xs font-bold tracking-wide whitespace-nowrap text-accent-fg uppercase shadow-card hover:bg-accent-hover"
      >
        View {row.name} details
      </AppLink>
    </div>
  );
}
