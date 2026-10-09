import { makeKey, textToEntries, type EntityDetail } from '@boh/data5e';
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
import { useEntity } from '../data/entities';
import { SchoolIcon } from '../lists/cells';

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
  text,
}: {
  entity: EntityDetail;
  /** Overrides the entity's name ("Hoot" for a familiar). */
  title?: string;
  subtitle?: string;
  /** Shown under the subtitle: a save DC, who it belongs to… */
  extra?: ReactNode;
  className?: string;
  /** Text rewritten by hand (plain paragraphs), in place of the entry's own. */
  text?: string | undefined;
}) {
  const d = entity.data;
  const spell = entity.type === 'spell';
  return (
    <CardFrame
      accent={accentOf(entity)}
      className={className}
      icon={spell ? <SchoolIcon square school={cap(SCHOOLS[String(d.school)] ?? '')} /> : undefined}
      title={<RichText text={title ?? entity.name} />}
      subtitle={subtitle ?? subtitleOf(entity)}
      head={
        spell ? (
          <>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <dd>{castingTime(d)}</dd>
              <dd>{spellRange(d)}</dd>
              <dd>{components(d)}</dd>
              <dd>{spellDuration(d)}</dd>
            </dl>
            {extra}
          </>
        ) : (
          extra
        )
      }
    >
      {text !== undefined ? (
        <Entries entries={textToEntries(text)} />
      ) : spell ? (
        <>
          <Entries entries={d.entries} />
          {d.entriesHigherLevel !== undefined && <Entries entries={d.entriesHigherLevel} />}
        </>
      ) : (
        <>
          <EntityView type={entity.type} data={d} edition={entity.edition} />
          {Array.isArray(d.mastery) && <Masteries refs={d.mastery} />}
        </>
      )}
    </CardFrame>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A weapon's masteries (2024), each with what it does, under the weapon's own text. */
function Masteries({ refs }: { refs: unknown[] }) {
  return (
    <div className="mt-1.5 space-y-1 border-t border-border pt-1.5">
      {refs.flatMap((r) => {
        if (typeof r !== 'string') return [];
        const [name = '', source = 'XPHB'] = r.split('|');
        return [<Mastery key={r} entityKey={makeKey('itemMastery', [name], source)} name={name} />];
      })}
    </div>
  );
}

function Mastery({ entityKey, name }: { entityKey: string; name: string }) {
  const state = useEntity(entityKey);
  const entries = state.status === 'found' ? state.entity.data.entries : undefined;
  return (
    <div>
      <p className="font-bold">Mastery: {name}</p>
      {entries !== undefined && <Entries entries={entries} />}
    </div>
  );
}

/**
 * The look of every printed card (as the earlier app printed them): a coloured left edge, a
 * serif title with an optional icon, a blue-grey subtitle, what is read at a glance (`head`:
 * casting time, range, save…), then a rule and the full text.
 */
export function CardFrame({
  accent,
  icon,
  title,
  subtitle,
  head,
  className,
  uses,
  children,
}: {
  accent: string;
  icon?: ReactNode;
  title: ReactNode;
  subtitle: string;
  head?: ReactNode;
  className?: string | undefined;
  /** Boxes to tick off uses (a feature used once per Long Rest…), beside the title. */
  uses?: { count: number; per?: string } | null | undefined;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        'break-inside-avoid rounded-md border border-l-4 border-border bg-surface-2 px-3 py-2.5 text-[10.5px] leading-relaxed',
        className,
      )}
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-[15px] leading-tight font-bold">{title}</h4>
          <p
            className="text-[10px] first-letter:uppercase"
            style={{ color: 'var(--boh-paper-subtitle)' }}
          >
            {subtitle}
          </p>
        </div>
        {uses && (
          <div className="shrink-0 text-right" aria-label={`${String(uses.count)} uses`}>
            <div className="flex flex-wrap justify-end gap-0.5">
              {Array.from({ length: uses.count }, (_, i) => (
                <span key={i} className="inline-block h-3 w-3 rounded-sm border border-text" />
              ))}
            </div>
            {uses.per && <p className="text-[8px] text-muted uppercase">{uses.per}</p>}
          </div>
        )}
      </div>
      {head !== undefined && head !== null && <div className="mt-1.5 space-y-1">{head}</div>}
      {/* Headings inside an entry stay small: the card's title is its only big type. */}
      <div className="mt-2 border-t border-border pt-1.5 [&_h2]:mt-1.5 [&_h2]:text-[11px] [&_h3]:mt-1.5 [&_h3]:text-[11px] [&_h4]:mt-1.5 [&_h4]:text-[11px] [&_h5]:text-[11px] [&_p]:my-1">
        {children}
      </div>
    </article>
  );
}
