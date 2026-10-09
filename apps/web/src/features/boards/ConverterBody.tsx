import type { BoardCard } from '../../app/boards/model';
import { convert, UNIT_LABELS, UNITS, type DistanceUnit } from '../../app/boards/units';
import { useBoardActions } from './context';

/**
 * A distance in feet, metres, grid squares, miles or kilometres, shown in all the others (the
 * table way: a square is 5 feet or 1.5 metres; the exact metres beside when they differ).
 */
export function ConverterBody({ card }: { card: Extract<BoardCard, { kind: 'converter' }> }) {
  const { update } = useBoardActions();
  const set = (patch: { value?: number; unit?: DistanceUnit }) => {
    update(card.id, (c) => (c.kind === 'converter' ? { ...c, ...patch } : c));
  };
  const field = 'rounded border border-border bg-surface px-2 py-1 text-sm';
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          aria-label="Distance"
          value={card.value}
          onChange={(e) => {
            set({ value: Number(e.target.value) || 0 });
          }}
          className={`${field} w-24 text-base font-bold`}
        />
        <select
          aria-label="Unit"
          value={card.unit}
          onChange={(e) => {
            set({ unit: e.target.value as DistanceUnit });
          }}
          className={`${field} min-w-0 flex-1`}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </select>
      </div>
      <dl aria-label="Converted" className="divide-y divide-border text-sm">
        {convert(card.value, card.unit).map((c) => (
          <div key={c.unit} className="flex items-baseline gap-2 py-1">
            <dt className="flex-1 text-muted">{UNIT_LABELS[c.unit]}</dt>
            <dd className="font-bold">{c.value.toLocaleString('en-US')}</dd>
            {c.exact !== undefined && (
              <dd className="text-xs text-muted" title="Exact metric value">
                (exactly {c.exact.toLocaleString('en-US')})
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
