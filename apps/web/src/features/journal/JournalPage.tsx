import {
  buildIndex,
  isAttachment,
  noteName,
  parseCompendiumRef,
  parseLinkInner,
  resolveLinkPath,
} from '@boh/journal';
import { Button, cn } from '@boh/ui';
import { FilePlus, FolderTree, Link2, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign, useCampaigns } from '../../app/campaigns/store';
import { dataWorker } from '../../app/data/client';
import { entityPath } from '../../app/data/entities';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { typeLabel } from '../../app/format';
import { noteRefFor, resolveCompendiumRef } from '../../app/journal/compendium';
import { journalPath } from '../../app/journal/paths';
import { useJournal } from '../../app/journal/store';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import type { JournalEditorOptions } from './editor/setup';
import { FileTree } from './FileTree';
import { NoteEditor } from './NoteEditor';

const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** The open campaign's notes: file tree, live-preview editor and backlinks. */
export function JournalPage({ note }: { note: string | undefined }) {
  const campaign = useActiveCampaign();
  const campaignsLoaded = useCampaigns((s) => s.loaded);
  const journal = useJournal();
  const navigate = useAppNavigate();
  const sources = useSourceList((s) => s.sources);
  const overrides = useSourcePrefs((s) => s.overrides);
  const [filesOpen, setFilesOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  usePageTitle(note ? noteName(note) : 'Journal');
  useEffect(() => {
    void useCampaigns.getState().load();
  }, []);
  useEffect(() => {
    if (campaign && journal.campaignId !== campaign.id) void journal.load(campaign.id);
  }, [campaign, journal]);

  const paths = useMemo(() => [...journal.notes.keys()].sort(), [journal.notes]);
  const index = useMemo(() => buildIndex(journal.notes), [journal.notes]);
  const text = note !== undefined ? journal.notes.get(note) : undefined;

  if (!campaignsLoaded || (campaign && !journal.loaded)) {
    return <p className="p-8 text-muted">Loading…</p>;
  }
  if (!campaign) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Journal</h1>
        <p className="mt-2 text-muted">
          Each campaign has its own journal. Create a campaign first.
        </p>
        <AppLink
          to="/campaigns"
          className="mt-4 inline-block font-medium text-link hover:underline"
        >
          Campaigns
        </AppLink>
      </div>
    );
  }

  const open = (path: string, newTab = false) => {
    navigate(journalPath(path), { newTab });
    setFilesOpen(false);
  };

  const newNote = async (folder: string, name?: string) => {
    open(await journal.createNote(folder, name));
  };

  const newFolder = async (parent: string) => {
    let name = 'New folder';
    const taken = new Set(journal.folders.map((f) => f.toLowerCase()));
    const prefix = parent ? `${parent}/` : '';
    for (let n = 1; taken.has(`${prefix}${name}`.toLowerCase()); n++)
      name = `New folder ${String(n)}`;
    await journal.createFolder(`${prefix}${name}`);
  };

  const rename = async (path: string, newName: string) => {
    const isFolder = journal.folders.includes(path);
    const clean = newName.replace(/[\\/:*?"<>|]/g, '-').replace(/\.md$/i, '');
    const target = `${folderOf(path) ? `${folderOf(path)}/` : ''}${clean}${isFolder ? '' : '.md'}`;
    await journal.move(path, target);
    if (note && (note === path || note.startsWith(`${path}/`))) {
      navigate(journalPath(`${target}${note.slice(path.length)}`));
    }
  };

  const remove = async (path: string) => {
    await journal.remove(path);
    setConfirmDelete(null);
    if (note && (note === path || note.startsWith(`${path}/`))) navigate('/journal');
  };

  const openLink = async (inner: string, newTab: boolean) => {
    const link = parseLinkInner(inner);
    const ref = parseCompendiumRef(link.target);
    if (ref) {
      const key = await resolveCompendiumRef(ref, campaign.edition);
      if (key) navigate(entityPath(key), { newTab });
      else setMessage(`“${ref.name}” is not in your data (or its source is turned off).`);
      return;
    }
    if (isAttachment(link.target)) return;
    const path = resolveLinkPath(link.target, paths, note);
    // Like Obsidian: following a link to a note that does not exist yet creates it.
    open(
      path ?? (await journal.createNote('', link.target.split('/').pop() ?? link.target)),
      newTab,
    );
  };

  const editorOptions: JournalEditorOptions = {
    isResolved: (target) => resolveLinkPath(target, paths, note) !== null,
    notePaths: () => paths,
    searchCompendium: (query, type) =>
      dataWorker().search(query, {
        limit: 15,
        excludeSources: disabledSourceIds(sources, overrides),
        ...(type ? { types: [type] } : {}),
      }),
    refFor: noteRefFor,
    typeLabel,
    openLink: (inner, newTab) => void openLink(inner, newTab),
    openUrl: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    onChange: (t) => {
      if (note) journal.setText(note, t);
    },
  };

  const tree = (
    <FileTree
      notes={paths}
      attachments={journal.attachments}
      folders={journal.folders}
      current={note ?? null}
      onOpen={(p) => {
        open(p);
      }}
      onNewNote={(folder) => void newNote(folder)}
      onNewFolder={(parent) => void newFolder(parent)}
      onRename={(p, n) => void rename(p, n)}
      onDelete={(p) => {
        setConfirmDelete(p);
      }}
    />
  );

  const backlinks = note ? (index.backlinks.get(note) ?? []) : [];

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-surface py-3 md:block">
        {tree}
      </aside>
      {filesOpen && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-surface py-3 md:hidden">
          <div className="flex justify-end px-2">
            <button
              type="button"
              aria-label="Close files"
              onClick={() => {
                setFilesOpen(false);
              }}
              className="rounded p-1 text-muted hover:text-text"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {tree}
        </div>
      )}

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5 md:px-8">
          <div className="mb-3 flex items-center gap-2 md:hidden">
            <Button
              size="sm"
              onClick={() => {
                setFilesOpen(true);
              }}
            >
              <FolderTree className="h-4 w-4" aria-hidden /> Files
            </Button>
          </div>

          {message && (
            <div
              role="status"
              className="mb-3 flex items-center gap-2 rounded-md bg-sunken px-3 py-2 text-sm"
            >
              <span className="flex-1">{message}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => {
                  setMessage(null);
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          {confirmDelete && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-accent/50 px-3 py-2 text-sm">
              <span className="flex-1">
                Delete “{confirmDelete}”
                {journal.folders.includes(confirmDelete) ? ' and everything in it' : ''}?
              </span>
              <Button variant="primary" size="sm" onClick={() => void remove(confirmDelete)}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmDelete(null);
                }}
              >
                Keep
              </Button>
            </div>
          )}

          {note !== undefined && text !== undefined ? (
            <article>
              <NoteTitle key={note} path={note} onRename={(name) => void rename(note, name)} />
              {folderOf(note) && <p className="mb-2 text-xs text-faint">{folderOf(note)}</p>}
              <NoteEditor path={note} text={text} options={editorOptions} />
            </article>
          ) : (
            <EmptyJournal
              campaign={campaign.name}
              count={paths.length}
              missing={note !== undefined}
              onNew={() => void newNote('')}
            />
          )}
        </div>
      </div>

      {note !== undefined && text !== undefined && (
        <aside
          aria-label="Backlinks"
          className="hidden w-64 shrink-0 overflow-y-auto border-l border-border p-4 text-sm xl:block"
        >
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
            <Link2 className="h-3.5 w-3.5" aria-hidden /> Linked from
          </h2>
          {backlinks.length === 0 ? (
            <p className="text-muted">No notes link here yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...new Set(backlinks.map((b) => b.from))].map((from) => (
                <li key={from}>
                  <button
                    type="button"
                    onClick={() => {
                      open(from);
                    }}
                    className="text-left font-medium text-link hover:underline"
                  >
                    {noteName(from)}
                  </button>
                  <p className="line-clamp-2 text-xs text-muted">
                    {snippet(
                      journal.notes.get(from) ?? '',
                      backlinks.find((b) => b.from === from)?.link.start ?? 0,
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
    </div>
  );
}

/** The text around a link, for the backlinks list. */
function snippet(text: string, at: number): string {
  const start = text.lastIndexOf('\n', at) + 1;
  const end = text.indexOf('\n', at);
  return text
    .slice(start, end === -1 ? undefined : end)
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');
}

function NoteTitle({ path, onRename }: { path: string; onRename: (name: string) => void }) {
  const [name, setName] = useState(noteName(path));
  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== noteName(path)) onRename(trimmed);
    else setName(noteName(path));
  };
  return (
    <input
      aria-label="Note title"
      value={name}
      onChange={(e) => {
        setName(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="mb-1 w-full border-b-2 border-transparent bg-transparent pb-1 font-serif text-3xl font-bold outline-none focus:border-accent"
    />
  );
}

function EmptyJournal({
  campaign,
  count,
  missing,
  onNew,
}: {
  campaign: string;
  count: number;
  missing: boolean;
  onNew: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-serif text-2xl font-bold">
        {missing ? 'Note not found' : `${campaign} journal`}
      </h1>
      <p className="mt-2 text-muted">
        {missing
          ? 'It may have been renamed or deleted.'
          : count === 0
            ? 'Notes for this campaign: people, places, sessions, plans. Link them with [[ ]].'
            : 'Pick a note from the files, or start a new one.'}
      </p>
      <Button variant="primary" className={cn('mt-4')} onClick={onNew}>
        <FilePlus className="h-4 w-4" aria-hidden /> New note
      </Button>
    </div>
  );
}
