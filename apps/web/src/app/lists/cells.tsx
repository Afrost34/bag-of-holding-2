import type { FieldDef, ListRow } from '@boh/data5e';
import { cn } from '@boh/ui';
import {
  Drama,
  Eye,
  Flame,
  Heart,
  PackageOpen,
  Repeat,
  Shield,
  Skull,
  type LucideIcon,
} from 'lucide-react';
import { cellText, valueLabel } from './labels';
import { rarityClass } from './rarity';

const SCHOOLS: Record<string, { icon: LucideIcon; className: string }> = {
  Abjuration: { icon: Shield, className: 'bg-school-abjuration' },
  Conjuration: { icon: PackageOpen, className: 'bg-school-conjuration' },
  Divination: { icon: Eye, className: 'bg-school-divination' },
  Enchantment: { icon: Heart, className: 'bg-school-enchantment' },
  Evocation: { icon: Flame, className: 'bg-school-evocation' },
  Illusion: { icon: Drama, className: 'bg-school-illusion' },
  Necromancy: { icon: Skull, className: 'bg-school-necromancy' },
  Transmutation: { icon: Repeat, className: 'bg-school-transmutation' },
};

/** A spell school as a coloured round badge. */
export function SchoolIcon({ school, small = false }: { school: string; small?: boolean }) {
  const entry = SCHOOLS[school];
  const Icon = entry?.icon ?? Shield;
  return (
    <span
      title={school}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-white',
        small ? 'h-4 w-4' : 'h-9 w-9 ring-2 ring-surface',
        entry?.className ?? 'bg-border-strong',
      )}
    >
      <Icon className={small ? 'h-2.5 w-2.5' : 'h-[18px] w-[18px]'} aria-hidden />
    </span>
  );
}

/** The content of one list cell. */
export function Cell({ row, field }: { row: ListRow; field: FieldDef }) {
  if (field.id === 'rarity' && typeof row.f.rarity === 'string') {
    return (
      <span className={cn('font-medium', rarityClass(row.f.rarity))}>
        {valueLabel('rarity', row.f.rarity)}
      </span>
    );
  }
  const value = cellText(row, field);
  if (value === '') return <span className="text-faint">—</span>;
  // Spells: concentration and ritual as small badges, like on the printed page.
  const badge =
    field.id === 'duration' && row.f.concentration === true
      ? { letter: 'C', title: 'Concentration' }
      : field.id === 'time' && row.f.ritual === true
        ? { letter: 'R', title: 'Ritual' }
        : null;
  const full = field.id === 'duration' ? row.f.duration : field.id === 'range' ? row.f.range : null;
  return (
    <span
      className="flex min-w-0 items-center gap-1.5"
      title={typeof full === 'string' ? full : value}
    >
      <span className="truncate">{value}</span>
      {badge && (
        <span
          title={badge.title}
          aria-label={badge.title}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong text-[10px] font-bold text-muted"
        >
          {badge.letter}
        </span>
      )}
    </span>
  );
}
