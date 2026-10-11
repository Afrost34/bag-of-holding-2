import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { packBigUrl } from '../../app/maps/packs';
import { displayName, type PackEntry } from '../../app/maps/packModel';

/** How long the pointer rests on a tile before the larger picture shows. */
export const ZOOM_DELAY = 500;
const BOX = 340;

/**
 * Resting the pointer on a picture of a pack for a moment shows it larger beside the tile (to the
 * left: the panels sit at the right edge of the window). Returns the handlers for the tile and
 * the popup to render inside it.
 */
export function useZoomOnHover(
  entry: PackEntry,
  enabled: boolean,
): {
  handlers: { onPointerEnter: (e: React.PointerEvent) => void; onPointerLeave: () => void };
  popup: ReactNode;
} {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!at) return;
    let live = true;
    void packBigUrl(entry).then((u) => {
      if (live) setSrc(u);
    });
    return () => {
      live = false;
    };
  }, [at, entry]);
  const leave = () => {
    window.clearTimeout(timer.current);
    setAt(null);
    setSrc(null);
  };
  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (!enabled || e.pointerType === 'touch') return;
      const rect = e.currentTarget.getBoundingClientRect();
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setAt({ x: rect.left, y: rect.top + rect.height / 2 });
      }, ZOOM_DELAY);
    },
    onPointerLeave: leave,
  };
  const popup =
    at &&
    createPortal(
      <div
        role="img"
        aria-label={`Preview of ${displayName(entry.path)}`}
        style={{
          left: Math.max(8, at.x - BOX - 12),
          top: Math.min(Math.max(8, at.y - BOX / 2), window.innerHeight - BOX - 8),
          width: BOX,
          height: BOX,
        }}
        className="pointer-events-none fixed z-50 flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface p-2 shadow-card"
      >
        {src ? (
          <img src={src} alt="" className="min-h-0 max-w-full flex-1 object-contain" />
        ) : (
          <span className="h-10 w-10 animate-pulse rounded bg-sunken" aria-hidden />
        )}
        <span className="max-w-full truncate text-xs text-muted">{displayName(entry.path)}</span>
      </div>,
      document.body,
    );
  return { handlers, popup };
}
