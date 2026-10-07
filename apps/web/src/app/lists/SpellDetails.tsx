import type { EntityDetail, ListRow } from '@boh/data5e';
import { castingTime, components, spellDuration, spellRange } from '@boh/data5e/format';
import { Entries, RichText } from '@boh/renderer';
import { valueLabel } from './labels';

/** Spells as on D&D Beyond: a grid of stats over the description. */
export function SpellDetails({ row, entity }: { row: ListRow; entity: EntityDetail }) {
  const d = entity.data;
  const text = (v: unknown) => (typeof v === 'string' && v !== '' ? v : '—');
  const stats: [string, string][] = [
    ['Level', valueLabel('level', String(row.f.level ?? 0))],
    ['Casting Time', castingTime(d)],
    ['Range/Area', spellRange(d)],
    ['Components', components(d)],
    ['Duration', spellDuration(d)],
    ['School', text(row.f.school)],
    ['Attack/Save', text(row.f.attack)],
    ['Damage/Effect', text(row.f.effect)],
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b-2 border-accent pb-4 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">
              {label}
            </dt>
            <dd className="first-letter:uppercase">
              <RichText text={value} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <Entries entries={d.entries} />
        {d.entriesHigherLevel !== undefined && <Entries entries={d.entriesHigherLevel} />}
      </div>
    </>
  );
}
