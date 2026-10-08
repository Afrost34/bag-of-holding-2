import { cn } from '@boh/ui';
import { ChevronRight, Dices } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../AppLink';
import { addLink, TABLE_KINDS, tablesLinkedTo, type RollTable, type TableLink } from './model';
import { useTables } from './store';
import { TableRoller, Wares } from './TableRoller';

/**
 * The roll tables linked to something (a note, an encounter, a creature), ready to roll; shops
 * show their wares. With `campaign` set (or `null` for the library), a table of that campaign
 * can be linked from here too.
 */
export function LinkedTables({
  link,
  campaign,
  onCreatures,
  creaturesLabel,
  compact = false,
  title = 'Tables',
}: {
  link: TableLink;
  /** Where tables that can be linked from here are kept; undefined hides the picker. */
  campaign?: string | null;
  onCreatures?: (keys: string[]) => void;
  creaturesLabel?: string;
  /** Narrow (a side panel): small headings. */
  compact?: boolean;
  title?: string;
}) {
  const { tables, loaded, load, save } = useTables();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const linked = tablesLinkedTo(tables, link);
  const linkable =
    campaign === undefined
      ? []
      : tables.filter((t) => (t.campaign ?? null) === campaign && !t.links.includes(link));
  if (linked.length === 0 && linkable.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-2">
      <h2
        className={
          compact
            ? 'flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase'
            : 'flex items-center gap-2 font-serif text-lg font-bold'
        }
      >
        <Dices className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden /> {title}
      </h2>
      {linked.length > 0 && (
        <ul className="space-y-2">
          {linked.map((t) => (
            <LinkedTable
              key={t.id}
              table={t}
              defaultOpen={linked.length === 1}
              {...(onCreatures ? { onCreatures } : {})}
              {...(creaturesLabel ? { creaturesLabel } : {})}
            />
          ))}
        </ul>
      )}
      {linkable.length > 0 && (
        <select
          value=""
          aria-label="Link a table"
          onChange={(e) => {
            const table = tables.find((t) => t.id === e.target.value);
            if (table) save(addLink(table, link));
          }}
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="">Link a table…</option>
          {linkable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </section>
  );
}

function LinkedTable({
  table,
  defaultOpen,
  onCreatures,
  creaturesLabel,
}: {
  table: RollTable;
  defaultOpen: boolean;
  onCreatures?: (keys: string[]) => void;
  creaturesLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const kind = TABLE_KINDS.find((k) => k.id === table.kind)?.label ?? '';
  return (
    <li aria-label={table.name} className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Fold ${table.name}` : `Open ${table.name}`}
          onClick={() => {
            setOpen(!open);
          }}
          className="rounded p-0.5 text-muted hover:bg-sunken"
        >
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', open && 'rotate-90')}
            aria-hidden
          />
        </button>
        <AppLink
          to={`/tables/${table.id}`}
          className="min-w-0 flex-1 truncate font-medium hover:underline"
        >
          {table.name}
        </AppLink>
        <span className="text-xs text-muted">{kind}</span>
      </div>
      {open && (
        <div className="border-t border-border p-2">
          {table.kind === 'shop' ? (
            <Wares table={table} />
          ) : (
            <TableRoller
              table={table}
              {...(onCreatures ? { onCreatures } : {})}
              {...(creaturesLabel ? { creaturesLabel } : {})}
            />
          )}
        </div>
      )}
    </li>
  );
}
