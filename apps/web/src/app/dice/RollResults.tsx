import { X } from 'lucide-react';
import { Breakdown, ModeBadge, OutcomeBadge } from './RollBreakdown';
import { useDice } from './store';

/** The latest rolls as cards in the corner; they fade out after a few seconds. */
export function RollResults() {
  const { log, shown, dismiss } = useDice();
  const entries = shown.map((id) => log.find((e) => e.id === id)).filter((e) => e !== undefined);
  if (entries.length === 0) return null;

  return (
    <ol
      aria-label="Roll results"
      aria-live="polite"
      className="pointer-events-none fixed right-3 bottom-20 z-50 flex w-72 flex-col-reverse gap-2 sm:right-4"
    >
      {entries.map((entry, i) => (
        <li
          key={entry.id}
          className="pointer-events-auto animate-[fade-in_150ms_ease-out] rounded-lg border border-border bg-surface p-3 shadow-card"
          style={{ opacity: i === 0 ? 1 : 0.85 }}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted" title={entry.label}>
                {entry.label ?? 'Roll'}
              </p>
              <p className="flex items-center gap-2">
                <span className="font-serif text-3xl font-bold" data-testid="roll-total">
                  {entry.total}
                </span>
                <ModeBadge mode={entry.mode} />
                <OutcomeBadge entry={entry} />
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss roll"
              onClick={() => {
                dismiss(entry.id);
              }}
              className="rounded p-0.5 text-faint hover:bg-sunken hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Breakdown text={entry.breakdown} className="mt-1 block break-words text-muted" />
          {entry.alternatives?.map((alt) => (
            <Breakdown key={alt.expression} text={alt.breakdown} className="block text-muted" />
          ))}
        </li>
      ))}
    </ol>
  );
}
