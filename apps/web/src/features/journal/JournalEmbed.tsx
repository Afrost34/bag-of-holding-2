import {
  isAttachment,
  noteName,
  noteSection,
  parseCompendiumRef,
  parseLinkInner,
  resolveLinkPath,
} from '@boh/journal';
import { FileText, Paperclip } from 'lucide-react';
import { useContext, useMemo } from 'react';
import { RollChip } from '../../app/dice/RollChip';
import { isImage } from '../../app/journal/attachments';
import { BaseView } from './BaseView';
import { CompendiumCard } from './CompendiumCard';
import { EmbedDepthContext, MAX_EMBED_DEPTH, useJournalView } from './context';
import type { Embed } from './editor/livePreview';
import { NoteViewer } from './NoteViewer';
import { useAttachmentUrl } from './useAttachmentUrl';

/** What the editor asks to draw: an `![[embed]]`, a ```base block or a `dice:` roll. */
export function EmbedContent({ embed }: { embed: Embed }) {
  if (embed.kind === 'embed') return <JournalEmbed inner={embed.inner} />;
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
export function JournalEmbed({ inner }: { inner: string }) {
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
    if (isImage(path)) return <EmbeddedImage path={path} size={link.display} />;
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
        {noteName(path)}
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
function EmbeddedImage({ path, size }: { path: string; size: string | undefined }) {
  const url = useAttachmentUrl(path);
  const [w, h] = (size ?? '').split('x').map((n) => Number(n.trim()));
  const width = w && Number.isFinite(w) ? w : undefined;
  const height = h && Number.isFinite(h) ? h : undefined;
  if (url === undefined) {
    return <div className="h-24 animate-pulse rounded-md bg-sunken" aria-label="Loading image" />;
  }
  if (url === null) return <Missing label={path} />;
  return (
    <img
      src={url}
      alt={noteName(path)}
      style={{ width, height }}
      className="max-w-full rounded-md"
    />
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
