import { cn } from '@boh/ui';
import { useMemo, useState } from 'react';
import {
  categoryCounts,
  categoryInfo,
  OBJECT_CATEGORIES,
  type CategoryId,
} from '../../app/maps/packCategories';
import { squaresOf } from '../../app/maps/packModel';
import { usePacks } from '../../app/maps/packs';
import { AssetGrid } from './AssetGrid';

type Pick = (path: string, aspect: number, squares?: { w: number; h: number }) => void;

/**
 * The library of objects, sorted: pick a category (trees, furniture, rocks…), then a picture. A
 * picture keeps the size its name gives in grid squares. Dungeondraft's right-hand library.
 */
export function ObjectLibrary({ selected, onPick }: { selected: string | null; onPick: Pick }) {
  const { entries } = usePacks();
  const counts = useMemo(() => categoryCounts(entries), [entries]);
  const available = OBJECT_CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0);
  const [chosen, setChosen] = useState<CategoryId | null>(null);
  const current = chosen && available.includes(chosen) ? chosen : (available[0] ?? null);
  if (!current) return null;
  return (
    <section aria-label="Object library" className="space-y-1.5">
      <div role="group" aria-label="Categories" className="flex flex-wrap gap-1">
        {available.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={current === c}
            onClick={() => {
              setChosen(c);
            }}
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs',
              current === c
                ? 'border-accent bg-accent-soft font-medium'
                : 'border-border text-muted',
            )}
          >
            {categoryInfo(c).name}{' '}
            <span className="tabular-nums text-muted">
              {(counts.get(c) ?? 0).toLocaleString('en')}
            </span>
          </button>
        ))}
      </div>
      <AssetGrid
        key={current}
        cats={[current]}
        label={categoryInfo(current).name}
        value={selected ?? undefined}
        columns={3}
        onPick={(entry, ref) => {
          const squares = squaresOf(entry.path);
          onPick(ref, squares ? squares.w / squares.h : 1, squares ?? undefined);
        }}
        emptyHint="Nothing here yet."
      />
    </section>
  );
}
