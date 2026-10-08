import { Button, cn } from '@boh/ui';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Lock,
  LockOpen,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useEncounters } from '../../app/encounters/store';
import { useJournal } from '../../app/journal/store';
import { importBackground, saveThumbnail } from '../../app/maps/assets';
import {
  addLayer,
  addPicture,
  removePicture,
  updatePicture,
  moveItemToLayer,
  moveLayer,
  removeItem,
  removeLayer,
  updateItem,
  updateLayer,
  mapFolders,
  mapKind,
  type MapDoc,
  type MapItem,
  type TemplateShape,
} from '../../app/maps/model';
import { useMaps } from '../../app/maps/store';
import { DEFAULT_SPEEDS, scaleForWidth, type DistanceUnit } from '../../app/maps/travel';
import { TERRAINS, terrainTile } from '../../app/maps/terrain';
import { PinCategories, PinLook } from './PinPanels';
import { StampLibrary } from './StampLibrary';
import { RouteSettings } from './RouteSettings';
import { PinLinkField } from './PinLinkField';
import {
  CALIBRATE_ICON,
  PEN_COLORS,
  type BrushSettings,
  type TemplateSettings,
  type Tool,
} from './tools';

type Tab = 'stamps' | 'layers' | 'pins' | 'grid' | 'item';

export interface MapPanelsProps {
  doc: MapDoc;
  open: boolean;
  onClose: () => void;
  commit: (change: (d: MapDoc) => MapDoc) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  selected: MapItem | null;
  onDeselect: () => void;
  layerId: string;
  setLayerId: (id: string) => void;
  stamp: string | null;
  setStamp: (path: string, aspect: number) => void;
  brush: BrushSettings;
  setBrush: (b: BrushSettings) => void;
  terrain: BrushSettings;
  setTerrain: (b: BrushSettings) => void;
  /** The eraser's width, in map pixels. */
  eraser: number;
  setEraser: (w: number) => void;
  template: TemplateSettings;
  setTemplate: (t: TemplateSettings) => void;
  snap: boolean;
  setSnap: (s: boolean) => void;
}

const field =
  'w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none';

