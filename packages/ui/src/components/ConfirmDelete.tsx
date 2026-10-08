import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../cn';

/**
 * A small bin button that asks once before deleting: the first click turns it into "Delete?"
 * with Yes / No. For cards in lists of sheets, boards, encounters and maps.
 */
export function ConfirmDelete({
  name,
  onDelete,
  className,
}: {
  /** What is deleted, for the button's name ("Delete Session 12"). */
  name: string;
  onDelete: () => void;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (asking)
    return (
      <span
        role="group"
        aria-label={`Delete ${name}?`}
        className={cn(
          'flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs shadow-card',
          className,
        )}
      >
        <span className="font-semibold">Delete?</span>
        <button
          type="button"
          onClick={onDelete}
          className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-fg hover:bg-accent-hover"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => {
            setAsking(false);
          }}
          className="rounded px-1.5 py-0.5 hover:bg-sunken"
        >
          No
        </button>
      </span>
    );
  return (
    <button
      type="button"
      aria-label={`Delete ${name}`}
      title={`Delete ${name}`}
      onClick={() => {
        setAsking(true);
      }}
      className={cn('rounded p-1.5 text-muted hover:bg-sunken hover:text-text', className)}
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}
