import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as model from './model';

const makeId = () => crypto.randomUUID();

interface TabsStore extends model.TabsState {
  setActivePath: (path: string) => void;
  /** Opens a tab and returns its path so the caller can navigate to it. */
  openTab: (path: string) => string;
  /** Activates a tab and returns its path. */
  activateTab: (id: string) => string;
  /** Closes a tab and returns the path of the tab that is active afterwards. */
  closeTab: (id: string) => string;
  closeOtherTabs: (id: string) => string;
  moveTab: (id: string, toIndex: number) => void;
}

/**
 * Open tabs, remembered per device in local storage (a viewer convenience, not synced data).
 */
export const useTabs = create<TabsStore>()(
  persist(
    (set, get) => {
      const apply = (next: model.TabsState) => {
        set({ tabs: next.tabs, activeId: next.activeId });
        return model.activeTab(next).path;
      };
      return {
        ...model.initialTabsState(makeId),
        setActivePath: (path) => apply(model.setActivePath(get(), path)),
        openTab: (path) => apply(model.openTab(get(), path, makeId())),
        activateTab: (id) => apply(model.activateTab(get(), id)),
        closeTab: (id) => apply(model.closeTab(get(), id, makeId)),
        closeOtherTabs: (id) => apply(model.closeOtherTabs(get(), id)),
        moveTab: (id, toIndex) => apply(model.moveTab(get(), id, toIndex)),
      };
    },
    {
      name: 'boh.tabs',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tabs: state.tabs, activeId: state.activeId }),
      merge: (persisted, current) => ({
        ...current,
        ...model.sanitizeTabsState(persisted, makeId),
      }),
    },
  ),
);
