/** Whole buildings: the settings they are made with, and those of a building you picked. */
import { Button, cn } from '@boh/ui';
import { Dices, Layers, Lock, LockOpen, Scissors, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { FURNISH_RECIPES } from '../../app/maps/dress/recipes';
import { updateItem, type BuildingSpec } from '../../app/maps/model';
import { useArtPrefs } from '../../app/maps/artPrefs';
import { pickFurnishing, roomTypes, withFurnishing } from '../../app/maps/structure/furnish';
import { stampUnit } from '../../app/maps/units';
import { usePacks } from '../../app/maps/packs';
import { ARCHETYPES, archetypeById } from '../../app/maps/structure/archetypes';
import {
  bakeStructure,
  cutAllCorners,
  floorName,
  floorsOf,
  lockRoom,
  mergeRoomsOf,
  neighbours,
  planOf,
  rerollRoom,
  rollAgain,
  setFloors,
  setRoomType,
  splitRoom,
  syncFootprint,
  unlockAll,
  updateGroup,
  type StructureItem,
} from '../../app/maps/structure/structureDoc';
import { resolveStyle, STYLES, styleById } from '../../app/maps/structure/styles';
import { field, type MapPanelsProps } from './panelTypes';
import { type GenerateSettings } from './tools';

/** A room type's name (a furnishing recipe's), or the type itself. */
const roomName = (type: string): string =>
  type === 'stairs' ? 'Stairs' : (FURNISH_RECIPES.find((r) => r.id === type)?.name ?? 'Room');

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
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
        aria-label={label}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="w-full"
      />
    </label>
  );
}

const DRESSINGS: { id: BuildingSpec['dressing']; name: string }[] = [
  { id: 'bare', name: 'None' },
  { id: 'lived-in', name: 'Lived-in' },
  { id: 'cluttered', name: 'Cluttered' },
];
const CONDITIONS: { id: BuildingSpec['condition']; name: string }[] = [
  { id: 'kept', name: 'Kept' },
  { id: 'worn', name: 'Worn' },
  { id: 'ruined', name: 'Ruined' },
];

