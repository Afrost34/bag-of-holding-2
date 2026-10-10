/** Scatter: presets, the pieces scattered, and the settings of a scatter you picked. */
import { Button, cn } from '@boh/ui';
import { Dices, Layers, Trash2 } from 'lucide-react';
import {
  bakeScatter,
  SCATTER_PRESETS,
  settingsFromPreset,
  type ScatterItem,
} from '../../app/maps/scatterDoc';
import { glyphRef, GLYPHS, isGlyphRef } from '../../app/maps/glyphs';
import { displayName, parsePackRef } from '../../app/maps/packModel';
import { type MapItem } from '../../app/maps/model';
import { TERRAINS, type TerrainId } from '../../app/maps/terrain';
import { Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';

/** The settings both a new scatter (the tool) and a picked one share. */
interface Controls {
  mode: 'area' | 'along';
  pieces: { ref: string; weight: number }[];
  spacing: number;
  sizeMin: number;
  sizeMax: number;
  rotation: 'none' | 'random' | 'along';
  cluster: number;
  offset: number;
  sides: 'center' | 'both' | 'left' | 'right';
  jitter: number;
  avoid: 'auto' | 'none';
  onlyOn?: TerrainId[] | undefined;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      {label}: {display ?? value}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="w-full"
      />
    </label>
  );
}

const pieceName = (ref: string): string => {
  if (isGlyphRef(ref)) return GLYPHS.find((g) => glyphRef(g.id) === ref)?.name ?? ref;
  const parsed = parsePackRef(ref);
  return displayName(parsed ? parsed.path : ref);
};

