import { Button, cn } from '@boh/ui';
import { Eraser, PaintBucket, Plus, Trash2 } from 'lucide-react';
import { askConfirm } from '../../app/confirm';
import { entryRef, usePacks } from '../../app/maps/packs';
import { fillSplat, MAX_SLOTS, setSplatSlot } from '../../app/maps/splat';
import { isPackTexture, type TerrainRef } from '../../app/maps/terrain';
import { Preview } from './PackBrowser';
import { Section } from './PanelParts';
import { type MapPanelsProps } from './panelTypes';
import { Slider, TerrainPicker } from './ShapePanel';
import { TerrainSwatch } from './ToolSettings';

/** What a slot looks like: a built-in terrain tile or the preview of a pack texture. */
function SlotSwatch({ texture }: { texture: TerrainRef }) {
  const entries = usePacks((s) => s.entries);
  if (!isPackTexture(texture)) return <TerrainSwatch id={texture} />;
  const entry = entries.find((e) => entryRef(e) === texture);
  return entry ? <Preview entry={entry} /> : <span className="block h-8 w-full bg-sunken" />;
}

/**
 * Dungeondraft's terrain tool: up to eight textures to paint with, a soft brush, and Fill. The
 * newest stroke covers what was under it; changing a slot's texture changes everything painted
 * with it (a winter version of the map in one click).
 */
export function SplatPanel({ doc, commit, splatSet, setSplatSet }: MapPanelsProps) {
  const slots = doc.splat?.slots ?? ['grass', 'dirt', 'sand', 'water'];
  const slot = Math.min(splatSet.slot, slots.length - 1);
  const current = slots[slot] ?? 'grass';
  return (
    <Section title="Terrain">
      <p className="text-xs text-muted">
        Paint with the brush; hold Alt to rub paint off. Pick a slot, then change its texture below.
      </p>
      <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Terrain slots">
        {slots.map((texture, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={slot === i}
            aria-label={`Slot ${String(i + 1)}`}
            onClick={() => {
              setSplatSet({ ...splatSet, slot: i });
            }}
            className={cn(
              'overflow-hidden rounded-md border-2 text-left text-xs',
              slot === i ? 'border-accent' : 'border-border',
            )}
          >
            <SlotSwatch texture={texture} />
            <span className="block px-1 py-0.5">{i + 1}</span>
          </button>
        ))}
        {slots.length < MAX_SLOTS && (
          <button
            type="button"
            aria-label="Add a slot"
            onClick={() => {
              commit((d) => ({ ...d, splat: setSplatSlot(d.splat, slots.length, 'grass') }));
              setSplatSet({ ...splatSet, slot: slots.length });
            }}
            className="flex items-center justify-center rounded-md border-2 border-dashed border-border text-muted hover:bg-sunken"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <p className="text-xs font-medium">Texture of slot {slot + 1}</p>
      <TerrainPicker
        value={current}
        onPick={(texture) => {
          commit((d) => ({ ...d, splat: setSplatSlot(d.splat, slot, texture) }));
        }}
      />
      <Slider
        label="Brush size"
        value={splatSet.radius}
        min={10}
        max={500}
        step={5}
        onChange={(radius) => {
          setSplatSet({ ...splatSet, radius });
        }}
      />
      <Slider
        label="Edge (soft to hard)"
        value={splatSet.hardness}
        min={0}
        max={1}
        step={0.05}
        display={`${String(Math.round(splatSet.hardness * 100))}%`}
        onChange={(hardness) => {
          setSplatSet({ ...splatSet, hardness });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={splatSet.erase}
          onChange={(e) => {
            setSplatSet({ ...splatSet, erase: e.target.checked });
          }}
        />
        <Eraser className="h-4 w-4" aria-hidden /> Rub paint off
      </label>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          onClick={() => {
            commit((d) => ({ ...d, splat: fillSplat(d.splat, slot) }));
          }}
        >
          <PaintBucket className="h-4 w-4" aria-hidden /> Fill the map
        </Button>
        {doc.splat && doc.splat.strokes.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              void askConfirm({
                title: 'Clear the terrain?',
                message: 'All the terrain painted on this map is removed (Undo brings it back).',
                confirmLabel: 'Clear',
              }).then((yes) => {
                if (yes)
                  commit((d) => {
                    const { splat: _s, ...rest } = d;
                    return rest;
                  });
              });
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Clear terrain
          </Button>
        )}
      </div>
    </Section>
  );
}
