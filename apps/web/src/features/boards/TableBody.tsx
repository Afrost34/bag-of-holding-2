import { useContext, useEffect } from 'react';
import type { BoardCard } from '../../app/boards/model';
import { JournalViewContext } from '../../app/journal/notes/context';
import { TableRoller } from '../../app/tables/TableRoller';
import { useTables } from '../../app/tables/store';
import { useBoardActions } from './context';

/**
 * One of the roll tables (Tables), rolled from the board: wild magic, rumours, loot. Picked from
 * the board's campaign and the library when the card is new.
 */
export function TableBody({ card }: { card: Extract<BoardCard, { kind: 'table' }> }) {
  const { update } = useBoardActions();
  const campaignId = useContext(JournalViewContext)?.campaignId;
  const { tables, loaded, load } = useTables();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const table = card.table ? tables.find((t) => t.id === card.table) : undefined;
  if (!loaded) return <p className="text-muted">Loading…</p>;
  if (table) return <TableRoller table={table} />;
  const choices = tables
    .filter((t) => !t.campaign || t.campaign === campaignId)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return (
    <div className="space-y-2">
      {card.table && <p className="text-muted">That table is gone. Pick another:</p>}
      {choices.length === 0 ? (
        <p className="text-muted">No tables yet: make one in Tables.</p>
      ) : (
        <ul aria-label="Tables" className="divide-y divide-border">
          {choices.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  update(card.id, (c) => (c.kind === 'table' ? { ...c, table: t.id } : c));
                }}
                className="w-full py-1.5 text-left hover:text-accent-ink"
              >
                {t.name}
                <span className="ml-1 text-xs text-muted">({t.rows.length} rows)</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
