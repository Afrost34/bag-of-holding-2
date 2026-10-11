import { cn } from '@boh/ui';
import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { entryRef, usePacks } from '../../app/maps/packs';
import { biomeOf, type CategoryId } from '../../app/maps/packCategories';
import { displayName, type PackEntry } from '../../app/maps/packModel';
import { Preview } from './PackBrowser';

const PAGE = 30;

/**
 * Pictures of the packs of one or more categories as a grid of previews with a search and the
 * biomes to narrow by: how Dungeondraft shows a tool's assets. Picking one calls `onPick`.
 */
export function AssetGrid({
  cats,
  label,
  value,
  onPick,
  emptyHint,
  columns = 3,
  filter,
}: {
  cats: readonly CategoryId[];
  /** Names the list and its search for screen readers and tests. */
  label: string;
  value?: string | undefined;
  onPick: (entry: PackEntry, ref: string) => void;
  emptyHint: string;
  columns?: 2 | 3 | 4;
  filter?: (entry: PackEntry) => boolean;
}) {
  const { entries, loaded, load } = usePacks();
  const [query, setQuery] = useState('');
  const [biome, setBiome] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const search = useDeferredValue(query);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const mine = useMemo(
    () => entries.filter((e) => cats.includes(e.cat) && (!filter || filter(e))),
    [entries, cats, filter],
  );
  const biomes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of mine) counts.set(biomeOf(e.path), (counts.get(biomeOf(e.path)) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [mine]);
  const found = useMemo(() => {
    const words = search
      .toLowerCase()
      .split(/[\s_/-]+/)
      .filter(Boolean);
    return mine.filter((e) => {
      if (biome && biomeOf(e.path) !== biome) return false;
      const hay = e.path.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [mine, search, biome]);

  if (mine.length === 0)
    return <p className="text-xs text-muted">{loaded ? emptyHint : 'Loading the packs…'}</p>;
  return (
    <section aria-label={label} className="space-y-1.5">
      <label className="relative block">
        <Search
          className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder={`Search ${String(mine.length)}…`}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          className="h-8 w-full rounded-md border border-border bg-surface pr-2 pl-7 text-xs"
        />
      </label>
      {biomes.length > 1 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={`${label}: biome`}>
          {[['', mine.length] as const, ...biomes].map(([name, count]) => (
            <button
              key={name || 'all'}
              type="button"
              aria-pressed={biome === name}
              onClick={() => {
                setBiome(name);
                setLimit(PAGE);
              }}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px]',
                biome === name
                  ? 'border-accent bg-accent-soft font-medium'
                  : 'border-border text-muted',
              )}
            >
              {name || 'All'} {count}
            </button>
          ))}
        </div>
      )}
      <ul
        aria-label={label}
        className={cn(
          'grid gap-1',
          columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-4' : 'grid-cols-3',
        )}
      >
        {found.slice(0, limit).map((e) => {
          const ref = entryRef(e);
          return (
            <li key={ref}>
              <button
                type="button"
                aria-pressed={value === ref}
                aria-label={displayName(e.path)}
                title={e.path}
                onClick={() => {
                  onPick(e, ref);
                }}
                className={cn(
                  'w-full overflow-hidden rounded-md border-2 bg-sunken text-left',
                  value === ref ? 'border-accent' : 'border-border hover:border-muted',
                )}
              >
                <Preview entry={e} />
              </button>
            </li>
          );
        })}
      </ul>
      {found.length > limit && (
        <button
          type="button"
          className="text-xs text-accent-ink underline"
          onClick={() => {
            setLimit(limit + PAGE * 2);
          }}
        >
          Show more ({found.length - limit} left)
        </button>
      )}
      {found.length === 0 && <p className="text-xs text-muted">Nothing matches.</p>}
    </section>
  );
}
