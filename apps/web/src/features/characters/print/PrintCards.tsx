import type { EntityDetail } from '@boh/data5e';
import type { ReactNode } from 'react';
import { CardFrame } from '../../../app/cards/PrintCard';
import type { FeatureUses } from './featureUses';

/** A feature or trait has no entity of its own to hand a PrintCard; same look. */
export function FeatureCard({
  title,
  subtitle,
  from,
  uses,
  children,
}: {
  title: string;
  subtitle: string;
  /** Boxes to tick off its uses. */
  uses?: FeatureUses | null;
  /** The entity it comes from: the card's edge takes its colour (species, background…). */
  from: string;
  children: ReactNode;
}) {
  return (
    <CardFrame accent={edgeColor(from)} title={title} subtitle={subtitle} uses={uses}>
      {children}
    </CardFrame>
  );
}

/** Species green, background orange, feats gold, class and subclass features purple. */
function edgeColor(from: string): string {
  if (/^(race|subrace):/.test(from)) return 'var(--boh-dex)';
  if (from.startsWith('background:')) return 'var(--boh-con)';
  if (from.startsWith('feat:')) return 'var(--boh-cha)';
  return 'var(--boh-wis)';
}

/** "DEX save · DC 15" for a spell with a saving throw. */
export function SaveLine({ spell, dc }: { spell: EntityDetail; dc: number | undefined }) {
  const save = spell.data.savingThrow;
  if (dc === undefined || !Array.isArray(save) || typeof save[0] !== 'string') return null;
  return (
    <p className="flex items-center gap-2 text-[10.5px] font-bold">
      <span className="rounded bg-sunken px-1.5 py-0.5 tracking-wide">
        {save[0].slice(0, 3).toUpperCase()}
      </span>
      DC {dc}
    </p>
  );
}
