import { RichText } from '@boh/renderer';
import { Button } from '@boh/ui';
import { Dices, Swords, X } from 'lucide-react';
import { useState } from 'react';
import { AppLink } from '../AppLink';
import { entityPath, useEntity } from '../data/entities';
import { useBuildEncounter } from './buildEncounter';
import {
  creaturesOf,
  formatRange,
  priceOfValue,
  rollTable,
  rowRanges,
  type RollTable,
  type TableRoll,
  type TableRow,
} from './model';

/** A compendium entry's name, linked to its page (the key while it loads). */
export function EntryName({ entryKey }: { entryKey: string }) {
  const state = useEntity(entryKey);
  const name =
    state.status === 'found' ? state.entity.name : (entryKey.split(':')[1]?.split('@')[0] ?? '');
  return (
    <AppLink to={entityPath(entryKey)} className="font-medium text-link hover:underline">
      {name}
    </AppLink>
  );
}

/** What a row says: its entry, its text, or both. */
export function RowLabel({ row }: { row: TableRow }) {
  return (
    <>
      {row.key && <EntryName entryKey={row.key} />}
      {row.key && row.text && ' '}
      {row.text && (
        <span className={row.key ? 'text-muted' : ''}>
          <RichText text={row.text} />
        </span>
      )}
    </>
  );
}

/** A shop row's price: the one typed in, else the item's own value. */
export function RowPrice({ row }: { row: TableRow }) {
  const state = useEntity(row.price || !row.key ? null : row.key);
  const price =
    row.price ?? (state.status === 'found' ? priceOfValue(state.entity.data.value) : undefined);
  return <span className="tabular-nums">{price ?? '—'}</span>;
}

/**
 * Rolls a table and lists what came up. Encounter tables turn their creatures into an encounter
 * (`onCreatures`, else a new encounter in the table's campaign).
 */
export function TableRoller({
  table,
  onCreatures,
  creaturesLabel = 'Build an encounter',
}: {
  table: RollTable;
  onCreatures?: (keys: string[]) => void;
  creaturesLabel?: string;
}) {
  const [rolls, setRolls] = useState<TableRoll[]>([]);
  const [times, setTimes] = useState(1);
  const build = useBuildEncounter();
  const creatures = creaturesOf(rolls);
  const ranges = new Map(rowRanges(table).map((r) => [r.id, r]));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          disabled={table.rows.length === 0}
          aria-label={`Roll ${table.name}`}
          onClick={() => {
            const next = Array.from({ length: times }, () => rollTable(table)).flatMap((r) =>
              r ? [r] : [],
            );
            setRolls((rs) => [...next, ...rs]);
          }}
        >
          <Dices className="h-4 w-4" aria-hidden /> Roll
        </Button>
        <label className="flex items-center gap-1 text-sm text-muted">
          ×
          <input
            type="number"
            min={1}
            max={20}
            value={times}
            aria-label={`Rolls of ${table.name} at once`}
            onChange={(e) => {
              setTimes(Math.max(1, Math.min(20, Math.round(Number(e.target.value)) || 1)));
            }}
            className="w-14 rounded-md border border-border bg-surface px-2 py-1 text-text"
          />
        </label>
        {rolls.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setRolls([]);
            }}
          >
            <X className="h-4 w-4" aria-hidden /> Clear
          </Button>
        )}
        {creatures.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              if (onCreatures) onCreatures(creatures);
              else build(table.name, table.campaign, creatures);
            }}
          >
            <Swords className="h-4 w-4" aria-hidden /> {creaturesLabel}
          </Button>
        )}
      </div>
      {rolls.length > 0 && (
        <ol aria-label={`Rolled on ${table.name}`} className="space-y-1 text-sm">
          {rolls.map((r, i) => (
            <li key={rolls.length - i} className="flex items-baseline gap-2">
              <span
                className="w-10 shrink-0 text-right font-mono text-xs text-muted tabular-nums"
                title={`Range ${formatRange(ranges.get(r.row.id) ?? { from: r.number, to: r.number })}`}
              >
                {r.number}
              </span>
              <span className="min-w-0 flex-1">
                {(r.row.count !== undefined || r.count !== 1) && (
                  <span className="font-semibold tabular-nums">{r.count} × </span>
                )}
                <RowLabel row={r.row} />
                {r.countRoll && <span className="ml-1 text-xs text-faint">({r.countRoll})</span>}
                {table.kind === 'shop' && (
                  <span className="ml-1 text-xs text-muted">
                    · <RowPrice row={r.row} />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** A shop's wares and prices. */
export function Wares({ table }: { table: RollTable }) {
  if (table.rows.length === 0) return <p className="text-sm text-muted">Nothing for sale yet.</p>;
  return (
    <ul aria-label={`Wares of ${table.name}`} className="divide-y divide-border text-sm">
      {table.rows.map((r) => (
        <li key={r.id} className="flex items-baseline gap-2 py-1">
          <span className="min-w-0 flex-1">
            {r.count && <span className="text-muted tabular-nums">{r.count} × </span>}
            <RowLabel row={r} />
          </span>
          <RowPrice row={r} />
        </li>
      ))}
    </ul>
  );
}
