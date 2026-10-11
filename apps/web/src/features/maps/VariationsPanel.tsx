/** Breaking up copies of the picked stamps: Randomize, and Swap material. */
import { Button } from '@boh/ui';
import { Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { MapDoc } from '../../app/maps/model';
import { folderIndex } from '../../app/maps/packNames';
import { usePacks } from '../../app/maps/packs';
import {
  DEFAULT_RANDOMIZE,
  materialChoices,
  randomizeStamps,
  swapMaterial,
  type RandomizeOptions,
} from '../../app/maps/randomize';

const OPTIONS: { key: keyof RandomizeOptions; label: string }[] = [
  { key: 'shape', label: 'Shape' },
  { key: 'colour', label: 'Colour' },
  { key: 'turn', label: 'Turn and mirror' },
  { key: 'size', label: 'Size' },
  { key: 'tint', label: 'Tint' },
];

export function VariationsPanel({
  doc,
  ids,
  commit,
}: {
  doc: MapDoc;
  ids: readonly string[];
  commit: (change: (d: MapDoc) => MapDoc) => void;
}) {
  const { entries, loaded, load } = usePacks();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const [options, setOptions] = useState<RandomizeOptions>(DEFAULT_RANDOMIZE);
  const index = useMemo(() => folderIndex(entries), [entries]);
  const materials = useMemo(() => materialChoices(doc, ids, index), [doc, ids, index]);
  const anyStamp = doc.layers.some((l) =>
    l.items.some((i) => i.kind === 'stamp' && ids.includes(i.id)),
  );
  if (!anyStamp) return null;
  return (
    <div role="group" aria-label="Variations" className="space-y-2">
      <h3 className="font-serif text-sm font-semibold">Variations</h3>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {OPTIONS.map((o) => (
          <label key={o.key} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={options[o.key]}
              onChange={(e) => {
                const on = e.target.checked;
                setOptions((s) => ({ ...s, [o.key]: on }));
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
      <Button
        variant="ghost"
        onClick={() => {
          const seed = Math.floor(Math.random() * 2 ** 31);
          commit((d) => randomizeStamps(d, ids, options, index, seed));
        }}
      >
        <Shuffle className="h-4 w-4" aria-hidden /> Randomize
      </Button>
      {materials.length > 0 && (
        <div role="group" aria-label="Swap material" className="space-y-1">
          <p className="text-xs text-muted">Swap colour or material:</p>
          <div className="flex flex-wrap gap-1">
            {materials.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => {
                  commit((d) => swapMaterial(d, ids, m.label, index));
                }}
                className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-sunken"
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
