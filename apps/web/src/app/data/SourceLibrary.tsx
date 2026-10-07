import type { SourceSummary } from '@boh/data5e';
import { Button, cn, Panel } from '@boh/ui';
import { Check, ChevronRight, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ArtImage } from '../ArtImage';
import { useLibrary } from './books';
import { SOURCE_GROUPS, sourceGroup, useSourceList, type SourceGroupId } from './sourceList';
import { isSourceEnabled } from './sourcePrefs';

/** Groups open by default; adventures and "other" are long lists. */
const OPEN_BY_DEFAULT = new Set<SourceGroupId>(['core2024', 'core2014', 'homebrew']);

/** Cover art of each book and adventure, by lowercased source id. */
function useSourceCovers(): Map<string, string> {
  const books = useLibrary('book');
  const adventures = useLibrary('adventure');
  return useMemo(() => {
    const covers = new Map<string, string>();
    for (const b of [...(books ?? []), ...(adventures ?? [])]) {
      if (b.coverPath) covers.set(b.source.toLowerCase(), b.coverPath);
    }
    return covers;
  }, [books, adventures]);
}

export interface SourceLibraryProps {
  title: string;
  /** On/off overrides of the default (everything except playtest), by lowercased source id. */
  overrides: Record<string, boolean>;
  onChange: (overrides: Record<string, boolean>) => void;
  intro?: string;
}

/**
 * Sources as a library of book covers: click a cover to turn the source on or off. Turned-off
 * sources are hidden everywhere while the campaign is open.
 */
export function SourceLibrary({ title, overrides, onChange, intro }: SourceLibraryProps) {
  const { sources, load } = useSourceList();
  const covers = useSourceCovers();
  const [filter, setFilter] = useState('');
  useEffect(() => {
    void load();
  }, [load]);

  const setEnabled = (ids: readonly string[], enabled: boolean) => {
    const next = { ...overrides };
    for (const id of ids) next[id.toLowerCase()] = enabled;
    onChange(next);
  };

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const visible = sources.filter(
      (s) =>
        s.entities > 0 &&
        (needle === '' ||
          s.name.toLowerCase().includes(needle) ||
          s.id.toLowerCase().includes(needle)),
    );
    return SOURCE_GROUPS.map((g) => ({
      ...g,
      sources: visible.filter((s) => sourceGroup(s) === g.id),
    })).filter((g) => g.sources.length > 0);
  }, [sources, filter]);

  const listed = sources.filter((s) => s.entities > 0);
  const enabledCount = listed.filter((s) => isSourceEnabled(s, overrides)).length;
  if (listed.length === 0) return null;

  return (
    <Panel
      title={title}
      actions={
        <span className="text-xs text-header-fg/70">
          {enabledCount} of {listed.length} on
        </span>
      }
    >
      <p className="mb-3 text-sm text-muted">
        {intro ?? 'Click a book to turn it on or off. Turned-off sources are hidden everywhere.'}{' '}
        Playtest material starts off.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
            }}
            placeholder="Filter sources"
            aria-label="Filter sources"
            className="h-9 w-full rounded-md border border-border bg-surface pr-3 pl-8 text-sm"
          />
        </label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange({});
          }}
        >
          Reset to defaults
        </Button>
      </div>
      <div className="divide-y divide-border">
        {groups.map((group) => (
          <CoverGroup
            key={group.id}
            label={group.label}
            sources={group.sources}
            overrides={overrides}
            covers={covers}
            defaultOpen={filter !== '' || OPEN_BY_DEFAULT.has(group.id)}
            onToggle={setEnabled}
          />
        ))}
      </div>
    </Panel>
  );
}

interface CoverGroupProps {
  label: string;
  sources: SourceSummary[];
  overrides: Record<string, boolean>;
  covers: Map<string, string>;
  defaultOpen: boolean;
  onToggle: (ids: readonly string[], enabled: boolean) => void;
}

function CoverGroup({ label, sources, overrides, covers, defaultOpen, onToggle }: CoverGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const on = sources.filter((s) => isSourceEnabled(s, overrides)).length;
  const ids = sources.map((s) => s.id);
  const isOpen = open || defaultOpen;

  return (
    <section className="py-3" aria-label={label}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => {
            setOpen(!isOpen);
          }}
          className="flex flex-1 items-center gap-1.5 py-1 text-left text-sm font-semibold"
        >
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')}
            aria-hidden
          />
          {label}
          <span className="font-normal text-muted">
            ({on}/{sources.length})
          </span>
        </button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Turn on all ${label}`}
          onClick={() => {
            onToggle(ids, true);
          }}
        >
          All
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Turn off all ${label}`}
          onClick={() => {
            onToggle(ids, false);
          }}
        >
          None
        </Button>
      </div>
      {isOpen && (
        <ul className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {sources.map((source) => {
            const enabled = isSourceEnabled(source, overrides);
            const cover = covers.get(source.id.toLowerCase());
            return (
              <li key={source.id}>
                <button
                  type="button"
                  aria-pressed={enabled}
                  aria-label={`${source.name}: ${enabled ? 'on' : 'off'}`}
                  title={`${source.name} (${source.id})`}
                  onClick={() => {
                    onToggle([source.id], !enabled);
                  }}
                  className="group block w-full text-left"
                >
                  <span
                    className={cn(
                      'relative block aspect-[3/4] overflow-hidden rounded-md border-2 bg-sunken transition',
                      enabled ? 'border-accent' : 'border-transparent opacity-45 grayscale',
                      'group-hover:opacity-100',
                    )}
                  >
                    {cover ? (
                      <ArtImage
                        path={cover}
                        widths={[160, 260]}
                        sizes="(min-width: 1024px) 120px, 28vw"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center p-2 text-center font-serif text-sm font-bold text-muted">
                        {source.id}
                      </span>
                    )}
                    {enabled && (
                      <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-fg shadow">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-snug">
                    {source.name}
                    {source.edition && (
                      <span className="ml-1 rounded bg-sunken px-1 text-[10px] font-semibold text-muted">
                        {source.edition}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
