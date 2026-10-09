import { useRouter } from '@tanstack/react-router';
import { useCallback, type MouseEvent } from 'react';
import { isPlayerWindow } from './data/client';
import { useTabs } from './tabs/store';

export interface NavigateOptions {
  /** Open in a new app tab instead of the current one. */
  newTab?: boolean;
  /** Replace the current history entry (a redirect), so Back does not come back here. */
  replace?: boolean;
}

/**
 * App-level navigation that understands tabs. Paths are router paths such as `/compendium`.
 * All in-app links should go through this (or `AppLink`) so Ctrl/middle-click opens an app tab.
 */
export function useAppNavigate() {
  const router = useRouter();
  const openTab = useTabs((s) => s.openTab);

  return useCallback(
    (path: string, options: NavigateOptions = {}) => {
      // The player window shows the players' board only: anything else opens in the DM's window.
      if (isPlayerWindow()) {
        openInMainWindow(path);
        return;
      }
      if (options.newTab === true) openTab(path);
      if (router.state.location.href === path) return;
      if (options.replace === true) router.history.replace(path);
      else router.history.push(path);
    },
    [router, openTab],
  );
}

/** True when a click should open a new tab (Ctrl/Cmd-click or middle-click). */
export function wantsNewTab(event: MouseEvent): boolean {
  return event.ctrlKey || event.metaKey || event.button === 1;
}

/** Opens an app page in the DM's main window (from the player window), bringing it forward. */
export function openInMainWindow(path: string): void {
  const opener = window.opener as Window | null;
  if (opener && !opener.closed) {
    opener.location.hash = `#${path}`;
    opener.focus();
    return;
  }
  window.open(`${location.pathname}${location.search}#${path}`, 'boh-main');
}
