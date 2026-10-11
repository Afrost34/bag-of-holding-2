import { cn } from '@boh/ui';
import { useShowDrawn } from '../../app/maps/artPrefs';
import { AssetGrid } from './AssetGrid';
import { Section } from './PanelParts';
import type { MapPanelsProps } from './panelTypes';

/**
 * Wall styles from the imported packs: every wall's "Straight path" strip (stone, brick, wood, in
 * every colour). "Plain line" is the drawn wall that needs no pack.
 */
export function WallStrips({
  value,
  onPick,
}: {
  value: string | undefined;
  onPick: (ref: string | undefined) => void;
}) {
  const drawn = useShowDrawn();
  return (
    <div className="space-y-1.5">
      {drawn && (
        <button
          type="button"
          aria-pressed={value === undefined}
          onClick={() => {
            onPick(undefined);
          }}
          className={cn(
            'w-full rounded-md border-2 px-2 py-1 text-left text-xs',
            value === undefined ? 'border-accent' : 'border-border',
          )}
        >
          Plain line
        </button>
      )}
      <AssetGrid
        cats={['walls']}
        label="Wall styles"
        value={value}
        columns={2}
        onPick={(_, ref) => {
          onPick(ref);
        }}
        emptyHint="No wall styles yet. Import an asset pack to build walls of stone, brick and wood."
      />
    </div>
  );
}

/** The Wall tool's panel: which wall the next walls are made of. */
export function WallPanel({ roomSet, setRoomSet }: MapPanelsProps) {
  return (
    <Section title="Wall">
      <p className="text-xs text-muted">
        Click to add points, double-click or Enter to finish, Esc to cancel.
      </p>
      <WallStrips
        value={roomSet.wallTexture}
        onPick={(wallTexture) => {
          const { wallTexture: _w, ...rest } = roomSet;
          setRoomSet(wallTexture ? { ...rest, wallTexture } : rest);
        }}
      />
    </Section>
  );
}
