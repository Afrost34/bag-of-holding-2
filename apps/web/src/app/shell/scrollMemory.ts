import { useRouter } from '@tanstack/react-router';
import { useEffect, type RefObject } from 'react';

/**
 * Back and forward come back to where the page was scrolled; any other navigation starts at the
 * top. The main area scrolls most pages; pages that scroll a box of their own (compendium lists,
 * articles, the reader) mark it with `data-scroll-memory="<name>"`. Each history entry has a key
 * (kept by the router in its state); the scroll positions are remembered under the key of the
 * entry being left. Lists fill in a moment after the page opens, so positions are put back again
 * until the page is tall enough (up to 2 s).
 */

export const SCROLL_MEMORY = 'data-scroll-memory';

const saved = new Map<string, Record<string, number>>();

const keyOf = (state: unknown): string | undefined => {
  if (typeof state !== 'object' || state === null) return undefined;
  const s = state as { __TSR_key?: unknown; key?: unknown };
  const key = s.__TSR_key ?? s.key;
  return typeof key === 'string' ? key : undefined;
};

/** The main area and every marked scroller in it, by name. */
function scrollers(main: HTMLElement): Map<string, HTMLElement> {
  const out = new Map<string, HTMLElement>([['main', main]]);
  for (const el of main.querySelectorAll<HTMLElement>(`[${SCROLL_MEMORY}]`))
    out.set(el.getAttribute(SCROLL_MEMORY) ?? '', el);
  return out;
}

export function useScrollMemory(main: RefObject<HTMLElement | null>): void {
  const router = useRouter();
  useEffect(() => {
    let frame = 0;
    const offBefore = router.subscribe('onBeforeNavigate', (e) => {
      const key = keyOf(e.fromLocation?.state);
      if (!key || !main.current) return;
      const positions: Record<string, number> = {};
      for (const [name, el] of scrollers(main.current)) positions[name] = el.scrollTop;
      saved.set(key, positions);
    });
    const offResolved = router.subscribe('onResolved', (e) => {
      cancelAnimationFrame(frame);
      const root = main.current;
      if (!root || !e.pathChanged) return;
      const key = keyOf(e.toLocation.state);
      const positions = key ? saved.get(key) : undefined;
      if (!positions) {
        for (const el of scrollers(root).values()) el.scrollTop = 0;
        return;
      }
      const until = performance.now() + 2000;
      const put = () => {
        let done = true;
        const now = scrollers(root);
        for (const [name, top] of Object.entries(positions)) {
          const el = now.get(name);
          if (!el) {
            done = false;
            continue;
          }
          el.scrollTop = top;
          if (Math.abs(el.scrollTop - top) > 2) done = false;
        }
        if (!done && performance.now() < until) frame = requestAnimationFrame(put);
      };
      put();
    });
    return () => {
      cancelAnimationFrame(frame);
      offBefore();
      offResolved();
    };
  }, [router, main]);
}
