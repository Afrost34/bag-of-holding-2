import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { packCards, type PackedPage } from './model';

/** A4 in CSS pixels (96 per inch), with 8 mm margins and a 4 mm gap between cards and columns. */
const MM = 96 / 25.4;
export const PAGE_W = 210 * MM;
export const PAGE_H = 297 * MM;
export const MARGIN = 8 * MM;
export const GAP = 4 * MM;
const COLUMN_W = (PAGE_W - 2 * MARGIN - GAP) / 2;
const CONTENT_H = PAGE_H - 2 * MARGIN;
const CONTENT_W = PAGE_W - 2 * MARGIN;

/** Something to lay out on the card pages: a card, or a heading kept with the card after it. */
export interface PackItem {
  id: string;
  node: ReactNode;
  breakBefore?: boolean;
  keepWithNext?: boolean;
}

export interface Packing {
  pages: PackedPage[];
  /** Cards taller than a whole page: clipped on paper. */
  tooTall: Set<string>;
}

/**
 * Measures every item at column width and at page width (off screen), then packs them into A4
 * pages of two columns. Heights are read again whenever an item changes size, so text that loads
 * late is accounted for. `key` names the items' content: measuring starts over when it changes.
 */
export function usePacking(items: readonly PackItem[], key: string) {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
  const ref = useRef<HTMLDivElement>(null);

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
    // Read once now (a timer, which also runs in a background tab), then whenever an item changes
    // size (late text, images).
    const timer = setTimeout(read, 0);
    observer.observe(box);
    for (const el of box.querySelectorAll<HTMLElement>('[data-card],[data-wide]'))
      observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [key]);

  const packing = useMemo<Packing>(() => {
    const input = items.map((c) => ({
      id: c.id,
      height: heights.get(c.id) ?? 0,
      wideHeight: heights.get(`wide:${c.id}`) ?? 0,
      ...(c.breakBefore ? { breakBefore: true } : {}),
      ...(c.keepWithNext ? { keepWithNext: true } : {}),
    }));
    return {
      pages: packCards(input, CONTENT_H, GAP),
      tooTall: new Set(input.filter((c) => c.wideHeight > CONTENT_H).map((c) => c.id)),
    };
  }, [items, heights]);

  const measurer = (
    <div ref={ref} aria-hidden className="paper pointer-events-none fixed top-0 -left-[9999px]">
      <div style={{ width: COLUMN_W }}>
        {items.map((c) => (
          <div key={c.id} data-card={c.id}>
            {c.node}
          </div>
        ))}
      </div>
      <div style={{ width: CONTENT_W }}>
        {items.map((c) => (
          <div key={c.id} data-wide={c.id}>
            {c.node}
          </div>
        ))}
      </div>
    </div>
  );
  return { packing, measurer };
}
