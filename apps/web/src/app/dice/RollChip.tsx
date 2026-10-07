import type { RollMode } from '@boh/dice';
import type { RollSpec } from '@boh/renderer';
import { cn } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useDice } from './store';

const LONG_PRESS_MS = 450;

/** Keyboard shortcuts kept for power users; the documented way is the right-click menu. */
function modeFromEvent(event: MouseEvent): RollMode {
  if (event.shiftKey) return 'advantage';
  if (event.ctrlKey || event.metaKey) return 'disadvantage';
  return 'normal';
}

/**
 * Every roll in the app. Click just rolls. For d20 rolls, right-click (long-press on touch)
 * opens a menu to roll with advantage or disadvantage.
 */
export function RollChip({
  roll,
  children,
  plain = false,
}: {
  roll: RollSpec;
  children: ReactNode;
  /** No dice colours: for numbers on a character sheet, which are all rollable. */
  plain?: boolean;
}) {
  const doRoll = useDice((s) => s.roll);
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const isD20 = roll.kind === 'd20';
  const title = `Roll ${roll.expression}${roll.label ? ` (${roll.label})` : ''}${
    isD20 ? '\nRight-click for advantage or disadvantage' : ''
  }`;

  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const chip = (
    <button
      type="button"
      title={title}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        void doRoll(roll, isD20 ? modeFromEvent(event) : 'normal');
      }}
      onPointerDown={(event) => {
        if (!isD20 || event.pointerType !== 'touch') return;
        longPressed.current = false;
        pressTimer.current = window.setTimeout(() => {
          longPressed.current = true;
          setMenuOpen(true);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(event) => {
        if (!isD20) return;
        event.preventDefault();
        cancelPress();
        setMenuOpen(true);
      }}
      className={cn(
        plain
          ? 'inline cursor-pointer rounded-sm px-0.5 hover:bg-sunken focus-visible:outline-2'
          : cn(
              'mx-px inline rounded-sm border-b border-dashed border-dice-border bg-dice-bg px-1 font-medium text-dice-fg',
              'cursor-pointer transition-colors hover:border-solid hover:bg-dice-border/40 focus-visible:outline-2',
            ),
      )}
    >
      {children}
    </button>
  );

  if (!isD20) return chip;

  return (
    <span className="relative inline">
      {chip}
      <Menu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        {/* Zero-size anchor: the menu opens only from right-click / long-press, never on click. */}
        <Menu.Trigger asChild>
          <span
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none absolute bottom-0 left-0 h-0 w-0"
          />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="start"
            sideOffset={4}
            className="z-50 min-w-44 rounded-md border border-border bg-surface p-1 text-sm shadow-card"
          >
            {(
              [
                ['advantage', 'Roll with advantage'],
                ['disadvantage', 'Roll with disadvantage'],
                ['normal', 'Roll normally'],
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
    </span>
  );
}
