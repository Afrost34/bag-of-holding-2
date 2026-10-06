import { Button } from '@boh/ui';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isDesktop } from '../platform';

/**
 * Offline-ready and new-version notices from the service worker.
 * The desktop app ships its files locally and updates through its own installer, so it has none.
 */
export function UpdatePrompt() {
  return isDesktop() ? null : <WebUpdatePrompt />;
}

function WebUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-card"
    >
      <span className="flex-1">
        {needRefresh ? 'A new version is ready.' : 'Ready to work offline.'}
      </span>
      {needRefresh && (
        <Button variant="primary" size="sm" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        {needRefresh ? 'Later' : 'OK'}
      </Button>
    </div>
  );
}
