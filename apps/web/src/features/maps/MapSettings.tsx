/** The Map panel of the map maker: kind, picture, filing, scale and travel or grid, encounter. */
import { Button } from '@boh/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useEncounters } from '../../app/encounters/store';
import { mapFolders, mapKind, type MapDoc } from '../../app/maps/model';
import { useMaps } from '../../app/maps/store';
import { DEFAULT_SPEEDS, scaleForWidth, type DistanceUnit } from '../../app/maps/travel';
import { NumberField, Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';
import { CALIBRATE_ICON } from './tools';

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
            <div key={i} className="space-y-1 rounded-md border border-border p-1.5">
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
                className={field}
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={s.perDay}
                  aria-label={`Speed ${String(i + 1)} per day`}
                  onChange={(e) => {
                    setSpeeds(
                      speeds.map((x, j) => (j === i ? { ...x, perDay: e.target.value } : x)),
                    );
                  }}
                  onBlur={() => {
                    save();
                  }}
                  className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                />
                <span className="flex-1 text-xs text-muted">{unit} a day</span>
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

export function MapSettings({ doc, commit, setTool, snap, setSnap }: MapPanelsProps) {
  const encounters = useEncounters((s) => s.encounters);
  const world = mapKind(doc) === 'world';
  const g = doc.grid;
  const setGrid = (change: Partial<MapDoc['grid']>) => {
    commit((d) => ({ ...d, grid: { ...d.grid, ...change } }));
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
      <Section title="Pins">
        <select
          value={doc.pinStyle ?? 'markers'}
          aria-label="Pin style"
          onChange={(e) => {
            const fantasy = e.target.value === 'fantasy';
            commit((d) => {
              const { pinStyle: _old, ...rest } = d;
              return fantasy ? { ...rest, pinStyle: 'fantasy' } : rest;
            });
          }}
          className={field}
        >
          <option value="markers">Markers</option>
          <option value="fantasy">Fantasy map: inked icons, italic names</option>
        </select>
      </Section>
      <Section title="Scale bar">
        <select
          value={doc.scaleBar ?? 'none'}
          aria-label="Scale bar"
          onChange={(e) => {
            const v = e.target.value;
            commit((d) => {
              const { scaleBar: _old, ...rest } = d;
              return v === 'plain' || v === 'fantasy' ? { ...rest, scaleBar: v } : rest;
            });
          }}
          className={field}
        >
          <option value="none">None</option>
          <option value="plain">Plain</option>
          <option value="fantasy">Fantasy map: inked, old lettering</option>
        </select>
        {doc.scaleBar && !doc.scale && mapKind(doc) === 'world' && (
          <p className="text-xs text-muted">Give the map its real size (Scale and travel) first.</p>
        )}
      </Section>
      <Section title="Size">
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
        <p className="text-xs text-muted">Adding the first picture (Layers) sizes the map to it.</p>
      </Section>
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
