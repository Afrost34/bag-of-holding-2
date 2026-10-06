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
 * Activates whichever new version is waiting and reloads into it. Done by hand rather than with
 * the plugin's `updateServiceWorker`, which only reloads for the version it was tracking: if a
 * second deploy lands while the page is open, its button silently did nothing.
 */
async function applyUpdate(): Promise<void> {
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  else reload(); // Already activated (e.g. by another window): just load it.
  // Safety net if the switch-over event never arrives.
  setTimeout(reload, 3000);
}

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
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        setInterval(() => void registration.update(), CHECK_EVERY_MS);
      }
    },
  });

  useEffect(() => {
    if (needRefresh && Date.now() - openedAt < APPLY_SILENTLY_WITHIN_MS) {
      void applyUpdate();
    }
  }, [needRefresh]);

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
        <Button variant="primary" size="sm" onClick={() => void applyUpdate()}>
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
