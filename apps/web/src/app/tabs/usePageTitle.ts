import { useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTabs } from './store';

/** Names the current page: its tab and the browser/window title. */
export function usePageTitle(title: string | undefined): void {
  const href = useRouterState({ select: (s) => s.location.href });
  const setTitle = useTabs((s) => s.setTitle);
  useEffect(() => {
    if (!title) return;
    setTitle(href, title);
    document.title = `${title} · Bag of Holding`;
    return () => {
      document.title = 'Bag of Holding';
    };
  }, [href, title, setTitle]);
}
