import { Button, Panel, cn } from '@boh/ui';
import { CheckCircle2, Circle, Download, RefreshCw } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { AppLink } from '../../app/AppLink';
import { useCampaigns } from '../../app/campaigns/store';
import { useData } from '../../app/data/store';
import { useSyncSettings } from '../../app/sync/store';

/**
 * The first steps on a new device, on the home page until they are done: the 5etools data,
 * sync with another device (optional), and a campaign. Each step can be done right here or one
 * click away.
 */
export function GetStarted() {
  const { status, busy, progress, refresh, installLatest } = useData();
  const { campaigns, loaded, load } = useCampaigns();
  const synced = useSyncSettings((s) => s.settings !== null);
  useEffect(() => {
    void refresh();
    if (!loaded) void load();
  }, [refresh, loaded, load]);

  const hasData = status?.installed === true && !busy;
  const hasCampaign = campaigns.length > 0;
  if (!status || status.storage === 'busy' || (hasData && hasCampaign)) return null;

  return (
    <Panel title="Get started" aria-label="Get started">
      <ol aria-label="First steps" className="space-y-4">
        <Step
          n={1}
          done={hasData}
          title="Download the 5etools data"
          text="Every spell, creature, item, class and book, for the compendium and everything built on it. About 115 MB, kept on this device so it works offline."
        >
          {busy ? (
            <div className="w-full max-w-sm" role="status">
              <p className="mb-1 text-sm">
                Downloading…{' '}
                {progress && progress.filesTotal > 0
                  ? `${String(progress.filesDone)} of ${String(progress.filesTotal)} files`
                  : ''}
              </p>
              <div className="h-2 overflow-hidden rounded bg-sunken">
                <div
                  className="h-full bg-accent transition-[width]"
                  style={{
                    width: `${String(
                      progress && progress.filesTotal > 0
                        ? Math.round((progress.filesDone / progress.filesTotal) * 100)
                        : 5,
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            !hasData && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => void installLatest()}>
                  <Download className="h-4 w-4" aria-hidden />
                  {status.interrupted ? 'Finish the download' : 'Download the data'}
                </Button>
                <AppLink to="/settings/data" className="text-sm text-link hover:underline">
                  Or use files you already have
                </AppLink>
              </div>
            )
          )}
        </Step>
        <Step
          n={2}
          done={synced}
          optional
          title="Using Bag of Holding on another device?"
          text="Connect this device to the same private data repository: your campaigns, characters, notes, boards and maps come here, and stay in step from then on."
        >
          {!synced && (
            <AppLink
              to="/settings/sync"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-accent"
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> Connect sync
            </AppLink>
          )}
        </Step>
        <Step
          n={3}
          done={hasCampaign}
          title="Create a campaign"
          text="A campaign has its edition (2014, 2024 or both), the books it uses, its journal, characters, boards, encounters and maps. Start from a template."
        >
          {!hasCampaign && (
            <AppLink
              to="/campaigns"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium',
                hasData
                  ? 'bg-accent text-accent-fg hover:bg-accent-hover'
                  : 'border border-border hover:border-accent',
              )}
            >
              Create a campaign
            </AppLink>
          )}
        </Step>
      </ol>
    </Panel>
  );
}

function Step({
  n,
  done,
  optional = false,
  title,
  text,
  children,
}: {
  n: number;
  done: boolean;
  optional?: boolean;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3" aria-label={`Step ${String(n)}: ${title}${done ? ' (done)' : ''}`}>
      {done ? (
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-dex" aria-hidden />
      ) : (
        <Circle className="mt-0.5 h-6 w-6 shrink-0 text-muted" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p>
          <span className={cn('font-semibold', done && 'text-muted line-through')}>{title}</span>
          {optional && <span className="ml-2 text-xs text-muted">(optional)</span>}
          {!done && <span className="mt-0.5 block text-sm text-muted">{text}</span>}
        </p>
        {children}
      </div>
    </li>
  );
}
