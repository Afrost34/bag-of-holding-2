/** Settings of the terrain shape and road/river tools, the island generator, and picked shapes. */
import { Button, cn } from '@boh/ui';
import { Dices, PaintBucket, Scissors, Trees } from 'lucide-react';
import { useState } from 'react';
import { type MapItem } from '../../app/maps/model';
import { PATH_ENDS, type PathEnd } from '../../app/maps/pathEnds';
import { PATH_STYLES, type PathStyle } from '../../app/maps/shapes';
import { TERRAINS, type TerrainRef } from '../../app/maps/terrain';
import { Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';
import { PackTextures } from './PackTextures';
import { TerrainSwatch } from './ToolSettings';

const EDGES = [
  ['shore', 'Coast', 'a shallow-water glow and wave lines'],
  ['ink', 'Ink line', 'a thin dark outline'],
  ['dashed', 'Dashed border', 'a dashed line, as on a map of regions'],
  ['none', 'None', 'no outline'],
] as const;

/** How a path begins and ends, and whether it closes into a ring (Dungeondraft's In, Out and loop). */
function PathEndsFields({
  start,
  end,
  loop,
  onChange,
}: {
  start: PathEnd;
  end: PathEnd;
  loop: boolean;
  onChange: (change: { start?: PathEnd; end?: PathEnd; loop?: boolean }) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(['start', 'end'] as const).map((which) => (
          <label key={which} className="block text-sm">
            {which === 'start' ? 'Begins' : 'Ends'}
            <select
              aria-label={which === 'start' ? 'Path begins' : 'Path ends'}
              value={which === 'start' ? start : end}
              onChange={(e) => {
                onChange({ [which]: e.target.value as PathEnd });
              }}
              className={field}
            >
              {PATH_ENDS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => {
            onChange({ loop: e.target.checked });
          }}
        />
        Close the loop
      </label>
    </>
  );
}

export function TerrainPicker({
  value,
  onPick,
}: {
  value: TerrainRef | undefined;
  onPick: (id: TerrainRef, base: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Terrain">
        {TERRAINS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={value === t.id}
            onClick={() => {
              onPick(t.id, t.base);
            }}
            className={cn(
              'overflow-hidden rounded-md border-2 text-left text-xs',
              value === t.id ? 'border-accent' : 'border-border',
            )}
          >
            <TerrainSwatch id={t.id} />
            <span className="block truncate px-1 py-0.5">{t.name}</span>
          </button>
        ))}
      </div>
      <PackTextures
        value={value}
        onPick={(ref) => {
          onPick(ref, '#9a958d');
        }}
      />
    </>
  );
}

export function Slider({
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

/** A random island or archipelago: one click, then drag its points to taste. */
function IslandGenerator({ onGenerate }: Pick<MapPanelsProps, 'onGenerate'>) {
  const [size, setSize] = useState(0.18);
  const [ruggedness, setRuggedness] = useState(0.5);
  const [elongation, setElongation] = useState(0.2);
  const [count, setCount] = useState(1);
  return (
    <Section title="Random island">
      <p className="text-xs text-muted">
        Makes land with the terrain and edge above, in the middle of what you see. Each click is a
        new island; edit it by dragging its points.
      </p>
      <Slider
        label="Size"
        value={size}
        min={0.05}
        max={0.4}
        step={0.01}
        display={`${String(Math.round(size * 100))}%`}
        onChange={setSize}
      />
      <Slider
        label="Ruggedness"
        value={ruggedness}
        min={0}
        max={1}
        step={0.05}
        display={`${String(Math.round(ruggedness * 100))}%`}
        onChange={setRuggedness}
      />
      <Slider
        label="Elongation"
        value={elongation}
        min={0}
        max={1}
        step={0.05}
        display={`${String(Math.round(elongation * 100))}%`}
        onChange={setElongation}
      />
      <Slider label="Islands" value={count} min={1} max={9} step={1} onChange={setCount} />
      <Button
        variant="ghost"
        onClick={() => {
          onGenerate({
            size,
            ruggedness,
            elongation,
            count,
            seed: Math.floor(Math.random() * 1e9),
          });
        }}
      >
        <Dices className="h-4 w-4" aria-hidden /> Generate an island
      </Button>
    </Section>
  );
}

/** The panel of the terrain shape tool and of the road and river tool. */
export function ShapePanel(props: MapPanelsProps) {
  const { tool, area, setArea, pathSet, setPathSet, onGenerate, onFillMap } = props;
  if (tool === 'path')
    return (
      <Section title="Road or river">
        <label className="block text-sm">
          Kind
          <select
            value={pathSet.style}
            aria-label="Path kind"
            onChange={(e) => {
              const style = e.target.value as PathStyle;
              const def = PATH_STYLES.find((s) => s.id === style);
              setPathSet({ ...pathSet, style, width: def?.width ?? pathSet.width });
            }}
            className={field}
          >
            {PATH_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <Slider
          label="Width"
          value={pathSet.width}
          min={2}
          max={160}
          step={1}
          onChange={(width) => {
            setPathSet({ ...pathSet, width });
          }}
        />
        <Slider
          label="Curve"
          value={pathSet.smooth}
          min={0}
          max={1}
          step={0.05}
          display={`${String(Math.round(pathSet.smooth * 100))}%`}
          onChange={(smooth) => {
            setPathSet({ ...pathSet, smooth });
          }}
        />
        {pathSet.style === 'river' && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pathSet.taper}
              onChange={(e) => {
                setPathSet({ ...pathSet, taper: e.target.checked });
              }}
            />
            Widens downstream (draw from the source to the sea)
          </label>
        )}
        <PathEndsFields
          start={pathSet.start}
          end={pathSet.end}
          loop={pathSet.loop}
          onChange={(change) => {
            setPathSet({ ...pathSet, ...change });
          }}
        />
        <p className="text-xs text-muted">
          Click to place points; double-click or Enter finishes, Escape cancels.
          {pathSet.style === 'river' ? ' End next to another river to join it.' : ''} Pick it with
          Select to drag its points (double-click a line to add one, right-click a point to remove
          it).
        </p>
      </Section>
    );
  return (
    <>
      <Section title="Terrain shape">
        <TerrainPicker
          value={area.texture}
          onPick={(texture) => {
            setArea({ ...area, texture });
          }}
        />
        <div role="radiogroup" aria-label="Edge" className="grid grid-cols-2 gap-1">
          {EDGES.map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={area.edge === id}
              title={hint}
              onClick={() => {
                setArea({ ...area, edge: id });
              }}
              className={cn(
                'rounded-md border px-2 py-1.5 text-sm',
                area.edge === id
                  ? 'border-accent bg-accent-soft font-medium'
                  : 'border-border text-muted hover:bg-sunken',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Slider
          label="Roundness"
          value={area.smooth}
          min={0}
          max={1}
          step={0.05}
          display={`${String(Math.round(area.smooth * 100))}%`}
          onChange={(smooth) => {
            setArea({ ...area, smooth });
          }}
        />
        <p className="text-xs text-muted">
          Click to place points; double-click or Enter closes the shape, Escape cancels. Pick it
          with Select to drag its points (double-click an edge to add one, right-click a point to
          remove it).
        </p>
        <Button variant="ghost" onClick={onFillMap}>
          <PaintBucket className="h-4 w-4" aria-hidden /> Cover the whole map
        </Button>
      </Section>
      <IslandGenerator onGenerate={onGenerate} />
    </>
  );
}

/** The settings of a picked terrain shape or road/river. */
export function ShapeItemSettings({
  item,
  set,
  onScatter,
  onCutHole,
}: {
  item: Extract<MapItem, { kind: 'shape' | 'path' }>;
  set: (change: (i: MapItem) => MapItem) => void;
  /** Trees, rocks… inside this shape, or along this path. */
  onScatter: () => void;
  /** Draw an area to cut out of this shape. */
  onCutHole: () => void;
}) {
  if (item.kind === 'shape')
    return (
      <>
        <TerrainPicker
          value={item.texture}
          onPick={(texture, base) => {
            set((i) => (i.kind === 'shape' ? { ...i, texture, color: base } : i));
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          Plain colour (a region)
          <input
            type="color"
            aria-label="Fill colour"
            value={item.color}
            onChange={(e) => {
              const color = e.target.value;
              set((i) => {
                if (i.kind !== 'shape') return i;
                const { texture: _t, ...rest } = i;
                return { ...rest, color };
              });
            }}
            className="h-7 w-9 cursor-pointer rounded border border-border bg-surface"
          />
        </label>
        <div role="radiogroup" aria-label="Edge" className="grid grid-cols-2 gap-1">
          {EDGES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={item.edge === id}
              onClick={() => {
                set((i) => (i.kind === 'shape' ? { ...i, edge: id } : i));
              }}
              className={cn(
                'rounded-md border px-2 py-1.5 text-sm',
                item.edge === id
                  ? 'border-accent bg-accent-soft font-medium'
                  : 'border-border text-muted hover:bg-sunken',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Slider
          label="Roundness"
          value={item.smooth}
          min={0}
          max={1}
          step={0.05}
          display={`${String(Math.round(item.smooth * 100))}%`}
          onChange={(smooth) => {
            set((i) => (i.kind === 'shape' ? { ...i, smooth } : i));
          }}
        />
        <Slider
          label="Opacity"
          value={item.opacity}
          min={0.1}
          max={1}
          step={0.05}
          display={`${String(Math.round(item.opacity * 100))}%`}
          onChange={(opacity) => {
            set((i) => (i.kind === 'shape' ? { ...i, opacity } : i));
          }}
        />
        <Button variant="ghost" onClick={onCutHole}>
          <Scissors className="h-4 w-4" aria-hidden /> Cut a hole
        </Button>
        {(item.holes?.length ?? 0) > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              set((i) => {
                if (i.kind !== 'shape') return i;
                const { holes: _holes, ...rest } = i;
                return rest;
              });
            }}
          >
            Fill the {item.holes?.length} {item.holes?.length === 1 ? 'hole' : 'holes'}
          </Button>
        )}
        <Button variant="ghost" onClick={onScatter}>
          <Trees className="h-4 w-4" aria-hidden /> Scatter inside this
        </Button>
      </>
    );
  return (
    <>
      <label className="block text-sm">
        Kind
        <select
          value={item.style}
          aria-label="Path kind"
          onChange={(e) => {
            const style = e.target.value as PathStyle;
            const def = PATH_STYLES.find((s) => s.id === style);
            set((i) => (i.kind === 'path' ? { ...i, style, color: def?.color ?? i.color } : i));
          }}
          className={field}
        >
          {PATH_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Slider
        label="Width"
        value={item.width}
        min={2}
        max={160}
        step={1}
        onChange={(width) => {
          set((i) => (i.kind === 'path' ? { ...i, width } : i));
        }}
      />
      <Slider
        label="Curve"
        value={item.smooth}
        min={0}
        max={1}
        step={0.05}
        display={`${String(Math.round(item.smooth * 100))}%`}
        onChange={(smooth) => {
          set((i) => (i.kind === 'path' ? { ...i, smooth } : i));
        }}
      />
      {item.style === 'river' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={item.taper !== false}
            onChange={(e) => {
              const taper = e.target.checked;
              set((i) => (i.kind === 'path' ? { ...i, taper } : i));
            }}
          />
          Widens downstream
        </label>
      )}
      <PathEndsFields
        start={item.start ?? 'hard'}
        end={item.end ?? 'hard'}
        loop={item.loop === true}
        onChange={(change) => {
          set((i) => {
            if (i.kind !== 'path') return i;
            const next = { ...i, ...change };
            if (next.start === 'hard') delete next.start;
            if (next.end === 'hard') delete next.end;
            if (!next.loop) delete next.loop;
            return next;
          });
        }}
      />
      <Button variant="ghost" onClick={onScatter}>
        <Trees className="h-4 w-4" aria-hidden /> Scatter along this
      </Button>
    </>
  );
}
