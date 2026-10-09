import { fieldLabel, noteType, parseFrontmatter, type PropertyValue } from '@boh/journal';
import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign } from '../../app/campaigns/store';
import { NotesProvider } from '../../app/journal/notes/NotesProvider';
import { NoteViewer } from '../../app/journal/notes/NoteViewer';
import { useAllNoteTypes } from '../../app/journal/noteTypes';
import { journalPath } from '../../app/journal/paths';
import { propertyText } from '../../app/journal/propertyText';
import { useJournal } from '../../app/journal/store';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { FilterBar } from './FilterBar';
import { filterRows, sortRows, type ListState } from './listModel';
import { ListRows } from './ListRows';
import { noteCategory, noteRows } from './notesList';
import { PageHeading } from './PageHeading';

const NO_SOURCES = new Set<string>();

/**
 * The campaign's notes of one kind (NPCs, locations, ships…), as a compendium list like spells
 * and items: a name search, filters from the kind's properties, sortable columns, and rows that
 * open on the note.
 */
export function NotesListPage({ typeId, note }: { typeId: string; note?: string | undefined }) {
  useAllNoteTypes();
  const type = noteType(typeId);
  const campaign = useActiveCampaign();
  const journal = useJournal();
  usePageTitle(type?.plural ?? 'Notes');
  useEffect(() => {
    if (campaign && journal.campaignId !== campaign.id) void journal.load(campaign.id);
  }, [campaign, journal]);
  // A link to a note opens the list on it: found by name, opened.
  const [state, setState] = useState<ListState>(() => ({
    q: note ? (note.split('/').pop()?.replace(/.md$/i, '') ?? '') : '',
    filters: {},
    sort: 'name',
    dir: 'asc',
    sel: note ?? null,
  }));
  const [advanced, setAdvanced] = useState(false);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const update = (patch: Partial<ListState>) => {
    setState((s) => ({ ...s, ...patch }));
  };

  const rows = useMemo(() => noteRows(journal.notes, typeId), [journal.notes, typeId]);
  const category = useMemo(() => (type ? noteCategory(type, rows) : null), [type, rows]);
  // Filter value counts reflect the name search, not the filters themselves.
  const base = useMemo(
    () => filterRows(rows, { ...state, filters: {} }, NO_SOURCES),
    [rows, state],
  );
  const visible = useMemo(
    () =>
      category ? sortRows(filterRows(base, { ...state, q: '' }, NO_SOURCES), state, category) : [],
    [base, state, category],
  );

  if (!campaign)
    return <p className="p-8 text-muted">Open a campaign to see its {type?.plural ?? 'notes'}.</p>;
  if (!type || !category)
    return <p className="p-8">There is no such kind of note in this campaign.</p>;

  const count = visible.length;
  return (
    <NotesProvider campaign={campaign}>
      <div
        ref={setScrollElement}
        data-scroll-memory="list"
        className="relative h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          <PageHeading
            aside={
              <span className="flex flex-wrap items-center gap-3">
                <span aria-live="polite">
                  {count} {count === 1 ? type.label.toLowerCase() : type.plural.toLowerCase()} in{' '}
                  {campaign.name}
                </span>
                {/* Came here from a link: the note it opened, a click away in the journal. */}
                {note && journal.notes.has(note) && (
                  <AppLink
                    to={journalPath(note)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-sunken"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Edit{' '}
                    {note.split('/').pop()?.replace(/\.md$/i, '')} in the journal
                  </AppLink>
                )}
              </span>
            }
          >
            {type.plural}
          </PageHeading>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
              No {type.plural.toLowerCase()} yet. Make one in the{' '}
              <AppLink to="/journal" className="text-link hover:underline">
                journal
              </AppLink>
              .
            </p>
          ) : (
            <>
              <FilterBar
                category={category}
                rows={base}
                q={state.q}
                filters={state.filters}
                advanced={advanced}
                withSource={false}
                onQuery={(q) => {
                  update({ q });
                }}
                onToggle={(field, value) => {
                  const current = state.filters[field] ?? [];
                  const next = current.includes(value)
                    ? current.filter((v) => v !== value)
                    : [...current, value];
                  update({ filters: { ...state.filters, [field]: next } });
                }}
                onClearField={(field) => {
                  update({ filters: { ...state.filters, [field]: [] } });
                }}
                onReset={() => {
                  update({ q: '', filters: {} });
                }}
                onToggleAdvanced={() => {
                  setAdvanced(!advanced);
                }}
              />
              {count === 0 ? (
                <p className="py-6 text-muted">
                  No {type.plural.toLowerCase()} match these filters.
                </p>
              ) : (
                <ListRows
                  category={category}
                  rows={visible}
                  sort={state.sort}
                  dir={state.dir}
                  onSort={(field) => {
                    update(
                      state.sort === field
                        ? { dir: state.dir === 'asc' ? 'desc' : 'asc' }
                        : { sort: field, dir: 'asc' },
                    );
                  }}
                  expanded={state.sel}
                  onExpand={(sel) => {
                    update({ sel });
                  }}
                  scrollElement={scrollElement}
                  sourceName={() => campaign.name}
                  pathOf={(row) => journalPath(row.key)}
                  details={(row) => (
                    <>
                      <NoteDetails text={journal.notes.get(row.key) ?? ''} />
                      <div className="mt-4 border-t border-border pt-4">
                        <AppLink
                          to={journalPath(row.key)}
                          className="inline-flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-fg uppercase hover:bg-accent-hover"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open in the journal
                        </AppLink>
                      </div>
                    </>
                  )}
                />
              )}
            </>
          )}
        </div>
      </div>
    </NotesProvider>
  );
}

/** Properties a reader does not need to see in the list (the kind, tags, picture…). */
const HIDDEN = new Set(['type', 'tags', 'image', 'aliases', 'cssclasses', 'banner']);

/** A note opened in the list: its properties as a card, then its text. */
function NoteDetails({ text }: { text: string }) {
  const { data, bodyStart } = parseFrontmatter(text);
  const props = Object.entries(data as Record<string, PropertyValue>)
    .filter(([k]) => !HIDDEN.has(k))
    .map(([k, v]) => [fieldLabel(k), propertyText(v)] as const)
    .filter(([, v]) => v !== '');
  return (
    <>
      {props.length > 0 && (
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
          {props.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-muted">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <NoteViewer key={text} text={text.slice(bodyStart)} />
    </>
  );
}
