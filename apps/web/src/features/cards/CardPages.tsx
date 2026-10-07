import type { EntityDetail } from '@boh/data5e';
import type { SheetCard } from '../../app/cards/model';
import { PrintCard } from '../../app/cards/PrintCard';
import { GAP, MARGIN, PAGE_H, PAGE_W, type Packing } from './packing';

/** The packed pages, A4 size. */
export function CardPagesView({
  packing,
  cards,
  entities,
}: {
  packing: Packing;
  cards: readonly SheetCard[];
  entities: Map<string, EntityDetail>;
}) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <div className="paper">
      {packing.pages.map((page, i) => (
        <section
          key={i}
          aria-label={`Page ${String(i + 1)}`}
          className="sheet-page mx-auto mb-6 box-border overflow-hidden bg-bg shadow-card"
          style={{ width: PAGE_W, height: PAGE_H, padding: MARGIN }}
        >
          {page.wide ? (
            <WideCard id={page.wide} byId={byId} entities={entities} />
          ) : (
            <div className="grid h-full grid-cols-2" style={{ gap: GAP }}>
              {page.columns.map((column, c) => (
                <div key={c} className="flex min-h-0 flex-col overflow-hidden" style={{ gap: GAP }}>
                  {column.map((id) => {
                    const card = byId.get(id);
                    const e = card ? entities.get(card.key) : undefined;
                    return e ? <PrintCard key={id} entity={e} /> : null;
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function WideCard({
  id,
  byId,
  entities,
}: {
  id: string;
  byId: Map<string, SheetCard>;
  entities: Map<string, EntityDetail>;
}) {
  const card = byId.get(id);
  const e = card ? entities.get(card.key) : undefined;
  return e ? <PrintCard entity={e} className="h-full overflow-hidden" /> : null;
}
