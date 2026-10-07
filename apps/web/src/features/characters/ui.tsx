import { cn } from '@boh/ui';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/**
 * Builder building blocks in D&D Beyond's style: a folding row with a title, a small line under
 * it ("2 Choices · 1st level"), and a blue marker while something inside still needs a pick.
 */
export function Accordion({
  title,
  subtitle,
  pending = false,
  defaultOpen,
  right,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Something inside still needs a pick: marked, and open by default. */
  pending?: boolean;
  defaultOpen?: boolean;
  /** Shown at the right of the header (a button, a count…). */
  right?: ReactNode;
  children?: ReactNode;
}) {
  // Until it is clicked, it follows `pending`, which often arrives after the first render.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? defaultOpen ?? pending;
  const setOpen = (v: boolean) => {
    setToggled(v);
  };
  const label = typeof title === 'string' ? title : undefined;
  return (
    <section
      aria-label={label}
      className={cn(
        'relative rounded-md border bg-surface',
        pending ? 'border-accent' : 'border-border',
      )}
    >
      {pending && (
        <span
          className="absolute -top-2 -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-fg"
          aria-label="Needs a choice"
        >
          !
        </span>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{title}</span>
            {subtitle && <span className="block text-xs text-muted">{subtitle}</span>}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-faint transition', open && 'rotate-180')}
            aria-hidden
          />
        </button>
        {right && <div className="pr-3">{right}</div>}
      </div>
      {open && children !== undefined && (
        <div className="border-t border-border px-3 py-3">{children}</div>
      )}
    </section>
  );
}

/** Page heading of a builder step: "Choose Origin: Background". */
export function StepTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-2xl">{children}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}
