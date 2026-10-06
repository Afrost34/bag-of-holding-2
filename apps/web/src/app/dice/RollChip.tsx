import type { RollMode } from '@boh/dice';
import type { RollSpec } from '@boh/renderer';
import { cn } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { useDice } from './store';

function modeFromEvent(event: MouseEvent): RollMode {
  if (event.shiftKey) return 'advantage';
  if (event.ctrlKey || event.metaKey) return 'disadvantage';
  return 'normal';
}

/**
 * Every roll in the app. Click rolls; for d20 rolls Shift+click rolls with advantage and
 * Ctrl+click with disadvantage; right-click (long-press on touch) opens a menu with all three.
 */
export function RollChip({ roll, children }: { roll: RollSpec; children: ReactNode }) {
  const doRoll = useDice((s) => s.roll);
  const [menuOpen, setMenuOpen] = useState(false);
  const isD20 = roll.kind === 'd20';
  const title = `Roll ${roll.expression}${roll.label ? ` (${roll.label})` : ''}${
    isD20 ? '\nShift+click: advantage · Ctrl+click: disadvantage · Right-click: menu' : ''
  }`;

  const chip = (
    <button
      type="button"
      title={title}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void doRoll(roll, isD20 ? modeFromEvent(event) : 'normal');
      }}
      onContextMenu={(event) => {
        if (!isD20) return;
        event.preventDefault();
        setMenuOpen(true);
      }}
      className={cn(
        'mx-px inline rounded-sm border-b border-dashed border-dice-border bg-dice-bg px-1 font-medium text-dice-fg',
        'cursor-pointer transition-colors hover:border-solid hover:bg-dice-border/40 focus-visible:outline-2',
      )}
    >
      {children}
    </button>
  );

  if (!isD20) return chip;

  return (
    <Menu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
      <Menu.Trigger asChild>
        <span className="inline">{chip}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          sideOffset={4}
          className="z-50 min-w-40 rounded-md border border-border bg-surface p-1 text-sm shadow-card"
        >
          {(
            [
              ['normal', 'Roll'],
              ['advantage', 'Roll with advantage'],
              ['disadvantage', 'Roll with disadvantage'],
            ] as const
          ).map(([mode, label]) => (
            <Menu.Item
              key={mode}
              onSelect={() => void doRoll(roll, mode)}
              className="cursor-pointer rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
            >
              {label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
