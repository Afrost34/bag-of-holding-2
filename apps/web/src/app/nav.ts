import {
  BookOpen,
  CalendarDays,
  Dices,
  Castle,
  FlaskConical,
  House,
  LayoutDashboard,
  Map,
  NotebookPen,
  Settings,
  SquareStack,
  Swords,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavModule {
  /** Top-level route path; also the first segment of every URL inside the module. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** One line shown on the home page and on placeholders. */
  description: string;
  /** Shown in the sidebar footer instead of the main list. */
  footer?: boolean;
}

/** Every module in sidebar order. Routes must exist for each path. */
export const navModules: readonly NavModule[] = [
  {
    path: '/',
    label: 'Home',
    icon: House,
    description: 'Your campaigns, recent pages and data status.',
  },
  {
    path: '/compendium',
    label: 'Compendium',
    icon: BookOpen,
    description: 'Every spell, creature, item, class and book, fully linked and searchable.',
  },
  {
    path: '/campaigns',
    label: 'Campaigns',
    icon: Castle,
    description: 'Edition, sources and rules for each campaign, created from templates.',
  },
  {
    path: '/journal',
    label: 'Journal',
    icon: NotebookPen,
    description: 'Campaign notes in Markdown, linked to each other and to the compendium.',
  },
  {
    path: '/homebrew',
    label: 'Homebrew',
    icon: FlaskConical,
    description: 'Create your own creatures, items, spells and more; share them as packs.',
  },
  {
    path: '/characters',
    label: 'Characters',
    icon: Users,
    description: 'Build and level characters with every choice tracked, then print them.',
  },
  {
    path: '/cards',
    label: 'Cards',
    icon: SquareStack,
    description: 'Lay out spell, item and feature cards on A4 pages and print them.',
  },
  {
    path: '/boards',
    label: 'Boards',
    icon: LayoutDashboard,
    description: 'Infinite DM screens with notes, pages, maps, trackers and dice.',
  },
  {
    path: '/encounters',
    label: 'Encounters',
    icon: Swords,
    description: 'Balance encounters for your party and run combat.',
  },
  {
    path: '/tables',
    label: 'Tables',
    icon: Dices,
    description:
      'Loot, shops and random encounters to roll, linked to notes, encounters and creatures.',
  },
  {
    path: '/maps',
    label: 'Maps',
    icon: Map,
    description: 'Battle, city and world maps with stamps, grids, pins and nested maps.',
  },
  {
    path: '/calendar',
    label: 'Calendar',
    icon: CalendarDays,
    description:
      'The campaign’s own calendar: today in the world, festivals, moons and what happened when.',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    description: 'Appearance, data and sync.',
    footer: true,
  },
];

/** The module a path belongs to, matched on its first segment. */
export function moduleForPath(path: string): NavModule | undefined {
  const pathname = path.split(/[?#]/, 1)[0] ?? '/';
  const first = pathname.split('/').find(Boolean);
  const target = first === undefined ? '/' : `/${first}`;
  return navModules.find((m) => m.path === target);
}

export function titleForPath(path: string): string {
  return moduleForPath(path)?.label ?? 'Page';
}
