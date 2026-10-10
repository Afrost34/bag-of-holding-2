import { Grid3x3, Magnet } from 'lucide-react';
import { cn } from '@boh/ui';

/** Dungeondraft's bottom bar: the grid and snap switches, the zoom and the square under the cursor. */
export function BottomBar({
  gridVisible,
  onGrid,
  snap,
  onSnap,
  zoom,
  square,
}: {
  gridVisible: boolean;
  onGrid: (visible: boolean) => void;
  snap: boolean;
  onSnap: (snap: boolean) => void;
  /** 1 = 100%. */
  zoom: number;
  /** The square under the cursor (column, row), counted from 1. */
  square: { col: number; row: number } | null;
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
