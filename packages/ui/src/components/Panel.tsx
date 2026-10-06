import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  actions?: ReactNode;
}

/** A card with the dark section header used across the app and on the printed sheet. */
export function Panel({ title, actions, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-surface shadow-card',
        className,
      )}
      {...props}
    >
      {title !== undefined && (
        <header className="flex items-center justify-between bg-header px-3 py-1.5">
          <h2 className="font-serif text-xs font-bold tracking-wide text-header-fg uppercase">
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}
