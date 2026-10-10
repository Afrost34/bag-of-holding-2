import { Button, cn } from '@boh/ui';
import { ChevronRight, FileArchive, Home, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { askConfirm } from '../../app/confirm';
import { packThumbUrl, usePacks, entryRef, type ImportProgress } from '../../app/maps/packs';
import {
  displayName,
  findPackEntries,
  foldersUnder,
  squaresOf,
  type PackEntry,
} from '../../app/maps/packModel';

const PAGE = 96;

const megabytes = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${String(Math.round(bytes / 1e6))} MB`;

/** A preview that is made when the tile scrolls into view. */
function Preview({ entry }: { entry: PackEntry }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const watcher = new IntersectionObserver(
      (seen) => {
        if (!seen.some((s) => s.isIntersecting)) return;
        watcher.disconnect();
        void packThumbUrl(entry).then((url) => {
          if (live) setSrc(url);
        });
      },
      { rootMargin: '200px' },
    );
    watcher.observe(el);
    return () => {
      live = false;
      watcher.disconnect();
    };
  }, [entry]);
  return (
    <span ref={ref} className="flex h-14 items-center justify-center">
      {src ? (
        <img src={src} alt="" className="max-h-14 max-w-full object-contain" draggable={false} />
      ) : (
        <span className="h-8 w-8 animate-pulse rounded bg-sunken" aria-hidden />
      )}
    </span>
  );
}

/**
 * The asset packs imported on this device: folders to open, a search, previews, and the zips
 * themselves to import or remove. Picking a picture starts the stamp tool with it.
 */
export function PackBrowser({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (ref: string, aspect: number, squares?: { w: number; h: number }) => void;
}) {
  const { metas, entries, loaded, load, importFiles, remove } = usePacks();
  const [prefix, setPrefix] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const search = useDeferredValue(query);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const folders = useMemo(() => foldersUnder(entries, prefix), [entries, prefix]);
  const found = useMemo(
    () => findPackEntries(entries, prefix, search, limit),
    [entries, prefix, search, limit],
  );
  const crumbs = prefix ? prefix.split('/') : [];

  const choose = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.zip,application/zip';
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      if (files.length === 0) return;
      setMessage(null);
      void importFiles(files, setProgress).then((report) => {
        setProgress(null);
        const parts = [
          report.added.length > 0 ? `${String(report.added.length)} added` : '',
          report.duplicates.length > 0 ? `${String(report.duplicates.length)} already here` : '',
          report.failed.length > 0
            ? `${String(report.failed.length)} failed (${report.failed
                .map((f) => `${f.name}: ${f.error}`)
                .join('; ')})`
            : '',
        ].filter(Boolean);
        setMessage(`${parts.join(', ')}.`);
      });
    };
    input.click();
  };

  const importing = progress !== null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" disabled={importing} onClick={choose}>
          <FileArchive className="h-4 w-4" aria-hidden /> Import packs (zip)
        </Button>
        {metas.length > 0 && (
          <Button
            variant="ghost"
            aria-expanded={managing}
            onClick={() => {
              setManaging(!managing);
            }}
          >
            Packs ({metas.length})
          </Button>
        )}
      </div>
      {progress && (
        <div role="status" className="space-y-1 text-xs text-muted">
          <p>
            Copying {progress.index} of {progress.count}: {progress.name}
          </p>
          <progress
            className="w-full"
            aria-label="Import progress"
            value={progress.copied}
            max={Math.max(1, progress.total)}
          />
          <p>
            {megabytes(progress.copied)} of {megabytes(progress.total)}. A copy stays in the app, so
            the zip can be deleted afterwards.
          </p>
        </div>
      )}
      {message && (
        <p role="status" className="text-xs text-muted">
          {message}
        </p>
      )}
      {managing && (
        <ul aria-label="Imported packs" className="space-y-1">
          {metas.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm"
            >
              <span className="min-w-0 flex-1 truncate" title={m.name}>
                {m.name}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {m.files.toLocaleString('en')} · {megabytes(m.bytes)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                title="Remove this pack from the app"
                onClick={() => {
                  void askConfirm({
                    title: `Remove ${m.name}?`,
                    message:
                      'Its pictures leave the app (the original zip is not touched). Maps that use them lose those stamps here until the pack is imported again.',
                    confirmLabel: 'Remove',
                  }).then((yes) => {
                    if (yes) void remove(m.id);
                  });
                }}
                className="rounded p-1 text-muted hover:bg-sunken"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          {loaded
            ? 'No packs yet. Import zips of pictures (like the Forgotten Adventures packs): they are copied into the app and stay available when the zip is gone.'
            : 'Loading…'}
        </p>
      ) : (
        <>
          <label className="relative block">
            <Search
              className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-faint"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              aria-label="Find a pack picture"
              placeholder={prefix ? `Search in ${crumbs.at(-1) ?? ''}…` : 'Search every pack…'}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              className="w-full rounded-md border border-border bg-surface py-1.5 pr-2 pl-8 text-sm"
            />
          </label>
          <nav aria-label="Pack folders" className="flex flex-wrap items-center gap-0.5 text-xs">
            <button
              type="button"
              aria-label="All packs"
              onClick={() => {
                setPrefix('');
                setLimit(PAGE);
              }}
              className="rounded p-1 text-muted hover:bg-sunken"
            >
              <Home className="h-3.5 w-3.5" aria-hidden />
            </button>
            {crumbs.map((c, i) => (
              <span key={crumbs.slice(0, i + 1).join('/')} className="flex items-center">
                <ChevronRight className="h-3 w-3 text-faint" aria-hidden />
                <button
                  type="button"
                  onClick={() => {
                    setPrefix(crumbs.slice(0, i + 1).join('/'));
                    setLimit(PAGE);
                  }}
                  className="rounded px-1 py-0.5 text-link hover:underline"
                >
                  {c.replace(/_/g, ' ')}
                </button>
              </span>
            ))}
          </nav>
          {folders.length > 0 && search.trim() === '' && (
            <ul aria-label="Folders" className="flex flex-wrap gap-1">
              {folders.map((f) => (
                <li key={f.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setPrefix(prefix ? `${prefix}/${f.name}` : f.name);
                      setLimit(PAGE);
                    }}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:border-accent"
                  >
                    {f.name.replace(/^!/, '').replace(/_/g, ' ')}{' '}
                    <span className="text-muted">{f.count.toLocaleString('en')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted" role="status">
            {found.total.toLocaleString('en')} picture{found.total === 1 ? '' : 's'}
          </p>
          <ul aria-label="Pack pictures" className="grid grid-cols-3 gap-1">
            {found.list.map((e) => {
              const ref = entryRef(e);
              const squares = squaresOf(e.path);
              return (
                <li key={ref}>
                  <button
                    type="button"
                    title={`${displayName(e.path)}${squares ? ` (${String(squares.w)}×${String(squares.h)})` : ''}`}
                    aria-label={displayName(e.path)}
                    aria-pressed={selected === ref}
                    onClick={() => {
                      const aspect = squares ? squares.w / squares.h : 1;
                      onPick(ref, aspect, squares ?? undefined);
                    }}
                    className={cn(
                      'block w-full rounded-md border-2 bg-surface p-0.5 text-left',
                      selected === ref ? 'border-accent' : 'border-border hover:border-accent',
                    )}
                  >
                    <Preview entry={e} />
                    <span className="block truncate text-[10px] leading-tight text-muted">
                      {displayName(e.path)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {found.total > found.list.length && (
            <Button
              variant="ghost"
              onClick={() => {
                setLimit(limit + PAGE);
              }}
            >
              Show more ({(found.total - found.list.length).toLocaleString('en')} left)
            </Button>
          )}
        </>
      )}
    </div>
  );
}
