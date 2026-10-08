import { CATEGORIES, type EntitySummary } from '@boh/data5e';
import { cn } from '@boh/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { noteType, searchNotes, type NoteHit } from '@boh/journal';
import { ArrowRight, CornerDownLeft, NotebookPen, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dataWorker } from '../data/client';
import { entityPath, useEntity } from '../data/entities';
import { useSourceList } from '../data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../data/sourcePrefs';
import { typeLabel } from '../format';
import { navModules } from '../nav';
import { useAppNavigate } from '../navigation';
import { EntityCard } from '../renderer/EntityCard';
import { useCampaigns } from '../campaigns/store';
import { journalPath } from '../journal/paths';
import { useJournal } from '../journal/store';
import { useSearchPalette } from './store';

type Result =
  | { kind: 'page'; id: string; label: string; detail: string; path: string }
  | { kind: 'note'; id: string; note: NoteHit }
  | { kind: 'entity'; id: string; entity: EntitySummary };

/** The "Journal" filter: only the open campaign's notes. */
const JOURNAL = 'journal';

const FILTERS = CATEGORIES.filter((c) =>
  [
    'spells',
    'creatures',
    'items',
    'classes',
    'species',
    'backgrounds',
    'feats',
    'conditions',
    'rules',
  ].includes(c.id),
);

