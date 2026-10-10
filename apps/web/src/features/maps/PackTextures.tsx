import { cn } from '@boh/ui';
import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { usePacks, entryRef } from '../../app/maps/packs';
import { displayName, squaresOf } from '../../app/maps/packModel';
import type { TerrainRef } from '../../app/maps/terrain';
import { Preview } from './PackBrowser';

const SHOWN = 24;

/** A pack picture that is a texture: in a `Textures` folder and with no size in squares. */
const isTexture = (path: string) => /(^|\/)Textures\//i.test(path) && !squaresOf(path);

/**
 * The textures of the imported asset packs (grass, cobblestone, wooden floors, roofs…), searched
 * by words. Shown under the built-in terrains, and empty (with a hint) until a pack is imported.
 */
export function PackTextures({
  value,
  onPick,
}: {
  value: TerrainRef | undefined;
  onPick: (ref: TerrainRef) => void;
}) {
  const { entries, loaded, load } = usePacks();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(SHOWN);
  const search = useDeferredValue(query);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const textures = useMemo(() => entries.filter((e) => isTexture(e.path)), [entries]);
  const found = useMemo(() => {
    const words = search
      .toLowerCase()
      .split(/[\s_/-]+/)
      .filter(Boolean);
    return textures.filter((e) => {
      const hay = e.path.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [textures, search]);
  return (
    <section aria-label="Textures from your packs" className="space-y-1">
      <p className="text-xs font-medium">From your packs</p>
      {textures.length === 0 ? (
        <p className="text-xs text-muted">
          {loaded
            ? 'No textures yet. Import an asset pack (Stamps → Import packs) to paint with its grass, stone and wood.'
            : 'Loading the packs…'}
        </p>
      ) : (
        <>
          <label className="relative block">
            <Search
              className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              aria-label="Search textures"
              placeholder="Search: cobblestone, grass…"
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(SHOWN);
              }}
              className="h-8 w-full rounded-md border border-border bg-surface pr-2 pl-7 text-xs"
            />
          </label>
          <ul className="grid grid-cols-3 gap-1" aria-label="Pack textures">
            {found.slice(0, limit).map((e) => {
              const ref = entryRef(e) as TerrainRef;
              return (
                <li key={ref}>
                  <button
                    type="button"
                    aria-pressed={value === ref}
                    title={e.path}
                    onClick={() => {
                      onPick(ref);
                    }}
                    className={cn(
                      'w-full overflow-hidden rounded-md border-2 text-left text-xs',
                      value === ref ? 'border-accent' : 'border-border',
                    )}
                  >
                    <Preview entry={e} />
                    <span className="block truncate px-1 py-0.5">{displayName(e.path)}</span>
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
                setLimit(limit + SHOWN * 2);
              }}
            >
              Show more ({found.length - limit} left)
            </button>
          )}
          {found.length === 0 && <p className="text-xs text-muted">Nothing matches.</p>}
        </>
      )}
    </section>
  );
}
