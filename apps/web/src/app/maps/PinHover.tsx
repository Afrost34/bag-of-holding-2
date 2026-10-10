import { parseFrontmatter } from '@boh/journal';
import { useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useCampaigns } from '../campaigns/store';
import { useEntity } from '../data/entities';
import { JournalViewContext } from '../journal/notes/context';
import { NotesProvider } from '../journal/notes/NotesProvider';
import { NoteViewer } from '../journal/notes/NoteViewer';
import { useJournal } from '../journal/store';
import { EntityCard } from '../renderer/EntityCard';
import { PAGE_KINDS, parsePagePath } from './pages';
import { pinLink, type PinLink } from './pinLink';
import type { MapScene } from './scene';
import { useMaps } from './store';

/** How long the pointer rests on a pin before its preview opens (ms). */
const DELAY = 300;
/** How long the preview stays after the mouse leaves the pin, to reach it (ms). */
const GRACE = 350;
const WIDTH = 384;
const HEIGHT = 420;

interface Hovered {
  id: string;
  label: string;
  link: PinLink;
  x: number;
  y: number;
}

/**
 * A preview of where a pin leads (the note, the compendium entry, the map), shown beside the
 * pointer while it rests on the pin. The mouse can move onto it to scroll and read it all; it
 * closes a moment after the mouse leaves both. Mouse only: on a touch screen a tap follows the pin.
 * Rendered once next to a map canvas; it listens to the canvas's host element itself.
 */
export function PinHover({
  scene,
  host,
  campaignId,
}: {
  scene: MapScene | null;
  host: RefObject<HTMLElement | null>;
  /** The map's campaign, for its notes. */
  campaignId?: string | undefined;
}) {
  const [shown, setShown] = useState<Hovered | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const pending = useRef<string | null>(null);
  /** Whether the mouse is on the preview itself. */
  const inside = useRef(false);

  const keep = () => {
    window.clearTimeout(closeTimer.current);
  };
  /** Closes now: a click on the map, or Escape. */
  const close = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    pending.current = null;
    inside.current = false;
    setShown(null);
  };
  /** Closes in a moment, unless the mouse comes back (to the pin or onto the preview). */
  const closeSoon = () => {
    window.clearTimeout(openTimer.current);
    pending.current = null;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      if (!inside.current) setShown(null);
    }, GRACE);
  };
  const latest = useRef({ keep, close, closeSoon });
  useEffect(() => {
    latest.current = { keep, close, closeSoon };
  });

  useEffect(() => {
    const el = host.current;
    if (!el || !scene) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons !== 0) {
        latest.current.close();
        return;
      }
      const r = el.getBoundingClientRect();
      // The host may be scaled (a map card on a zoomed board): back to its own pixels.
      const k = r.width ? el.clientWidth / r.width : 1;
      const hit = scene.hit(scene.toMap((e.clientX - r.left) * k, (e.clientY - r.top) * k));
      const link = hit?.kind === 'pin' ? pinLink(hit) : null;
      if (!hit || !link) {
        latest.current.closeSoon();
        return;
      }
      latest.current.keep();
      if (pending.current === hit.id) return;
      pending.current = hit.id;
      window.clearTimeout(openTimer.current);
      const at = { x: e.clientX, y: e.clientY };
      const label = hit.kind === 'pin' ? hit.label : '';
      openTimer.current = window.setTimeout(() => {
        setShown((now) => (now?.id === hit.id ? now : { id: hit.id, label, link, ...at }));
      }, DELAY);
    };
    const onLeave = () => {
      latest.current.closeSoon();
    };
    const onDown = () => {
      latest.current.close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current.close();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    };
  }, [scene, host]);

  if (!shown) return null;
  // Just beside the pointer (a short way to move onto it), kept inside the window.
  const left = Math.max(8, Math.min(shown.x + 12, window.innerWidth - WIDTH - 8));
  const top = Math.max(8, Math.min(shown.y + 12, window.innerHeight - HEIGHT - 8));
  return createPortal(
    <div
      role="tooltip"
      aria-label={`Preview: ${shown.label || 'pin'}`}
      style={{ left, top, width: WIDTH, maxHeight: HEIGHT }}
      onPointerEnter={() => {
        inside.current = true;
        keep();
      }}
      onPointerLeave={() => {
        inside.current = false;
        closeSoon();
      }}
      className="fixed z-50 overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface text-sm shadow-card"
    >
      <Content link={shown.link} campaignId={campaignId} />
    </div>,
    document.body,
  );
}

function Content({ link, campaignId }: { link: PinLink; campaignId: string | undefined }) {
  if (link.kind === 'entity') return <EntityPreview entityKey={link.key} />;
  if (link.kind === 'map') return <MapPreview id={link.id} />;
  if (link.kind === 'page') return <PagePreview path={link.path} />;
  return <NotePreview path={link.path} campaignId={campaignId} />;
}

function EntityPreview({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  if (state.status !== 'found')
    return (
      <p className="p-3 text-muted">{state.status === 'loading' ? 'Loading…' : 'Not found.'}</p>
    );
  return <EntityCard entity={state.entity} compact />;
}

function MapPreview({ id }: { id: string }) {
  const map = useMaps((s) => s.maps.find((m) => m.id === id));
  return (
    <div className="p-3">
      <p className="text-xs font-semibold text-muted uppercase">Map</p>
      <p className="font-serif text-lg font-bold">{map?.name ?? 'This map no longer exists.'}</p>
    </div>
  );
}

/** A page of the app: what kind it is, and that a click opens it. */
function PagePreview({ path }: { path: string }) {
  const info = parsePagePath(path);
  const label = PAGE_KINDS.find((k) => k.id === info?.kind)?.label ?? 'A page of the app';
  return (
    <p className="p-3 text-sm">
      {label}. <span className="text-muted">Click the pin to open it.</span>
    </p>
  );
}

/** A note read-only, with the journal's formatting (links, embeds) where the journal is open. */
function NotePreview({ path, campaignId }: { path: string; campaignId: string | undefined }) {
  const hasJournal = useContext(JournalViewContext) !== null;
  const campaign = useCampaigns((s) => s.campaigns.find((c) => c.id === campaignId));
  const body = <NoteText path={path} />;
  if (hasJournal) return body;
  if (!campaign) return <p className="p-3 text-muted">Notes belong to a campaign.</p>;
  return (
    <NotesProvider campaign={{ id: campaign.id, edition: campaign.edition }}>{body}</NotesProvider>
  );
}

function NoteText({ path }: { path: string }) {
  const text = useJournal((s) => s.notes.get(path));
  const title = (path.split('/').pop() ?? path).replace(/\.md$/i, '');
  return (
    <div className="p-3">
      <p className="mb-1 font-serif text-lg font-bold">{title}</p>
      {text === undefined ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <NoteViewer key={text} text={text.slice(parseFrontmatter(text).bodyStart)} />
      )}
    </div>
  );
}
