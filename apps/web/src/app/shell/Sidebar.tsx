import { cn, IconButton, Tooltip } from '@boh/ui';
import { useRouterState } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLink } from '../AppLink';
import {
  activeCompendiumLink,
  BROWSE_LINKS,
  LIBRARY_LINKS,
  type CompendiumLink,
} from '../compendiumLinks';
import { moduleForPath, navModules, type NavModule } from '../nav';
import { CampaignSwitcher } from './CampaignSwitcher';
import { LogoMark } from './Logo';
import { SearchButton } from './SearchButton';

export interface SidebarProps {
  /** Icons only. Ignored in the mobile drawer. */
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ collapsed, onToggleCollapsed, onNavigate, className }: SidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = moduleForPath(pathname);
  const main = navModules.filter((m) => m.footer !== true);
  const footer = navModules.filter((m) => m.footer === true);

  return (
    <nav
      aria-label="Main"
      className={cn(
        'flex h-full flex-col bg-chrome text-chrome-fg transition-[width] duration-150',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
    >
      <div className={cn('flex h-20 items-center justify-center px-3')}>
        <LogoMark className={cn('shrink-0', collapsed ? 'w-10' : 'w-20')} />
      </div>

      {!collapsed && <CampaignSwitcher {...(onNavigate ? { onNavigate } : {})} />}
      <SearchButton collapsed={collapsed} {...(onNavigate ? { onNavigate } : {})} />

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {main.map((m) => (
          <NavItem
            key={m.path}
            module={m}
            active={current?.path === m.path}
            collapsed={collapsed}
            {...(onNavigate ? { onNavigate } : {})}
          >
            {m.path === '/compendium' && current?.path === m.path && !collapsed && (
              <CompendiumMenu pathname={pathname} {...(onNavigate ? { onNavigate } : {})} />
            )}
          </NavItem>
        ))}
      </ul>

      <ul className="space-y-0.5 border-t border-chrome-2 px-2 py-2">
        {footer.map((m) => (
          <NavItem
            key={m.path}
            module={m}
            active={current?.path === m.path}
            collapsed={collapsed}
            {...(onNavigate ? { onNavigate } : {})}
          />
        ))}
        {onToggleCollapsed && (
          <li className={cn('flex', collapsed ? 'justify-center' : 'justify-end')}>
            <IconButton
              variant="chrome"
              size="icon-sm"
              label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              tooltipSide="right"
              icon={
                collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )
              }
              onClick={onToggleCollapsed}
            />
          </li>
        )}
      </ul>
    </nav>
  );
}

interface NavItemProps {
  module: NavModule;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  /** Sub-menu shown under the item. */
  children?: ReactNode;
}

/** The compendium's Browse and Library links, nested under Compendium while it is open. */
function CompendiumMenu({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const active = activeCompendiumLink(pathname);
  const item = (link: CompendiumLink) => {
    const Icon = link.icon;
    const on = active === link.to;
    return (
      <li key={link.to}>
        <AppLink
          to={link.to}
          aria-current={on ? 'page' : undefined}
          {...(onNavigate ? { onNavigate } : {})}
          className={cn(
            'flex h-8 items-center gap-2.5 rounded-md pr-2 pl-4 text-[13px] font-medium transition-colors',
            on
              ? 'bg-chrome-2 text-chrome-fg'
              : 'text-chrome-muted hover:bg-chrome-2/60 hover:text-chrome-fg',
          )}
        >
          <Icon className={cn('h-4 w-4 shrink-0', on && 'text-accent-ink')} aria-hidden />
          <span className="truncate">{link.label}</span>
        </AppLink>
      </li>
    );
  };
  return (
    <div className="mt-1 mb-2 ml-3 border-l border-chrome-2 pl-1">
      <p className="px-4 pt-1 pb-1 text-[10px] font-semibold tracking-wider text-chrome-muted uppercase">
        Browse
      </p>
      <ul aria-label="Browse" className="space-y-px">
        {BROWSE_LINKS.map(item)}
      </ul>
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-chrome-muted uppercase">
        Library
      </p>
      <ul aria-label="Library" className="space-y-px">
        {LIBRARY_LINKS.map(item)}
      </ul>
    </div>
  );
}

function NavItem({ module, active, collapsed, onNavigate, children }: NavItemProps) {
  const Icon = module.icon;
  const link = (
    <AppLink
      to={module.path}
      aria-current={active ? 'page' : undefined}
      {...(onNavigate ? { onNavigate } : {})}
      className={cn(
        'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-chrome-2 text-chrome-fg'
          : 'text-chrome-muted hover:bg-chrome-2/60 hover:text-chrome-fg',
      )}
    >
      {active && (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-accent" aria-hidden />
      )}
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{module.label}</span>}
    </AppLink>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip label={module.label} side="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
      {children}
    </li>
  );
}
