/** Lights and the ambient light of a map (Dungeondraft's light tool and environment). */
import { AMBIENTS } from '../../app/maps/lighting';
import { type MapDoc, type MapItem } from '../../app/maps/model';
import { Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';

/** The settings both a new light (the tool) and a picked one share. */
interface Controls {
  /** Range in grid squares. */
  squares: number;
  color: string;
  intensity: number;
  shadows: boolean;
}

function LightControls({
  value,
  onChange,
}: {
  value: Controls;
  onChange: (patch: Partial<Controls>) => void;
}) {
  return (
    <>
      <label className="block text-sm">
        Range: {Math.round(value.squares * 5) / 5} squares
        <input
          type="range"
          aria-label="Light range"
          min={1}
          max={40}
          step={0.5}
          value={value.squares}
          onChange={(e) => {
            onChange({ squares: Number(e.target.value) });
          }}
          className="w-full"
        />
      </label>
      <label className="block text-sm">
        Brightness: {Math.round(value.intensity * 100)}%
        <input
          type="range"
          aria-label="Light brightness"
          min={10}
          max={100}
          step={5}
          value={Math.round(value.intensity * 100)}
          onChange={(e) => {
            onChange({ intensity: Number(e.target.value) / 100 });
          }}
          className="w-full"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        Colour
        <input
          type="color"
          aria-label="Light colour"
          value={value.color}
          onChange={(e) => {
            onChange({ color: e.target.value });
          }}
          className="h-7 w-9 cursor-pointer rounded border border-border bg-surface"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.shadows}
          onChange={(e) => {
            onChange({ shadows: e.target.checked });
          }}
        />
        Walls cast shadows
      </label>
    </>
  );
}

/** The Light tool: what the next light placed is like, and the ambient light. */
export function LightPanel({ light, setLight, doc, commit }: MapPanelsProps) {
  return (
    <>
      <Section title="Light">
        <LightControls
          value={light}
          onChange={(patch) => {
            setLight({ ...light, ...patch });
          }}
        />
        <p className="text-xs text-muted">
          Click to place a light. Lights show where the ambient light is dark: set it below (Night,
          Dusk…). Closed doors and walls throw shadows; archways let light through.
        </p>
      </Section>
      <AmbientSettings doc={doc} commit={commit} />
    </>
  );
}

/** A picked light. */
export function LightItemSettings({
  item,
  grid,
  set,
}: {
  item: Extract<MapItem, { kind: 'light' }>;
  grid: number;
  set: (change: (i: MapItem) => MapItem) => void;
}) {
  return (
    <LightControls
      value={{
        squares: item.range / grid,
        color: item.color,
        intensity: item.intensity,
        shadows: item.shadows,
      }}
      onChange={(patch) => {
        set((i) => {
          if (i.kind !== 'light') return i;
          const { squares, ...rest } = patch;
          return {
            ...i,
            ...rest,
            ...(squares !== undefined ? { range: Math.round(squares * grid) } : {}),
          };
        });
      }}
    />
  );
}

/** The light everywhere before any light is added. */
export function AmbientSettings({
  doc,
  commit,
}: {
  doc: MapDoc;
  commit: MapPanelsProps['commit'];
}) {
  const current = AMBIENTS.find((a) => a.color === (doc.ambient ?? null))?.id ?? 'custom';
  const set = (color: string | null) => {
    commit((d) => {
      const { ambient: _old, ...rest } = d;
      return color ? { ...rest, ambient: color } : rest;
    });
  };
  return (
    <Section title="Ambient light">
      <select
        aria-label="Ambient preset"
        value={current}
        onChange={(e) => {
          const pick = AMBIENTS.find((a) => a.id === e.target.value);
          if (pick) set(pick.color);
        }}
        className={field}
      >
        {AMBIENTS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
        {current === 'custom' && <option value="custom">Custom colour</option>}
      </select>
      <label className="flex items-center gap-2 text-sm">
        Colour
        <input
          type="color"
          aria-label="Ambient colour"
          value={doc.ambient ?? '#ffffff'}
          onChange={(e) => {
            set(e.target.value);
          }}
          className="h-7 w-9 cursor-pointer rounded border border-border bg-surface"
        />
      </label>
    </Section>
  );
}
