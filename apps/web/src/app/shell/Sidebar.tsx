import { cn, IconButton, Tooltip } from '@boh/ui';
import { useRouterState } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AppLink } from '../AppLink';
import { moduleForPath, navModules, type NavModule } from '../nav';
import { LogoMark } from './Logo';

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
      <div className={cn('flex h-14 items-center gap-2.5 px-3', collapsed && 'justify-center')}>
        <LogoMark className="h-9 w-9 shrink-0" />
        {!collapsed && (
          <span className="font-serif text-[15px] leading-tight font-bold">Bag of Holding</span>
        )}
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {main.map((m) => (
          <NavItem
            key={m.path}
            module={m}
            active={current?.path === m.path}
            collapsed={collapsed}
            {...(onNavigate ? { onNavigate } : {})}
          />
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
}

function NavItem({ module, active, collapsed, onNavigate }: NavItemProps) {
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
      {!collapsed && module.milestone !== undefined && (
        <span className="rounded bg-chrome-2 px-1.5 py-0.5 text-[10px] font-semibold text-chrome-muted">
          M{module.milestone}
        </span>
      )}
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
    </li>
  );
}