/** The editor's side panel: what the tool draws, then stamps, layers, grid or the picked item. */
export function MapPanels(props: MapPanelsProps) {
  const { open, onClose, selected, tool } = props;
  const [tab, setTab] = useState<Tab>('stamps');
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Picking an item shows its settings.
  if ((selected?.id ?? null) !== shownFor) {
    setShownFor(selected?.id ?? null);
    if (selected) setTab('item');
    else if (tab === 'item') setTab('stamps');
  }
  const tabs: { id: Tab; label: string }[] = [
    { id: 'stamps', label: 'Stamps' },
    { id: 'layers', label: 'Layers' },
    { id: 'pins', label: 'Pins' },
    { id: 'grid', label: 'Map' },
    ...(selected ? [{ id: 'item' as const, label: 'Item' }] : []),
  ];
  return (
    <aside
      aria-label="Map panels"
      className={cn(
        'flex w-80 shrink-0 flex-col border-l border-border bg-surface',
        'max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:max-w-[90vw] max-lg:shadow-card',
        !open && 'max-lg:hidden',
      )}
    >
      <div className="flex items-center gap-1 border-b border-border px-2 pt-2">
        <div role="tablist" aria-label="Panels" className="flex flex-1 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
              }}
              className={cn(
                'rounded-t-md px-2.5 py-1.5 text-sm font-medium',
                tab === t.id ? 'bg-sunken text-text' : 'text-muted hover:text-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close panels"
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-sunken lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {(tool === 'pen' || tool === 'terrain' || tool === 'eraser' || tool === 'template') && (
          <ToolSettings {...props} />
        )}
        {tab === 'stamps' && <StampLibrary selected={props.stamp} onPick={props.setStamp} />}
        {tab === 'layers' && <Layers {...props} />}
        {tab === 'pins' && <PinCategories doc={props.doc} commit={props.commit} />}
        {tab === 'grid' && <MapSettings {...props} />}
        {tab === 'item' && selected && <ItemSettings {...props} item={selected} />}
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="font-serif text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}

function ToolSettings({
  tool,
  brush,
  setBrush,
  terrain,
  setTerrain,
  eraser,
  setEraser,
  template,
  setTemplate,
}: MapPanelsProps) {
  if (tool === 'eraser')
    return (
      <Section title="Eraser">
        <label className="block text-sm">
          Width: {eraser}
          <input
            type="range"
            min={10}
            max={400}
            value={eraser}
            onChange={(e) => {
              setEraser(Number(e.target.value));
            }}
            className="w-full"
          />
        </label>
        <p className="text-xs text-muted">
          Rubs out brush and terrain strokes where it goes, on layers that are shown and not locked.
          Undo brings them back.
        </p>
      </Section>
    );
  if (tool === 'template')
    return (
      <Section title="Template to draw">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            Shape
            <select
              value={template.shape}
              onChange={(e) => {
                setTemplate({ ...template, shape: e.target.value as TemplateShape });
              }}
              className={field}
            >
              <option value="cone">Cone</option>
              <option value="sphere">Sphere</option>
              <option value="cube">Cube</option>
              <option value="line">Line</option>
            </select>
          </label>
          <label className="text-sm">
            Size (ft)
            <input
              type="number"
              min={5}
              step={5}
              value={template.feet}
              onChange={(e) => {
                setTemplate({ ...template, feet: Math.max(5, Number(e.target.value) || 5) });
              }}
              className={field}
            />
          </label>
        </div>
        <p className="text-xs text-muted">Drag from where it starts towards where it points.</p>
      </Section>
    );
  const terrainTool = tool === 'terrain';
  const s = terrainTool ? terrain : brush;
  const set = terrainTool ? setTerrain : setBrush;
  return (
    <Section title={terrainTool ? 'Terrain brush' : 'Brush'}>
      {terrainTool ? (
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Terrain">
          {TERRAINS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={s.texture === t.id}
              onClick={() => {
                set({ ...s, texture: t.id, color: t.base });
              }}
              className={cn(
                'overflow-hidden rounded-md border-2 text-left text-xs',
                s.texture === t.id ? 'border-accent' : 'border-border',
              )}
            >
              <TerrainSwatch id={t.id} />
              <span className="block truncate px-1 py-0.5">{t.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Colour">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={s.color === c}
              aria-label={c}
              title={c}
              onClick={() => {
                set({ ...s, color: c });
              }}
              className={cn(
                'h-7 w-7 rounded-full border-2',
                s.color === c ? 'border-accent' : 'border-border',
              )}
              style={{ background: c }}
            />
          ))}
          <input
            type="color"
            aria-label="Another colour"
            value={s.color}
            onChange={(e) => {
              set({ ...s, color: e.target.value });
            }}
            className="h-7 w-9 cursor-pointer rounded border border-border bg-surface"
          />
        </div>
      )}
      <label className="block text-sm">
        Width: {s.width}
        <input
          type="range"
          min={terrainTool ? 20 : 1}
          max={terrainTool ? 400 : 40}
          value={s.width}
          onChange={(e) => {
            set({ ...s, width: Number(e.target.value) });
          }}
          className="w-full"
        />
      </label>
      <label className="block text-sm">
        Opacity: {Math.round(s.opacity * 100)}%
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(s.opacity * 100)}
          onChange={(e) => {
            set({ ...s, opacity: Number(e.target.value) / 100 });
          }}
          className="w-full"
        />
      </label>
    </Section>
  );
}

