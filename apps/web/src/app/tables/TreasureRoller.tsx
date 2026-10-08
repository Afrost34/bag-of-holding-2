import { RichText } from '@boh/renderer';
import { Button } from '@boh/ui';
import { Coins, NotebookPen, X } from 'lucide-react';
import { useState } from 'react';
import { EntryName } from './TableRoller';
import {
  crNumber,
  formatCoins,
  rollTreasure,
  tableForCr,
  plainName,
  treasureText,
  type Found,
  type Treasure,
  type TreasureKind,
} from './treasure';
import { loadTreasure } from './treasureData';

const CRS = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))];

function FoundLabel({ found }: { found: Found }) {
  return 'key' in found ? <EntryName entryKey={found.key} /> : <RichText text={found.text} />;
}

/**
 * Rolls treasure by challenge rating on the Dungeon Master's Guide tables: an individual
 * creature's pocket money or a whole hoard, from the 2014 or the 2024 book.
 */
export function TreasureRoller({
  cr: initialCr = '1',
  edition: initialEdition = '2024',
  onKeep,
}: {
  cr?: string;
  edition?: '2014' | '2024';
  /** Keeps what was rolled (as text), e.g. in an encounter's notes. */
  onKeep?: (text: string) => void;
}) {
  const [kind, setKind] = useState<TreasureKind>('hoard');
  const [cr, setCr] = useState(initialCr);
  const [edition, setEdition] = useState(initialEdition);
  const [rolled, setRolled] = useState<Treasure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roll = () => {
    void loadTreasure()
      .then((data) => {
        const table = tableForCr(data[kind], crNumber(cr), edition);
        if (!table) {
          setError('The treasure tables are not in your 5etools data.');
          return;
        }
        setError(null);
        setRolled((r) => [rollTreasure(table, data.tables(edition)), ...r]);
      })
      .catch(() => {
        setError('The treasure tables could not be read.');
      });
  };
  const select = 'rounded-md border border-border bg-surface px-2 py-1 text-sm';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          aria-label="Treasure for"
          onChange={(e) => {
            setKind(e.target.value === 'individual' ? 'individual' : 'hoard');
          }}
          className={select}
        >
          <option value="hoard">A hoard</option>
          <option value="individual">One creature</option>
        </select>
        <label className="flex items-center gap-1 text-sm">
          CR
          <select
            value={cr}
            aria-label="Challenge rating"
            onChange={(e) => {
              setCr(e.target.value);
            }}
            className={select}
          >
            {CRS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <select
          value={edition}
          aria-label="Rules"
          onChange={(e) => {
            setEdition(e.target.value === '2014' ? '2014' : '2024');
          }}
          className={select}
        >
          <option value="2024">2024 rules</option>
          <option value="2014">2014 rules</option>
        </select>
        <Button variant="primary" onClick={roll}>
          <Coins className="h-4 w-4" aria-hidden /> Roll treasure
        </Button>
        {rolled.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setRolled([]);
            }}
          >
            <X className="h-4 w-4" aria-hidden /> Clear
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-muted">{error}</p>}
      {rolled.length > 0 && (
        <ol aria-label="Treasure rolled" className="space-y-2">
          {rolled.map((t, i) => {
            const coins = formatCoins(t.coins);
            const empty = !coins && t.valuables.length === 0 && t.magicItems.length === 0;
            return (
              <li
                key={rolled.length - i}
                className="rounded-md border border-border bg-surface p-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-muted">{t.from}</span>
                  {onKeep && (
                    <button
                      type="button"
                      onClick={() => {
                        onKeep(treasureText(t, plainName));
                      }}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-link hover:bg-sunken"
                    >
                      <NotebookPen className="h-3.5 w-3.5" aria-hidden /> Add to the notes
                    </button>
                  )}
                </div>
                {empty && <p className="text-muted">Nothing.</p>}
                {coins && <p className="font-semibold tabular-nums">{coins}</p>}
                {(t.valuables.length > 0 || t.magicItems.length > 0) && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {t.valuables.map((v, j) => (
                      <li key={`v${String(j)}`}>
                        <FoundLabel found={v.found} />{' '}
                        <span className="text-xs text-muted">({v.value} gp)</span>
                      </li>
                    ))}
                    {t.magicItems.map((m, j) => (
                      <li key={`m${String(j)}`}>
                        <FoundLabel found={m} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
