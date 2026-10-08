import { IconButton } from '@boh/ui';
import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react';
import { useAppNavigate } from '../navigation';
import { useSync } from './store';

/**
 * Sync state at a glance, next to the search: tap to sync now (or to set sync up, or to see what
 * went wrong in the settings).
 */
export function SyncButton() {
  const { status, lastSync, error, progress, syncNow } = useSync();
  const navigate = useAppNavigate();
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
              ? `Synced at ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Sync now`
              : 'Sync now';
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
    <IconButton
      className="mb-1"
      variant="chrome"
      size="icon-sm"
      label={label}
      tooltipSide="bottom"
      icon={icon}
      onClick={() => {
        if (status === 'off' || status === 'error') navigate('/settings/sync');
        else void syncNow();
      }}
    />
  );
}
