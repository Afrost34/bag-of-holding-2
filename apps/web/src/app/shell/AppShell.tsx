import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTabs } from '../tabs/store';
import { useApplyTheme } from '../theme';
import { Sidebar } from './Sidebar';
import { useSidebarPrefs } from './sidebarPrefs';
import { TabStrip } from './TabStrip';
import { UpdatePrompt } from './UpdatePrompt';

export function AppShell() {
  useApplyTheme();
  const href = useRouterState({ select: (s) => s.location.href });
  const setActivePath = useTabs((s) => s.setActivePath);
  const { collapsed, toggle } = useSidebarPrefs();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The URL is the source of truth for the active tab (deep links, back/forward).
  useEffect(() => {
    setActivePath(href);
  }, [href, setActivePath]);

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar className="hidden md:flex" collapsed={collapsed} onToggleCollapsed={toggle} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TabStrip
          onOpenMenu={() => {
            setDrawerOpen(true);
          }}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setDrawerOpen(false);
            }}
          />
          <Sidebar
            className="relative shadow-xl"
            collapsed={false}
            onNavigate={() => {
              setDrawerOpen(false);
            }}
          />
        </div>
      )}

      <UpdatePrompt />
    </div>
  );
}
