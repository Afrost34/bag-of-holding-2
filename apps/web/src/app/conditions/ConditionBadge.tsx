import { cn } from '@boh/ui';
import {
  ArrowDownToLine,
  Ban,
  BatteryLow,
  Biohazard,
  EarOff,
  EyeOff,
  Frown,
  Ghost,
  Grab,
  Heart,
  Link,
  Moon,
  Mountain,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The fifteen conditions, each with an icon and a colour of its own, so a tracker row or a chip
 * reads at a glance ("Prone" is a blue arrow down, "Poisoned" a green biohazard).
 */
const INFO: Record<string, { icon: LucideIcon; className: string }> = {
  Blinded: { icon: EyeOff, className: 'text-cond-blinded bg-cond-blinded/15' },
  Charmed: { icon: Heart, className: 'text-cond-charmed bg-cond-charmed/15' },
  Deafened: { icon: EarOff, className: 'text-cond-deafened bg-cond-deafened/15' },
  Exhaustion: { icon: BatteryLow, className: 'text-cond-exhaustion bg-cond-exhaustion/15' },
  Frightened: { icon: Frown, className: 'text-cond-frightened bg-cond-frightened/15' },
  Grappled: { icon: Grab, className: 'text-cond-grappled bg-cond-grappled/15' },
  Incapacitated: { icon: Ban, className: 'text-cond-incapacitated bg-cond-incapacitated/15' },
  Invisible: { icon: Ghost, className: 'text-cond-invisible bg-cond-invisible/15' },
  Paralyzed: { icon: Zap, className: 'text-cond-paralyzed bg-cond-paralyzed/15' },
  Petrified: { icon: Mountain, className: 'text-cond-petrified bg-cond-petrified/15' },
  Poisoned: { icon: Biohazard, className: 'text-cond-poisoned bg-cond-poisoned/15' },
  Prone: { icon: ArrowDownToLine, className: 'text-cond-prone bg-cond-prone/15' },
  Restrained: { icon: Link, className: 'text-cond-restrained bg-cond-restrained/15' },
  Stunned: { icon: Sparkles, className: 'text-cond-stunned bg-cond-stunned/15' },
  Unconscious: { icon: Moon, className: 'text-cond-unconscious bg-cond-unconscious/15' },
};

/**
 * A condition as a coloured chip with its icon. `compact` shows the icon only (the name stays
 * the tooltip and the accessible name).
 */
export function ConditionBadge({
  condition,
  compact = false,
  className,
  children,
}: {
  condition: string;
  compact?: boolean;
  className?: string;
  /** Extra controls inside the chip (a remove button). */
  children?: ReactNode;
}) {
  const info = INFO[condition];
  const Icon = info?.icon;
  return (
    <span
      title={condition}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold',
        info?.className ?? 'bg-sunken text-muted',
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {compact ? <span className="sr-only">{condition}</span> : condition}
      {children}
    </span>
  );
}
