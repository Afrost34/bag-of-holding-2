import { useShowDrawn } from '../../app/maps/artPrefs';
import { squaresOf } from '../../app/maps/packModel';
import { AssetGrid } from './AssetGrid';
import { Section } from './PanelParts';
import type { MapPanelsProps } from './panelTypes';
import { RoomPanel } from './RoomPanel';

/**
 * The Portal tool: doors and windows of the packs. Picking one and clicking near a wall puts it on
 * the wall, turned along it. (The drawn doors of rooms are offered only with the drawn art.)
 */
export function PortalPanel(props: MapPanelsProps) {
  const drawn = useShowDrawn();
  return (
    <>
      <Section title="Portal">
        <p className="text-xs text-muted">
          Pick a door or window, then click on a wall. It snaps to the wall and turns along it.
        </p>
        <AssetGrid
          cats={['doors', 'windows']}
          label="Doors and windows"
          value={props.stamp ?? undefined}
          columns={3}
          onPick={(entry, ref) => {
            const squares = squaresOf(entry.path);
            props.setStamp(ref, squares ? squares.w / squares.h : 1, squares ?? undefined);
          }}
          emptyHint="No doors yet. Import an asset pack to place its doors and windows."
        />
      </Section>
      {drawn && <RoomPanel {...props} />}
    </>
  );
}
