/** Town building: districts that generate streets and houses, and buildings drawn or saved by hand. */
import { Button, cn } from '@boh/ui';
import { Castle, Dices, Hammer, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBuildings } from '../../app/maps/buildings';
import {
  bakeDistrict,
  DISTRICT_STYLES,
  ROOF_STYLES,
  settingsFromStyle,
  type BuildingItem,
  type DistrictItem,
  type DistrictStyleId,
  type RoofStyle,
} from '../../app/maps/cityDoc';
import { type MapItem } from '../../app/maps/model';
import { Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';

const ROOF_COLORS = ['#b5543a', '#c9a15a', '#8a6a4a', '#5f6b7a', '#6a6a6a', '#3f6f7a', '#7a8a4a'];

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

const percent = (v: number) => `${String(Math.round(v * 100))}%`;

/** The numbers a district is made from, shared by the tool and a picked district. */
interface DistrictControlsValue {
  blockSize: number;
  streetWidth: number;
  density: number;
  jitter: number;
  angle: number;
  plaza: number;
  wall: boolean;
  avoid: 'auto' | 'none';
}

function DistrictControls({
  value,
  onChange,
}: {
  value: DistrictControlsValue;
  onChange: (patch: Partial<DistrictControlsValue>) => void;
}) {
  return (
    <>
      <Slider
        label="Distance between streets"
        value={value.blockSize}
        min={40}
        max={500}
        step={5}
        onChange={(blockSize) => {
          onChange({ blockSize });
        }}
      />
      <Slider
        label="Street width"
        value={value.streetWidth}
        min={4}
        max={60}
        step={1}
        onChange={(streetWidth) => {
          onChange({ streetWidth });
        }}
      />
      <Slider
        label="Built up"
        value={value.density}
        min={0.2}
        max={1}
        step={0.05}
        display={percent(value.density)}
        onChange={(density) => {
          onChange({ density });
        }}
      />
      <Slider
        label="Crookedness"
        value={value.jitter}
        min={0}
        max={1}
        step={0.05}
        display={percent(value.jitter)}
        onChange={(jitter) => {
          onChange({ jitter });
        }}
      />
      <Slider
        label="Direction of the streets"
        value={value.angle}
        min={0}
        max={90}
        step={1}
        display={`${String(value.angle)}°`}
        onChange={(angle) => {
          onChange({ angle });
        }}
      />
      <Slider
        label="Open square in the middle"
        value={value.plaza}
        min={0}
        max={0.8}
        step={0.05}
        display={value.plaza === 0 ? 'none' : percent(value.plaza)}
        onChange={(plaza) => {
          onChange({ plaza });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.wall}
          onChange={(e) => {
            onChange({ wall: e.target.checked });
          }}
        />
        A wall with towers round it
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
        Keep off roads, rivers and water (houses move aside when they do)
      </label>
    </>
  );
}

function StyleCards({
  value,
  onPick,
}: {
  value: DistrictStyleId;
  onPick: (style: DistrictStyleId) => void;
}) {
  return (
    <div role="radiogroup" aria-label="District style" className="grid grid-cols-2 gap-1">
      {(Object.keys(DISTRICT_STYLES) as DistrictStyleId[]).map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => {
            onPick(id);
          }}
          className={cn(
            'rounded-md border px-2 py-1.5 text-left text-sm',
            value === id
              ? 'border-accent bg-accent-soft font-medium'
              : 'border-border text-muted hover:bg-sunken',
          )}
        >
          {DISTRICT_STYLES[id].name}
          <span className="block text-[11px] font-normal text-muted">
            {DISTRICT_STYLES[id].hint}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The District tool: pick a style, then draw the outline; or make a whole walled town. */
export function DistrictPanel({ district, setDistrict, onGenerateTown }: MapPanelsProps) {
  return (
    <Section title="District">
      <StyleCards
        value={district.style}
        onPick={(style) => {
          setDistrict(settingsFromStyle(style, district.scale));
        }}
      />
      <Slider
        label="Size of everything"
        value={district.scale}
        min={0.3}
        max={4}
        step={0.05}
        display={`×${district.scale.toFixed(2)}`}
        onChange={(scale) => {
          setDistrict({ ...district, scale });
        }}
      />
      <DistrictControls
        value={district}
        onChange={(patch) => {
          setDistrict({ ...district, ...patch });
        }}
      />
      <p className="text-xs text-muted">
        Click the corners of the district; double-click or Enter finishes, Escape cancels. Streets,
        blocks and buildings fill it. Pick it to drag its corners; the eraser takes out single
        buildings, and Bake turns the rest into buildings you can edit one by one.
      </p>
      <Button variant="ghost" onClick={onGenerateTown}>
        <Castle className="h-4 w-4" aria-hidden /> Generate a walled town
      </Button>
    </Section>
  );
}

function RoofPicker({
  roof,
  color,
  onChange,
}: {
  roof: RoofStyle;
  color: string;
  onChange: (patch: { roof?: RoofStyle; color?: string }) => void;
}) {
  return (
    <>
      <label className="block text-sm">
        Roof
        <select
          value={roof}
          aria-label="Roof style"
          onChange={(e) => {
            onChange({ roof: e.target.value as RoofStyle });
          }}
          className={field}
        >
          {ROOF_STYLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Roof colour">
        {ROOF_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            onClick={() => {
              onChange({ color: c });
            }}
            className={cn(
              'h-7 w-7 rounded-full border-2',
              color === c ? 'border-accent' : 'border-border',
            )}
            style={{ background: c }}
          />
        ))}
        <input
          type="color"
          aria-label="Another roof colour"
          value={color}
          onChange={(e) => {
            onChange({ color: e.target.value });
          }}
          className="h-7 w-9 cursor-pointer rounded border border-border bg-surface"
        />
      </div>
    </>
  );
}

/** The Building tool: a rectangle by dragging, an outline by clicking, or one from the library. */
export function BuildingPanel({ buildingSet, setBuildingSet }: MapPanelsProps) {
  const { entries, loaded, load, remove } = useBuildings();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  return (
    <Section title="Building">
      <div role="radiogroup" aria-label="Building shape" className="grid grid-cols-2 gap-1">
        {(
          [
            ['rect', 'Rectangle (drag)'],
            ['polygon', 'Outline (click)'],
          ] as const
        ).map(([shape, label]) => (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={buildingSet.libraryId === null && buildingSet.shape === shape}
            onClick={() => {
              setBuildingSet({ ...buildingSet, shape, libraryId: null });
            }}
            className={cn(
              'rounded-md border px-2 py-1.5 text-sm',
              buildingSet.libraryId === null && buildingSet.shape === shape
                ? 'border-accent bg-accent-soft font-medium'
                : 'border-border text-muted hover:bg-sunken',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <RoofPicker
        roof={buildingSet.roof}
        color={buildingSet.color}
        onChange={(patch) => {
          setBuildingSet({ ...buildingSet, ...patch });
        }}
      />
      <p className="text-xs text-muted">
        {buildingSet.libraryId
          ? 'Click on the map to place the saved building.'
          : buildingSet.shape === 'rect'
            ? 'Drag a rectangle. Pick it later and press R to turn it.'
            : 'Click the corners; double-click or Enter finishes, Escape cancels.'}
      </p>
      {entries.length > 0 && (
        <ul aria-label="Saved buildings" className="space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={buildingSet.libraryId === e.id}
                onClick={() => {
                  setBuildingSet({
                    ...buildingSet,
                    libraryId: buildingSet.libraryId === e.id ? null : e.id,
                  });
                }}
                className={cn(
                  'min-w-0 flex-1 truncate rounded-md border px-2 py-1 text-left text-sm',
                  buildingSet.libraryId === e.id
                    ? 'border-accent bg-accent-soft font-medium'
                    : 'border-border hover:bg-sunken',
                )}
              >
                {e.name}
              </button>
              <button
                type="button"
                aria-label={`Delete ${e.name} from the library`}
                onClick={() => {
                  void remove(e.id);
                }}
                className="rounded p-1 text-muted hover:bg-sunken"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** The settings of a picked district: change it, roll again, or bake it into buildings. */
export function DistrictItemSettings({
  item,
  set,
  commit,
}: {
  item: DistrictItem;
  set: (change: (i: MapItem) => MapItem) => void;
  commit: MapPanelsProps['commit'];
}) {
  const change = (patch: Partial<DistrictControlsValue>) => {
    set((i) => (i.kind === 'district' ? { ...i, ...patch } : i));
  };
  return (
    <>
      <StyleCards
        value={item.style}
        onPick={(style) => {
          set((i) => (i.kind === 'district' ? { ...i, style } : i));
        }}
      />
      <DistrictControls value={item} onChange={change} />
      {(item.removed?.length ?? 0) > 0 && (
        <p className="text-xs text-muted">
          {item.removed?.length} building{item.removed?.length === 1 ? '' : 's'} erased.{' '}
          <button
            type="button"
            className="text-link hover:underline"
            onClick={() => {
              set((i) => {
                if (i.kind !== 'district') return i;
                const { removed: _r, ...rest } = i;
                return rest;
              });
            }}
          >
            Bring them back
          </button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            set((i) =>
              i.kind === 'district'
                ? { ...i, seed: Math.floor(Math.random() * 1e9), removed: [] }
                : i,
            );
          }}
        >
          <Dices className="h-4 w-4" aria-hidden /> Roll again
        </Button>
        <Button
          variant="ghost"
          title="Turn the generated buildings into buildings of their own"
          onClick={() => {
            commit((d) => bakeDistrict(d, item.id));
          }}
        >
          <Hammer className="h-4 w-4" aria-hidden /> Bake into buildings
        </Button>
      </div>
    </>
  );
}

/** The settings of a picked building: its roof, a name, and saving it to the library. */
export function BuildingItemSettings({
  item,
  set,
}: {
  item: BuildingItem;
  set: (change: (i: MapItem) => MapItem) => void;
}) {
  const save = useBuildings((s) => s.save);
  const [name, setName] = useState(item.name ?? '');
  const [saved, setSaved] = useState(false);
  return (
    <>
      <RoofPicker
        roof={item.roof}
        color={item.color}
        onChange={(patch) => {
          set((i) => (i.kind === 'building' ? { ...i, ...patch } : i));
        }}
      />
      <label className="block text-sm">
        Name
        <input
          value={name}
          aria-label="Building name"
          placeholder="Tavern, smithy…"
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          onBlur={() => {
            set((i) => (i.kind === 'building' ? { ...i, name } : i));
          }}
          className={field}
        />
      </label>
      <Button
        variant="ghost"
        onClick={() => {
          void save(item, name).then(() => {
            setSaved(true);
          });
        }}
      >
        <Save className="h-4 w-4" aria-hidden /> Save to the library
      </Button>
      {saved && (
        <p role="status" className="text-xs text-muted">
          Saved: find it under Building.
        </p>
      )}
      <p className="text-xs text-muted">Press R to turn it, drag its corners to reshape it.</p>
    </>
  );
}
