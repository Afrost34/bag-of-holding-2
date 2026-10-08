import type { EntityDetail } from '@boh/data5e';
import { EntityView, RichText } from '@boh/renderer';
import { cn } from '@boh/ui';
import { useSourceList } from '../data/sourceList';
import { typeLabel } from '../format';

/** Type, source and page, e.g. `Spell · Player's Handbook (2024) p. 274`. */
export function EntityMeta({ entity, className }: { entity: EntityDetail; className?: string }) {
  const sourceName = useSourceList(
    (s) => s.sources.find((x) => x.id.toLowerCase() === entity.source.toLowerCase())?.name,
  );
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 text-sm text-muted', className)}>
      <span>{typeLabel(entity.type)}</span>
      <span aria-hidden>·</span>
      <span title={entity.source}>{sourceName ?? entity.source}</span>
      {entity.page !== null && <span>p. {entity.page}</span>}
      <span className="rounded bg-sunken px-1 text-[10px] font-semibold">{entity.edition}</span>
      {entity.layer === 'homebrew' && (
        <span className="rounded bg-accent-soft px-1 text-[10px] font-semibold text-accent-ink">
          Homebrew
        </span>
      )}
    </p>
  );
}

/** An entity as a self-contained card: used for previews and statblocks embedded in books. */
export function EntityCard({
  entity,
  compact = false,
}: {
  entity: EntityDetail;
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        'rounded-lg border border-border bg-surface',
        compact ? 'p-3' : 'p-4 shadow-card',
      )}
    >
      <h3
        className={cn('font-serif font-bold', compact ? 'text-lg' : 'text-xl')}
        data-title={entity.name}
      >
        <RichText text={entity.name} />
      </h3>
      <EntityMeta entity={entity} className="mb-1" />
      <EntityView type={entity.type} data={entity.data} edition={entity.edition} />
    </article>
  );
}
