import type { ReactNode } from 'react';
import { GAP, MARGIN, PAGE_H, PAGE_W, type Packing, type PackItem } from './packing';

/** The packed pages, each exactly A4. */
export function PackedPages({
  packing,
  items,
  label = 'Card page',
  decorate,
}: {
  packing: Packing;
  items: readonly PackItem[];
  label?: string;
  /** Wraps an item as shown (buttons over a card on screen); the packing is unchanged. */
  decorate?: (id: string, node: ReactNode) => ReactNode;
}) {
  const byId = new Map(items.map((c) => [c.id, c]));
  return (
    <>
      {packing.pages.map((page, i) => (
        <section
          key={i}
          aria-label={`${label} ${String(i + 1)}`}
          className="sheet-page mx-auto mb-6 box-border overflow-hidden bg-surface shadow-card"
          style={{ width: PAGE_W, height: PAGE_H, padding: MARGIN }}
        >
          {page.wide ? (
            <div className="h-full overflow-hidden">{byId.get(page.wide)?.node}</div>
          ) : (
            <div className="grid h-full grid-cols-2" style={{ gap: GAP }}>
              {page.columns.map((column, c) => (
                <div key={c} className="flex min-h-0 flex-col overflow-hidden" style={{ gap: GAP }}>
                  {column.map((id) => (
                    <div key={id}>
                      {decorate ? decorate(id, byId.get(id)?.node) : byId.get(id)?.node}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
