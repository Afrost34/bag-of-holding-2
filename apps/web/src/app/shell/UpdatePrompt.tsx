import { Button } from '@boh/ui';
import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isDesktop } from '../platform';

/** Updates found this soon after opening are applied at once: nothing is in progress yet. */
const APPLY_SILENTLY_WITHIN_MS = 15_000;
const CHECK_EVERY_MS = 60 * 60 * 1000;
const openedAt = Date.now();

/**
 * New-version handling for the web app. The service worker keeps serving the cached version
 * until a new one is activated, so without this a deploy would stay invisible.
 * The desktop app ships its files locally and updates through its own installer.
 */
export function UpdatePrompt() {
  return isDesktop() ? null : <WebUpdatePrompt />;
}

function WebUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        setInterval(() => void registration.update(), CHECK_EVERY_MS);
      }
    },
  });

  useEffect(() => {
    if (needRefresh && Date.now() - openedAt < APPLY_SILENTLY_WITHIN_MS) {
      void updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border-2 border-accent bg-surface p-3 text-sm shadow-card sm:inset-x-auto sm:right-4 sm:max-w-sm"
    >
      {needRefresh && <Sparkles className="h-5 w-5 shrink-0 text-accent" aria-hidden />}
      <span className="flex-1">
        {needRefresh ? 'A new version of Bag of Holding is ready.' : 'Ready to work offline.'}
      </span>
      {needRefresh && (
        <Button variant="primary" size="sm" onClick={() => void updateServiceWorker(true)}>
          Update now
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
