import type { ReactNode } from 'react';

/** Compendium page title: large serif heading over an accent rule. */
export function PageHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end gap-x-4 gap-y-1 border-b-2 border-accent pb-2">
      <h1 className="font-serif text-2xl font-bold sm:text-3xl">{children}</h1>
      {aside !== undefined && <div className="ml-auto text-sm text-muted">{aside}</div>}
    </header>
  );
}
