import type { EntityDetail } from '@boh/data5e';
import { useEffect, useMemo, useRef, useState } from 'react';
import { packCards, type PackedPage, type SheetCard } from '../../app/cards/model';
import { PrintCard } from '../../app/cards/PrintCard';

/** A4 in CSS pixels (96 per inch), with 8 mm margins and a 4 mm gap between cards and columns. */
const MM = 96 / 25.4;
export const PAGE_W = 210 * MM;
export const PAGE_H = 297 * MM;
export const MARGIN = 8 * MM;
export const GAP = 4 * MM;
const COLUMN_W = (PAGE_W - 2 * MARGIN - GAP) / 2;
const CONTENT_H = PAGE_H - 2 * MARGIN;
const CONTENT_W = PAGE_W - 2 * MARGIN;

export interface Packing {
  pages: PackedPage[];
  /** Cards taller than a whole column: clipped on paper. */
  tooTall: Set<string>;
}

/**
 * Measures every card at column width (off screen), then packs them into pages. Heights are
 * read whenever the cards' content changes size, so text that loads late is accounted for.
 */
export function useCardPacking(cards: readonly SheetCard[], entities: Map<string, EntityDetail>) {
  const visible = cards.filter((c) => !c.hidden && entities.has(c.key));
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
  const ref = useRef<HTMLDivElement>(null);
  const visibleKey = visible.map((c) => `${c.id}:${c.key}`).join('|');

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const read = () => {
      const next = new Map<string, number>();
      for (const el of box.querySelectorAll<HTMLElement>('[data-card]'))
        next.set(el.dataset.card ?? '', el.offsetHeight);
      for (const el of box.querySelectorAll<HTMLElement>('[data-wide]'))
        next.set(`wide:${el.dataset.wide ?? ''}`, el.offsetHeight);
      setHeights(next);
    };
    const observer = new ResizeObserver(read);
    // Read once now (a timer, which also runs in a background tab), then whenever a card changes
    // size (late text, images).
    const timer = setTimeout(read, 0);
    observer.observe(box);
    for (const el of box.querySelectorAll<HTMLElement>('[data-card],[data-wide]'))
      observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [visibleKey, entities]);

  const packing = useMemo<Packing>(() => {
    const input = visible.map((c) => ({
      id: c.id,
      height: heights.get(c.id) ?? 0,
      wideHeight: heights.get(`wide:${c.id}`) ?? 0,
      ...(c.breakBefore ? { breakBefore: true } : {}),
    }));
    return {
      pages: packCards(input, CONTENT_H, GAP),
      tooTall: new Set(input.filter((c) => c.wideHeight > CONTENT_H).map((c) => c.id)),
    };
  }, [visible, heights]);

  // Every card at column width, and at page width for when it is too tall for a column.
  const measurer = (
    <div ref={ref} aria-hidden className="paper pointer-events-none fixed top-0 -left-[9999px]">
      <div style={{ width: COLUMN_W }}>
        {visible.map((c) => {
          const e = entities.get(c.key);
          return e ? (
            <div key={c.id} data-card={c.id}>
              <PrintCard entity={e} />
            </div>
          ) : null;
        })}
      </div>
      <div style={{ width: CONTENT_W }}>
        {visible.map((c) => {
          const e = entities.get(c.key);
          return e ? (
            <div key={c.id} data-wide={c.id}>
              <PrintCard entity={e} />
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
  return { packing, measurer };
}
