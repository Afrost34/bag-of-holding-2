/**
 * Pure tab model. Each tab is a URL inside the app; the active tab's URL is the router location.
 * Kept free of React and storage so it can be unit tested directly.
 */

export interface Tab {
  id: string;
  /** Router path including search, e.g. `/compendium/spells?level=3`. */
  path: string;
}

export interface TabsState {
  tabs: Tab[];
  activeId: string;
}

export const HOME_PATH = '/';

export function initialTabsState(makeId: () => string, path = HOME_PATH): TabsState {
  const id = makeId();
  return { tabs: [{ id, path }], activeId: id };
}

export function activeTab(state: TabsState): Tab {
  const tab = state.tabs.find((t) => t.id === state.activeId) ?? state.tabs[0];
  if (!tab) throw new Error('Tab state has no tabs');
  return tab;
}

/** Records a navigation inside the active tab. */
export function setActivePath(state: TabsState, path: string): TabsState {
  const current = activeTab(state);
  if (current.path === path) return state;
  return { ...state, tabs: state.tabs.map((t) => (t.id === current.id ? { ...t, path } : t)) };
}

/** Opens a tab right after the active one and makes it active. */
export function openTab(state: TabsState, path: string, id: string): TabsState {
  const index = state.tabs.findIndex((t) => t.id === state.activeId);
  const tabs = [...state.tabs];
  tabs.splice(index + 1, 0, { id, path });
  return { tabs, activeId: id };
}

export function activateTab(state: TabsState, id: string): TabsState {
  if (!state.tabs.some((t) => t.id === id) || state.activeId === id) return state;
  return { ...state, activeId: id };
}

/**
 * Closes a tab. Closing the active tab activates its right neighbour, else its left one.
 * Closing the last tab leaves a single fresh Home tab.
 */
export function closeTab(state: TabsState, id: string, makeId: () => string): TabsState {
  const index = state.tabs.findIndex((t) => t.id === id);
  if (index === -1) return state;
  const tabs = state.tabs.filter((t) => t.id !== id);
  if (tabs.length === 0) return initialTabsState(makeId);
  if (state.activeId !== id) return { ...state, tabs };
  const next = tabs[Math.min(index, tabs.length - 1)];
  if (!next) return initialTabsState(makeId);
  return { tabs, activeId: next.id };
}

/** Closes every tab except `id`. */
export function closeOtherTabs(state: TabsState, id: string): TabsState {
  const keep = state.tabs.find((t) => t.id === id);
  return keep ? { tabs: [keep], activeId: keep.id } : state;
}

/** Moves a tab to a new index (for drag reordering). */
export function moveTab(state: TabsState, id: string, toIndex: number): TabsState {
  const from = state.tabs.findIndex((t) => t.id === id);
  if (from === -1) return state;
  const tabs = [...state.tabs];
  const [tab] = tabs.splice(from, 1);
  if (!tab) return state;
  const clamped = Math.max(0, Math.min(toIndex, tabs.length));
  tabs.splice(clamped, 0, tab);
  return { ...state, tabs };
}

/** Repairs persisted state that may be stale or hand-edited. */
export function sanitizeTabsState(value: unknown, makeId: () => string): TabsState {
  if (typeof value !== 'object' || value === null) return initialTabsState(makeId);
  const raw = value as { tabs?: unknown; activeId?: unknown };
  const candidates: unknown[] = Array.isArray(raw.tabs) ? raw.tabs : [];
  const tabs = candidates.filter(isTab);
  const first = tabs[0];
  if (!first) return initialTabsState(makeId);
  const active = tabs.find((t) => t.id === raw.activeId) ?? first;
  return { tabs, activeId: active.id };
}

function isTab(value: unknown): value is Tab {
  if (typeof value !== 'object' || value === null) return false;
  const { id, path } = value as Record<string, unknown>;
  return typeof id === 'string' && typeof path === 'string' && path.startsWith('/');
}
