/**
 * What the app's own right-click menu offers, by what was right-clicked (the browser's menu is
 * never shown). Pure: the shell describes the target, this picks the items.
 */

export interface MenuTarget {
  /** A link: an app path (`/compendium/…`) or an outside address. */
  link?: { path: string; outside: boolean };
  /** A text field (input, text area, the note editor). */
  editable?: boolean;
  /** Text selected on the page. */
  selection?: string;
}

export type MenuItemId =
  | 'open'
  | 'open-tab'
  | 'copy-link'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'select-all'
  | 'back'
  | 'forward'
  | 'search';

export interface MenuItem {
  id: MenuItemId;
  label: string;
  /** A line above it. */
  separator?: boolean;
}

const LABELS: Record<MenuItemId, string> = {
  open: 'Open',
  'open-tab': 'Open in a new tab',
  'copy-link': 'Copy link',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  'select-all': 'Select all',
  back: 'Back',
  forward: 'Forward',
  search: 'Search…',
};

/** The items for a target, in order; groups are separated. */
export function menuItems(target: MenuTarget): MenuItem[] {
  const groups: MenuItemId[][] = [];
  if (target.link)
    groups.push(target.link.outside ? ['open', 'copy-link'] : ['open', 'open-tab', 'copy-link']);
  if (target.editable) groups.push(['cut', 'copy', 'paste', 'select-all']);
  else if (target.selection?.trim()) groups.push(['copy']);
  if (!target.link && !target.editable) groups.push(['back', 'forward', 'search']);
  return groups.flatMap((ids, g) =>
    ids.map((id, i) => ({
      id,
      label: LABELS[id],
      ...(g > 0 && i === 0 ? { separator: true } : {}),
    })),
  );
}

/** An `<a href>` as a target link: hash links are app paths (`#/x` → `/x`). */
export function linkTarget(href: string): { path: string; outside: boolean } | undefined {
  if (!href) return undefined;
  if (href.startsWith('#/')) return { path: href.slice(1), outside: false };
  if (/^https?:\/\//i.test(href)) return { path: href, outside: true };
  return undefined;
}
