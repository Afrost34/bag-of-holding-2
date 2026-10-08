import type { EntityDetail } from '@boh/data5e';
import { Button } from '@boh/ui';
import { Dices } from 'lucide-react';
import { useState } from 'react';
import { useActiveCampaign } from '../campaigns/store';
import { useAppNavigate } from '../navigation';
import { kindForRows, rowsFromCompendium, withRows } from './model';
import { useTables } from './store';

/** Compendium entries that are tables of rows to roll on. */
const TABLE_TYPES = new Set(['table', 'magicItems', 'gems', 'artObjects']);

/**
 * "Copy to my tables" on a compendium table (trinkets, encounters, magic items…): a roll table
 * of your own in the open campaign, ready to edit, link and roll.
 */
export function CopyToTables({ entity }: { entity: EntityDetail }) {
  const active = useActiveCampaign();
  const navigate = useAppNavigate();
  const [busy, setBusy] = useState(false);
  if (!TABLE_TYPES.has(entity.type)) return null;
  const rows = rowsFromCompendium(entity.data);
  if (rows.length === 0) return null;
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        const store = useTables.getState();
        void store
          .load()
          .then(() => store.create(entity.name, kindForRows(rows), active?.id))
          .then((table) => {
            const filled = withRows(table, rows);
            useTables.getState().save(filled);
            navigate(`/tables/${filled.id}`);
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <Dices className="h-4 w-4" aria-hidden /> Copy to my tables
    </Button>
  );
}
