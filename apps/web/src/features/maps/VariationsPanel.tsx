/** Breaking up copies of the picked stamps: Randomize, and Swap material. */
import { Button } from '@boh/ui';
import { Hourglass, Shuffle, UtensilsCrossed } from 'lucide-react';
import { ageStamps } from '../../app/maps/dress/decay';
import { dressTables, isTable } from '../../app/maps/dress/tables';
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
  /** The share of the picked stamps Age / decay changes. */
  const [decay, setDecay] = useState(0.6);
  const index = useMemo(() => folderIndex(entries), [entries]);
  const materials = useMemo(() => materialChoices(doc, ids, index), [doc, ids, index]);
  const picked = doc.layers.flatMap((l) =>
    l.items.filter(
      (i): i is Extract<typeof i, { kind: 'stamp' }> => i.kind === 'stamp' && ids.includes(i.id),
    ),
  );
  if (picked.length === 0) return null;
  const tables = picked.filter(isTable);
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
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          title="Some become broken or fallen (where the packs have it), seats and tables are knocked over, the rest get grimy"
          onClick={() => {
            const seed = Math.floor(Math.random() * 2 ** 31);
            commit((d) => ageStamps(d, ids, index, decay, seed));
          }}
        >
          <Hourglass className="h-4 w-4" aria-hidden /> Age / decay
        </Button>
        <label className="flex flex-1 items-center gap-1 text-xs text-muted">
          How much
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={decay}
            aria-label="Decay strength"
            onChange={(e) => {
              setDecay(Number(e.target.value));
            }}
            className="min-w-0 flex-1"
          />
        </label>
      </div>
      {tables.length > 0 && entries.length > 0 && (
        <Button
          variant="ghost"
          title="A plate or mug in front of each chair beside the table, and something in the middle"
          onClick={() => {
            const seed = Math.floor(Math.random() * 2 ** 31);
            commit((d) =>
              dressTables(
                d,
                tables.map((t) => t.id),
                entries,
                seed,
              ),
            );
          }}
        >
          <UtensilsCrossed className="h-4 w-4" aria-hidden /> Dress{' '}
          {tables.length === 1 ? 'this table' : `these ${String(tables.length)} tables`}
        </Button>
      )}
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
