import { useMatch, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useRecent } from './recent';
import { useTabs } from './store';

/** Names the current page: its tab and the browser/window title. */
export function usePageTitle(title: string | undefined): void {
  const href = useRouterState({ select: (s) => s.location.href });
  // While the app goes to another page, the URL changes before the page being left goes away: it
  // must not name the next page's tab after itself. A page names a tab only while the URL's path
  // is its own.
  const own = useMatch({ strict: false, select: (m) => m.pathname });
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = decoded(own) === decoded(path);
  const setTitle = useTabs((s) => s.setTitle);
  useEffect(() => {
    if (!title || !current) return;
    setTitle(href, title);
    useRecent.getState().record(href, title);
    document.title = `${title} · Bag of Holding`;
    return () => {
      document.title = 'Bag of Holding';
    };
  }, [href, title, setTitle, current]);
}

/** Paths compared as text: one side may still be URL-encoded (`spell%3Afireball`) or end in `/`. */
function decoded(path: string): string {
  const bare = path.length > 1 ? path.replace(/\/$/, '') : path;
  try {
    return decodeURIComponent(bare);
  } catch {
    return bare;
  }
}
