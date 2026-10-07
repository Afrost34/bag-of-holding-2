import { Button, cn } from '@boh/ui';
import { Castle, Check, Plus, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { EDITION_LABELS } from '../../app/campaigns/model';
import { useCampaigns } from '../../app/campaigns/store';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { NewCampaign } from './NewCampaign';

/** Your campaigns: switch between them, create one from a template, open its settings. */
export function CampaignsPage() {
  const { campaigns, activeId, loaded, load, activate } = useCampaigns();
  const [creating, setCreating] = useState(false);
  usePageTitle('Campaigns');
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-wrap items-end gap-3 border-b-2 border-accent pb-2">
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">Campaigns</h1>
          <span className="flex-1" />
          {campaigns.length > 0 && !creating && (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> New campaign
            </Button>
          )}
        </header>

        {!loaded && <p className="text-muted">Loading…</p>}

        {loaded && (creating || campaigns.length === 0) && (
          <NewCampaign
            first={campaigns.length === 0}
            onDone={() => {
              setCreating(false);
            }}
          />
        )}

        {campaigns.length > 0 && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Your campaigns">
            {campaigns.map((c) => {
              const active = c.id === activeId;
              return (
                <li
                  key={c.id}
                  className={cn(
                    'flex flex-col rounded-lg border bg-surface p-4',
                    active ? 'border-accent' : 'border-border',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Castle className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-serif text-xl font-bold">{c.name}</h2>
                      <p className="text-sm text-muted">{EDITION_LABELS[c.edition]}</p>
                    </div>
                    {active && (
                      <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">
                        Open
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {!active && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void activate(c.id)}
                        aria-label={`Open ${c.name}`}
                      >
                        <Check className="h-4 w-4" aria-hidden /> Open
                      </Button>
                    )}
                    <AppLink
                      to={`/campaigns/${encodeURIComponent(c.id)}`}
                      aria-label={`Settings of ${c.name}`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-surface-2"
                    >
                      <Settings2 className="h-4 w-4" aria-hidden /> Settings
                    </AppLink>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
