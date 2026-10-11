/** Town building: districts that generate streets and houses, and buildings drawn or saved by hand. */
import { Button, cn } from '@boh/ui';
import { Castle, Dices, Hammer, Save, Scissors, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { AssetGrid } from './AssetGrid';
import type { StreetLayout } from '../../app/maps/city';
import { useShowDrawn } from '../../app/maps/artPrefs';
import { districtRoofs } from '../../app/maps/packDefaults';
import { usePacks } from '../../app/maps/packs';
import { Section, ShapePicker } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';
import { GenerateControls } from './StructurePanel';
import { generateOf } from './tools';

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
  layout: StreetLayout;
  /** Meters. */
  blockSize: number;
  /** Meters. */
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
      <LayoutCards
        value={value.layout}
        onPick={(layout) => {
          onChange({ layout });
        }}
      />
      <Slider
        label="Distance between streets"
        value={Math.round(value.blockSize * 10) / 10}
        min={10}
        max={200}
        step={1}
        display={`${String(Math.round(value.blockSize))} m`}
        onChange={(blockSize) => {
          onChange({ blockSize });
        }}
      />
      <Slider
        label="Street width"
        value={Math.round(value.streetWidth * 10) / 10}
        min={1}
        max={25}
        step={0.5}
        display={`${String(Math.round(value.streetWidth * 10) / 10)} m`}
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

const LAYOUTS: { id: StreetLayout; name: string; hint: string }[] = [
  { id: 'grid', name: 'Grid', hint: 'streets at right angles' },
  { id: 'radial', name: 'Rings and spokes', hint: 'round a hub' },
  { id: 'organic', name: 'Winding', hint: 'irregular blocks' },
  { id: 'linear', name: 'Main street', hint: 'long blocks, side by side' },
];

/** How the streets run: the four layouts the generator can make. */
function LayoutCards({
  value,
  onPick,
}: {
  value: StreetLayout;
  onPick: (layout: StreetLayout) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Street layout" className="grid grid-cols-2 gap-1">
      {LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          onClick={() => {
            onPick(l.id);
          }}
          className={cn(
            'rounded-md border px-2 py-1.5 text-left text-sm',
            value === l.id
              ? 'border-accent bg-accent-soft font-medium'
              : 'border-border text-muted hover:bg-sunken',
          )}
        >
          {l.name}
          <span className="block text-[11px] font-normal text-muted">{l.hint}</span>
        </button>
      ))}
    </div>
  );
}

