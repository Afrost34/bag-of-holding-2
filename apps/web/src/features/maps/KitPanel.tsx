/** The walkway tool (line kits: chainwalks, cable bridges, pipe runs…) and a picked kit's settings. */
import { Button, cn } from '@boh/ui';
import { Layers, Shuffle } from 'lucide-react';
import { useArtPrefs } from '../../app/maps/artPrefs';
import { KITS, kitById } from '../../app/maps/kits/catalog';
import { bakeKit, resolveKit, type KitItem } from '../../app/maps/kits/kitDoc';
import { updateItem } from '../../app/maps/model';
import { usePacks } from '../../app/maps/packs';
import { field, type MapPanelsProps } from './panelTypes';

/** The kits as cards, one picked. */
function KitCards({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Kind of walkway" className="grid grid-cols-2 gap-1">
      {KITS.map((k) => (
        <button
          key={k.id}
          type="button"
          role="radio"
          aria-checked={value === k.id}
          title={k.hint}
          onClick={() => {
            onChange(k.id);
          }}
          className={cn(
            'rounded-md border px-2 py-1.5 text-left text-sm',
            value === k.id
              ? 'border-accent bg-accent-soft font-medium'
              : 'border-border text-muted hover:bg-sunken',
          )}
        >
          {k.name}
          <span className="block text-[11px] font-normal text-muted">{k.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function KitPanel({ kitSet, setKitSet }: MapPanelsProps) {
  return (
    <div className="space-y-3">
      <KitCards
        value={kitSet.kit}
        onChange={(kit) => {
          setKitSet({ ...kitSet, kit });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={kitSet.loop}
          onChange={(e) => {
            setKitSet({ ...kitSet, loop: e.target.checked });
          }}
        />
        Close the loop
      </label>
    </div>
  );
}

/** A picked kit: its kind, how wide, its pictures picked again, baked. */
export function KitItemSettings({
  item,
  commit,
}: {
  item: KitItem;
  commit: MapPanelsProps['commit'];
}) {
  const { entries } = usePacks();
  const drawn = useArtPrefs((s) => s.drawnArt);
  const change = (f: (i: KitItem) => KitItem) => {
    commit((d) => updateItem(d, item.id, (i) => (i.kind === 'kit' ? f(i) : i)));
  };
  const pick = (kit: string) => (drawn ? {} : resolveKit(kitById(kit), entries));
  const scale = item.scale ?? 1;
  return (
    <div className="space-y-3">
      <KitCards
        value={item.kit}
        onChange={(kit) => {
          change((i) => ({ ...i, kit, palette: pick(kit) }));
        }}
      />
      <label className="block text-sm">
        Size: {Math.round(scale * 100)}%
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={scale}
          aria-label="Kit size"
          onChange={(e) => {
            const v = Number(e.target.value);
            change((i) => {
              const { scale: _old, ...rest } = i;
              return v === 1 ? rest : { ...rest, scale: v };
            });
          }}
          className={field}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.loop === true}
          onChange={(e) => {
            const loop = e.target.checked;
            change((i) => {
              const { loop: _old, ...rest } = i;
              return loop ? { ...rest, loop: true } : rest;
            });
          }}
        />
        Close the loop
      </label>
      <div className="flex flex-wrap gap-2">
        {entries.length > 0 && (
          <Button
            variant="ghost"
            title="Pick the deck, rails and posts from the packs again"
            onClick={() => {
              change((i) => ({ ...i, palette: pick(i.kit) }));
            }}
          >
            <Shuffle className="h-4 w-4" aria-hidden /> Pick again
          </Button>
        )}
        <Button
          variant="ghost"
          title="Turn it into paths and stamps you can change one by one"
          onClick={() => {
            commit((d) => bakeKit(d, item.id));
          }}
        >
          <Layers className="h-4 w-4" aria-hidden /> Bake
        </Button>
      </div>
    </div>
  );
}