/** What is scattered: the built-in glyphs to switch on and off, and any stamp picked. */
function Pieces({
  pieces,
  stamp,
  onChange,
}: {
  pieces: Controls['pieces'];
  stamp: string | null;
  onChange: (pieces: Controls['pieces']) => void;
}) {
  const has = (ref: string) => pieces.some((p) => p.ref === ref);
  const toggle = (ref: string) => {
    if (!has(ref)) onChange([...pieces, { ref, weight: 1 }]);
    else if (pieces.length > 1) onChange(pieces.filter((p) => p.ref !== ref));
  };
  const custom = pieces.filter((p) => !isGlyphRef(p.ref));
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">Pieces</legend>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Built-in pieces">
        {GLYPHS.map((g) => {
          const ref = glyphRef(g.id);
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={has(ref)}
              onClick={() => {
                toggle(ref);
              }}
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs',
                has(ref) ? 'border-accent bg-accent-soft font-medium' : 'border-border text-muted',
              )}
            >
              {g.name}
            </button>
          );
        })}
      </div>
      {custom.length > 0 && (
        <ul aria-label="Stamps in the mix" className="flex flex-wrap gap-1">
          {custom.map((p) => (
            <li key={p.ref}>
              <button
                type="button"
                aria-label={`Remove ${pieceName(p.ref)} from the mix`}
                title="Remove from the mix"
                disabled={pieces.length <= 1}
                onClick={() => {
                  toggle(p.ref);
                }}
                className="rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-xs"
              >
                {pieceName(p.ref)} ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {stamp && !has(stamp) && (
        <Button
          variant="ghost"
          onClick={() => {
            onChange([...pieces, { ref: stamp, weight: 2 }]);
          }}
        >
          Add the stamp picked in Stamps
        </Button>
      )}
    </fieldset>
  );
}

function ScatterControls({
  value,
  stamp,
  onChange,
}: {
  value: Controls;
  stamp: string | null;
  onChange: (patch: Partial<Controls>) => void;
}) {
  return (
    <>
      <Pieces
        pieces={value.pieces}
        stamp={stamp}
        onChange={(pieces) => {
          onChange({ pieces });
        }}
      />
      <Slider
        label="Spacing"
        value={value.spacing}
        min={8}
        max={300}
        step={1}
        onChange={(spacing) => {
          onChange({ spacing });
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Smallest"
          value={value.sizeMin}
          min={6}
          max={300}
          step={1}
          onChange={(sizeMin) => {
            onChange({ sizeMin, sizeMax: Math.max(sizeMin, value.sizeMax) });
          }}
        />
        <Slider
          label="Largest"
          value={value.sizeMax}
          min={6}
          max={400}
          step={1}
          onChange={(sizeMax) => {
            onChange({ sizeMax, sizeMin: Math.min(sizeMax, value.sizeMin) });
          }}
        />
      </div>
      {value.mode === 'area' ? (
        <Slider
          label="Groves and clearings"
          value={value.cluster}
          min={0}
          max={1}
          step={0.05}
          display={`${String(Math.round(value.cluster * 100))}%`}
          onChange={(cluster) => {
            onChange({ cluster });
          }}
        />
      ) : (
        <>
          <label className="block text-sm">
            Stand
            <select
              value={value.sides}
              aria-label="Which side of the line"
              onChange={(e) => {
                onChange({ sides: e.target.value as Controls['sides'] });
              }}
              className={field}
            >
              <option value="center">On the line</option>
              <option value="both">Both sides</option>
              <option value="left">Left side</option>
              <option value="right">Right side</option>
            </select>
          </label>
          {value.sides !== 'center' && (
            <Slider
              label="Distance from the line"
              value={value.offset}
              min={0}
              max={300}
              step={1}
              onChange={(offset) => {
                onChange({ offset });
              }}
            />
          )}
          <Slider
            label="Wandering"
            value={value.jitter}
            min={0}
            max={1}
            step={0.05}
            display={`${String(Math.round(value.jitter * 100))}%`}
            onChange={(jitter) => {
              onChange({ jitter });
            }}
          />
        </>
      )}
      <label className="block text-sm">
        Turned
        <select
          value={value.rotation}
          aria-label="Rotation of pieces"
          onChange={(e) => {
            onChange({ rotation: e.target.value as Controls['rotation'] });
          }}
          className={field}
        >
          <option value="none">Upright</option>
          <option value="random">Any way (rocks, top-down pictures)</option>
          {value.mode === 'along' && <option value="along">Along the line</option>}
        </select>
      </label>
      <label className="block text-sm">
        Only on
        <select
          value={value.onlyOn?.[0] ?? ''}
          aria-label="Only on this ground"
          onChange={(e) => {
            const id = e.target.value;
            onChange({ onlyOn: id ? [id as TerrainId] : undefined });
          }}
          className={field}
        >
          <option value="">Any ground</option>
          {TERRAINS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.avoid === 'auto'}
          onChange={(e) => {
            onChange({ avoid: e.target.checked ? 'auto' : 'none' });
          }}
          className="mt-1"
        />
        Keep clear of roads, trails, rivers and water (it follows them when they move)
      </label>
    </>
  );
}

/** The panel of the Scatter tool: pick a preset, adjust it, then draw where it goes. */
export function ScatterPanel({ scatter, setScatter, stamp }: MapPanelsProps) {
  return (
    <Section title="Scatter">
      <div role="radiogroup" aria-label="Scatter preset" className="grid grid-cols-2 gap-1">
        {SCATTER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={scatter.preset === p.id}
            title={p.hint}
            onClick={() => {
              setScatter(settingsFromPreset(p, scatter.scale));
            }}
            className={cn(
              'rounded-md border px-2 py-1.5 text-left text-sm',
              scatter.preset === p.id
                ? 'border-accent bg-accent-soft font-medium'
                : 'border-border text-muted hover:bg-sunken',
            )}
          >
            {p.name}
            <span className="block text-[11px] font-normal text-muted">{p.hint}</span>
          </button>
        ))}
      </div>
      <Slider
        label="Size of everything"
        value={scatter.scale}
        min={0.25}
        max={4}
        step={0.05}
        display={`×${scatter.scale.toFixed(2)}`}
        onChange={(scale) => {
          setScatter({ ...scatter, scale });
        }}
      />
      <ScatterControls
        value={scatter}
        stamp={stamp}
        onChange={(patch) => {
          setScatter({ ...scatter, ...patch });
        }}
      />
      <p className="text-xs text-muted">
        {scatter.mode === 'area'
          ? 'Click the corners of the area to fill; double-click or Enter finishes, Escape cancels.'
          : 'Click along the line to follow; double-click or Enter finishes, Escape cancels.'}{' '}
        Or pick a shape or a road with Select and press its Scatter button.
      </p>
    </Section>
  );
}

/** The settings of a picked scatter: change them, roll again, or turn it into loose stamps. */
export function ScatterItemSettings({
  item,
  stamp,
  set,
  commit,
}: {
  item: ScatterItem;
  stamp: string | null;
  set: (change: (i: MapItem) => MapItem) => void;
  commit: MapPanelsProps['commit'];
}) {
  const change = (patch: Partial<Controls>) => {
    set((i) => {
      if (i.kind !== 'scatter') return i;
      const { onlyOn: _old, ...rest } = i;
      const next = { ...rest, ...patch };
      // `onlyOn: undefined` clears it.
      return next as MapItem;
    });
  };
  return (
    <>
      {(item.within ?? item.follow) && (
        <p className="text-xs text-muted">
          {item.within ? 'Fills a shape' : 'Follows a road or river'}: reshape that, and this
          follows.
        </p>
      )}
      <ScatterControls value={item} stamp={stamp} onChange={change} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            set((i) =>
              i.kind === 'scatter' ? { ...i, seed: Math.floor(Math.random() * 1e9) } : i,
            );
          }}
        >
          <Dices className="h-4 w-4" aria-hidden /> Roll again
        </Button>
        <Button
          variant="ghost"
          title="Turn the pieces into loose stamps you can move one by one"
          onClick={() => {
            commit((d) => bakeScatter(d, item.id));
          }}
        >
          <Layers className="h-4 w-4" aria-hidden /> Bake into stamps
        </Button>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted">
        <Trash2 className="h-3 w-3" aria-hidden /> Remove deletes the whole scatter.
      </p>
    </>
  );
}
