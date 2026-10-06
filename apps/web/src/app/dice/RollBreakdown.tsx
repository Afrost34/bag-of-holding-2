import { cn } from '@boh/ui';
import { outcomeText, type RollEntry } from './roll';

/** `1d20 + 5 → [~~4~~, 17] + 5 = 22` with dropped dice struck through. */
export function Breakdown({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(~~\d+~~)/);
  return (
    <span className={cn('font-mono text-xs', className)}>
      {parts.map((p, i) =>
        p.startsWith('~~') ? (
          <s key={i} className="opacity-50">
            {p.slice(2, -2)}
          </s>
        ) : (
          p
        ),
      )}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: RollEntry['mode'] }) {
  if (mode === 'normal') return null;
  return (
    <span
      className={cn(
        'rounded px-1 text-[10px] font-bold uppercase',
        mode === 'advantage' ? 'bg-dex/20 text-dex' : 'bg-str/20 text-str',
      )}
    >
      {mode === 'advantage' ? 'Adv' : 'Dis'}
    </span>
  );
}

export function OutcomeBadge({ entry }: { entry: RollEntry }) {
  const text = outcomeText(entry);
  if (!text) return null;
  const good = entry.outcome === 'success' || (entry.kind === 'coin' && entry.total === 1);
  return (
    <span
      className={cn(
        'rounded px-1.5 text-xs font-semibold',
        good ? 'bg-dex/20 text-dex' : 'bg-sunken text-muted',
      )}
    >
      {text}
    </span>
  );
}
