import {
  noteName,
  noteSection,
  parseCompendiumRef,
  parseLinkInner,
  resolveLinkPath,
} from '@boh/journal';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { CampaignEdition } from '../../app/campaigns/model';
import { useEntity } from '../../app/data/entities';
import { resolveCompendiumRef } from '../../app/journal/compendium';
import { EntityCard } from '../../app/renderer/EntityCard';
import { journalViewerExtensions, type JournalEditorOptions } from './editor/setup';

const OPEN_DELAY = 350;
const CLOSE_DELAY = 200;

interface Hovered {
  inner: string;
  rect: DOMRect;
}

/**
 * Hovering a link (`[data-link-target]`) inside `container` with a mouse shows a preview card
 * under it. Moving onto the card keeps it open, so its own links can be clicked. Touch screens
 * have no hover: a tap follows the link.
 */
export function LinkPreviews({
  container,
  children,
}: {
  container: RefObject<HTMLElement | null>;
  children: (inner: string) => ReactNode;
}) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const linkOf = (t: EventTarget | null) =>
      t instanceof Element ? t.closest<HTMLElement>('[data-link-target]') : null;
    const schedule = (fn: () => void, ms: number) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(fn, ms);
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const link = linkOf(e.target);
      const inner = link?.dataset.linkTarget;
      if (!link || !inner) return;
      schedule(() => {
        if (link.isConnected) setHovered({ inner, rect: link.getBoundingClientRect() });
      }, OPEN_DELAY);
    };
    const out = (e: PointerEvent) => {
      const link = linkOf(e.target);
      if (!link || link.contains(e.relatedTarget as Node | null)) return;
      schedule(() => {
        setHovered(null);
      }, CLOSE_DELAY);
    };
    const close = () => {
      window.clearTimeout(timer.current);
      setHovered(null);
    };
    el.addEventListener('pointerover', over);
    el.addEventListener('pointerout', out);
    el.addEventListener('pointerdown', close);
    el.addEventListener('keydown', close);
    return () => {
      window.clearTimeout(timer.current);
      el.removeEventListener('pointerover', over);
      el.removeEventListener('pointerout', out);
      el.removeEventListener('pointerdown', close);
      el.removeEventListener('keydown', close);
    };
  }, [container]);

  // The card is placed for the link's position at hover time; scrolling would leave it behind.
  useEffect(() => {
    if (!hovered) return;
    const close = (e: Event) => {
      if (e.target instanceof Node && card.current?.contains(e.target)) return;
      setHovered(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [hovered]);

  if (!hovered) return null;

  const { rect } = hovered;
  const width = Math.min(window.innerWidth * 0.92, 416);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const below = window.innerHeight - rect.bottom - 18;
  const above = rect.top - 18;
  const placeBelow = below >= 280 || below >= above;
  const maxHeight = Math.min(window.innerHeight * 0.6, 512, placeBelow ? below : above);

  return createPortal(
    <div
      ref={card}
      role="tooltip"
      aria-label="Link preview"
      onPointerEnter={() => {
        window.clearTimeout(timer.current);
      }}
      onPointerLeave={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          setHovered(null);
        }, CLOSE_DELAY);
      }}
      onClick={() => {
        setHovered(null);
      }}
      className="fixed z-50 overflow-y-auto rounded-lg shadow-card"
      style={{
        left,
        width,
        maxHeight,
        ...(placeBelow ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
      }}
    >
      {children(hovered.inner)}
    </div>,
    document.body,
  );
}

const box = 'rounded-lg border border-border bg-surface p-3 text-sm';

/** What a journal link points at: a compendium entry, a note (or one of its sections). */
export function LinkPreviewContent({
  inner,
  notes,
  fromPath,
  edition,
  viewer,
}: {
  inner: string;
  notes: ReadonlyMap<string, string>;
  fromPath: string | undefined;
  edition: CampaignEdition;
  viewer: Pick<JournalEditorOptions, 'isResolved' | 'openLink' | 'openUrl'>;
}) {
  const link = parseLinkInner(inner);
  const ref = parseCompendiumRef(link.target);
  if (ref) return <CompendiumPreview inner={inner} edition={edition} />;
  const path = resolveLinkPath(link.target, [...notes.keys()], fromPath);
  if (!path) {
    return (
      <div className={box}>
        <p className="font-medium">{link.target}</p>
        <p className="mt-1 text-muted">No note yet. Click the link to create it.</p>
      </div>
    );
  }
  const section = noteSection(notes.get(path) ?? '', link.heading);
  return (
    <div className={box}>
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {noteName(path)}
        {link.heading ? ` › ${link.heading}` : ''}
      </p>
      {section === null ? (
        <p className="text-muted">There is no heading “{link.heading}” in this note.</p>
      ) : section.trim() === '' ? (
        <p className="text-muted">This note is empty.</p>
      ) : (
        <NoteViewer key={`${path}\n${section}`} text={section} options={viewer} />
      )}
    </div>
  );
}

function CompendiumPreview({ inner, edition }: { inner: string; edition: CampaignEdition }) {
  const ref = parseCompendiumRef(parseLinkInner(inner).target);
  const [resolved, setResolved] = useState<{ for: string; key: string | null } | null>(null);
  useEffect(() => {
    if (!ref) return;
    let live = true;
    void resolveCompendiumRef(ref, edition).then((key) => {
      if (live) setResolved({ for: inner, key });
    });
    return () => {
      live = false;
    };
    // `ref` is derived from `inner`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inner, edition]);
  const key = resolved?.for === inner ? resolved.key : undefined;
  const entity = useEntity(key ?? null);
  if (key === undefined || (key && entity.status === 'loading')) {
    return <div className={`${box} text-muted`}>Loading…</div>;
  }
  if (key === null || entity.status !== 'found') {
    return (
      <div className={`${box} text-muted`}>
        “{ref?.name}” is not in your data (or its source is turned off).
      </div>
    );
  }
  return (
    <div className="text-sm">
      <EntityCard entity={entity.entity} compact />
    </div>
  );
}

/** A note rendered read-only, formatted the same way as in the editor. */
function NoteViewer({
  text,
  options,
}: {
  text: string;
  options: Pick<JournalEditorOptions, 'isResolved' | 'openLink' | 'openUrl'>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text,
        extensions: journalViewerExtensions({
          isResolved: (t) => latest.current.isResolved(t),
          openLink: (inner, newTab) => {
            latest.current.openLink(inner, newTab);
          },
          openUrl: (url) => {
            latest.current.openUrl(url);
          },
        }),
      }),
    });
    return () => {
      view.destroy();
    };
    // Remounted (by key) when the text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={host} />;
}
