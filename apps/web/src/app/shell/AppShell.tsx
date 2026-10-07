import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { PLAYER_ROUTE } from '../boards/player';
import { useCampaigns } from '../campaigns/store';
import { Dice3DLayer } from '../dice/Dice3DLayer';
import { DiceTray } from '../dice/DiceTray';
import { RollInputDialog } from '../dice/RollInputDialog';
import { RollResults } from '../dice/RollResults';
import { AppRendererProvider } from '../renderer/services';
import { SearchPalette } from '../search/SearchPalette';
import { startAutoSync } from '../sync/store';
import { useTabs } from '../tabs/store';
import { useApplyTheme } from '../theme';
import { KeyboardShortcuts } from './KeyboardShortcuts';
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
  // The player window (a second window the DM shows things in) is not a full app.
  const player = href.split(/[?#]/, 1)[0] === PLAYER_ROUTE;

  // The open campaign decides which sources are on and whose notes show, on every page.
  useEffect(() => {
    // Sync starts once the campaigns are read, so it compares against what is on this device.
    void useCampaigns
      .getState()
      .load()
      .then(() => {
        if (!player) startAutoSync();
      });
    // Once: a window does not turn into the player window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The URL is the source of truth for the active tab (deep links, back/forward).
  // (Not the player window's: tabs are shared with the DM's window through localStorage.)
  useEffect(() => {
    if (!player) setActivePath(href);
  }, [href, setActivePath, player]);

  // The player window shows only what the DM sends it: no sidebar, tabs or dice tray.
  if (player)
    return (
      <AppRendererProvider>
        <Outlet />
      </AppRendererProvider>
    );

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar className="hidden md:flex" collapsed={collapsed} onToggleCollapsed={toggle} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TabStrip
          onOpenMenu={() => {
            setDrawerOpen(true);
          }}
        />
        <main className="min-h-0 flex-1 overflow-y-auto pb-16 has-[>.h-full]:pb-0">
          <AppRendererProvider>
            <Outlet />
          </AppRendererProvider>
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

      <Dice3DLayer />
      <RollResults />
      <DiceTray />
      <RollInputDialog />
      <SearchPalette />
      <KeyboardShortcuts />
      <UpdatePrompt />
    </div>
  );
}
