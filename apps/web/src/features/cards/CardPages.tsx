import { PackedPages } from '../../app/cards/PackedPages';
import type { Packing, PackItem } from '../../app/cards/packing';

/** The packed pages, A4 size. */
export function CardPagesView({
  packing,
  items,
}: {
  packing: Packing;
  items: readonly PackItem[];
}) {
  return (
    <div className="paper">
      <PackedPages packing={packing} items={items} label="Page" />
    </div>
  );
}
