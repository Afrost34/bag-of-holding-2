/** The Map panel of the map maker: kind, picture, filing, scale and travel or grid, encounter. */
import { Button } from '@boh/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useCampaigns } from '../../app/campaigns/store';
import { useEncounters } from '../../app/encounters/store';
import { mapFolders, type MapDoc } from '../../app/maps/model';
import { useMaps } from '../../app/maps/store';
import { DEFAULT_SPEEDS, type DistanceUnit } from '../../app/maps/travel';
import {
  FEET,
  formatLength,
  isStandardCell,
  LENGTH_UNITS,
  mapSizeMeters,
  metersIn,
  metersPerPixel,
  type LengthUnit,
} from '../../app/maps/units';
import { AmbientSettings } from './LightPanel';
import { NumberField, Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';
import { CALIBRATE_ICON } from './tools';

/**
 * The speeds a party travels at on a large map: the measure tool then says how long a distance
 * takes at each. (How large the map is, is set under Real size.)
 */
function TravelSpeeds({ doc, commit }: Pick<MapPanelsProps, 'doc' | 'commit'>) {
  const unit: DistanceUnit = doc.scale?.unit ?? 'km';
  const [speeds, setSpeeds] = useState(
    (doc.travel ?? []).map((t) => ({ name: t.name, perDay: String(t.perDay) })),
  );
  if (!doc.scale) return null;
  const save = (next = speeds) => {
    const travel = next
      .map((s) => ({ name: s.name.trim(), perDay: Number(s.perDay) }))
      .filter((s) => s.name && s.perDay > 0);
    commit((d) => {
      const { travel: _t, ...rest } = d;
      return { ...rest, ...(travel.length ? { travel } : {}) };
    });
  };
  return (
    <Section title="Travel">
      <p className="text-xs text-muted">
        The measure tool gives distances and, with these speeds, travel times.
      </p>
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
                setSpeeds(speeds.map((x, j) => (j === i ? { ...x, perDay: e.target.value } : x)));
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
                save(next);
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
    </Section>
  );
}

/**
 * How big the map is in the world: its width and height in meters or kilometers (which sets how
 * far one grid square is), or how far a square is; and how many squares the map has. Real sizes
 * change what the map means, not its picture: stamps and the district tool follow the scale.
 */
function RealSize({ doc, commit }: Pick<MapPanelsProps, 'doc' | 'commit'>) {
  const size = mapSizeMeters(doc);
  const cell = doc.grid.size * metersPerPixel(doc);
  const across = Math.round(doc.width / doc.grid.size);
  const down = Math.round(doc.height / doc.grid.size);
  const [unit, setUnit] = useState<LengthUnit>(size.w >= 5000 ? 'km' : 'm');
  const k = metersIn(unit);
  const shown = (meters: number) => Math.round((meters / k) * 100) / 100;
  /** One grid square stands for this many meters: the packs' 5 feet is a battle map, any other a scale. */
  const setCell = (cellM: number) => {
    commit((d) => {
      const { scale: _s, ...rest } = d;
      return {
        ...rest,
        grid: { ...d.grid, feet: cellM / FEET },
        ...(isStandardCell(cellM)
          ? {}
          : { scale: { unit: 'km' as const, perPixel: cellM / 1000 / d.grid.size } }),
      };
    });
  };
  /** The map has this many squares across and down (its picture grows or shrinks). */
  const setSquares = (w: number, h: number) => {
    commit((d) => ({
      ...d,
      width: Math.min(16384, Math.max(d.grid.size, Math.round(w) * d.grid.size)),
      height: Math.min(16384, Math.max(d.grid.size, Math.round(h) * d.grid.size)),
    }));
  };
  const fine = unit === 'km' || unit === 'mi';
  return (
    <Section title="Real size">
      <label className="block text-sm">
        Unit
        <select
          aria-label="Unit of the size"
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value as LengthUnit);
          }}
          className={field}
        >
          {LENGTH_UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Width"
          value={shown(size.w)}
          min={0}
          step={fine ? 0.1 : 1}
          onChange={(v) => {
            if (v > 0) setCell((v * k) / Math.max(1, across));
          }}
        />
        <NumberField
          label="Height"
          value={shown(size.h)}
          min={0}
          step={fine ? 0.1 : 1}
          onChange={(v) => {
            if (v > 0) setCell((v * k) / Math.max(1, down));
          }}
        />
        <NumberField
          label="One grid square"
          value={shown(cell)}
          min={0}
          step={fine ? 0.1 : 0.5}
          onChange={(v) => {
            if (v > 0) setCell(v * k);
          }}
        />
        <NumberField
          label="Stamp size ×"
          value={doc.stampScale ?? 1}
          min={0}
          step={0.5}
          onChange={(v) => {
            commit((d) => {
              const { stampScale: _s, ...rest } = d;
              return v > 0 && v !== 1 ? { ...rest, stampScale: v } : rest;
            });
          }}
        />
        <NumberField
          label="Squares across"
          value={across}
          min={1}
          onChange={(v) => {
            setSquares(v, down);
          }}
        />
        <NumberField
          label="Squares down"
          value={down}
          min={1}
          onChange={(v) => {
            setSquares(across, v);
          }}
        />
      </div>
      <p className="text-xs text-muted">
        {formatLength(size.w)} × {formatLength(size.h)}: {across} × {down} squares of{' '}
        {formatLength(cell)}. Stamps are drawn at their true size on this scale: ×1 is true to
        scale; raise it to make every new stamp larger on a big map. Adding the first picture
        (Layers) sizes the map to it.
      </p>
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
      <RealSize key={`size-${doc.id}`} doc={doc} commit={commit} />
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
      <TravelSpeeds key={'travel-' + doc.id} doc={doc} commit={commit} />
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
