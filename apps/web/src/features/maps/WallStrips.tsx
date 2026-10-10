import { cn } from '@boh/ui';
import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { usePacks, entryRef } from '../../app/maps/packs';
import { displayName } from '../../app/maps/packModel';
import { isWallStrip } from '../../app/maps/wallStrip';
import { Section } from './PanelParts';
import { Preview } from './PackBrowser';
import type { MapPanelsProps } from './panelTypes';

const SHOWN = 18;

/**
 * Wall styles from the imported packs: every wall's "Straight path" strip (stone, brick, wood, in
 * every colour). "Plain line" is the drawn wall that needs no pack.
 */
export function WallStrips({
  value,
  onPick,
}: {
  value: string | undefined;
  onPick: (ref: string | undefined) => void;
}) {
  const { entries, loaded, load } = usePacks();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(SHOWN);
  const search = useDeferredValue(query);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const strips = useMemo(() => entries.filter((e) => isWallStrip(e.path)), [entries]);
  const found = useMemo(() => {
    const words = search
      .toLowerCase()
      .split(/[\s_/-]+/)
      .filter(Boolean);
    return strips.filter((e) => {
      const hay = e.path.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [strips, search]);
  return (
    <section aria-label="Wall styles from your packs" className="space-y-1">
      <button
        type="button"
        aria-pressed={value === undefined}
        onClick={() => {
          onPick(undefined);
        }}
        className={cn(
          'w-full rounded-md border-2 px-2 py-1 text-left text-xs',
          value === undefined ? 'border-accent' : 'border-border',
        )}
      >
        Plain line
      </button>
      {strips.length === 0 ? (
        <p className="text-xs text-muted">
          {loaded
            ? 'No wall styles yet. Import an asset pack to build walls of stone, brick and wood.'
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
              aria-label="Search wall styles"
              placeholder="Search: stone, brick, earthy…"
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(SHOWN);
              }}
              className="h-8 w-full rounded-md border border-border bg-surface pr-2 pl-7 text-xs"
            />
          </label>
          <ul className="grid grid-cols-2 gap-1" aria-label="Wall styles">
            {found.slice(0, limit).map((e) => {
              const ref = entryRef(e);
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
                    <span className="block truncate px-1 py-0.5">
                      {displayName(e.path)
                        .replace(/ Straight Path$/, '')
                        .replace(/^Wall /, '')}
                    </span>
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

/** The Wall tool's panel: which wall the next walls are made of. */
export function WallPanel({ roomSet, setRoomSet }: MapPanelsProps) {
  return (
    <Section title="Wall">
      <p className="text-xs text-muted">
        Click to add points, double-click or Enter to finish, Esc to cancel.
      </p>
      <WallStrips
        value={roomSet.wallTexture}
        onPick={(wallTexture) => {
          const { wallTexture: _w, ...rest } = roomSet;
          setRoomSet(wallTexture ? { ...rest, wallTexture } : rest);
        }}
      />
    </Section>
  );
}
