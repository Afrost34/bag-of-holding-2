/** Rooms and doors for battle maps: floors, walls, doors cut through them, generators. */
import { Button, cn } from '@boh/ui';
import { Dices, Mountain, Pickaxe } from 'lucide-react';
import { useMemo, useState } from 'react';
import { defaultCaveFloor, defaultCaveWall } from '../../app/maps/packDefaults';
import { usePacks } from '../../app/maps/packs';
import type { TerrainRef } from '../../app/maps/terrain';
import { type MapItem } from '../../app/maps/model';
import { FURNISH_RECIPES } from '../../app/maps/dress/recipes';
import { DOOR_KINDS, type DoorKind } from '../../app/maps/rooms';
import { Section, ShapePicker } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';
import { Slider, TerrainPicker } from './ShapePanel';
import { WallStrips } from './WallStrips';

type WallStyle = 'stone' | 'cave' | 'wood';
const WALL_STYLES: { id: WallStyle; name: string }[] = [
  { id: 'stone', name: 'Stone' },
  { id: 'cave', name: 'Cave rock' },
  { id: 'wood', name: 'Wood' },
];

function WallStyleSelect({
  value,
  onChange,
}: {
  value: WallStyle;
  onChange: (v: WallStyle) => void;
}) {
  return (
    <label className="block text-sm">
      Walls
      <select
        value={value}
        aria-label="Wall style"
        onChange={(e) => {
          onChange(e.target.value as WallStyle);
        }}
        className={field}
      >
        {WALL_STYLES.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DoorKinds({ value, onChange }: { value: DoorKind; onChange: (k: DoorKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Door kind" className="grid grid-cols-2 gap-1">
      {DOOR_KINDS.map((d) => (
        <button
          key={d.id}
          type="button"
          role="radio"
          aria-checked={value === d.id}
          onClick={() => {
            onChange(d.id);
          }}
          className={cn(
            'rounded-md border px-2 py-1.5 text-sm',
            value === d.id
              ? 'border-accent bg-accent-soft font-medium'
              : 'border-border text-muted hover:bg-sunken',
          )}
        >
          {d.name}
        </button>
      ))}
    </div>
  );
}

/** The Room tool, and the Door tool: what a room is like, then draw it; generators. */
export function RoomPanel(props: MapPanelsProps) {
  const { tool, roomSet, setRoomSet, onGenerateDungeon, onGenerateCave, draw, setDraw } = props;
  const [rooms, setRooms] = useState(7);
  const packEntries = usePacks((s) => s.entries);
  const caveWall = useMemo(() => defaultCaveWall(packEntries), [packEntries]);
  const caveFloor = useMemo(() => defaultCaveFloor(packEntries), [packEntries]);
  if (tool === 'door')
    return (
      <Section title="Door">
        <DoorKinds
          value={roomSet.doorKind}
          onChange={(doorKind) => {
            setRoomSet({ ...roomSet, doorKind });
          }}
        />
        <p className="text-xs text-muted">
          Click on a wall of a room to cut a door in it; click a door again to take it out.
        </p>
      </Section>
    );
  return (
    <>
      <Section title="Room">
        <ShapePicker draw={draw} setDraw={setDraw} />
        <TerrainPicker
          cats={['floors']}
          value={roomSet.floor}
          onPick={(floor) => {
            setRoomSet({ ...roomSet, floor });
          }}
        />
        <WallStyleSelect
          value={roomSet.wallStyle}
          onChange={(wallStyle) => {
            setRoomSet({ ...roomSet, wallStyle });
          }}
        />
        <WallStrips
          value={roomSet.wallTexture}
          onPick={(wallTexture) => {
            const { wallTexture: _w, ...rest } = roomSet;
            setRoomSet(wallTexture ? { ...rest, wallTexture } : rest);
          }}
        />
        <Slider
          label="Wall thickness"
          value={roomSet.wall}
          min={3}
          max={40}
          step={1}
          onChange={(wall) => {
            setRoomSet({ ...roomSet, wall });
          }}
        />
        <Slider
          label="Roundness"
          value={roomSet.smooth}
          min={0}
          max={1}
          step={0.05}
          display={`${String(Math.round(roomSet.smooth * 100))}%`}
          onChange={(smooth) => {
            setRoomSet({ ...roomSet, smooth });
          }}
        />
        <Button
          variant="ghost"
          title="Click the outline of a cave: rounded, with a cliff rim and an earthen floor from your packs"
          onClick={() => {
            setDraw({ kind: 'free', sides: draw.sides });
            setRoomSet({
              ...roomSet,
              smooth: 0.8,
              wallStyle: 'cave',
              ...(caveWall ? { wallTexture: caveWall } : {}),
              ...(caveFloor ? { floor: caveFloor as TerrainRef } : {}),
            });
          }}
        >
          <Mountain className="h-4 w-4" aria-hidden /> Cave brush (an outline, rounded)
        </Button>
        <p className="text-xs text-muted">
          Rooms that touch join up into one floor. Pick a room to drag its corners; use the Door
          tool to cut doors.
        </p>
      </Section>
      <Section title="Generate">
        <Slider label="Rooms" value={rooms} min={3} max={16} step={1} onChange={setRooms} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onGenerateDungeon(rooms);
            }}
          >
            <Pickaxe className="h-4 w-4" aria-hidden /> Generate a dungeon
          </Button>
          <Button variant="ghost" onClick={onGenerateCave}>
            <Mountain className="h-4 w-4" aria-hidden /> Generate a cave
          </Button>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted">
          <Dices className="h-3 w-3" aria-hidden /> Each click is new; it fills what you see, with
          the floor and walls above.
        </p>
      </Section>
    </>
  );
}

/** The settings of a picked room. */
export function RoomItemSettings({
  item,
  set,
  onFurnish,
  extrasOnly = false,
}: {
  extrasOnly?: boolean;
  item: Extract<MapItem, { kind: 'room' }>;
  set: (change: (i: MapItem) => MapItem) => void;
  onFurnish: (preset: string) => void;
}) {
  const change = (patch: Partial<Extract<MapItem, { kind: 'room' }>>) => {
    set((i) => (i.kind === 'room' ? { ...i, ...patch } : i));
  };
  return (
    <>
      {!extrasOnly && (
        <>
          <TerrainPicker
            cats={['floors']}
            value={item.floor}
            onPick={(floor) => {
              change({ floor });
            }}
          />
          <WallStyleSelect
            value={item.wallStyle}
            onChange={(wallStyle) => {
              change({ wallStyle });
            }}
          />
          <WallStrips
            value={item.wallTexture}
            onPick={(wallTexture) => {
              set((i) => {
                if (i.kind !== 'room') return i;
                const { wallTexture: _w, ...rest } = i;
                return wallTexture ? { ...rest, wallTexture } : rest;
              });
            }}
          />
          <Slider
            label="Wall thickness"
            value={item.wall}
            min={3}
            max={40}
            step={1}
            onChange={(wall) => {
              change({ wall });
            }}
          />
          <Slider
            label="Roundness"
            value={item.smooth}
            min={0}
            max={1}
            step={0.05}
            display={`${String(Math.round(item.smooth * 100))}%`}
            onChange={(smooth) => {
              change({ smooth });
            }}
          />
        </>
      )}
      <div role="group" aria-label="Furnish" className="space-y-1">
        <p className="text-sm font-medium">Furnish it as…</p>
        <div className="flex flex-wrap gap-1">
          {FURNISH_RECIPES.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => {
                onFurnish(p.id);
              }}
              className="rounded-md border border-border px-2 py-1 text-sm hover:bg-sunken"
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          title="Lamps on the walls, every few squares; they light the room by themselves"
          onClick={() => {
            onFurnish('room-lights');
          }}
          className="rounded-md border border-border px-2 py-1 text-sm hover:bg-sunken"
        >
          Light this room
        </button>
      </div>
      <p className="text-xs text-muted">
        {(item.doors?.length ?? 0) === 0
          ? 'No doors yet: use the Door tool.'
          : `${String(item.doors?.length ?? 0)} door${item.doors?.length === 1 ? '' : 's'}.`}{' '}
        {(item.doors?.length ?? 0) > 0 && (
          <button
            type="button"
            className="text-link hover:underline"
            onClick={() => {
              set((i) => {
                if (i.kind !== 'room') return i;
                const { doors: _d, ...rest } = i;
                return rest;
              });
            }}
          >
            Remove them
          </button>
        )}
      </p>
    </>
  );
}
