import {
  isAttachment,
  prettyName,
  noteSection,
  parseCompendiumRef,
  parseLinkInner,
  resolveLinkPath,
} from '@boh/journal';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CompendiumCard } from './CompendiumCard';
import { useJournalView } from './context';
import { JournalEmbed } from './JournalEmbed';
import { NoteViewer } from './NoteViewer';

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
export function LinkPreviewContent({ inner }: { inner: string }) {
  const view = useJournalView();
  const link = parseLinkInner(inner);
  if (parseCompendiumRef(link.target)) return <CompendiumCard inner={inner} compact />;
  if (isAttachment(link.target)) {
    return <JournalEmbed inner={inner} />;
  }
  const path = resolveLinkPath(link.target, [...view.notes.keys()], view.notePath);
  if (!path) {
    return (
      <div className={box}>
        <p className="font-medium">{link.target}</p>
        <p className="mt-1 text-muted">No note yet. Click the link to create it.</p>
      </div>
    );
  }
  const section = noteSection(view.notes.get(path) ?? '', link.heading);
  return (
    <div className={box}>
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {prettyName(path)}
        {link.heading ? ` › ${link.heading}` : ''}
      </p>
      {section === null ? (
        <p className="text-muted">There is no heading “{link.heading}” in this note.</p>
      ) : section.trim() === '' ? (
        <p className="text-muted">This note is empty.</p>
      ) : (
        <NoteViewer
          key={`${path}
${section}`}
          text={section}
        />
      )}
    </div>
  );
}
