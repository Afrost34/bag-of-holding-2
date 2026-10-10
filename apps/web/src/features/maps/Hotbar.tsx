import { cn } from '@boh/ui';
import { useMemo } from 'react';
import { entryRef, usePacks } from '../../app/maps/packs';
import { displayName, parsePackRef } from '../../app/maps/packModel';
import { Preview } from './PackBrowser';
import type { HotStamp } from './editorModel';

/**
 * Dungeondraft's hotbar: the stamps used last, one key (1–9) or click each. A pack picture shows
 * its preview; others show their name.
 */
export function Hotbar({
  items,
  selected,
  onPick,
}: {
  items: readonly HotStamp[];
  selected: string | null;
  onPick: (item: HotStamp) => void;
}) {
  const { entries } = usePacks();
  const byRef = useMemo(() => new Map(entries.map((e) => [entryRef(e), e])), [entries]);
  if (items.length === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Recent stamps"
      className="pointer-events-auto absolute inset-x-0 bottom-10 flex justify-center gap-1 px-2"
    >
      {items.map((item, i) => {
        const entry = byRef.get(item.ref);
        const parsed = parsePackRef(item.ref);
        const name = displayName(parsed ? parsed.path : item.ref.replace(/^glyph:/, ''));
        return (
          <button
            key={item.ref}
            type="button"
            aria-label={`Stamp ${String(i + 1)}: ${name}`}
            aria-pressed={selected === item.ref}
            title={`${name} (${String(i + 1)})`}
            onClick={() => {
              onPick(item);
            }}
            className={cn(
              'relative h-12 w-12 overflow-hidden rounded-md border-2 bg-surface/95 p-0.5 shadow-card',
              selected === item.ref ? 'border-accent' : 'border-border hover:border-accent',
            )}
          >
            <span className="absolute top-0 left-0.5 text-[9px] font-bold text-muted">{i + 1}</span>
            {entry ? (
              <Preview entry={entry} />
            ) : (
              <span className="flex h-full items-center justify-center truncate text-[9px] leading-tight text-muted">
                {name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
