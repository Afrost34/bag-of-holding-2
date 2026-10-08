import { fieldLabel, noteType, parseFrontmatter, type PropertyValue } from '@boh/journal';
import { cn } from '@boh/ui';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ExternalLink, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign } from '../../app/campaigns/store';
import { NoteTypeIcon } from '../../app/journal/NoteTypeIcon';
import { NotesProvider } from '../../app/journal/notes/NotesProvider';
import { NoteViewer } from '../../app/journal/notes/NoteViewer';
import { useAllNoteTypes } from '../../app/journal/noteTypes';
import { journalPath } from '../../app/journal/paths';
import { propertyText } from '../../app/journal/propertyText';
import { useJournal } from '../../app/journal/store';
import { usePageTitle } from '../../app/tabs/usePageTitle';

interface Row {
  path: string;
  name: string;
  props: Record<string, PropertyValue>;
}

/**
 * The campaign's notes of one kind (NPCs, locations, ships…), as a compendium list: sortable
 * columns from the kind's properties, a filter, and each row opening on the note.
 */
export function NotesListPage({ typeId }: { typeId: string }) {
  useAllNoteTypes();
  const type = noteType(typeId);
  const campaign = useActiveCampaign();
  const journal = useJournal();
  usePageTitle(type?.plural ?? 'Notes');
  useEffect(() => {
    if (campaign && journal.campaignId !== campaign.id) void journal.load(campaign.id);
  }, [campaign, journal]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; asc: boolean }>({ key: 'name', asc: true });
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      [...journal.notes].flatMap(([path, text]) => {
        const props = parseFrontmatter(text).data as Record<string, PropertyValue>;
        return typeof props.type === 'string' && props.type.toLowerCase() === typeId
          ? [{ path, name: path.split('/').pop()?.replace(/\.md$/i, '') ?? path, props }]
          : [];
      }),
    [journal.notes, typeId],
  );
  const columns = type?.columns ?? [];
  const q = query.trim().toLowerCase();
  const shown = rows
    .filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        columns.some((c) => propertyText(r.props[c]).toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      const va = sort.key === 'name' ? a.name : propertyText(a.props[sort.key]);
      const vb = sort.key === 'name' ? b.name : propertyText(b.props[sort.key]);
      return (sort.asc ? 1 : -1) * va.localeCompare(vb, 'en', { numeric: true });
    });

  if (!campaign)
    return <p className="p-8 text-muted">Open a campaign to see its {type?.plural ?? 'notes'}.</p>;
  if (!type) return <p className="p-8">There is no such kind of note in this campaign.</p>;

  const header = (key: string, label: string) => (
    <button
      type="button"
      aria-label={`Sort by ${label}${sort.key === key ? (sort.asc ? ', ascending' : ', descending') : ''}`}
      onClick={() => {
        setSort(sort.key === key ? { key, asc: !sort.asc } : { key, asc: true });
      }}
      className={cn(
        'flex min-w-0 items-center gap-1 text-left text-[11px] font-semibold tracking-wider uppercase hover:text-accent-ink',
        sort.key === key ? 'text-text' : 'text-muted',
      )}
    >
      <span className="truncate">{label}</span>
      {sort.key === key &&
        (sort.asc ? (
          <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
        ))}
    </button>
  );
  const grid = {
    gridTemplateColumns: `minmax(10rem,2fr) ${columns.map(() => 'minmax(0,1fr)').join(' ')} 1.5rem`,
  };

  return (
    <NotesProvider campaign={campaign}>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <AppLink to="/compendium" aria-label="Compendium" className="text-muted hover:text-text">
            <ArrowLeft className="h-5 w-5" />
          </AppLink>
          <NoteTypeIcon type={type} className="h-6 w-6 text-accent-ink" />
          <h1 className="font-serif text-2xl font-bold">{type.plural}</h1>
          <span className="text-sm text-muted">
            {rows.length} in {campaign.name}
          </span>
        </header>
        <label className="relative mb-3 block">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            aria-label={`Filter ${type.plural}`}
            placeholder={`Filter ${type.plural.toLowerCase()}…`}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm"
          />
        </label>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
            No {type.plural.toLowerCase()} yet. Make one in the{' '}
            <AppLink to="/journal" className="text-link hover:underline">
              journal
            </AppLink>
            .
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div
              className="sticky top-0 z-10 grid items-center gap-x-4 border-b border-border bg-bg px-4 py-2.5"
              style={grid}
            >
              {header('name', 'Name')}
              {columns.map((c) => (
                <span key={c}>{header(c, fieldLabel(c))}</span>
              ))}
              <span />
            </div>
            <ul aria-label={type.plural}>
              {shown.map((r) => (
                <li key={r.path} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    aria-expanded={open === r.path}
                    onClick={() => {
                      setOpen(open === r.path ? null : r.path);
                    }}
                    className="grid w-full items-center gap-x-4 px-4 py-2.5 text-left text-sm odd:bg-surface-2 hover:bg-sunken"
                    style={grid}
                  >
                    <span className="truncate font-semibold">{r.name}</span>
                    {columns.map((c) => (
                      <span key={c} className="truncate text-muted">
                        {propertyText(r.props[c])}
                      </span>
                    ))}
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted transition-transform',
                        open === r.path && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                  {open === r.path && (
                    <div className="border-t border-border px-4 py-3">
                      <NoteViewer
                        key={journal.notes.get(r.path)}
                        text={journal.notes.get(r.path) ?? ''}
                      />
                      <AppLink
                        to={journalPath(r.path)}
                        className="mt-3 inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-bold tracking-wide text-accent-fg uppercase hover:bg-accent-hover"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open in the journal
                      </AppLink>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </NotesProvider>
  );
}
