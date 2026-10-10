/** Elevation: paint hills and valleys, see them as hill shading, or make terrain from noise. */
import { Button, cn } from '@boh/ui';
import { Dices, Mountain, Trash2, Waves } from 'lucide-react';
import { useState } from 'react';
import {
  encodeHeights,
  flatElevation,
  generateHeights,
  heightsOf,
  riversFromHeights,
  type BrushMode,
  type Elevation,
} from '../../app/maps/elevation';
import { addItem, itemId } from '../../app/maps/model';
import { Section } from './PanelParts';
import { type MapPanelsProps } from './panelTypes';
import { Slider } from './ShapePanel';

const MODES: { id: BrushMode; name: string; hint: string }[] = [
  { id: 'raise', name: 'Raise', hint: 'hills and mountains' },
  { id: 'lower', name: 'Lower', hint: 'valleys, lakes, seas' },
  { id: 'smooth', name: 'Smooth', hint: 'soften what is rough' },
  { id: 'flatten', name: 'Flatten', hint: 'plains at the height you start on' },
];

export function ElevationPanel({ doc, commit, elev, setElev, layerId }: MapPanelsProps) {
  const e = doc.elevation;
  const [roughness, setRoughness] = useState(0.55);
  const [island, setIsland] = useState(true);
  const [rivers, setRivers] = useState(4);
  /** Rivers that run downhill from the heights, as paths on the layer. */
  const makeRivers = () => {
    commit((d) => {
      const el = d.elevation;
      if (!el) return d;
      const lines = riversFromHeights(el, heightsOf(el), {
        seed: Math.floor(Math.random() * 1e9),
        count: rivers,
        minLength: 10,
      });
      let next = d;
      for (const points of lines)
        next = addItem(next, layerId, {
          kind: 'path',
          id: itemId(next),
          points,
          smooth: 0.6,
          style: 'river',
          width: Math.max(14, Math.round(el.cell * 2.2)),
          color: '#3d7fb0',
          taper: true,
        });
      return next;
    });
  };
  const set = (patch: Partial<Elevation>) => {
    commit((d) => (d.elevation ? { ...d, elevation: { ...d.elevation, ...patch } } : d));
  };
  const generate = () => {
    commit((d) => {
      const base = d.elevation ?? flatElevation(d.width, d.height);
      const heights = generateHeights(base, {
        seed: Math.floor(Math.random() * 1e9),
        roughness,
        island,
      });
      return { ...d, elevation: { ...base, data: encodeHeights(heights), tint: true } };
    });
  };
  return (
    <>
      {e ? (
        <Section title="Elevation">
          <div role="radiogroup" aria-label="Elevation brush" className="grid grid-cols-2 gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={elev.mode === m.id}
                title={m.hint}
                onClick={() => {
                  setElev({ ...elev, mode: m.id });
                }}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-left text-sm',
                  elev.mode === m.id
                    ? 'border-accent bg-accent-soft font-medium'
                    : 'border-border text-muted hover:bg-sunken',
                )}
              >
                {m.name}
                <span className="block text-[11px] font-normal text-muted">{m.hint}</span>
              </button>
            ))}
          </div>
          <Slider
            label="Brush size"
            value={elev.radius}
            min={20}
            max={600}
            step={5}
            onChange={(radius) => {
              setElev({ ...elev, radius });
            }}
          />
          <Slider
            label="Brush strength"
            value={elev.strength}
            min={0.05}
            max={1}
            step={0.05}
            display={`${String(Math.round(elev.strength * 100))}%`}
            onChange={(strength) => {
              setElev({ ...elev, strength });
            }}
          />
          <p className="text-xs text-muted">
            Drag on the map to paint. Undo takes a stroke back. Hills lit from the north-west.
          </p>
        </Section>
      ) : (
        <Section title="Elevation">
          <p className="text-xs text-muted">
            Heights under the map, drawn as hill shading: how mountains and valleys look from above.
            Optional: a map without it stays flat.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              commit((d) => ({ ...d, elevation: flatElevation(d.width, d.height) }));
            }}
          >
            <Mountain className="h-4 w-4" aria-hidden /> Start with flat land
          </Button>
        </Section>
      )}
      <Section title="Make terrain">
        <Slider
          label="Roughness"
          value={roughness}
          min={0}
          max={1}
          step={0.05}
          display={`${String(Math.round(roughness * 100))}%`}
          onChange={setRoughness}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={island}
            onChange={(ev) => {
              setIsland(ev.target.checked);
            }}
          />
          A landmass with sea round it
        </label>
        <Button variant="ghost" onClick={generate}>
          <Dices className="h-4 w-4" aria-hidden /> Generate terrain
        </Button>
      </Section>
      {e && (
        <Section title="Rivers">
          <Slider label="How many" value={rivers} min={1} max={12} step={1} onChange={setRivers} />
          <Button variant="ghost" onClick={makeRivers}>
            <Waves className="h-4 w-4" aria-hidden /> Make rivers that run downhill
          </Button>
          <p className="text-xs text-muted">
            They start on the high ground and follow the slope to the sea. Pick one to reshape it.
          </p>
        </Section>
      )}
      {e && (
        <Section title="Look">
          <Slider
            label="How much it shows"
            value={e.strength}
            min={0}
            max={1}
            step={0.05}
            display={`${String(Math.round(e.strength * 100))}%`}
            onChange={(strength) => {
              set({ strength });
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={e.tint}
              onChange={(ev) => {
                set({ tint: ev.target.checked });
              }}
            />
            Colour by height (sea, lowland, hills, snow)
          </label>
          <Slider
            label="Contour lines every"
            value={e.contours ?? 0}
            min={0}
            max={60}
            step={5}
            display={e.contours ? String(e.contours) : 'off'}
            onChange={(contours) => {
              commit((d) => {
                if (!d.elevation) return d;
                const { contours: _old, ...rest } = d.elevation;
                return { ...d, elevation: contours > 0 ? { ...rest, contours } : rest };
              });
            }}
          />
          {e.tint && (
            <Slider
              label="Sea level"
              value={e.sea}
              min={0}
              max={200}
              step={1}
              onChange={(sea) => {
                set({ sea });
              }}
            />
          )}
          <Button
            variant="ghost"
            onClick={() => {
              commit((d) => {
                const { elevation: _e, ...rest } = d;
                return rest;
              });
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Remove the elevation
          </Button>
        </Section>
      )}
    </>
  );
}
