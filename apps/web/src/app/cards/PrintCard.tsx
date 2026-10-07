import type { EntityDetail } from '@boh/data5e';
import {
  castingTime,
  components,
  itemTypeLine,
  spellDuration,
  spellLevelSchool,
  spellRange,
} from '@boh/data5e/format';
import { Entries, EntityView, RichText } from '@boh/renderer';
import { cn } from '@boh/ui';
import type { ReactNode } from 'react';
import { typeLabel } from '../format';

const SCHOOLS: Record<string, string> = {
  A: 'abjuration', C: 'conjuration', D: 'divination', E: 'enchantment', V: 'evocation',
  I: 'illusion', N: 'necromancy', T: 'transmutation',
}; // prettier-ignore
const RARITY: Record<string, string> = {
  uncommon: 'var(--boh-rarity-uncommon)',
  rare: 'var(--boh-rarity-rare)',
  'very rare': 'var(--boh-rarity-very-rare)',
  legendary: 'var(--boh-rarity-legendary)',
  artifact: 'var(--boh-rarity-artifact)',
};

/** The coloured edge of a card: a spell's school, an item's rarity, otherwise neutral. */
function accentOf(entity: EntityDetail): string {
  const d = entity.data;
  if (entity.type === 'spell')
    return `var(--boh-school-${SCHOOLS[String(d.school)] ?? 'evocation'})`;
  if (typeof d.rarity === 'string' && RARITY[d.rarity]) return RARITY[d.rarity] ?? '';
  if (entity.type === 'monster') return 'var(--boh-str)';
  return 'var(--boh-int)';
}

function subtitleOf(entity: EntityDetail): string {
  const d = entity.data;
  if (entity.type === 'spell') return spellLevelSchool(d, entity.edition);
  if (['item', 'baseitem', 'magicvariant'].includes(entity.type)) return itemTypeLine(d);
  return typeLabel(entity.type);
}

/**
 * A card for paper: name, what it is, and the full entry, in small type with a coloured edge.
 * Used on card sheets and at the end of the printed character sheet.
 */
export function PrintCard({
  entity,
  title,
  subtitle,
  extra,
  className,
}: {
  entity: EntityDetail;
  /** Overrides the entity's name ("Hoot" for a familiar). */
  title?: string;
  subtitle?: string;
  /** Shown under the subtitle: a save DC, who it belongs to… */
  extra?: ReactNode;
  className?: string;
}) {
  const d = entity.data;
  return (
    <article
      className={cn(
        'break-inside-avoid rounded-md border border-l-4 border-border bg-surface p-2.5 text-[11px] leading-snug',
        className,
      )}
      style={{ borderLeftColor: accentOf(entity) }}
    >
      <h4 className="font-serif text-sm font-bold">
        <RichText text={title ?? entity.name} />
      </h4>
      <p className="mb-1 text-[10px] text-muted first-letter:uppercase">
        {subtitle ?? subtitleOf(entity)}
      </p>
      {extra}
      <div className="[&_p]:my-1">
        {entity.type === 'spell' ? (
          <>
            <dl className="mb-1 grid grid-cols-2 gap-x-2 border-b border-border pb-1 text-[10px]">
              <dd>{castingTime(d)}</dd>
              <dd>{spellRange(d)}</dd>
              <dd>{components(d)}</dd>
              <dd>{spellDuration(d)}</dd>
            </dl>
            <Entries entries={d.entries} />
            {d.entriesHigherLevel !== undefined && <Entries entries={d.entriesHigherLevel} />}
          </>
        ) : (
          <EntityView type={entity.type} data={d} edition={entity.edition} />
        )}
      </div>
    </article>
  );
}
