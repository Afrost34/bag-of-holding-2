/** The Item panel of the map maker: the picked stamp, text, template, pin or route. */
import { Button } from '@boh/ui';
import { FlipHorizontal2, FlipVertical2, Ruler, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { orderItem } from '../../app/maps/arrange';
import { useJournal } from '../../app/journal/store';
import {
  moveItemToLayer,
  removeItem,
  updateItem,
  type MapItem,
  type TemplateShape,
} from '../../app/maps/model';
import { useMaps } from '../../app/maps/store';
import { ITEM_TITLES } from './editorModel';
import { NumberField, Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';
import { WallStrips } from './WallStrips';
import { PinLinkField } from './PinLinkField';
import { PinLook } from './PinPanels';
import { RouteSettings } from './RouteSettings';
import { BuildingItemSettings, DistrictItemSettings } from './CityPanel';
import { RoomItemSettings } from './RoomPanel';
import { ScatterItemSettings } from './ScatterPanel';
import { ShapeItemSettings } from './ShapePanel';
import { TextLettering } from './TextLettering';

export function ItemSettings({
  doc,
  commit,
  item,
  onDeselect,
  onMeasureFrom,
  onScatterOn,
  onCutHole,
  onFurnish,
  stamp,
}: MapPanelsProps & { item: MapItem }) {
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
  return (
    <Section title={ITEM_TITLES[item.kind]}>
      {item.kind !== 'route' && item.kind !== 'pin' && item.kind !== 'template' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={item.under === true}
            onChange={(e) => {
              const under = e.target.checked;
              set((i) => {
                const { under: _u, ...rest } = i;
                return under ? { ...rest, under: true } : rest;
              });
            }}
          />
          Under the layer's other items
        </label>
      )}
      {item.kind !== 'pin' && item.kind !== 'template' && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            onClick={() => {
              commit((d) => orderItem(d, item.id, 'front'));
            }}
          >
            Bring to front
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              commit((d) => orderItem(d, item.id, 'back'));
            }}
          >
            Send to back
          </Button>
        </div>
      )}
      {item.kind === 'wall' && (
        <WallStrips
          value={item.texture}
          onPick={(texture) => {
            set((i) => {
              if (i.kind !== 'wall') return i;
              const { texture: _t, ...rest } = i;
              return texture ? { ...rest, texture } : rest;
            });
          }}
        />
      )}
      {item.kind === 'route' && <RouteSettings item={item} doc={doc} set={set} />}
      {(item.kind === 'shape' || item.kind === 'path') && (
        <ShapeItemSettings
          item={item}
          set={set}
          onScatter={() => {
            onScatterOn(item);
          }}
          onCutHole={() => {
            onCutHole(item.id);
          }}
        />
      )}
      {item.kind === 'district' && <DistrictItemSettings item={item} set={set} commit={commit} />}
      {item.kind === 'building' && <BuildingItemSettings item={item} set={set} />}
      {item.kind === 'room' && (
        <RoomItemSettings
          item={item}
          set={set}
          onFurnish={(preset) => {
            onFurnish(item.id, preset);
          }}
        />
      )}
      {item.kind === 'scatter' && (
        <ScatterItemSettings item={item} stamp={stamp} set={set} commit={commit} />
      )}
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
          <TextLettering item={item} doc={doc} set={set} />
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
          {onMeasureFrom && (
            <Button
              variant="ghost"
              onClick={() => {
                onMeasureFrom({ x: item.x, y: item.y });
              }}
            >
              <Ruler className="h-4 w-4" aria-hidden /> Measure from here
            </Button>
          )}
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
