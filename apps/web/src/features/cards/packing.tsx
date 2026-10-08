import type { EntityDetail } from '@boh/data5e';
import { useMemo } from 'react';
import type { SheetCard } from '../../app/cards/model';
import { PrintCard } from '../../app/cards/PrintCard';
import { usePacking, type PackItem } from '../../app/cards/packing';

/** A card sheet's shown cards as items to pack (see `usePacking`), with their pages. */
export function useCardPacking(cards: readonly SheetCard[], entities: Map<string, EntityDetail>) {
  const items = useMemo<PackItem[]>(
    () =>
      cards.flatMap((c) => {
        const e = c.hidden ? undefined : entities.get(c.key);
        return e
          ? [
              {
                id: c.id,
                node: <PrintCard entity={e} />,
                ...(c.breakBefore ? { breakBefore: true } : {}),
              },
            ]
          : [];
      }),
    [cards, entities],
  );
  const key = items.map((i) => i.id).join('|');
  return { items, ...usePacking(items, key) };
}
