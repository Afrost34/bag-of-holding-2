/** The Map panel of the map maker: kind, picture, filing, scale and travel or grid, encounter. */
import { Button } from '@boh/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useCampaigns } from '../../app/campaigns/store';
import { useEncounters } from '../../app/encounters/store';
import { mapFolders, PAPERS, type MapDoc, type MapPaper } from '../../app/maps/model';
import { useMaps } from '../../app/maps/store';
import { DEFAULT_SPEEDS, scaleForWidth, type DistanceUnit } from '../../app/maps/travel';
import { AmbientSettings } from './LightPanel';
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
        For a world or region map (optional): the measure tool then gives distances and travel
        times.
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
  const campaigns = useCampaigns((s) => s.campaigns);
  const [moving, setMoving] = useState(false);
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
        Lives in
        <select
          value={doc.campaign ?? ''}
          aria-label="Where the map lives"
          disabled={moving}
          onChange={(e) => {
            const to = e.target.value || undefined;
            setMoving(true);
            void useMaps
              .getState()
              .move(doc.id, to)
              .finally(() => {
                setMoving(false);
              });
          }}
          className={field}
        >
          <option value="">The library (no campaign)</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {moving && <span className="text-xs text-muted">Moving the map and its pictures…</span>}
      </label>
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
  const g = doc.grid;
  const setGrid = (change: Partial<MapDoc['grid']>) => {
    commit((d) => ({ ...d, grid: { ...d.grid, ...change } }));
  };
  return (
    <>
      <Section title="Paper">
        <select
          value={doc.paper ?? 'parchment'}
          aria-label="Kind of paper"
          onChange={(e) => {
            const paper = e.target.value as MapPaper;
            commit((d) => {
              const { paper: _old, ...rest } = d;
              return paper === 'parchment' ? rest : { ...rest, paper };
            });
          }}
          className={field}
        >
          {PAPERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Section>
      <AmbientSettings doc={doc} commit={commit} />
      <Section title="Roofs and sun">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={doc.hideRoofs === true}
            onChange={(e) => {
              const hide = e.target.checked;
              commit((d) => {
                const { hideRoofs: _old, ...rest } = d;
                return hide ? { ...rest, hideRoofs: true } : rest;
              });
            }}
          />
          Hide the roofs (show the floors inside)
        </label>
        <label className="block text-sm">
          Sun: {Math.round(doc.sun?.angle ?? 180)}°
          <input
            type="range"
            aria-label="Sun direction"
            min={0}
            max={355}
            step={5}
            value={doc.sun?.angle ?? 180}
            onChange={(e) => {
              const angle = Number(e.target.value);
              commit((d) => ({ ...d, sun: { angle, strength: d.sun?.strength ?? 1 } }));
            }}
            className="w-full"
          />
        </label>
        <label className="block text-sm">
          Shade: {Math.round((doc.sun?.strength ?? 1) * 100)}%
          <input
            type="range"
            aria-label="Shade strength"
            min={0}
            max={200}
            step={10}
            value={Math.round((doc.sun?.strength ?? 1) * 100)}
            onChange={(e) => {
              const strength = Number(e.target.value) / 100;
              commit((d) => ({ ...d, sun: { angle: d.sun?.angle ?? 180, strength } }));
            }}
            className="w-full"
          />
        </label>
        <p className="text-xs text-muted">
          The sun is where the light comes from: 0° east, 90° south, 180° west, 270° north.
        </p>
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
        {doc.scaleBar && !doc.scale && !doc.grid.visible && (
          <p className="text-xs text-muted">
            Show the grid or give the map its real size (Scale and travel) first.
          </p>
        )}
      </Section>
      <Section title="Size">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Width (squares)"
            value={Math.round(doc.width / doc.grid.size)}
            min={1}
            onChange={(v) => {
              commit((d) => ({
                ...d,
                width: Math.min(16384, Math.max(200, Math.round(v) * d.grid.size)),
              }));
            }}
          />
          <NumberField
            label="Height (squares)"
            value={Math.round(doc.height / doc.grid.size)}
            min={1}
            onChange={(v) => {
              commit((d) => ({
                ...d,
                height: Math.min(16384, Math.max(200, Math.round(v) * d.grid.size)),
              }));
            }}
          />
        </div>
        <p className="text-xs text-muted">
          {doc.width} × {doc.height} px. Adding the first picture (Layers) sizes the map to it.
        </p>
      </Section>
      <Filing key={doc.id} doc={doc} commit={commit} />
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
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={g.visible}
            onChange={(e) => {
              setGrid({ visible: e.target.checked });
            }}
          />
          Show the grid
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
      <ScaleAndTravel key={'scale-' + doc.id} doc={doc} commit={commit} />
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
