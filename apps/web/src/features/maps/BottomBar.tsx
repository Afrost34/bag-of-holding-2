import { Grid3x3, Home, Magnet } from 'lucide-react';
import { cn } from '@boh/ui';

/** Dungeondraft's bottom bar: the grid and snap switches, the zoom and the square under the cursor. */
export function BottomBar({
  gridVisible,
  onGrid,
  snap,
  onSnap,
  roofs,
  onRoofs,
  zoom,
  square,
  hint,
  selectedName,
}: {
  gridVisible: boolean;
  onGrid: (visible: boolean) => void;
  snap: boolean;
  onSnap: (snap: boolean) => void;
  /** Roofs shown; null when the map has no buildings. */
  roofs: boolean | null;
  onRoofs: (shown: boolean) => void;
  /** 1 = 100%. */
  zoom: number;
  /** The square under the cursor (column, row), counted from 1. */
  square: { col: number; row: number } | null;
  /** What the current tool does. */
  hint: string | null;
  /** The selected item, by name. */
  selectedName: string | null;
}) {
  const toggle = (on: boolean) =>
    cn(
      'flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium',
      on ? 'border-accent bg-accent/15 text-accent-ink' : 'border-border bg-surface text-muted',
    );
  return (
    <div
      role="toolbar"
      aria-label="Map bar"
      className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-border bg-surface/95 px-2 py-1"
    >
      <button
        type="button"
        aria-pressed={gridVisible}
        title="Show the grid (G)"
        className={toggle(gridVisible)}
        onClick={() => {
          onGrid(!gridVisible);
        }}
      >
        <Grid3x3 className="h-4 w-4" aria-hidden /> Grid
      </button>
      <button
        type="button"
        aria-pressed={snap}
        title="Snap to the grid (S)"
        className={toggle(snap)}
        onClick={() => {
          onSnap(!snap);
        }}
      >
        <Magnet className="h-4 w-4" aria-hidden /> Snap
      </button>
      {roofs !== null && (
        <button
          type="button"
          aria-pressed={roofs}
          title="Show the roofs of the buildings"
          className={toggle(roofs)}
          onClick={() => {
            onRoofs(!roofs);
          }}
        >
          <Home className="h-4 w-4" aria-hidden /> Roofs
        </button>
      )}
      {selectedName && (
        <span className="rounded bg-sunken px-1.5 py-0.5 text-xs font-medium" aria-label="Selected">
          {selectedName}
        </span>
      )}
      {hint && (
        <span className="hidden min-w-0 flex-1 truncate text-xs text-muted @2xl:block" title={hint}>
          {hint}
        </span>
      )}
      <span
        className="ml-auto text-xs text-muted tabular-nums"
        aria-label="Square under the cursor"
      >
        {square ? `${String(square.col)}, ${String(square.row)}` : '–'}
      </span>
      <span className="w-12 text-right text-xs text-muted tabular-nums" aria-label="Zoom">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
