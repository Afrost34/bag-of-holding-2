import { X } from 'lucide-react';
import { Breakdown, ModeBadge, OutcomeBadge } from './RollBreakdown';
import { useDice } from './store';

/** `1d20 + 5 → [17] + 5 = 22` without the total at the end (it is shown large beside it). */
const mathOf = (breakdown: string) => breakdown.replace(/\s*=\s*-?\d+\s*$/, '');

/**
 * The latest rolls in the corner, one compact line each: the total and the maths (what was
 * rolled is in the tooltip). They fade out after a few seconds.
 */
export function RollResults() {
  const { log, shown, dismiss } = useDice();
  const entries = shown.map((id) => log.find((e) => e.id === id)).filter((e) => e !== undefined);
  if (entries.length === 0) return null;

  return (
    <ol
      aria-label="Roll results"
      aria-live="polite"
      className="pointer-events-none fixed right-3 bottom-20 z-50 flex w-64 flex-col-reverse gap-1.5 sm:right-4"
    >
      {entries.map((entry, i) => (
        <li
          key={entry.id}
          title={entry.label ?? 'Roll'}
          aria-label={entry.label ?? 'Roll'}
          className="pointer-events-auto flex animate-[fade-in_150ms_ease-out] items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1 shadow-card"
          style={{ opacity: i === 0 ? 1 : 0.85 }}
        >
          <span className="font-serif text-xl font-bold" data-testid="roll-total">
            {entry.total}
          </span>
          <span className="min-w-0 flex-1">
            <Breakdown text={mathOf(entry.breakdown)} className="block truncate text-muted" />
            {entry.alternatives?.map((alt) => (
              <Breakdown
                key={alt.expression}
                text={alt.breakdown}
                className="block truncate text-muted"
              />
            ))}
          </span>
          <ModeBadge mode={entry.mode} />
          <OutcomeBadge entry={entry} />
          <button
            type="button"
            aria-label="Dismiss roll"
            onClick={() => {
              dismiss(entry.id);
            }}
            className="rounded p-0.5 text-faint hover:bg-sunken hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ol>
  );
}
