import { describe, expect, it } from 'vitest';
import {
  activateTab,
  activeTab,
  closeOtherTabs,
  closeTab,
  initialTabsState,
  moveTab,
  openTab,
  sanitizeTabsState,
  setActivePath,
  type TabsState,
} from './model';

function ids() {
  let n = 0;
  return () => `t${String(++n)}`;
}

function threeTabs(): TabsState {
  return {
    tabs: [
      { id: 'a', path: '/' },
      { id: 'b', path: '/compendium' },
      { id: 'c', path: '/journal' },
    ],
    activeId: 'b',
  };
}

describe('tab model', () => {
  it('starts with one Home tab', () => {
    const state = initialTabsState(ids());
    expect(state.tabs).toEqual([{ id: 't1', path: '/' }]);
    expect(activeTab(state).id).toBe('t1');
  });

  it('navigates inside the active tab only', () => {
    const state = setActivePath(threeTabs(), '/compendium/spells');
    expect(state.tabs.map((t) => t.path)).toEqual(['/', '/compendium/spells', '/journal']);
  });

  it('returns the same object when nothing changes', () => {
    const state = threeTabs();
    expect(setActivePath(state, '/compendium')).toBe(state);
    expect(activateTab(state, 'b')).toBe(state);
    expect(activateTab(state, 'missing')).toBe(state);
  });

  it('opens new tabs right after the active one', () => {
    const state = openTab(threeTabs(), '/maps', 'd');
    expect(state.tabs.map((t) => t.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(state.activeId).toBe('d');
  });

  it('closing the active tab activates the right neighbour, else the left', () => {
    expect(closeTab(threeTabs(), 'b', ids()).activeId).toBe('c');
    const lastActive = { ...threeTabs(), activeId: 'c' };
    expect(closeTab(lastActive, 'c', ids()).activeId).toBe('b');
  });

  it('closing an inactive tab keeps the active one', () => {
    const state = closeTab(threeTabs(), 'a', ids());
    expect(state.activeId).toBe('b');
    expect(state.tabs).toHaveLength(2);
  });

  it('closing the last tab leaves a fresh Home tab', () => {
    const state = closeTab({ tabs: [{ id: 'x', path: '/maps' }], activeId: 'x' }, 'x', ids());
    expect(state.tabs).toEqual([{ id: 't1', path: '/' }]);
  });

  it('closes other tabs', () => {
    expect(closeOtherTabs(threeTabs(), 'c')).toEqual({
      tabs: [{ id: 'c', path: '/journal' }],
      activeId: 'c',
    });
  });

  it('moves tabs and clamps the target index', () => {
    expect(moveTab(threeTabs(), 'a', 2).tabs.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(moveTab(threeTabs(), 'c', -5).tabs.map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('repairs broken persisted state', () => {
    expect(sanitizeTabsState(null, ids()).tabs).toHaveLength(1);
    expect(
      sanitizeTabsState(
        { tabs: [{ id: 'a', path: 'no-slash' }, { id: 'b', path: '/ok' }, 7], activeId: 'zzz' },
        ids(),
      ),
    ).toEqual({ tabs: [{ id: 'b', path: '/ok' }], activeId: 'b' });
  });
});
