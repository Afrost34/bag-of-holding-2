import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { useAppNavigate, wantsNewTab } from './navigation';

export interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Router path, e.g. `/compendium`. */
  to: string;
  /** Called after navigation, e.g. to close the mobile drawer. */
  onNavigate?: () => void;
}

/** In-app link: click navigates the current tab, Ctrl/Cmd/middle-click opens a new app tab. */
export function AppLink({ to, onNavigate, onClick, onAuxClick, ...props }: AppLinkProps) {
  const navigate = useAppNavigate();

  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.shiftKey || event.altKey) return; // leave browser behaviours alone
    event.preventDefault();
    navigate(to, { newTab: wantsNewTab(event) });
    onNavigate?.();
  };

  return (
    <a
      href={`#${to}`}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) handle(event);
      }}
      onAuxClick={(event) => {
        onAuxClick?.(event);
        if (!event.defaultPrevented && event.button === 1) handle(event);
      }}
      {...props}
    />
  );
}
