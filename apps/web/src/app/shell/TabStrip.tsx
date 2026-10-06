import { cn, IconButton } from '@boh/ui';
import { useRouter } from '@tanstack/react-router';
import { Menu, Plus, X } from 'lucide-react';
import { useEffect, useRef, type DragEvent, type Ref } from 'react';
import { moduleForPath, titleForPath } from '../nav';
import { HOME_PATH, type Tab } from '../tabs/model';
import { useTabs } from '../tabs/store';

export interface TabStripProps {
  onOpenMenu: () => void;
}

/** Browser-style tabs. Each tab keeps its own URL; switching tabs navigates the router. */
export function TabStrip({ onOpenMenu }: TabStripProps) {
  const router = useRouter();
  const { tabs, activeId, openTab, activateTab, closeTab, moveTab } = useTabs();
  const activeRef = useRef<HTMLDivElement>(null);

  const go = (path: string) => {
    if (router.state.location.href !== path) router.history.push(path);
  };

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  const onDrop = (event: DragEvent, index: number) => {
    const id = event.dataTransfer.getData('application/x-boh-tab');
    if (id) moveTab(id, index);
  };

  return (
    <div className="flex h-11 shrink-0 items-end gap-1 bg-chrome pr-2 pl-1 md:pl-2">
      <IconButton
        className="mb-1 md:hidden"
        variant="chrome"
        size="icon"
        label="Open menu"
        icon={<Menu className="h-5 w-5" />}
        onClick={onOpenMenu}
      />
      <div
        role="tablist"
        aria-label="Open pages"
        className="scrollbar-none flex min-w-0 items-end gap-1 overflow-x-auto"
      >
        {tabs.map((tab, index) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            canClose={tabs.length > 1 || tab.path !== HOME_PATH}
            ref={tab.id === activeId ? activeRef : undefined}
            onSelect={() => {
              go(activateTab(tab.id));
            }}
            onClose={() => {
              go(closeTab(tab.id));
            }}
            onDrop={(event) => {
              onDrop(event, index);
            }}
          />
        ))}
      </div>
      <IconButton
        className="mb-1"
        variant="chrome"
        size="icon-sm"
        label="New tab"
        tooltipSide="bottom"
        icon={<Plus className="h-4 w-4" />}
        onClick={() => {
          go(openTab(HOME_PATH));
        }}
      />
    </div>
  );
}

interface TabButtonProps {
  tab: Tab;
  active: boolean;
  canClose: boolean;
  ref: Ref<HTMLDivElement> | undefined;
  onSelect: () => void;
  onClose: () => void;
  onDrop: (event: DragEvent) => void;
}

function TabButton({ tab, active, canClose, ref, onSelect, onClose, onDrop }: TabButtonProps) {
  const Icon = moduleForPath(tab.path)?.icon;
  const title = titleForPath(tab.path);

  return (
    <div
      ref={ref}
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      draggable
      title={title}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-boh-tab', tab.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={onDrop}
      onClick={onSelect}
      onAuxClick={(event) => {
        if (event.button === 1 && canClose) {
          event.preventDefault();
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect();
        if (event.key === 'Delete' && canClose) onClose();
      }}
      className={cn(
        'group flex h-9 max-w-52 min-w-28 shrink-0 cursor-default items-center gap-2 rounded-t-lg pr-1.5 pl-3 text-sm select-none',
        active ? 'bg-bg text-text' : 'text-chrome-muted hover:bg-chrome-2 hover:text-chrome-fg',
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="flex-1 truncate">{title}</span>
      {canClose && (
        <button
          type="button"
          aria-label={`Close ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded hover:bg-sunken',
            active ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-70',
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
