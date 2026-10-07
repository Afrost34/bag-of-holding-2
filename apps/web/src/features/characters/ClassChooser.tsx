import type { ListRow } from '@boh/data5e';
import { Entries } from '@boh/renderer';
import { meetsRequirements, requirementText, type Ability } from '@boh/rules';
import { Button, cn } from '@boh/ui';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArtImage } from '../../app/ArtImage';
import { loadEntity } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';
import { useClassPage } from '../../app/data/pages';
import { SOURCE_GROUPS, sourceGroup, useSourceList } from '../../app/data/sourceList';
import { Accordion } from './ui';

export interface MulticlassCheck {
  /** Ability scores after increases. */
  scores: Record<Ability, number>;
  /** Classes whose requirements are not met cannot be added. */
  enforce: boolean;
  /** Classes the character already has. */
  taken: readonly string[];
}

/**
 * Choosing a class, as on D&D Beyond: classes grouped by book family, art on the left, and for a
 * multiclass the ones whose ability requirements are not met struck through with the reason.
 * Picking one opens a summary to confirm.
 */
export function ClassChooser({
  edition,
  isEnabled,
  multiclass,
  onAdd,
  onCancel,
}: {
  edition: '2014' | '2024';
  isEnabled: (source: string) => boolean;
  multiclass?: MulticlassCheck;
  onAdd: (key: string) => void;
  onCancel?: () => void;
}) {
  const rows = useListRows('classes');
  const { sources, load } = useSourceList();
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [confirm, setConfirm] = useState<ListRow | null>(null);
  const missing = useRequirements(multiclass && rows ? rows : null, multiclass);

  useEffect(() => {
    void load();
  }, [load]);

  const bookName = (id: string) =>
    sources.find((s) => s.id.toLowerCase() === id.toLowerCase())?.name ?? id;
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bySource = new Map(sources.map((s) => [s.id.toLowerCase(), s]));
    const visible = (rows ?? [])
      .filter((r) => r.type === 'class' && isEnabled(r.source))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(a.edition !== edition) - Number(b.edition !== edition) ||
          a.name.localeCompare(b.name, 'en'),
      );
    return SOURCE_GROUPS.map((g) => ({
      ...g,
      rows: visible.filter((r) => {
        const s = bySource.get(r.source.toLowerCase());
        return (s ? sourceGroup(s) : 'other') === g.id;
      }),
    })).filter((g) => g.rows.length > 0);
  }, [rows, sources, query, edition, isEnabled]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 font-serif text-2xl">
          {multiclass ? 'Choose a class to multiclass' : 'Choose a class'}
        </h2>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {multiclass && (
        <p className="text-sm text-muted">
          Multiclassing needs 13 or more in each class&apos;s main abilities, for the new class and
          the ones you have. 2014 and 2024 classes are not designed to be mixed.
        </p>
      )}
      <label className="relative block">
        <Search
          className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          placeholder="Search classes"
          aria-label="Search classes"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
        />
      </label>
      {rows === null && <p className="text-sm text-muted">Loading…</p>}
      {groups.map((g) => {
        const open = !closed.has(g.id);
        return (
          <section key={g.id} aria-label={g.label}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                const next = new Set(closed);
                if (open) next.add(g.id);
                else next.delete(g.id);
                setClosed(next);
              }}
              className="flex w-full items-center gap-2 border-b border-border py-2 text-left"
            >
              <span className="flex-1 font-serif text-lg font-bold">{g.label}</span>
              <ChevronDown
                className={cn('h-4 w-4 text-faint transition', !open && '-rotate-90')}
                aria-hidden
              />
            </button>
            {open && (
              <ul className="mt-2 space-y-1.5" aria-label="classes">
                {g.rows.map((r) => {
                  const taken = multiclass?.taken.includes(r.key) ?? false;
                  const unmet = missing.get(r.key);
                  const blocked = taken || (!!unmet && !!multiclass?.enforce);
                  return (
                    <li key={r.key}>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          setConfirm(r);
                        }}
                        className="flex w-full items-center gap-3 rounded-md border border-border bg-surface px-2 py-1.5 text-left hover:border-accent disabled:opacity-60 disabled:hover:border-border"
                      >
                        <ClassArt row={r} />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block font-bold tracking-wide uppercase',
                              blocked && 'line-through',
                            )}
                          >
                            {r.name}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {bookName(r.source)}
                            {r.legacy && ' · Legacy'}
                            {taken && ' · Already taken'}
                            {unmet && (
                              <span className="text-accent-ink">
                                {' '}
                                · Prerequisites not met: {unmet}
                              </span>
                            )}
                          </span>
                        </span>
                        {!blocked && (
                          <ChevronRight className="h-5 w-5 shrink-0 text-link" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {confirm && (
        <ConfirmClass
          row={confirm}
          onCancel={() => {
            setConfirm(null);
          }}
          onAdd={() => {
            onAdd(confirm.key);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

function ClassArt({ row, size = 40 }: { row: ListRow; size?: number }) {
  const image = row.card?.image;
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded bg-sunken"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {image && (
        <ArtImage
          path={image}
          widths={[96, 192]}
          sizes={`${String(size)}px`}
          className="h-full w-full object-cover object-top"
        />
      )}
    </span>
  );
}

/** Missing multiclass requirements by class key ("Wisdom 13"), read from each class. */
function useRequirements(
  rows: ListRow[] | null,
  check: MulticlassCheck | undefined,
): Map<string, string> {
  const [missing, setMissing] = useState(new Map<string, string>());
  // Scores compared by value: the object is new on every render.
  const scoresKey = check ? JSON.stringify(check.scores) : '';
  useEffect(() => {
    if (!rows || !scoresKey) return;
    const scores = JSON.parse(scoresKey) as MulticlassCheck['scores'];
    let cancelled = false;
    void Promise.all(
      rows
        .filter((r) => r.type === 'class')
        .map(async (r) => {
          const e = await loadEntity(r.key);
          const mc = e?.data.multiclassing;
          const req =
            typeof mc === 'object' && mc !== null && 'requirements' in mc
              ? mc.requirements
              : undefined;
          if (typeof req !== 'object' || req === null) return null;
          const r2 = req as Record<string, unknown>;
          return meetsRequirements(r2, scores) ? null : ([r.key, requirementText(r2)] as const);
        }),
    ).then((list) => {
      if (!cancelled) setMissing(new Map(list.filter((x) => x !== null)));
    });
    return () => {
      cancelled = true;
    };
  }, [rows, scoresKey]);
  return missing;
}

/** What a class is, before adding it: its card and its first features. */
function ConfirmClass({
  row,
  onCancel,
  onAdd,
}: {
  row: ListRow;
  onCancel: () => void;
  onAdd: () => void;
}) {
  const page = useClassPage(row.key);
  const features = page.status === 'found' ? page.page.features.filter((f) => f.level <= 3) : [];
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
    };
  }, [onCancel]);
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${row.name}`}
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-surface shadow-xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center bg-header px-4 py-3 text-header-fg">
          <h2 className="flex-1 font-serif text-lg font-bold uppercase">Confirm add class</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="rounded p-1 hover:bg-black/20"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-serif text-2xl">{row.name}</p>
              <p className="text-sm text-muted italic">{row.source}</p>
              {row.card?.tagline && <p className="text-sm italic">{row.card.tagline}</p>}
            </div>
            <ClassArt row={row} size={72} />
          </div>
          {row.card?.blurb && <p className="text-sm">{row.card.blurb}</p>}
          {row.card && row.card.facts.length > 0 && (
            <dl className="text-sm">
              {row.card.facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="inline font-bold">{label}: </dt>
                  <dd className="inline">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="space-y-2">
            {features.map((f) => (
              <Accordion
                key={f.key}
                title={f.name}
                subtitle={`Level ${String(f.level)}`}
                defaultOpen={f.level === 1}
              >
                {f.entity ? (
                  <div className="text-sm">
                    <Entries entries={f.entity.data.entries} />
                  </div>
                ) : null}
              </Accordion>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="bg-sunken py-3 font-bold uppercase hover:bg-border"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="bg-accent py-3 font-bold text-accent-fg uppercase hover:bg-accent-hover"
          >
            Add class
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