/** Ctrl+K search over everything: compendium entries plus app pages and lists. */
export function SearchPalette() {
  const { open, setOpen } = useSearchPalette();
  const navigate = useAppNavigate();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const sources = useSourceList((s) => s.sources);
  const loadSources = useSourceList((s) => s.load);
  const overrides = useSourcePrefs((s) => s.overrides);
  const query = text.trim();
  const notes = useJournal((s) => s.notes);
  const activeCampaign = useCampaigns((s) => s.activeId);

  // Ctrl/Cmd+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useSearchPalette.getState().open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [setOpen]);

  useEffect(() => {
    if (open) void loadSources();
  }, [open, loadSources]);

  // The open campaign's journal is searched too (loaded here if its page was not opened yet).
  useEffect(() => {
    const journal = useJournal.getState();
    if (open && activeCampaign && journal.campaignId !== activeCampaign) {
      void journal.load(activeCampaign);
    }
  }, [open, activeCampaign]);

  useEffect(() => {
    if (!open || query.length < 2 || filter === JOURNAL) return;
    let cancelled = false;
    const types = filter ? CATEGORIES.find((c) => c.id === filter)?.types : undefined;
    const timer = setTimeout(() => {
      void dataWorker()
        .search(query, {
          limit: 40,
          excludeSources: disabledSourceIds(sources, overrides),
          ...(types ? { types: [...types] } : {}),
        })
        .then((r) => {
          if (!cancelled) {
            setEntities(r);
            setActive(0);
          }
        })
        .catch(() => undefined);
    }, 90);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, filter, sources, overrides]);

  const results: Result[] = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    const pages: Result[] = filter
      ? []
      : [
          ...CATEGORIES.filter((c) => c.label.toLowerCase().includes(q)).map((c): Result => ({
            kind: 'page',
            id: `list:${c.id}`,
            label: `Browse ${c.label}`,
            detail: 'Compendium list',
            path: `/compendium/list/${c.id}`,
          })),
          ...navModules
            .filter((m) => m.label.toLowerCase().startsWith(q))
            .map((m): Result => ({
              kind: 'page',
              id: `nav:${m.path}`,
              label: m.label,
              detail: 'Go to page',
              path: m.path,
            })),
        ].slice(0, 3);
    const noteHits =
      filter === null || filter === JOURNAL
        ? searchNotes(notes, query, filter === JOURNAL ? 40 : 5).map((note): Result => ({
            kind: 'note',
            id: `note:${note.path}`,
            note,
          }))
        : [];
    return [
      ...pages,
      ...noteHits,
      ...(filter === JOURNAL
        ? []
        : entities.map((entity): Result => ({ kind: 'entity', id: entity.key, entity }))),
    ];
  }, [query, filter, entities, notes]);

  const shown = query.length >= 2 ? results : [];
  const current = shown[Math.min(active, shown.length - 1)];

  const close = () => {
    setOpen(false);
    setText('');
    setEntities([]);
  };

  const choose = (result: Result, newTab: boolean) => {
    navigate(
      result.kind === 'page'
        ? result.path
        : result.kind === 'note'
          ? journalPath(result.note.path)
          : entityPath(result.entity.key),
      { newTab },
    );
    close();
  };

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) setOpen(true);
        else close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[8vh] left-1/2 z-50 flex max-h-[80vh] w-[min(96vw,56rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-5 w-5 shrink-0 text-faint" aria-hidden />
            <input
              autoFocus
              value={text}
              onChange={(e) => {
                setText(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, shown.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter' && current) {
                  e.preventDefault();
                  choose(current, e.ctrlKey || e.metaKey);
                }
              }}
              placeholder="Search spells, creatures, items, rules, your notes…"
              aria-label="Search everything"
              role="combobox"
              aria-expanded={shown.length > 0}
              aria-controls="search-results"
              className="h-14 flex-1 bg-transparent text-lg outline-none"
            />
            <kbd className="hidden rounded border border-border px-1.5 text-xs text-faint sm:block">
              Esc
            </kbd>
          </div>

          <div
            className="scrollbar-none flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2"
            role="group"
            aria-label="Search in"
          >
            {[
              { id: null, label: 'All' },
              ...(activeCampaign ? [{ id: JOURNAL, label: 'Journal' }] : []),
              ...FILTERS.map((c) => ({ id: c.id, label: c.label })),
            ].map((f) => (
              <button
                key={f.label}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                }}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-0.5 text-xs',
                  filter === f.id
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-border hover:border-accent',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1">
            <ul
              id="search-results"
              ref={listRef}
              role="listbox"
              aria-label="Results"
              className="min-h-0 flex-1 overflow-y-auto p-1.5"
            >
              {query.length < 2 && (
                <li className="p-4 text-sm text-muted">Type at least two letters.</li>
              )}
              {query.length >= 2 && shown.length === 0 && (
                <li className="p-4 text-sm text-muted">No matches.</li>
              )}
              {shown.map((r, i) => (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => {
                    setActive(i);
                  }}
                  onClick={(e) => {
                    choose(r, e.ctrlKey || e.metaKey);
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1) choose(r, true);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2',
                    i === active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                  )}
                >
                  {r.kind === 'page' ? (
                    <>
                      <ArrowRight className="h-4 w-4 text-accent-ink" aria-hidden />
                      <span className="flex-1 font-medium">{r.label}</span>
                      <span className="text-xs text-muted">{r.detail}</span>
                    </>
                  ) : r.kind === 'note' ? (
                    <>
                      <NotebookPen className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.note.name}</span>
                        {r.note.snippet && (
                          <span className="block truncate text-xs text-muted">
                            {r.note.snippet}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {noteType(r.note.type)?.label ?? 'Note'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate font-medium">{r.entity.name}</span>
                      <span className="text-xs text-muted">{typeLabel(r.entity.type)}</span>
                      <span className="w-24 truncate text-right text-xs text-faint">
                        {r.entity.source} <span className="font-semibold">{r.entity.edition}</span>
                      </span>
                    </>
                  )}
                  {i === active && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-faint" aria-hidden />
                  )}
                </li>
              ))}
            </ul>
            {current?.kind === 'entity' && <PreviewPane entityKey={current.entity.key} />}
            {current?.kind === 'note' && <NotePreview hit={current.note} />}
          </div>
          <p className="hidden border-t border-border px-3 py-1.5 text-[11px] text-faint sm:block">
            ↑↓ to move · Enter to open · Ctrl+Enter for a new tab
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NotePreview({ hit }: { hit: NoteHit }) {
  const kind = noteType(hit.type);
  return (
    <div className="hidden w-[24rem] shrink-0 overflow-y-auto border-l border-border bg-bg p-4 text-sm lg:block">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        {kind?.label ?? 'Journal note'}
      </p>
      <p className="mt-1 font-serif text-lg font-bold">{hit.name}</p>
      <p className="mt-1 text-xs text-faint">{hit.path.slice(0, hit.path.lastIndexOf('/') + 1)}</p>
      {hit.snippet && <p className="mt-3 text-muted">{hit.snippet}</p>}
    </div>
  );
}

function PreviewPane({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  return (
    <div className="hidden w-[24rem] shrink-0 overflow-y-auto border-l border-border bg-bg p-2 text-sm lg:block">
      {state.status === 'found' && <EntityCard entity={state.entity} compact />}
    </div>
  );
}
