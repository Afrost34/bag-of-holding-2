import { cn, Tooltip } from '@boh/ui';
import { Search } from 'lucide-react';
import { useSearchPalette } from '../search/store';

/** Search everything (Ctrl/Cmd+K), at the top of the sidebar where it is easy to find. */
export function SearchButton({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  /** Closes the phone drawer. */
  onNavigate?: () => void;
}) {
  const open = () => {
    onNavigate?.();
    useSearchPalette.getState().setOpen(true);
  };
  const button = (
    <button
      type="button"
      aria-label="Search"
      onClick={open}
      className={cn(
        'flex h-10 w-full items-center gap-3 rounded-md border border-chrome-2 bg-chrome-2/50 text-sm text-chrome-muted hover:border-accent hover:text-chrome-fg',
        collapsed ? 'justify-center px-0' : 'px-3',
      )}
    >
      <Search className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded bg-chrome px-1.5 py-0.5 font-sans text-[10px] font-semibold">
            Ctrl K
          </kbd>
        </>
      )}
    </button>
  );
  return (
    <div className="px-2 pt-2">
      {collapsed ? (
        <Tooltip label="Search (Ctrl+K)" side="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </div>
  );
}
