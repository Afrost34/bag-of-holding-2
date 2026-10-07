import { Button, cn, IconButton, Tooltip } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { Dices, History, Minus, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { DieIcon } from './DieIcon';
import {
  addDie,
  clearFaces,
  countOf,
  EMPTY_POOL,
  isEmpty,
  poolExpression,
  poolLabel,
  removeDie,
  type DieMode,
  type Faces,
  type Pool,
} from './pool';
import { Breakdown, ModeBadge, OutcomeBadge } from './RollBreakdown';
import { DICE_TRAY_EVENT } from '../shell/shortcuts';
import { useDice, useDiceSettings } from './store';

/** Dice nearest the button are the most used. */
const COLUMN_ORDER: Faces[] = [100, 4, 6, 8, 10, 12, 20];
const LONG_PRESS_MS = 450;

/**
 * D&D Beyond-style dice: the dice button fans out every die. Click a die to add it to the pool,
 * right-click (long-press on touch) for options such as advantage. Roll throws everything.
 */
export function DiceTray() {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<Pool>(EMPTY_POOL);
  const roll = useDice((s) => s.roll);
  const empty = isEmpty(pool);
  const hasDice = pool.dice.length > 0;

  // Alt+D (see shell/shortcuts.ts).
  useEffect(() => {
    const toggle = () => {
      setOpen((o) => !o);
    };
    window.addEventListener(DICE_TRAY_EVENT, toggle);
    return () => {
      window.removeEventListener(DICE_TRAY_EVENT, toggle);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const rollPool = () => {
    if (!hasDice) return;
    const expression = poolExpression(pool);
    void roll({ kind: 'dice', expression, label: poolLabel(pool) });
    setPool(EMPTY_POOL);
    setOpen(false);
  };

  return (
    <div className="fixed right-3 bottom-3 z-40 flex flex-col items-end gap-2 sm:right-4 sm:bottom-4 print:hidden">
      {open && (
        <div
          role="group"
          aria-label="Dice"
          // Bottom-up so the most used dice sit nearest the button; wraps into a second column
          // leftwards when the window is too short for one.
          className="flex max-h-[calc(100dvh-6rem)] flex-col-reverse flex-wrap-reverse content-start items-center gap-2"
        >
          {[...COLUMN_ORDER].reverse().map((faces) => (
            <DieButton
              key={faces}
              faces={faces}
              count={countOf(pool, faces)}
              advantage={
                pool.dice.filter((d) => d.faces === faces && d.mode === 'advantage').length
              }
              disadvantage={
                pool.dice.filter((d) => d.faces === faces && d.mode === 'disadvantage').length
              }
              onAdd={(mode) => {
                setPool((p) => addDie(p, faces, mode));
              }}
              onRemove={() => {
                setPool((p) => removeDie(p, faces));
              }}
              onClear={() => {
                setPool((p) => clearFaces(p, faces));
              }}
            />
          ))}
          <RollLog />
        </div>
      )}

      <div className="flex items-center gap-2">
        {!empty && (
          <div className="flex items-center gap-1 rounded-full border border-border bg-surface py-1 pr-1 pl-3 text-sm shadow-card">
            <span
              className="max-w-44 truncate font-mono text-xs"
              title={poolLabel(pool)}
              data-testid="dice-pool"
            >
              {poolLabel(pool) || '—'}
            </span>
            <IconButton
              label="Decrease modifier"
              size="icon-sm"
              icon={<Minus className="h-3.5 w-3.5" />}
              onClick={() => {
                setPool((p) => ({ ...p, modifier: p.modifier - 1 }));
              }}
            />
            <IconButton
              label="Increase modifier"
              size="icon-sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setPool((p) => ({ ...p, modifier: p.modifier + 1 }));
              }}
            />
            <IconButton
              label="Clear dice"
              size="icon-sm"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={() => {
                setPool(EMPTY_POOL);
              }}
            />
          </div>
        )}
        {hasDice ? (
          <button
            type="button"
            onClick={rollPool}
            className="flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-bold tracking-wide text-accent-fg uppercase shadow-card hover:bg-accent-hover"
          >
            <Dices className="h-5 w-5" aria-hidden /> Roll
          </button>
        ) : (
          <button
            type="button"
            aria-label={open ? 'Close dice' : 'Dice'}
            aria-expanded={open}
            onClick={() => {
              setOpen((o) => !o);
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-card hover:bg-accent-hover"
          >
            {open ? <X className="h-6 w-6" /> : <Dices className="h-6 w-6" />}
          </button>
        )}
      </div>
    </div>
  );
}

interface DieButtonProps {
  faces: Faces;
  count: number;
  advantage: number;
  disadvantage: number;
  onAdd: (mode: DieMode) => void;
  onRemove: () => void;
  onClear: () => void;
}

function DieButton({
  faces,
  count,
  advantage,
  disadvantage,
  onAdd,
  onRemove,
  onClear,
}: DieButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  // Touch screens have no right-click: a long press opens the options instead.
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const label = `d${String(faces)}`;
  const modeNote = [
    advantage > 0 && `${String(advantage)} adv`,
    disadvantage > 0 && `${String(disadvantage)} dis`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Menu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
      <Tooltip
        label={`${label}${count ? ` × ${String(count)}${modeNote ? ` (${modeNote})` : ''}` : ''} · right-click for options`}
        side="left"
      >
        <Menu.Trigger asChild>
          <button
            type="button"
            aria-label={`Add ${label}`}
            onClick={(e) => {
              e.preventDefault();
              if (longPressed.current) {
                longPressed.current = false;
                return;
              }
              onAdd('normal');
            }}
            onPointerDown={(e) => {
              // Radix opens menus on pointer down; we open on right-click / long press only.
              e.preventDefault();
              onPointerDown(e);
            }}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onContextMenu={(e) => {
              e.preventDefault();
              cancelPress();
              setMenuOpen(true);
            }}
            className={cn(
              'relative flex h-12 w-12 animate-[fade-in_120ms_ease-out] flex-col items-center justify-center rounded-full border bg-surface shadow-card transition-colors',
              count > 0
                ? 'border-accent text-accent-ink'
                : 'border-border text-text hover:border-accent hover:text-accent-ink',
            )}
          >
            <DieIcon faces={faces} className="h-7 w-7" />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
              {faces === 100 ? '%' : faces}
            </span>
            {count > 0 && (
              <span className="absolute -top-1 -left-1 min-w-5 rounded-full bg-accent px-1 text-center text-[11px] font-bold text-accent-fg">
                {count}
              </span>
            )}
          </button>
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal>
        <Menu.Content
          side="left"
          align="center"
          sideOffset={8}
          className="z-50 min-w-48 rounded-md border border-border bg-surface p-1 text-sm shadow-card"
        >
          <Menu.Label className="px-2 py-1 text-xs font-semibold text-muted">{label}</Menu.Label>
          <MenuItem
            onSelect={() => {
              onAdd('normal');
            }}
          >
            Add one
          </MenuItem>
          {faces === 20 && (
            <>
              <MenuItem
                onSelect={() => {
                  onAdd('advantage');
                }}
              >
                Add with advantage
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  onAdd('disadvantage');
                }}
              >
                Add with disadvantage
              </MenuItem>
            </>
          )}
          <MenuItem
            onSelect={() => {
              for (let i = 0; i < 4; i++) onAdd('normal');
            }}
          >
            Add four
          </MenuItem>
          <Menu.Separator className="my-1 h-px bg-border" />
          <MenuItem disabled={count === 0} onSelect={onRemove}>
            Remove one
          </MenuItem>
          <MenuItem disabled={count === 0} onSelect={onClear}>
            Remove all {label}
          </MenuItem>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function MenuItem({
  children,
  onSelect,
  disabled = false,
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="cursor-pointer rounded px-2 py-1.5 outline-none data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-sunken"
    >
      {children}
    </Menu.Item>
  );
}

/** This session's rolls, opened from the top of the dice column. */
function RollLog() {
  const { log, clearLog } = useDice();
  const { threeD, setThreeD } = useDiceSettings();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Roll log"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card hover:text-text"
        >
          <History className="h-4 w-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(90vw,22rem)] rounded-lg border border-border bg-surface shadow-card"
        >
          <div className="flex items-center border-b border-border px-3 py-2">
            <h2 className="flex-1 text-sm font-semibold">Rolls this session ({log.length})</h2>
            {log.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearLog}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
              </Button>
            )}
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {log.length === 0 ? (
              <p className="p-2 text-sm text-muted">No rolls yet.</p>
            ) : (
              <ol className="space-y-1">
                {log.map((entry) => (
                  <li key={entry.id} className="rounded-md px-2 py-1.5 odd:bg-surface-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-10 text-right font-serif text-lg font-bold">
                        {entry.total}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{entry.label ?? 'Roll'}</span>
                      <ModeBadge mode={entry.mode} />
                      <OutcomeBadge entry={entry} />
                      <time className="text-[10px] text-faint">
                        {new Date(entry.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <Breakdown text={entry.breakdown} className="block pl-12 text-muted" />
                  </li>
                ))}
              </ol>
            )}
          </div>
          <label className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={threeD}
              onChange={(e) => {
                setThreeD(e.target.checked);
              }}
              className="h-3.5 w-3.5 accent-[var(--boh-accent)]"
            />
            Show 3D dice
          </label>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
