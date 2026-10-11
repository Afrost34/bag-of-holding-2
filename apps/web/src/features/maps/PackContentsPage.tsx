import { Button, cn } from '@boh/ui';
import { ChevronLeft, FileArchive } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useArtPrefs } from '../../app/maps/artPrefs';
import {
  CATEGORIES,
  categoryCounts,
  type CategoryGroup,
  type CategoryId,
} from '../../app/maps/packCategories';
import { displayName } from '../../app/maps/packModel';
import { usePacks, type ImportProgress } from '../../app/maps/packs';
import { Preview } from './PackBrowser';

const GROUPS: CategoryGroup[] = ['Terrain', 'Structures', 'Nature', 'Interior', 'Effects', 'Other'];
const SAMPLE = 24;

const megabytes = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${String(Math.round(bytes / 1e6))} MB`;

/**
 * "Pack contents": how every imported pack was sorted into the categories the tools use, with a
 * sample of each so a wrong folder is easy to spot, and the switch for the simple drawn art.
 */
export function PackContentsPage() {
  const { metas, entries, loaded, load, importFiles, remove } = usePacks();
  const drawnArt = useArtPrefs((s) => s.drawnArt);
  const setDrawnArt = useArtPrefs((s) => s.setDrawnArt);
  const [open, setOpen] = useState<CategoryId | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const counts = useMemo(() => categoryCounts(entries), [entries]);
  const perPack = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.pack, (m.get(e.pack) ?? 0) + 1);
    return m;
  }, [entries]);
  const sample = useMemo(() => {
    if (!open) return [];
    const mine = entries.filter((e) => e.cat === open);
    // Spread over the whole list: every Nth picture, so several folders show.
    const step = Math.max(1, Math.floor(mine.length / SAMPLE));
    return mine.filter((_, i) => i % step === 0).slice(0, SAMPLE);
  }, [entries, open]);

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
        const failed = report.failed.map((f) => `${f.name}: ${f.error}`).join('; ');
        setMessage(
          [
            report.added.length > 0 ? `${String(report.added.length)} added` : '',
            report.duplicates.length > 0 ? `${String(report.duplicates.length)} already here` : '',
            report.failed.length > 0 ? `${String(report.failed.length)} failed (${failed})` : '',
          ]
            .filter(Boolean)
            .join(', ') + '.',
        );
      });
    };
    input.click();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <AppLink to="/maps" className="inline-flex items-center gap-1 text-sm text-accent-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Maps
        </AppLink>
        <h1 className="flex-1 font-serif text-2xl font-bold">Pack contents</h1>
        <Button variant="primary" disabled={progress !== null} onClick={choose}>
          <FileArchive className="h-4 w-4" aria-hidden /> Import packs (zip)
        </Button>
      </div>
      {progress && (
        <p role="status" className="text-sm text-muted">
          Copying {progress.name} ({progress.index} of {progress.count}):{' '}
          {Math.round((progress.copied / Math.max(1, progress.total)) * 100)}%
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <label className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
        <input
          type="checkbox"
          checked={drawnArt}
          onChange={(e) => {
            setDrawnArt(e.target.checked);
          }}
          className="mt-1"
        />
        <span>
          Also offer the simple drawn art (flat terrains, glyph trees, ink walls)
          <span className="block text-xs text-muted">
            Off by default: with packs imported, every tool works from your packs. It shows anyway
            while no pack is imported.
          </span>
        </span>
      </label>

      <section aria-label="Imported packs" className="space-y-2">
        <h2 className="font-serif text-lg font-semibold">Packs ({metas.length})</h2>
        {metas.length === 0 ? (
          <p className="text-sm text-muted">
            {loaded
              ? 'No packs yet. Import your Forgotten Adventures zips: the Core pack and the Expansion pack hold nearly everything.'
              : 'Loading…'}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {metas.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1 font-medium">{m.name}</span>
                <span className="text-muted">
                  {m.files.toLocaleString('en')} pictures,{' '}
                  {(perPack.get(m.id) ?? 0).toLocaleString('en')} used · {megabytes(m.bytes)}
                </span>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => {
                    void remove(m.id);
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          &ldquo;Used&rdquo; counts the pictures this pack adds: a picture that is in two packs (or
          as .png and .webp) is kept once.
        </p>
      </section>

      {entries.length > 0 &&
        GROUPS.map((group) => {
          const rows = CATEGORIES.filter((c) => c.group === group && (counts.get(c.id) ?? 0) > 0);
          if (rows.length === 0) return null;
          return (
            <section key={group} aria-label={group} className="space-y-2">
              <h2 className="font-serif text-lg font-semibold">{group}</h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {rows.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-expanded={open === c.id}
                      onClick={() => {
                        setOpen(open === c.id ? null : c.id);
                      }}
                      className={cn(
                        'flex w-full flex-wrap items-baseline gap-x-3 px-3 py-2 text-left text-sm hover:bg-sunken',
                        open === c.id && 'bg-sunken',
                      )}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted tabular-nums">
                        {(counts.get(c.id) ?? 0).toLocaleString('en')}
                      </span>
                      <span className="basis-full text-xs text-muted sm:basis-auto">{c.about}</span>
                    </button>
                    {open === c.id && (
                      <ul
                        aria-label={`Samples of ${c.name}`}
                        className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-6"
                      >
                        {sample.map((e) => (
                          <li key={`${e.pack}:${e.path}`} className="min-w-0 text-[10px]">
                            <Preview entry={e} />
                            <span className="block truncate font-medium" title={e.path}>
                              {displayName(e.path)}
                            </span>
                            <span className="block truncate text-muted" title={e.path}>
                              {e.path.split('/').slice(0, -1).join(' › ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}
