import { describe, expect, it } from 'vitest';
import { linkTarget, menuItems } from './contextMenuModel';

const ids = (target: Parameters<typeof menuItems>[0]) => menuItems(target).map((i) => i.id);

describe('the right-click menu', () => {
  it('offers to open app links in a tab, outside links only in the browser', () => {
    expect(ids({ link: { path: '/compendium', outside: false } })).toEqual([
      'open',
      'open-tab',
      'copy-link',
    ]);
    expect(ids({ link: { path: 'https://5e.tools', outside: true } })).toEqual([
      'open',
      'copy-link',
    ]);
  });

  it('edits text fields, copies selections, and otherwise moves around', () => {
    expect(ids({ editable: true })).toEqual(['cut', 'copy', 'paste', 'select-all']);
    expect(ids({ selection: 'Fireball' })).toEqual(['copy', 'back', 'forward', 'search']);
    expect(ids({})).toEqual(['back', 'forward', 'search']);
    expect(menuItems({ selection: 'x' })[1]).toMatchObject({ id: 'back', separator: true });
  });

  it('reads hash links as app paths', () => {
    expect(linkTarget('#/maps/abc')).toEqual({ path: '/maps/abc', outside: false });
    expect(linkTarget('https://github.com')).toEqual({ path: 'https://github.com', outside: true });
    expect(linkTarget('mailto:x')).toBeUndefined();
  });
});
