import { cn, Panel } from '@boh/ui';
import { Database, Download } from 'lucide-react';
import { AppLink } from '../../app/AppLink';
import { navModules } from '../../app/nav';

export function HomePage() {
  const modules = navModules.filter((m) => m.path !== '/' && m.footer !== true);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="font-serif text-2xl font-bold md:text-3xl">Bag of Holding</h1>
        <p className="mt-1 text-muted">Everything for your table, in one place, online or off.</p>
      </header>

      <Panel title="5etools data">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Database className="h-8 w-8 shrink-0 text-faint" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Not downloaded yet</p>
            <p className="text-sm text-muted">
              Downloading and updating the 5etools data arrives in milestone 1. It is stored on this
              device only and never uploaded.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-faint sm:self-center">
            <Download className="h-3.5 w-3.5" aria-hidden /> Coming in M1
          </span>
        </div>
      </Panel>

      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="mb-3 font-serif text-lg font-bold">
          Modules
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <li key={m.path}>
                <AppLink
                  to={m.path}
                  className={cn(
                    'flex h-full gap-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors',
                    'hover:border-accent/60 hover:bg-surface-2',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{m.label}</span>
                      {m.milestone !== undefined && (
                        <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                          M{m.milestone}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{m.description}</span>
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