/** How a building's rooms are furnished, and how kept it is. */
function DressingControls({
  value,
  onChange,
}: {
  value: Pick<BuildingSpec, 'dressing' | 'condition'>;
  onChange: (v: Pick<BuildingSpec, 'dressing' | 'condition'>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-sm">
        Furniture
        <select
          value={value.dressing}
          aria-label="Furniture"
          onChange={(e) => {
            const dressing = DRESSINGS.find((d) => d.id === e.target.value)?.id ?? 'lived-in';
            onChange({ ...value, dressing });
          }}
          className={field}
        >
          {DRESSINGS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Condition
        <select
          value={value.condition}
          aria-label="Condition"
          onChange={(e) => {
            const condition = CONDITIONS.find((c) => c.id === e.target.value)?.id ?? 'kept';
            onChange({ ...value, condition });
          }}
          className={field}
        >
          {CONDITIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** The headings the kinds are listed under. */
const KIND_GROUPS = ['Town', 'Rust & Sunfire', 'Dungeons', 'Ships'] as const;

/** What a new building is: its kind (archetype), look, floors and rooms. */
export function GenerateControls({
  value,
  onChange,
}: {
  value: GenerateSettings;
  onChange: (v: GenerateSettings) => void;
}) {
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Kind of building" className="space-y-2">
        {KIND_GROUPS.map((group) => (
          <div key={group}>
            <p className="mb-1 text-xs font-medium text-muted">{group}</p>
            <div className="grid grid-cols-2 gap-1">
              {ARCHETYPES.filter((a) => (a.group ?? 'Town') === group).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={value.archetype === a.id}
                  title={a.hint}
                  onClick={() => {
                    onChange({
                      ...value,
                      archetype: a.id,
                      rooms: a.rooms,
                      upper: a.upper,
                      cellar: a.cellar,
                      style: a.style,
                    });
                  }}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-left text-sm',
                    value.archetype === a.id
                      ? 'border-accent bg-accent-soft font-medium'
                      : 'border-border text-muted hover:bg-sunken',
                  )}
                >
                  {a.name}
                  <span className="block text-[11px] font-normal text-muted">{a.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {archetypeById(value.archetype).layout === 'ship' && (
        <div role="radiogroup" aria-label="Sea or sky" className="grid grid-cols-2 gap-1">
          {(
            [
              ['sea', 'Sea', 'sails, oars and an anchor'],
              ['sky', 'Sky', 'solar sails, a shard engine'],
            ] as const
          ).map(([id, name, hint]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={value.medium === id}
              title={hint}
              onClick={() => {
                onChange({ ...value, medium: id });
              }}
              className={cn(
                'rounded-md border px-2 py-1.5 text-left text-sm',
                value.medium === id
                  ? 'border-accent bg-accent-soft font-medium'
                  : 'border-border text-muted hover:bg-sunken',
              )}
            >
              {name}
              <span className="block text-[11px] font-normal text-muted">{hint}</span>
            </button>
          ))}
        </div>
      )}
      <label className="block text-sm">
        Look
        <select
          value={value.style}
          aria-label="Building style"
          onChange={(e) => {
            onChange({ ...value, style: e.target.value });
          }}
          className={field}
        >
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Range
        label="Floors above the ground floor"
        value={value.upper}
        min={0}
        max={3}
        onChange={(upper) => {
          onChange({ ...value, upper });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.cellar}
          onChange={(e) => {
            onChange({ ...value, cellar: e.target.checked });
          }}
        />
        A cellar
      </label>
      <Range
        label="Rooms on each floor"
        value={value.rooms}
        min={1}
        max={12}
        onChange={(rooms) => {
          onChange({ ...value, rooms });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.windows}
          onChange={(e) => {
            onChange({ ...value, windows: e.target.checked });
          }}
        />
        Windows
      </label>
      <Range
        label="Crooked walls"
        value={value.crooked}
        min={0}
        max={1}
        step={0.1}
        display={`${String(Math.round(value.crooked * 100))}%`}
        onChange={(crooked) => {
          onChange({ ...value, crooked });
        }}
      />
      <DressingControls
        value={value}
        onChange={(v) => {
          onChange({ ...value, ...v });
        }}
      />
    </div>
  );
}

/** The settings of a picked building: every floor at once, and the rooms of this floor. */
export function StructureItemSettings({
  doc,
  item,
  commit,
}: {
  doc: MapPanelsProps['doc'];
  item: StructureItem;
  commit: MapPanelsProps['commit'];
}) {
  const { entries } = usePacks();
  const drawn = useArtPrefs((s) => s.drawnArt);
  const options = { unit: stampUnit(doc), drawn };
  const cell = doc.grid.size;
  const group = item.group;
  const spec = item.spec;
  const floors = floorsOf(doc, group);
  const plan = planOf(item, cell);
  const [roomId, setRoomId] = useState<number | null>(null);
  // A room that is gone (rolled again) is simply not shown.
  const room = plan.rooms.find((r) => r.id === roomId) ?? null;
  const changeAll = (change: (i: StructureItem) => StructureItem) => {
    commit((d) => updateGroup(d, group, change));
  };
  const changeThis = (change: (i: StructureItem) => StructureItem) => {
    commit((d) => updateItem(d, item.id, (i) => (i.kind === 'structure' ? change(i) : i)));
  };
  const locked = new Set((item.rooms ?? []).map((r) => r.id));
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Name
        <input
          value={spec.name}
          aria-label="Building name"
          onChange={(e) => {
            const name = e.target.value;
            changeAll((i) => ({ ...i, spec: { ...i.spec, name } }));
          }}
          className={field}
        />
      </label>
      <p className="text-xs text-muted">
        {archetypeById(spec.archetype).name}, {floorName(item.floor).toLowerCase()} of{' '}
        {floors.length} floor{floors.length === 1 ? '' : 's'}. Page Up and Page Down go up and down.
        Drag a corner to bend a wall.
      </p>
      <label className="block text-sm">
        Kind
        <select
          value={spec.archetype}
          aria-label="Kind of building"
          onChange={(e) => {
            const archetype = e.target.value;
            changeAll((i) => ({
              ...i,
              spec: withFurnishing(
                { ...i.spec, archetype },
                roomTypes(archetype),
                entries,
                options,
              ),
            }));
          }}
          className={field}
        >
          {ARCHETYPES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Look
        <select
          value={spec.style}
          aria-label="Building style"
          onChange={(e) => {
            const style = e.target.value;
            const palette = resolveStyle(styleById(style), entries);
            const roof = styleById(style).roofKind;
            changeAll((i) => ({ ...i, spec: { ...i.spec, style, palette, roof } }));
          }}
          className={field}
        >
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Range
        label="Floors above the ground floor"
        value={spec.upper}
        min={0}
        max={3}
        onChange={(upper) => {
          commit((d) => setFloors(d, group, upper, spec.cellar));
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={spec.cellar}
          onChange={(e) => {
            const cellar = e.target.checked;
            commit((d) => setFloors(d, group, spec.upper, cellar));
          }}
        />
        A cellar
      </label>
      <Range
        label="Rooms on each floor"
        value={spec.rooms}
        min={1}
        max={12}
        onChange={(rooms) => {
          changeAll((i) => ({ ...i, spec: { ...i.spec, rooms } }));
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={spec.windows}
          onChange={(e) => {
            const windows = e.target.checked;
            changeAll((i) => ({ ...i, spec: { ...i.spec, windows } }));
          }}
        />
        Windows
      </label>
      <Range
        label="Crooked walls"
        value={spec.crooked}
        min={0}
        max={1}
        step={0.1}
        display={`${String(Math.round(spec.crooked * 100))}%`}
        onChange={(crooked) => {
          changeAll((i) => ({ ...i, spec: { ...i.spec, crooked } }));
        }}
      />
      <DressingControls
        value={spec}
        onChange={(v) => {
          changeAll((i) => ({ ...i, spec: { ...i.spec, ...v } }));
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          title="Cut the rooms anew (the stairs and the rooms you keep stay)"
          onClick={() => {
            const seed = Math.floor(Math.random() * 2 ** 31);
            changeAll((i) => ({ ...i, spec: rollAgain(i.spec, seed) }));
          }}
        >
          <Dices className="h-4 w-4" aria-hidden /> Roll again
        </Button>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            title="Pick the floors, walls, doors, windows and furniture from the packs again"
            onClick={() => {
              const palette = resolveStyle(styleById(spec.style), entries);
              // Every room type in use on any floor, not only the archetype's.
              const types = floors.flatMap((f) => planOf(f, cell).rooms.map((r) => r.type));
              const furniture = pickFurnishing(spec, entries, options, types);
              changeAll((i) => ({ ...i, spec: { ...i.spec, palette, ...furniture } }));
            }}
          >
            <Shuffle className="h-4 w-4" aria-hidden /> Pick again
          </Button>
        )}
        <Button
          variant="ghost"
          aria-pressed={(item.chamfers?.length ?? 0) > 0}
          title="Cut the outer corners at 45°"
          onClick={() => {
            const on = (item.chamfers?.length ?? 0) === 0;
            commit((d) =>
              syncFootprint(
                updateItem(d, item.id, (i) => (i.kind === 'structure' ? cutAllCorners(i, on) : i)),
                item.id,
              ),
            );
          }}
        >
          <Scissors className="h-4 w-4" aria-hidden /> Cut corners
        </Button>
        {(item.bends?.some((v) => v !== 0) ?? false) && (
          <Button
            variant="ghost"
            onClick={() => {
              commit((d) =>
                syncFootprint(
                  updateItem(d, item.id, (i) => {
                    if (i.kind !== 'structure') return i;
                    const { bends: _b, ...rest } = i;
                    return rest;
                  }),
                  item.id,
                ),
              );
            }}
          >
            Straighten the walls
          </Button>
        )}
        <Button
          variant="ghost"
          title="Turn the building into rooms and stamps you can change one by one"
          onClick={() => {
            commit((d) => bakeStructure(d, group));
          }}
        >
          <Layers className="h-4 w-4" aria-hidden /> Bake
        </Button>
      </div>
      <div role="group" aria-label="Rooms" className="space-y-1">
        <p className="text-sm font-medium">Rooms of the {floorName(item.floor).toLowerCase()}</p>
        <ul className="flex flex-wrap gap-1">
          {plan.rooms.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={roomId === r.id}
                onClick={() => {
                  setRoomId(roomId === r.id ? null : r.id);
                }}
                className={cn(
                  'flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs',
                  roomId === r.id
                    ? 'border-accent bg-accent-soft'
                    : 'border-border hover:bg-sunken',
                )}
              >
                {locked.has(r.id) && <Lock className="h-3 w-3" aria-label="kept" />}
                {roomName(r.type)} {r.cells.length}
              </button>
            </li>
          ))}
        </ul>
        {room && room.type !== 'stairs' && (
          <div className="space-y-1.5 rounded-md border border-border p-2">
            <label className="block text-sm">
              Room for
              <select
                value={room.type}
                aria-label="Room type"
                onChange={(e) => {
                  const type = e.target.value;
                  // The new type's furniture is picked for the whole building (one spec).
                  commit((d) =>
                    updateGroup(
                      updateItem(d, item.id, (i) =>
                        i.kind === 'structure' ? setRoomType(i, cell, room.id, type) : i,
                      ),
                      group,
                      (i) => ({ ...i, spec: withFurnishing(i.spec, [type], entries, options) }),
                    ),
                  );
                }}
                className={field}
              >
                {!FURNISH_RECIPES.some((r) => r.id === room.type) && (
                  <option value={room.type}>{roomName(room.type)}</option>
                )}
                {FURNISH_RECIPES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                onClick={() => {
                  changeThis((i) => lockRoom(i, cell, room.id, !locked.has(room.id)));
                }}
              >
                {locked.has(room.id) ? (
                  <>
                    <LockOpen className="h-4 w-4" aria-hidden /> Let it go
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" aria-hidden /> Keep it
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                title="Lay its furniture anew"
                onClick={() => {
                  const seed = Math.floor(Math.random() * 2 ** 31);
                  changeThis((i) => rerollRoom(i, cell, room.id, seed));
                }}
              >
                <Dices className="h-4 w-4" aria-hidden /> Furnish again
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  changeThis((i) => splitRoom(i, cell, room.id) ?? i);
                }}
              >
                Split in two
              </Button>
            </div>
            {neighbours(item, cell, room.id).length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                Join with:
                {neighbours(item, cell, room.id).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      changeThis((i) => mergeRoomsOf(i, cell, room.id, n.id) ?? i);
                    }}
                    className="rounded-md border border-border px-2 py-0.5 hover:bg-sunken"
                  >
                    {roomName(n.type)} {n.cells.length}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {locked.size > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              changeThis(unlockAll);
            }}
          >
            <LockOpen className="h-4 w-4" aria-hidden /> Let every room go
          </Button>
        )}
      </div>
    </div>
  );
}
