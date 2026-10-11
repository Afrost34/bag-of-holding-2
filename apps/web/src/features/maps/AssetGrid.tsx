import { cn } from '@boh/ui';
import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { MAX_TILE, MIN_TILE, useAssetPrefs } from '../../app/maps/artPrefs';
import { groupVariants } from '../../app/maps/packVariants';
import { libraryOrder } from '../../app/maps/packDefaults';
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
  filter,
}: {
  cats: readonly CategoryId[];
  /** Names the list and its search for screen readers and tests. */
  label: string;
  value?: string | undefined;
  onPick: (entry: PackEntry, ref: string) => void;
  emptyHint: string;
  filter?: (entry: PackEntry) => boolean;
}) {
  const { entries, loaded, load } = usePacks();
  const [query, setQuery] = useState('');
  const [biome, setBiome] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const { tile, setTile } = useAssetPrefs();
  const search = useDeferredValue(query);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const mine = useMemo(
    () => entries.filter((e) => cats.includes(e.cat) && (!filter || filter(e))).sort(libraryOrder),
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

  // The same thing in other colours is one stamp with variations.
  const groups = useMemo(() => groupVariants(found), [found]);
  const open = value
    ? groups.find((g) => g.variants.some((v) => entryRef(v.entry) === value))
    : undefined;
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
      <label className="flex items-center gap-2 text-[11px] text-muted">
        Preview size
        <input
          type="range"
          aria-label={`${label}: preview size`}
          min={MIN_TILE}
          max={MAX_TILE}
          step={4}
          value={tile}
          onChange={(e) => {
            setTile(Number(e.target.value));
          }}
          className="min-w-0 flex-1"
        />
      </label>
      <ul
        aria-label={label}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${String(tile + 12)}px, 1fr))` }}
      >
        {groups.slice(0, limit).map((g) => {
          const e = g.head;
          const ref = entryRef(e);
          const chosen = g === open;
          return (
            <li key={ref} className="relative">
              <button
                type="button"
                aria-pressed={chosen}
                aria-label={displayName(e.path)}
                title={
                  g.variants.length > 1
                    ? `${g.name}: ${String(g.variants.length)} variations`
                    : e.path
                }
                onClick={() => {
                  onPick(e, ref);
                }}
                className={cn(
                  'w-full overflow-hidden rounded-md border-2 bg-sunken text-left',
                  chosen ? 'border-accent' : 'border-border hover:border-muted',
                )}
              >
                <Preview entry={e} size={tile} />
              </button>
              {g.variants.length > 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-1 bottom-1 rounded-full bg-surface/90 px-1.5 text-[10px] font-semibold text-muted shadow-card"
                >
                  {g.variants.length}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {open && open.variants.length > 1 && (
        <div role="group" aria-label={`${label}: variations`} className="space-y-1">
          <p className="text-[11px] text-muted">Variations of {open.name}</p>
          <ul className="flex flex-wrap gap-1">
            {open.variants.map((v) => {
              const vref = entryRef(v.entry);
              return (
                <li key={vref}>
                  <button
                    type="button"
                    aria-pressed={value === vref}
                    aria-label={`${displayName(v.entry.path)} (${v.label})`}
                    title={v.label}
                    onClick={() => {
                      onPick(v.entry, vref);
                    }}
                    className={cn(
                      'w-16 overflow-hidden rounded-md border-2 bg-sunken',
                      value === vref ? 'border-accent' : 'border-border hover:border-muted',
                    )}
                  >
                    <Preview entry={v.entry} size={40} />
                    <span className="block truncate px-0.5 text-center text-[10px] text-muted">
                      {v.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {groups.length > limit && (
        <button
          type="button"
          className="text-xs text-accent-ink underline"
          onClick={() => {
            setLimit(limit + PAGE * 2);
          }}
        >
          Show more ({groups.length - limit} left)
        </button>
      )}
      {groups.length === 0 && <p className="text-xs text-muted">Nothing matches.</p>}
    </section>
  );
}
