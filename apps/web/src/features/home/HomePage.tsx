import { cn } from '@boh/ui';
import {
  FilePlus,
  LayoutDashboard,
  Map as MapIcon,
  Swords,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { AppLink } from '../../app/AppLink';
import { ago } from '../../app/format';
import { useCampaigns } from '../../app/campaigns/store';
import { moduleForPath, navModules } from '../../app/nav';
import { Wordmark } from '../../app/shell/Logo';
import { useRecent, type RecentPage } from '../../app/tabs/recent';
import { GetStarted } from './GetStarted';

const QUICK: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/characters', label: 'New character', icon: UserPlus },
  { to: '/journal', label: 'Write a note', icon: FilePlus },
  { to: '/boards', label: 'Open a board', icon: LayoutDashboard },
  { to: '/encounters', label: 'Plan an encounter', icon: Swords },
  { to: '/maps', label: 'Draw a map', icon: MapIcon },
];

export function HomePage() {
  const modules = navModules.filter((m) => m.path !== '/' && m.footer !== true);
  const recent = useRecent((s) => s.pages);
  const { loaded, load } = useCampaigns();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex justify-center py-2">
        <h1>
          <Wordmark className="text-4xl md:text-5xl" />
        </h1>
      </header>

      <GetStarted />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section aria-labelledby="continue-heading">
          <h2 id="continue-heading" className="mb-3 font-serif text-lg font-bold">
            Continue where you left off
          </h2>
          {recent.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted">
              The pages you open show up here.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {recent.slice(0, 8).map((p) => (
                <RecentLink key={p.path} page={p} />
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="start-heading">
          <h2 id="start-heading" className="mb-3 font-serif text-lg font-bold">
            Start something
          </h2>
          <ul className="space-y-2">
            {QUICK.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <AppLink
                  to={to}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 font-medium hover:border-accent"
                >
                  <Icon className="h-4 w-4 text-accent-ink" aria-hidden /> {label}
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="mb-3 font-serif text-lg font-bold">
          Modules
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <li key={m.path}>
                <AppLink
                  to={m.path}
                  title={m.description}
                  className={cn(
                    'flex h-full items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-card transition-colors',
                    'hover:border-accent/60 hover:bg-surface-2',
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-semibold">{m.label}</span>
                </AppLink>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function RecentLink({ page }: { page: RecentPage }) {
  const module = moduleForPath(page.path);
  const Icon = module?.icon;
  return (
    <li>
      <AppLink
        to={page.path}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 hover:border-accent"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{page.title}</span>
          <span className="block text-xs text-muted">
            {module?.label} · {ago(page.at)}
          </span>
        </span>
      </AppLink>
    </li>
  );
}
