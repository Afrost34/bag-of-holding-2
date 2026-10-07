import {
  isAttachment,
  noteName,
  prettyName,
  noteSection,
  parseCompendiumRef,
  parseLinkInner,
  resolveLinkPath,
} from '@boh/journal';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { useContext, useMemo } from 'react';
import { RollChip } from '../../dice/RollChip';
import { isImage } from '../attachments';
import { BaseView } from './BaseView';
import { CompendiumCard } from './CompendiumCard';
import { EmbedDepthContext, MAX_EMBED_DEPTH, useJournalView } from './context';
import type { Embed } from './editor/livePreview';
import { NoteViewer } from './NoteViewer';
import { TableEditor } from './TableEditor';
import { useAttachmentUrl } from './useAttachmentUrl';

/** What the editor asks to draw: an `![[embed]]`, a ```base block or a `dice:` roll. */
export function EmbedContent({ embed, editable = false }: { embed: Embed; editable?: boolean }) {
  if (embed.kind === 'embed') {
    return <JournalEmbed inner={embed.inner} {...(editable ? { replace: embed.replace } : {})} />;
  }
  if (embed.kind === 'table') return <TableEditor source={embed.source} onChange={embed.replace} />;
  if (embed.kind === 'dice') {
    const kind = /^\s*1?d20\b/i.test(embed.expression) ? 'd20' : 'dice';
    return <RollChip roll={{ kind, expression: embed.expression }}>{embed.expression}</RollChip>;
  }
  return <BaseBlock yaml={embed.yaml} edit={embed.edit} />;
}

/** A ```base block: `this` is the note it is in. */
function BaseBlock({ yaml, edit }: { yaml: string; edit: () => void }) {
  const { noteInfos, notePath } = useJournalView();
  const self = useMemo(() => noteInfos.find((n) => n.path === notePath), [noteInfos, notePath]);
  return <BaseView yaml={yaml} self={self} onEditSource={edit} />;
}

/** `![[…]]`: an image, a note (or one of its sections), a compendium entry, or a file link. */
export function JournalEmbed({
  inner,
  replace,
}: {
  inner: string;
  /** Changes the embed in the note (null removes it); only in an editable note. */
  replace?: (inner: string | null) => void;
}) {
  const view = useJournalView();
  const depth = useContext(EmbedDepthContext);
  const link = parseLinkInner(inner);

  if (parseCompendiumRef(link.target)) {
    return <CompendiumCard inner={inner} />;
  }

  if (isAttachment(link.target)) {
    const path = resolveLinkPath(link.target, view.attachments, view.notePath);
    if (!path) return <Missing label={link.target} />;
    if (path.toLowerCase().endsWith('.base')) {
      const self = view.noteInfos.find((n) => n.path === view.notePath);
      return <BaseView yaml={view.bases.get(path) ?? ''} self={self} initialView={link.heading} />;
    }
    if (isImage(path)) {
      return (
        <EmbeddedImage
          path={path}
          size={link.display}
          {...(replace
            ? {
                onResize: (width: number | null) => {
                  replace(width === null ? link.target : `${link.target}|${String(width)}`);
                },
                onRemove: () => {
                  replace(null);
                },
              }
            : {})}
        />
      );
    }
    return <FileChip path={path} />;
  }

  const path = resolveLinkPath(link.target, [...view.notes.keys()], view.notePath);
  if (!path) return <Missing label={link.target} />;
  const section = noteSection(view.notes.get(path) ?? '', link.heading);
  const open = (newTab: boolean) => {
    view.openLink(inner, newTab);
  };
  return (
    <div className="rounded-md border-l-4 border-accent/50 bg-sunken/60 py-2 pr-3 pl-4">
      <button
        type="button"
        onClick={(e) => {
          open(e.ctrlKey || e.metaKey);
        }}
        className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase hover:text-link"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        {prettyName(path)}
        {link.heading ? ` › ${link.heading}` : ''}
      </button>
      {depth >= MAX_EMBED_DEPTH ? (
        <p className="text-sm text-muted">Open the note to read it.</p>
      ) : section === null ? (
        <p className="text-sm text-muted">There is no heading “{link.heading}” in this note.</p>
      ) : (
        <NoteViewer key={section} text={section} />
      )}
    </div>
  );
}

/** `|500` sets the width, `|500x300` width and height, as in Obsidian. */
/** Image widths offered when resizing (null: as wide as the note). */
const SIZES = [
  { label: 'Small', width: 240 },
  { label: 'Medium', width: 400 },
  { label: 'Large', width: 640 },
  { label: 'Full width', width: null },
] as const;

function EmbeddedImage({
  path,
  size,
  onResize,
  onRemove,
}: {
  path: string;
  size: string | undefined;
  onResize?: (width: number | null) => void;
  onRemove?: () => void;
}) {
  const url = useAttachmentUrl(path);
  const [w, h] = (size ?? '').split('x').map((n) => Number(n.trim()));
  const width = w && Number.isFinite(w) ? w : undefined;
  const height = h && Number.isFinite(h) ? h : undefined;
  if (url === undefined) {
    return <div className="h-24 animate-pulse rounded-md bg-sunken" aria-label="Loading image" />;
  }
  if (url === null) return <Missing label={path} />;
  const img = (
    <img
      src={url}
      alt={noteName(path)}
      style={{ width, height }}
      className="max-w-full rounded-md"
    />
  );
  if (!onResize) return img;
  return (
    <span className="group/img relative inline-block max-w-full">
      {img}
      <span
        role="toolbar"
        aria-label="Image size"
        className="absolute top-2 left-2 flex gap-0.5 rounded-md bg-surface/95 p-0.5 text-xs opacity-0 shadow-card transition-opacity group-hover/img:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
      >
        {SIZES.map((s) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={(width ?? null) === s.width}
            onClick={() => {
              onResize(s.width);
            }}
            className="rounded px-2 py-1 hover:bg-sunken aria-pressed:bg-accent-soft aria-pressed:text-accent"
          >
            {s.label}
          </button>
        ))}
        {onRemove && (
          <button
            type="button"
            aria-label="Remove image"
            onClick={onRemove}
            className="rounded px-1.5 py-1 text-muted hover:bg-sunken hover:text-text"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </span>
    </span>
  );
}

function FileChip({ path }: { path: string }) {
  const url = useAttachmentUrl(path);
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-sm text-link hover:underline"
    >
      <Paperclip className="h-4 w-4" aria-hidden />
      {path.slice(path.lastIndexOf('/') + 1)}
    </a>
  );
}

function Missing({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-md bg-sunken px-2 py-1 text-sm text-muted italic">
      “{label}” not found
    </span>
  );
}
