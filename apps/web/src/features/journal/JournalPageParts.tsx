/** Smaller parts of the journal page: banners, the template form, the note title, the empty journal, a .base file. */
import { bannerOf, parseFrontmatter, resolveLinkPath, type NoteType } from '@boh/journal';
import { Button, cn } from '@boh/ui';
import { FilePlus } from 'lucide-react';
import { useState } from 'react';
import { BaseView } from '../../app/journal/notes/BaseView';
import { useJournalView } from '../../app/journal/notes/context';
import { useAttachmentUrl } from '../../app/journal/notes/useAttachmentUrl';
import { NoteTypeIcon } from '../../app/journal/NoteTypeIcon';
import { displayName } from './journalPageModel';

/** A banner across the top of a note: its `banner`, `image` or `cover` property. */
export function Banner({ text }: { text: string }) {
  const banner = bannerOf(parseFrontmatter(text).data);
  const { attachments, notePath } = useJournalView();
  const file =
    banner?.kind === 'file' ? resolveLinkPath(banner.target, attachments, notePath) : null;
  const fileUrl = useAttachmentUrl(file);
  const src = banner?.kind === 'url' ? banner.target : fileUrl;
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className="mb-4 h-40 w-full rounded-lg object-cover sm:h-52"
      draggable={false}
    />
  );
}

export function TemplateForm({
  label,
  onCreate,
  onCancel,
}: {
  label: string;
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const clean = name.replace(/[\\/:*?"<>|]/g, '-').trim();
  return (
    <form
      aria-label={label}
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onCreate(clean);
      }}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 text-sm"
    >
      <span className="w-full font-medium">{label}</span>
      <input
        autoFocus
        aria-label="Name of the new note"
        placeholder="Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 focus:border-accent focus:outline-none"
      />
      <Button type="submit" variant="primary" size="sm" disabled={!clean}>
        Create
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

export function NoteTitle({ path, onRename }: { path: string; onRename: (name: string) => void }) {
  const [name, setName] = useState(displayName(path));
  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== displayName(path)) onRename(trimmed);
    else setName(displayName(path));
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

export function EmptyJournal({
  campaign,
  count,
  missing,
  onNew,
  onNewOfType,
  onImport,
  noteTypes,
}: {
  noteTypes: readonly NoteType[];
  campaign: string;
  count: number;
  missing: boolean;
  onNew: () => void;
  onNewOfType: (type: NoteType) => void;
  onImport: () => void;
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
      {!missing && (
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Or start a…</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {noteTypes.map((t) => (
              <Button
                key={t.id}
                size="sm"
                onClick={() => {
                  onNewOfType(t);
                }}
              >
                <NoteTypeIcon type={t} /> {t.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {!missing && count === 0 && (
        <p className="mt-6 text-sm text-muted">
          Coming from Obsidian?{' '}
          <button
            type="button"
            onClick={onImport}
            className="font-medium text-link hover:underline"
          >
            Import your vault
          </button>
        </p>
      )}
    </div>
  );
}

/** A `.base` file: its views, and its YAML to edit. */
export function BaseFilePage({
  yaml,
  onSave,
}: {
  yaml: string;
  onSave: (yaml: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  if (editing !== null) {
    return (
      <div className="space-y-2">
        <textarea
          aria-label="Base YAML"
          value={editing}
          spellCheck={false}
          onChange={(e) => {
            setEditing(e.target.value);
          }}
          rows={Math.min(30, Math.max(10, editing.split('\n').length + 1))}
          className="w-full rounded-md border border-border bg-surface p-3 font-mono text-sm focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              void onSave(editing).then(() => {
                setEditing(null);
              });
            }}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(null);
            }}
          >
            Cancel
          </Button>
        </div>
        <BaseView yaml={editing} />
      </div>
    );
  }
  return (
    <BaseView
      yaml={yaml}
      onEditSource={() => {
        setEditing(yaml);
      }}
    />
  );
}