/** A terrain texture's look, for its button. */
function TerrainSwatch({ id }: { id: (typeof TERRAINS)[number]['id'] }) {
  const url = useMemo(() => terrainTile(id).toDataURL('image/png'), [id]);
  return (
    <span
      aria-hidden
      className="block h-8 w-full bg-cover"
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}

function Layers({ doc, commit, layerId, setLayerId }: MapPanelsProps) {
  return (
    <Section title="Layers">
      <p className="text-xs text-muted">
        New things go on the chosen layer. The top one is drawn last.
      </p>
      <ol className="space-y-1">
        {[...doc.layers].reverse().map((l) => (
          <li
            key={l.id}
            className={cn(
              'flex items-center gap-1 rounded-md border px-1.5 py-1',
              l.id === layerId ? 'border-accent bg-accent-soft' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="active-layer"
              checked={l.id === layerId}
              aria-label={`Draw on ${l.name}`}
              onChange={() => {
                setLayerId(l.id);
              }}
            />
            <input
              value={l.name}
              aria-label="Layer name"
              onChange={(e) => {
                commit((d) => updateLayer(d, l.id, { name: e.target.value }));
              }}
              className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
            />
            <span className="text-xs text-muted">{l.items.length}</span>
            <IconButton
              label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
              onClick={() => {
                commit((d) => updateLayer(d, l.id, { visible: !l.visible }));
              }}
            >
              {l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </IconButton>
            <IconButton
              label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
              onClick={() => {
                commit((d) => updateLayer(d, l.id, { locked: !l.locked }));
              }}
            >
              {l.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            </IconButton>
            <IconButton
              label={`Move ${l.name} up`}
              onClick={() => {
                commit((d) => moveLayer(d, l.id, 1));
              }}
            >
              <ArrowUp className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={`Move ${l.name} down`}
              onClick={() => {
                commit((d) => moveLayer(d, l.id, -1));
              }}
            >
              <ArrowDown className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={`Delete ${l.name}`}
              disabled={doc.layers.length <= 1}
              onClick={() => {
                commit((d) => removeLayer(d, l.id));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </li>
        ))}
      </ol>
      <Button
        variant="ghost"
        onClick={() => {
          commit((d) => addLayer(d, `Layer ${String(d.layers.length + 1)}`));
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add a layer
      </Button>
    </Section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-0.5 text-muted hover:bg-sunken hover:text-text disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className={field}
      />
    </label>
  );
}

/**
 * A world or region map's real size, given as the distance across it, and the speeds a party
 * travels at: the measure tool then says how far, and how long at each speed.
 */
function ScaleAndTravel({ doc, commit }: Pick<MapPanelsProps, 'doc' | 'commit'>) {
  const [unit, setUnit] = useState<DistanceUnit | ''>(doc.scale?.unit ?? '');
  const [across, setAcross] = useState(
    doc.scale ? String(Math.round(doc.scale.perPixel * doc.width)) : '',
  );
  const [speeds, setSpeeds] = useState(
    (doc.travel ?? []).map((t) => ({ name: t.name, perDay: String(t.perDay) })),
  );
  const save = (nextUnit = unit, nextAcross = across, nextSpeeds = speeds) => {
    const distance = Number(nextAcross);
    const travel = nextSpeeds
      .map((s) => ({ name: s.name.trim(), perDay: Number(s.perDay) }))
      .filter((s) => s.name && s.perDay > 0);
    commit((d) => {
      const { scale: _s, travel: _t, ...rest } = d;
      return {
        ...rest,
        ...(nextUnit && distance > 0 ? { scale: scaleForWidth(d.width, distance, nextUnit) } : {}),
        ...(travel.length ? { travel } : {}),
      };
    });
  };
  return (
    <Section title="Scale and travel">
      <p className="text-xs text-muted">
        For a world or region map: the measure tool then gives distances and travel times.
      </p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="block text-sm">
          Distance across the map
          <input
            type="number"
            min={0}
            value={across}
            disabled={!unit}
            onChange={(e) => {
              setAcross(e.target.value);
            }}
            onBlur={() => {
              save();
            }}
            className={field}
          />
        </label>
        <label className="block text-sm">
          Unit
          <select
            value={unit}
            onChange={(e) => {
              const next = e.target.value === 'km' || e.target.value === 'mi' ? e.target.value : '';
              setUnit(next);
              save(next);
            }}
            className={field}
          >
            <option value="">Grid (feet)</option>
            <option value="km">km</option>
            <option value="mi">miles</option>
          </select>
        </label>
      </div>
      {unit && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Travel speeds ({unit} per day)</p>
          {speeds.map((s, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={s.name}
                aria-label={`Speed ${String(i + 1)} name`}
                placeholder="Merchant skyship"
                onChange={(e) => {
                  setSpeeds(speeds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)));
                }}
                onBlur={() => {
                  save();
                }}
                className={cn(field, 'min-w-0 flex-1')}
              />
              <input
                type="number"
                min={0}
                value={s.perDay}
                aria-label={`Speed ${String(i + 1)} per day`}
                onChange={(e) => {
                  setSpeeds(speeds.map((x, j) => (j === i ? { ...x, perDay: e.target.value } : x)));
                }}
                onBlur={() => {
                  save();
                }}
                className={cn(field, 'w-20')}
              />
              <button
                type="button"
                aria-label={`Remove speed ${String(i + 1)}`}
                onClick={() => {
                  const next = speeds.filter((_, j) => j !== i);
                  setSpeeds(next);
                  save(unit, across, next);
                }}
                className="rounded p-1 text-muted hover:bg-sunken"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() => {
              setSpeeds([...speeds, { name: '', perDay: '' }]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add a speed
          </Button>
          {speeds.length === 0 && (
            <p className="text-xs text-muted">
              Without speeds, travel is on foot ({DEFAULT_SPEEDS[unit][0]?.perDay} {unit} a day).
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

/** Where the map is filed in the maps list, and the words to find it by. */
function Filing({ doc, commit }: Pick<MapPanelsProps, 'doc' | 'commit'>) {
  const all = useMaps((s) => s.maps);
  const [folder, setFolder] = useState(doc.folder ?? '');
  const [tags, setTags] = useState((doc.tags ?? []).join(', '));
  const save = () => {
    const nextTags = [
      ...new Set(
        tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const nextFolder = folder
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean)
      .join('/');
    commit((d) => {
      const { folder: _f, tags: _t, ...rest } = d;
      return {
        ...rest,
        ...(nextFolder ? { folder: nextFolder } : {}),
        ...(nextTags.length ? { tags: nextTags } : {}),
      };
    });
  };
  return (
    <Section title="Filed under">
      <label className="block text-sm">
        Folder
        <input
          value={folder}
          list="map-folders"
          placeholder="Battle maps/Dungeons"
          onChange={(e) => {
            setFolder(e.target.value);
          }}
          onBlur={save}
          className={field}
        />
        <datalist id="map-folders">
          {mapFolders(all).map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </label>
      <label className="block text-sm">
        Tags
        <input
          value={tags}
          placeholder="tavern, night"
          onChange={(e) => {
            setTags(e.target.value);
          }}
          onBlur={save}
          className={field}
        />
      </label>
    </Section>
  );
}

function MapSettings({ doc, commit, setTool, snap, setSnap }: MapPanelsProps) {
  const encounters = useEncounters((s) => s.encounters);
  const [importing, setImporting] = useState(false);
  const world = mapKind(doc) === 'world';
  const g = doc.grid;
  const setGrid = (change: Partial<MapDoc['grid']>) => {
    commit((d) => ({ ...d, grid: { ...d.grid, ...change } }));
  };
  const pickBackground = (file: File) => {
    setImporting(true);
    void importBackground(file, doc.campaign)
      .then((bg) => {
        commit((d) => ({ ...d, background: bg, width: bg.width, height: bg.height }));
        // The maps list shows it small.
        void saveThumbnail(file, doc.id, doc.campaign);
      })
      .finally(() => {
        setImporting(false);
      });
  };
  return (
    <>
      <Section title="Kind of map">
        <select
          value={mapKind(doc)}
          aria-label="Kind of map"
          onChange={(e) => {
            const kind = e.target.value === 'world' ? 'world' : 'battle';
            commit((d) => ({ ...d, kind }));
          }}
          className={field}
        >
          <option value="battle">Battle map</option>
          <option value="world">World or city map</option>
        </select>
      </Section>
      <Section title="Picture">
        <PictureFile
          label={doc.background ? 'Replace the picture' : 'Choose a picture'}
          busy={importing}
          onFile={pickBackground}
        />
        {doc.background ? (
          <p className="text-xs text-muted">
            {doc.background.width} × {doc.background.height} px.
            <button
              type="button"
              className="ml-2 text-link hover:underline"
              onClick={() => {
                commit((d) => {
                  const { background: _b, ...rest } = d;
                  return rest;
                });
              }}
            >
              Remove
            </button>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Width (px)"
              value={doc.width}
              min={200}
              onChange={(v) => {
                commit((d) => ({ ...d, width: Math.min(16384, Math.max(200, v)) }));
              }}
            />
            <NumberField
              label="Height (px)"
              value={doc.height}
              min={200}
              onChange={(v) => {
                commit((d) => ({ ...d, height: Math.min(16384, Math.max(200, v)) }));
              }}
            />
          </div>
        )}
      </Section>
      {doc.background && <PictureLayers doc={doc} commit={commit} />}
      <Filing key={doc.id} doc={doc} commit={commit} />
      {world ? (
        <ScaleAndTravel key={'scale-' + doc.id} doc={doc} commit={commit} />
      ) : (
        <Section title="Grid">
          <label className="block text-sm">
            Type
            <select
              value={g.type}
              onChange={(e) => {
                setGrid({ type: e.target.value as MapDoc['grid']['type'] });
              }}
              className={field}
            >
              <option value="square">Squares</option>
              <option value="hex">Hexes</option>
              <option value="none">No grid</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Cell size (px)"
              value={g.size}
              min={4}
              onChange={(v) => {
                setGrid({ size: Math.max(4, v) });
              }}
            />
            <NumberField
              label="Feet per cell"
              value={g.feet}
              min={1}
              onChange={(v) => {
                setGrid({ feet: Math.max(1, v) });
              }}
            />
            <NumberField
              label="Offset X"
              value={g.offsetX}
              onChange={(v) => {
                setGrid({ offsetX: v });
              }}
            />
            <NumberField
              label="Offset Y"
              value={g.offsetY}
              onChange={(v) => {
                setGrid({ offsetY: v });
              }}
            />
          </div>
          <label className="block text-sm">
            Grid lines: {Math.round(g.opacity * 100)}%
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(g.opacity * 100)}
              onChange={(e) => {
                setGrid({ opacity: Number(e.target.value) / 100 });
              }}
              className="w-full"
            />
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              setTool('calibrate');
            }}
          >
            <CALIBRATE_ICON className="h-4 w-4" aria-hidden /> Fit the grid to the picture
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => {
                setSnap(e.target.checked);
              }}
            />
            Snap to the grid
          </label>
        </Section>
      )}
      <Section title="Encounter">
        <label className="block text-sm">
          Fought here
          <select
            value={doc.encounter ?? ''}
            aria-label="Linked encounter"
            onChange={(e) => {
              const encounter = e.target.value;
              commit((d) => {
                const { encounter: _e, ...rest } = d;
                return encounter ? { ...rest, encounter } : rest;
              });
            }}
            className={field}
          >
            <option value="">None</option>
            {encounters
              .filter((x) => (x.campaign ?? null) === (doc.campaign ?? null))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
      </Section>
    </>
  );
}

function ItemSettings({ doc, commit, item, onDeselect }: MapPanelsProps & { item: MapItem }) {
  // Selectors return what the stores hold; lists are made from it here (a new array from a
  // selector would re-render forever).
  const journalNotes = useJournal((s) => s.notes);
  const journalFor = useJournal((s) => s.campaignId);
  const allMaps = useMaps((s) => s.maps);
  const notes = useMemo(
    () => (journalFor === doc.campaign ? [...journalNotes.keys()].sort() : []),
    [journalNotes, journalFor, doc.campaign],
  );
  const maps = useMemo(
    () => allMaps.filter((m) => m.id !== doc.id && m.campaign === doc.campaign),
    [allMaps, doc.id, doc.campaign],
  );
  const set = (change: (i: MapItem) => MapItem) => {
    commit((d) => updateItem(d, item.id, change));
  };
  const layer = doc.layers.find((l) => l.items.some((i) => i.id === item.id));
  const titles: Record<MapItem['kind'], string> = {
    stamp: 'Stamp',
    stroke: 'Brush stroke',
    wall: 'Wall',
    route: 'Route',
    text: 'Text',
    template: 'Spell template',
    pin: 'Pin',
  };
  return (
    <Section title={titles[item.kind]}>
      {item.kind === 'route' && <RouteSettings item={item} doc={doc} set={set} />}
      {item.kind === 'stamp' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Width"
              value={Math.round(item.w)}
              min={4}
              onChange={(v) => {
                set((i) => (i.kind === 'stamp' ? { ...i, w: Math.max(4, v) } : i));
              }}
            />
            <NumberField
              label="Height"
              value={Math.round(item.h)}
              min={4}
              onChange={(v) => {
                set((i) => (i.kind === 'stamp' ? { ...i, h: Math.max(4, v) } : i));
              }}
            />
          </div>
          <label className="block text-sm">
            Rotation: {Math.round(item.rotation)}°
            <input
              type="range"
              min={0}
              max={359}
              step={15}
              value={item.rotation}
              aria-label="Rotation"
              onChange={(e) => {
                const rotation = Number(e.target.value);
                set((i) => (i.kind === 'stamp' ? { ...i, rotation } : i));
              }}
              className="w-full"
            />
          </label>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              aria-pressed={item.flipX === true}
              onClick={() => {
                set((i) => (i.kind === 'stamp' ? { ...i, flipX: !i.flipX } : i));
              }}
            >
              <FlipHorizontal2 className="h-4 w-4" aria-hidden /> Flip across
            </Button>
            <Button
              variant="ghost"
              aria-pressed={item.flipY === true}
              onClick={() => {
                set((i) => (i.kind === 'stamp' ? { ...i, flipY: !i.flipY } : i));
              }}
            >
              <FlipVertical2 className="h-4 w-4" aria-hidden /> Flip up
            </Button>
          </div>
          <p className="text-xs text-muted">Keys: R turns, [ and ] resize, Delete removes.</p>
        </>
      )}
      {item.kind === 'text' && (
        <>
          <label className="block text-sm">
            Text
            <textarea
              value={item.text}
              rows={2}
              autoFocus
              onChange={(e) => {
                const text = e.target.value;
                set((i) => (i.kind === 'text' ? { ...i, text } : i));
              }}
              className={field}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Size"
              value={item.size}
              min={6}
              onChange={(v) => {
                set((i) => (i.kind === 'text' ? { ...i, size: Math.max(6, v) } : i));
              }}
            />
            <label className="text-sm">
              Colour
              <input
                type="color"
                value={item.color}
                onChange={(e) => {
                  const color = e.target.value;
                  set((i) => (i.kind === 'text' ? { ...i, color } : i));
                }}
                className="block h-8 w-full"
              />
            </label>
          </div>
        </>
      )}
      {item.kind === 'stroke' && (
        <label className="block text-sm">
          Width: {item.width}
          <input
            type="range"
            min={1}
            max={400}
            value={item.width}
            onChange={(e) => {
              const width = Number(e.target.value);
              set((i) => (i.kind === 'stroke' ? { ...i, width } : i));
            }}
            className="w-full"
          />
        </label>
      )}
      {item.kind === 'template' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            Shape
            <select
              value={item.shape}
              onChange={(e) => {
                const shape = e.target.value as TemplateShape;
                set((i) => (i.kind === 'template' ? { ...i, shape } : i));
              }}
              className={field}
            >
              <option value="cone">Cone</option>
              <option value="sphere">Sphere</option>
              <option value="cube">Cube</option>
              <option value="line">Line</option>
            </select>
          </label>
          <NumberField
            label="Size (ft)"
            value={item.feet}
            min={5}
            step={5}
            onChange={(v) => {
              set((i) => (i.kind === 'template' ? { ...i, feet: Math.max(5, v) } : i));
            }}
          />
          <NumberField
            label="Direction (°)"
            value={item.angle}
            step={15}
            onChange={(v) => {
              set((i) => (i.kind === 'template' ? { ...i, angle: v } : i));
            }}
          />
        </div>
      )}
      {item.kind === 'pin' && (
        <>
          <label className="block text-sm">
            Label
            <input
              value={item.label}
              aria-label="Pin label"
              autoFocus
              onChange={(e) => {
                const label = e.target.value;
                set((i) => (i.kind === 'pin' ? { ...i, label } : i));
              }}
              className={field}
            />
          </label>
          <PinLook doc={doc} pin={item} set={set} />
          <PinLinkField pin={item} doc={doc} notes={notes} maps={maps} set={set} />
        </>
      )}
      {layer && doc.layers.length > 1 && (
        <label className="block text-sm">
          Layer
          <select
            value={layer.id}
            onChange={(e) => {
              const to = e.target.value;
              commit((d) => moveItemToLayer(d, item.id, to));
            }}
            className={field}
          >
            {doc.layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        variant="ghost"
        onClick={() => {
          commit((d) => removeItem(d, item.id));
          onDeselect();
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden /> Remove
      </Button>
    </Section>
  );
}

/**
 * Pictures of the same place over the background (night, snow, an overlay), each shown or
 * hidden with a click: what the players see changes with it.
 */
function PictureLayers({ doc, commit }: Pick<MapPanelsProps, 'doc' | 'commit'>) {
  const [importing, setImporting] = useState(false);
  const pictures = doc.pictures ?? [];
  const add = (file: File) => {
    setImporting(true);
    void importBackground(file, doc.campaign)
      .then((pic) => {
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        commit((d) => addPicture(d, { name, path: pic.path, visible: true }));
      })
      .finally(() => {
        setImporting(false);
      });
  };
  return (
    <Section title="Picture layers">
      <p className="text-xs text-muted">
        Other versions of the picture (night, snow) or overlays, shown over it or hidden.
      </p>
      <ul aria-label="Picture layers" className="space-y-1">
        {pictures.map((p, i) => (
          <li key={p.path} className="flex items-center gap-1.5 text-sm">
            <button
              type="button"
              aria-pressed={p.visible}
              aria-label={(p.visible ? 'Hide ' : 'Show ') + p.name}
              onClick={() => {
                commit((d) => updatePicture(d, i, { visible: !p.visible }));
              }}
              className="rounded p-1 text-muted hover:bg-sunken"
            >
              {p.visible ? (
                <Eye className="h-4 w-4" aria-hidden />
              ) : (
                <EyeOff className="h-4 w-4" aria-hidden />
              )}
            </button>
            <input
              value={p.name}
              aria-label="Picture layer name"
              onChange={(e) => {
                commit((d) => updatePicture(d, i, { name: e.target.value }));
              }}
              className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-0.5"
            />
            <button
              type="button"
              aria-label={'Remove ' + p.name}
              onClick={() => {
                commit((d) => removePicture(d, i));
              }}
              className="rounded p-1 text-muted hover:bg-sunken"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <PictureFile label="Add a picture layer" busy={importing} onFile={add} />
    </Section>
  );
}

/** A button that opens the file picker for a picture (a real input, so it works everywhere). */
function PictureFile({
  label,
  busy,
  onFile,
}: {
  label: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-sunken',
        busy && 'pointer-events-none opacity-60',
      )}
    >
      <ImagePlus className="h-4 w-4" aria-hidden />
      {busy ? 'Reading…' : label}
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
