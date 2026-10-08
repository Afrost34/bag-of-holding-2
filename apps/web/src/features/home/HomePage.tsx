import { cn } from '@boh/ui';
import { AppLink } from '../../app/AppLink';
import { navModules } from '../../app/nav';
import { useData } from '../../app/data/store';
import { DataStatusCard } from './DataStatusCard';
import { GetStarted } from './GetStarted';

export function HomePage() {
  const status = useData((s) => s.status);
  const modules = navModules.filter((m) => m.path !== '/' && m.footer !== true);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="font-serif text-2xl font-bold md:text-3xl">Bag of Holding</h1>
        <p className="mt-1 text-muted">Everything for your table, in one place, online or off.</p>
      </header>

      <GetStarted />
      {/* Once the data is in (or while another window holds it); before, Get started has it. */}
      {(status?.installed === true || status?.storage === 'busy') && <DataStatusCard />}

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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
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
