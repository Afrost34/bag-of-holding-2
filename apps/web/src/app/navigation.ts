import { useRouter } from '@tanstack/react-router';
import { useCallback, type MouseEvent } from 'react';
import { useTabs } from './tabs/store';

export interface NavigateOptions {
  /** Open in a new app tab instead of the current one. */
  newTab?: boolean;
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
      if (options.newTab === true) openTab(path);
      if (router.state.location.href !== path) router.history.push(path);
    },
    [router, openTab],
  );
}

/** True when a click should open a new tab (Ctrl/Cmd-click or middle-click). */
export function wantsNewTab(event: MouseEvent): boolean {
  return event.ctrlKey || event.metaKey || event.button === 1;
}
