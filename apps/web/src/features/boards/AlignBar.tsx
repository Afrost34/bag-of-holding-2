import { ControlButton, Panel } from '@xyflow/react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Magnet,
  type LucideIcon,
} from 'lucide-react';
import { useBoardSnap, type AlignMode } from '../../app/boards/align';

const TOOLS: { mode: AlignMode; label: string; Icon: LucideIcon; min?: number }[] = [
  { mode: 'left', label: 'Align left edges', Icon: AlignStartVertical },
  { mode: 'center', label: 'Align centres', Icon: AlignCenterVertical },
  { mode: 'right', label: 'Align right edges', Icon: AlignEndVertical },
  { mode: 'top', label: 'Align top edges', Icon: AlignStartHorizontal },
  { mode: 'middle', label: 'Align middles', Icon: AlignCenterHorizontal },
  { mode: 'bottom', label: 'Align bottom edges', Icon: AlignEndHorizontal },
  { mode: 'row', label: 'Space evenly across', Icon: AlignHorizontalDistributeCenter, min: 3 },
  { mode: 'column', label: 'Space evenly down', Icon: AlignVerticalDistributeCenter, min: 3 },
];

/** Shown while two cards or more are selected: line them up or space them evenly. */
export function AlignBar({
  count,
  onAlign,
}: {
  count: number;
  onAlign: (mode: AlignMode) => void;
}) {
  if (count < 2) return null;
  return (
    <Panel position="top-center">
      <div
        role="toolbar"
        aria-label="Align cards"
        className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-card"
      >
        <span className="px-1.5 text-xs text-muted">{count} cards</span>
        {TOOLS.map(({ mode, label, Icon, min = 2 }) => (
          <button
            key={mode}
            type="button"
            aria-label={label}
            title={label}
            disabled={count < min}
            onClick={() => {
              onAlign(mode);
            }}
            className="rounded p-1.5 text-muted hover:bg-sunken hover:text-text disabled:opacity-30"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
      </div>
    </Panel>
  );
}

/** The Controls button that turns snapping to the board's grid on and off. */
export function SnapButton() {
  const snap = useBoardSnap((s) => s.snap);
  const toggle = useBoardSnap((s) => s.toggle);
  return (
    <ControlButton
      onClick={toggle}
      aria-label="Snap to grid"
      aria-pressed={snap}
      title={snap ? 'Snapping to the grid (click to move freely)' : 'Snap to the grid'}
      className={snap ? 'bg-accent! text-accent-fg!' : ''}
    >
      <Magnet aria-hidden />
    </ControlButton>
  );
}
