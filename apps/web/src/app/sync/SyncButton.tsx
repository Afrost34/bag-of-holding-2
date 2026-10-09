import type { SyncResult } from '@boh/storage';
import { Button, IconButton } from '@boh/ui';
import * as Popover from '@radix-ui/react-popover';
import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLink } from '../AppLink';
import { useSync } from './store';

/** A file as people know it: its name, without folders or extension. */
const fileName = (path: string) => (path.split('/').pop() ?? path).replace(/\.(md|json)$/i, '');

/** Sync state at a glance, next to the search; open it to see what syncs, or sync now. */
export function SyncButton() {
  const { status, lastSync, error, progress, plan, lastResult, syncNow } = useSync();
  const at = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const label =
    status === 'off'
      ? 'Set up sync'
      : status === 'syncing'
        ? progress && progress.total > 0
          ? `Syncing… ${String(progress.done)} of ${String(progress.total)}`
          : 'Syncing…'
        : status === 'offline'
          ? 'Offline: will sync when back online'
          : status === 'error'
            ? `Sync problem: ${error ?? ''}`
            : lastSync
              ? `Synced at ${at(lastSync)}`
              : 'Sync';
  const icon =
    status === 'syncing' ? (
      <RefreshCw className="h-4 w-4 animate-spin" />
    ) : status === 'error' ? (
      <CloudAlert className="h-4 w-4 text-accent-ink" />
    ) : status === 'offline' || status === 'off' ? (
      <CloudOff className="h-4 w-4" />
    ) : lastSync ? (
      <CloudCheck className="h-4 w-4" />
    ) : (
      <Cloud className="h-4 w-4" />
    );
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton
          className="mb-1"
          variant="chrome"
          size="icon-sm"
          label={label}
          tooltipSide="bottom"
          icon={icon}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          aria-label="Sync"
          className="z-50 w-80 space-y-3 rounded-md border border-border bg-surface p-3 text-sm text-text shadow-card"
        >
          <p className="font-semibold">{label}</p>
          {status === 'off' || status === 'error' ? (
            <AppLink to="/settings/sync" className="text-link hover:underline">
              Sync settings
            </AppLink>
          ) : (
            <>
              {status === 'syncing' && plan && (
                <Changes
                  sent={plan.upload}
                  fetched={plan.download}
                  deletedHere={plan.deleteHere}
                  deletedThere={plan.deleteThere}
                />
              )}
              {status !== 'syncing' && lastResult && <LastResult result={lastResult} />}
              <Button
                variant="primary"
                disabled={status === 'syncing' || status === 'offline'}
                onClick={() => void syncNow()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Sync now
              </Button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function LastResult({ result }: { result: SyncResult }) {
  if (result.unchanged) return <p className="text-muted">Nothing had changed.</p>;
  const nothing =
    result.uploaded.length +
      result.downloaded.length +
      result.deletedHere.length +
      result.deletedThere.length ===
    0;
  if (nothing) return <p className="text-muted">Everything was already in step.</p>;
  return (
    <Changes
      sent={result.uploaded}
      fetched={result.downloaded}
      deletedHere={result.deletedHere}
      deletedThere={result.deletedThere}
    />
  );
}

/** The files a sync sends, fetches and deletes, by name. */
function Changes({
  sent,
  fetched,
  deletedHere,
  deletedThere,
}: {
  sent: readonly string[];
  fetched: readonly string[];
  deletedHere: readonly string[];
  deletedThere: readonly string[];
}) {
  const groups: [string, readonly string[]][] = [
    ['Sent', sent],
    ['Fetched', fetched],
    ['Deleted here', deletedHere],
    ['Deleted in the repository', deletedThere],
  ];
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto">
      {groups
        .filter(([, list]) => list.length > 0)
        .map(([title, list]) => (
          <Group key={title} title={`${title} (${String(list.length)})`}>
            {list.slice(0, 50).map((p) => (
              <li key={p} title={p} className="truncate">
                {fileName(p)}
              </li>
            ))}
            {list.length > 50 && <li className="text-muted">…and {list.length - 50} more</li>}
          </Group>
        ))}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="text-xs font-semibold text-muted uppercase">{title}</h3>
      <ul className="text-xs">{children}</ul>
    </section>
  );
}
