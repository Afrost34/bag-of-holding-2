import type { MapItem } from '../../app/maps/model';
import { NumberField } from './PanelParts';
import { field } from './panelTypes';

type MapText = Extract<MapItem, { kind: 'text' }>;

/** Old-map ink: what region names are lettered in. */
const INK = '#2b1d0e';

/** How a text is lettered: bold, or as a region's name on an old map, spaced, turned and bent. */
export function TextLettering({
  item,
  set,
}: {
  item: MapText;
  set: (change: (i: MapItem) => MapItem) => void;
}) {
  const change = (patch: Partial<MapText>) => {
    set((i) => (i.kind === 'text' ? { ...i, ...patch } : i));
  };
  return (
    <>
      <label className="block text-sm">
        Lettering
        <select
          value={item.font ?? 'bold'}
          onChange={(e) => {
            if (e.target.value === 'fantasy')
              // A region's name: inked, letters spaced out.
              change({ font: 'fantasy', color: INK, spacing: item.spacing ?? 30 });
            else
              set((i) => {
                if (i.kind !== 'text') return i;
                const { font: _was, ...rest } = i;
                return rest;
              });
          }}
          className={field}
        >
          <option value="bold">Bold</option>
          <option value="fantasy">Old map (region names)</option>
        </select>
      </label>
      <label className="block text-sm">
        Letter spacing: {item.spacing ?? 0}
        <input
          type="range"
          min={0}
          max={150}
          value={item.spacing ?? 0}
          onChange={(e) => {
            change({ spacing: Number(e.target.value) });
          }}
          className="w-full"
        />
      </label>
      <label className="block text-sm">
        Curve: {item.curve ?? 0}
        <input
          type="range"
          min={-100}
          max={100}
          value={item.curve ?? 0}
          onChange={(e) => {
            change({ curve: Number(e.target.value) });
          }}
          className="w-full"
        />
      </label>
      <NumberField
        label="Rotation (degrees)"
        value={item.rotation ?? 0}
        step={5}
        onChange={(v) => {
          change({ rotation: ((((v + 180) % 360) + 360) % 360) - 180 });
        }}
      />
    </>
  );
}