/** The textures a district's roofs are covered with: one picked from the packs, or the style's own mix. */
function DistrictRoofs({
  style,
  value,
  onChange,
}: {
  style: DistrictStyleId;
  value: readonly string[] | undefined;
  onChange: (refs: string[]) => void;
}) {
  const { entries } = usePacks();
  const mix = useMemo(() => districtRoofs(entries, style), [entries, style]);
  if (!entries.some((e) => e.cat === 'roofs')) return null;
  const single = value?.length === 1 ? value[0] : undefined;
  const mixed = single === undefined;
  return (
    <div className="space-y-1.5">
      <p className="text-sm">Roofs: {mixed ? 'a mix for this style' : 'one texture'}</p>
      <AssetGrid
        cats={['roofs']}
        label="District roofs"
        value={single}
        onPick={(_, ref) => {
          onChange([ref]);
        }}
        emptyHint="No roof textures yet."
      />
      {!mixed && (
        <button
          type="button"
          className="text-xs text-accent-ink underline"
          onClick={() => {
            onChange(mix);
          }}
        >
          Back to the mix for this style
        </button>
      )}
    </div>
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
export function DistrictPanel({
  district,
  setDistrict,
  onGenerateTown,
  draw,
  setDraw,
}: MapPanelsProps) {
  return (
    <Section title="District">
      <ShapePicker draw={draw} setDraw={setDraw} />
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
      <DistrictRoofs
        style={district.style}
        value={district.roofTextures}
        onChange={(roofTextures) => {
          setDistrict({ ...district, roofTextures });
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
  texture,
  onChange,
  onTexture,
}: {
  roof: RoofStyle;
  color: string;
  texture: string | undefined;
  onChange: (patch: { roof?: RoofStyle; color?: string }) => void;
  onTexture: (texture: string | undefined) => void;
}) {
  const drawn = useShowDrawn();
  const { entries } = usePacks();
  const hasRoofs = entries.some((e) => e.cat === 'roofs');
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
      <AssetGrid
        cats={['roofs']}
        label="Roof textures"
        value={texture}
        onPick={(_, ref) => {
          onTexture(ref);
        }}
        emptyHint="No roof textures yet. Import an asset pack for tile, hay and slate roofs."
      />
      {(drawn || !hasRoofs) && (
        <>
          <div
            className="flex flex-wrap items-center gap-1"
            role="radiogroup"
            aria-label="Roof colour"
          >
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
          {texture && (
            <button
              type="button"
              className="text-xs text-accent-ink underline"
              onClick={() => {
                onTexture(undefined);
              }}
            >
              Back to the plain colour
            </button>
          )}
        </>
      )}
    </>
  );
}

/** The Building tool: a rectangle by dragging, an outline by clicking, or one from the library. */
export function BuildingPanel({ buildingSet, setBuildingSet, draw, setDraw }: MapPanelsProps) {
  const { entries, loaded, load, remove } = useBuildings();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const whole = buildingSet.whole === true && buildingSet.libraryId === null;
  return (
    <Section title="Building">
      <div role="radiogroup" aria-label="What to draw" className="grid grid-cols-2 gap-1">
        {(
          [
            [true, 'Whole building', 'rooms, doors, floors'],
            [false, 'Roof only', 'for a town seen from above'],
          ] as const
        ).map(([value, name, hint]) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={(buildingSet.whole === true) === value}
            onClick={() => {
              setBuildingSet({ ...buildingSet, whole: value, libraryId: null });
            }}
            className={cn(
              'rounded-md border px-2 py-1.5 text-left text-sm',
              (buildingSet.whole === true) === value
                ? 'border-accent bg-accent-soft font-medium'
                : 'border-border text-muted hover:bg-sunken',
            )}
          >
            {name}
            <span className="block text-[11px] font-normal text-muted">{hint}</span>
          </button>
        ))}
      </div>
      {buildingSet.libraryId === null && <ShapePicker draw={draw} setDraw={setDraw} />}
      {whole && (
        <>
          <GenerateControls
            value={generateOf(buildingSet)}
            onChange={(generate) => {
              setBuildingSet({ ...buildingSet, generate });
            }}
          />
          <p className="text-xs text-muted">
            Drag out the building on the grid. With a building picked, drag next to it to make it
            bigger (an L, a T, a wing).
          </p>
        </>
      )}
      {!whole && (
        <RoofPicker
          roof={buildingSet.roof}
          color={buildingSet.color}
          texture={buildingSet.roofTexture}
          onChange={(patch) => {
            setBuildingSet({ ...buildingSet, ...patch });
          }}
          onTexture={(roofTexture) => {
            const { roofTexture: _r, ...rest } = buildingSet;
            setBuildingSet(roofTexture ? { ...rest, roofTexture } : rest);
          }}
        />
      )}
      {!whole && (
        <p className="text-xs text-muted">
          {buildingSet.libraryId
            ? 'Click on the map to place the saved building.'
            : draw.kind === 'free'
              ? 'Click the corners; double-click or Enter finishes, Escape cancels.'
              : 'Drag it out. Pick it later and press R to turn it.'}
        </p>
      )}
      {!whole && entries.length > 0 && (
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
  onCutHole,
  mpp,
}: {
  item: DistrictItem;
  /** Meters one pixel of the map covers: the item keeps pixels, the sliders show meters. */
  mpp: number;
  set: (change: (i: MapItem) => MapItem) => void;
  commit: MapPanelsProps['commit'];
  /** Draw an area to cut out of this district. */
  onCutHole: () => void;
}) {
  const change = (patch: Partial<DistrictControlsValue>) => {
    const { blockSize, streetWidth, layout, ...rest } = patch;
    set((i) => {
      if (i.kind !== 'district') return i;
      const { layout: _l, ...base } = i;
      const chosen = layout ?? i.layout ?? 'grid';
      return {
        ...base,
        ...rest,
        ...(chosen !== 'grid' ? { layout: chosen } : {}),
        ...(blockSize !== undefined ? { blockSize: Math.round(blockSize / mpp) } : {}),
        ...(streetWidth !== undefined
          ? { streetWidth: Math.round((streetWidth / mpp) * 10) / 10 }
          : {}),
      };
    });
  };
  return (
    <>
      <StyleCards
        value={item.style}
        onPick={(style) => {
          set((i) => (i.kind === 'district' ? { ...i, style } : i));
        }}
      />
      <DistrictRoofs
        style={item.style}
        value={item.roofTextures}
        onChange={(roofTextures) => {
          set((i) => (i.kind === 'district' ? { ...i, roofTextures } : i));
        }}
      />
      <DistrictControls
        value={{
          ...item,
          layout: item.layout ?? 'grid',
          blockSize: item.blockSize * mpp,
          streetWidth: item.streetWidth * mpp,
        }}
        onChange={change}
      />
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
        <Button variant="ghost" onClick={onCutHole}>
          <Scissors className="h-4 w-4" aria-hidden /> Cut a hole
        </Button>
        {(item.holes?.length ?? 0) > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              set((i) => {
                if (i.kind !== 'district') return i;
                const { holes: _h, ...rest } = i;
                return rest;
              });
            }}
          >
            Fill the {item.holes?.length} {item.holes?.length === 1 ? 'hole' : 'holes'}
          </Button>
        )}
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
  extrasOnly = false,
}: {
  extrasOnly?: boolean;
  item: BuildingItem;
  set: (change: (i: MapItem) => MapItem) => void;
}) {
  const save = useBuildings((s) => s.save);
  const [name, setName] = useState(item.name ?? '');
  const [saved, setSaved] = useState(false);
  return (
    <>
      {!extrasOnly && (
        <>
          <RoofPicker
            roof={item.roof}
            color={item.color}
            texture={item.roofTexture}
            onChange={(patch) => {
              set((i) => (i.kind === 'building' ? { ...i, ...patch } : i));
            }}
            onTexture={(roofTexture) => {
              set((i) => {
                if (i.kind !== 'building') return i;
                const { roofTexture: _r, ...rest } = i;
                return roofTexture ? { ...rest, roofTexture } : rest;
              });
            }}
          />
        </>
      )}
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
