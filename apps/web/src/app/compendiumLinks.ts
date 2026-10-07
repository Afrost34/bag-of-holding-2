import { BROWSE_CATEGORIES } from '@boh/data5e';
import {
  Backpack,
  BookMarked,
  FileText,
  Gem,
  Library,
  Map as MapIcon,
  Medal,
  PersonStanding,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface CompendiumLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  classes: Shield,
  backgrounds: ScrollText,
  species: PersonStanding,
  feats: Medal,
  spells: Sparkles,
  equipment: Backpack,
  'magic-items': Gem,
  creatures: Skull,
};

/** The compendium's Browse menu (sidebar and compendium home). */
export const BROWSE_LINKS: readonly CompendiumLink[] = BROWSE_CATEGORIES.map((c) => ({
  to: `/compendium/list/${c.id}`,
  label: c.label,
  icon: CATEGORY_ICONS[c.id] ?? FileText,
}));

/** Books, adventures and the quick reference. */
export const LIBRARY_LINKS: readonly CompendiumLink[] = [
  { to: '/compendium/library/books', label: 'Books', icon: Library },
  { to: '/compendium/library/adventures', label: 'Adventures', icon: MapIcon },
  { to: '/compendium/quickref/bookref-quick', label: 'Quick Reference', icon: BookMarked },
];

/** The link a compendium path belongs to, for highlighting it in menus. */
export function activeCompendiumLink(pathname: string): string | undefined {
  const all = [...BROWSE_LINKS, ...LIBRARY_LINKS];
  const exact = all.find((l) => pathname === l.to || pathname.startsWith(`${l.to}/`));
  if (exact) return exact.to;
  if (pathname.startsWith('/compendium/book/')) return '/compendium/library/books';
  if (pathname.startsWith('/compendium/adventure/')) return '/compendium/library/adventures';
  if (pathname.startsWith('/compendium/quickref/')) return LIBRARY_LINKS[2]?.to;
  return undefined;
}
