import type { EntityDetail } from '@boh/data5e';
import type { ReactNode } from 'react';

/** A feature or trait has no entity of its own to hand a PrintCard; same look. */
export function FeatureCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article
      className="break-inside-avoid rounded-md border border-l-4 border-border bg-surface p-2.5 text-[11px] leading-snug"
      style={{ borderLeftColor: 'var(--boh-int)' }}
    >
      <h4 className="font-serif text-sm font-bold">{title}</h4>
      <p className="mb-1 text-[10px] text-muted">{subtitle}</p>
      <div className="[&_p]:my-1">{children}</div>
    </article>
  );
}

/** "DEX save · DC 15" for a spell with a saving throw. */
export function SaveLine({ spell, dc }: { spell: EntityDetail; dc: number | undefined }) {
  const save = spell.data.savingThrow;
  if (dc === undefined || !Array.isArray(save) || typeof save[0] !== 'string') return null;
  return (
    <p className="text-[10px] font-bold">
      {save[0].slice(0, 3).toUpperCase()} save · DC {dc}
    </p>
  );
}
