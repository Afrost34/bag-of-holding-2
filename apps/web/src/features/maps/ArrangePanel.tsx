/** Lining up and spacing out several picked items. */
import { Button } from '@boh/ui';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  GripHorizontal,
  GripVertical,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { alignItems, distributeItems, removeItems, type AlignMode } from '../../app/maps/arrange';
import { Section } from './PanelParts';
import { type MapPanelsProps } from './panelTypes';

const ALIGNS: { mode: AlignMode; label: string; icon: LucideIcon }[] = [
  { mode: 'left', label: 'Align left edges', icon: AlignStartVertical },
  { mode: 'center', label: 'Align centres', icon: AlignCenterVertical },
  { mode: 'right', label: 'Align right edges', icon: AlignEndVertical },
  { mode: 'top', label: 'Align top edges', icon: AlignStartHorizontal },
  { mode: 'middle', label: 'Align middles', icon: AlignCenterHorizontal },
  { mode: 'bottom', label: 'Align bottom edges', icon: AlignEndHorizontal },
];

/** Shown while two or more items are picked (Shift+click adds to the pick). */
export function ArrangePanel({
  selectedIds,
  commit,
  onDeselect,
}: Pick<MapPanelsProps, 'selectedIds' | 'commit' | 'onDeselect'>) {
  return (
    <Section title="Selection">
      <p className="text-xs text-muted">
        {selectedIds.length} items picked. Drag one to move them all; Shift+click adds or removes
        one.
      </p>
      <div role="group" aria-label="Align" className="flex flex-wrap gap-1">
        {ALIGNS.map((a) => (
          <button
            key={a.mode}
            type="button"
            aria-label={a.label}
            title={a.label}
            onClick={() => {
              commit((d) => alignItems(d, selectedIds, a.mode));
            }}
            className="rounded-md border border-border p-2 text-muted hover:bg-sunken hover:text-text"
          >
            <a.icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
      </div>
      <div role="group" aria-label="Distribute" className="flex flex-wrap gap-1">
        <button
          type="button"
          aria-label="Space out horizontally"
          title="Space out horizontally (three or more)"
          disabled={selectedIds.length < 3}
          onClick={() => {
            commit((d) => distributeItems(d, selectedIds, 'x'));
          }}
          className="rounded-md border border-border p-2 text-muted hover:bg-sunken hover:text-text disabled:opacity-40"
        >
          <GripHorizontal className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Space out vertically"
          title="Space out vertically (three or more)"
          disabled={selectedIds.length < 3}
          onClick={() => {
            commit((d) => distributeItems(d, selectedIds, 'y'));
          }}
          className="rounded-md border border-border p-2 text-muted hover:bg-sunken hover:text-text disabled:opacity-40"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <Button
        variant="ghost"
        onClick={() => {
          commit((d) => removeItems(d, selectedIds));
          onDeselect();
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden /> Remove the {selectedIds.length} items
      </Button>
    </Section>
  );
}
