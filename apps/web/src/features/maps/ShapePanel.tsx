/** Settings of the terrain shape and road/river tools, the island generator, and picked shapes. */
import { Button, cn } from '@boh/ui';
import { Dices, PaintBucket } from 'lucide-react';
import { useState } from 'react';
import { type MapItem } from '../../app/maps/model';
import { PATH_STYLES, type PathStyle } from '../../app/maps/shapes';
import { TERRAINS, type TerrainId } from '../../app/maps/terrain';
import { Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';
import { TerrainSwatch } from './ToolSettings';

const EDGES = [
  ['shore', 'Coast', 'a shallow-water glow and wave lines'],
  ['ink', 'Ink line', 'a thin dark outline'],
  ['none', 'None', 'no outline'],
] as const;

function TerrainPicker({
  value,
  onPick,
}: {
  value: TerrainId | undefined;
  onPick: (id: TerrainId, base: string) => void;
}) {
  return (
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
  );
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
        <div role="radiogroup" aria-label="Edge" className="grid grid-cols-3 gap-1">
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
}: {
  item: Extract<MapItem, { kind: 'shape' | 'path' }>;
  set: (change: (i: MapItem) => MapItem) => void;
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
        <div role="radiogroup" aria-label="Edge" className="grid grid-cols-3 gap-1">
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
    </>
  );
}
