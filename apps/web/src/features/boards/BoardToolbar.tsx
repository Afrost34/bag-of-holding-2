/** The board's tool bar (name, undo, the Add menu, player window) and its right-click Add menu. */
import { Button } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  LayoutList,
  MonitorUp,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { type Board } from '../../app/boards/model';
import { openPlayerWindow } from '../../app/boards/player';
import { useBoards } from '../../app/boards/store';
import { useAppNavigate } from '../../app/navigation';
import { itemClass, type AddOption } from './addOptions';
import { KIND_ICONS } from './kinds';

function OptionIcon({ kind }: { kind: AddOption['kind'] }) {
  const I = KIND_ICONS[kind];
  return <I className="h-4 w-4" aria-hidden />;
}

/** Another board of the same campaign, a new one, or the list of all boards. */
function BoardSwitcher({ board }: { board: Board }) {
  const navigate = useAppNavigate();
  const all = useBoards((s) => s.boards);
  const create = useBoards((s) => s.create);
  const mine = all.filter((b) => !b.players && b.campaign === board.campaign);
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Switch board"
        className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
      >
        <ChevronDown className="h-4 w-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-96 min-w-56 overflow-y-auto rounded-md border border-border bg-surface p-1 text-text shadow-card"
        >
          {mine.map((b) => (
            <Menu.Item
              key={b.id}
              className={itemClass}
              onSelect={() => {
                if (b.id !== board.id) navigate(`/boards/${b.id}`);
              }}
            >
              <Check className={b.id === board.id ? 'h-4 w-4' : 'h-4 w-4 opacity-0'} aria-hidden />
              {b.name}
            </Menu.Item>
          ))}
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item
            className={itemClass}
            onSelect={() => {
              void create('New board', board.campaign).then((b) => {
                navigate(`/boards/${b.id}`);
              });
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> New board
          </Menu.Item>
          <Menu.Item
            className={itemClass}
            onSelect={() => {
              navigate('/boards?list=1');
            }}
          >
            <LayoutList className="h-4 w-4" aria-hidden /> All boards
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** The Add menu where the board was right-clicked; cards land there. */
export function ContextAddMenu({
  x,
  y,
  at,
  options,
  onClose,
}: {
  x: number;
  y: number;
  at: { x: number; y: number };
  options: AddOption[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Add here"
      className="absolute z-30 min-w-52 rounded-md border border-border bg-surface p-1 text-text shadow-card"
      style={{ left: x, top: y }}
    >
      {options.map((o) => (
        <div key={o.id}>
          {o.separator && <div className="my-1 h-px bg-border" />}
          <button
            type="button"
            role="menuitem"
            disabled={o.disabled}
            className={itemClass}
            onClick={() => {
              o.run(at);
              onClose();
            }}
          >
            <OptionIcon kind={o.kind} /> {o.label}
          </button>
        </div>
      ))}
    </div>
  );
}

export function Toolbar({
  board,
  onRename,
  options,
  onDelete,
  onUndo,
  onRedo,
}: {
  board: Board;
  onRename: (name: string) => void;
  options: AddOption[];
  onDelete: () => void;
  /** Absent when there is nothing to undo (or redo). */
  onUndo: (() => void) | undefined;
  onRedo: (() => void) | undefined;
}) {
  const [name, setName] = useState(board.name);
  // The players' board (the player window) has no other board to go back to, and stays.
  const players = board.players === true;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
      {!players && (
        <AppLink
          to="/boards?list=1"
          aria-label="All boards"
          className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </AppLink>
      )}
      <input
        value={name}
        aria-label="Board name"
        onChange={(e) => {
          setName(e.target.value);
        }}
        onBlur={() => {
          if (name.trim() && name !== board.name) onRename(name.trim());
        }}
        className="min-w-0 flex-1 rounded bg-transparent px-1 font-serif text-lg font-bold focus:bg-sunken focus:outline-none"
      />
      {!players && <BoardSwitcher board={board} />}
      <span className="hidden text-sm text-muted sm:inline">
        {board.cards.filter((c) => c.kind !== 'stack' && c.kind !== 'frame').length} cards
      </span>
      <Button
        variant="ghost"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={!onUndo}
        onClick={onUndo}
      >
        <Undo2 className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
        disabled={!onRedo}
        onClick={onRedo}
      >
        <Redo2 className="h-4 w-4" aria-hidden />
      </Button>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button variant="primary">
            <Plus className="h-4 w-4" aria-hidden /> Add
          </Button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-52 rounded-md border border-border bg-surface p-1 text-text shadow-card"
          >
            {options.map((o) => (
              <div key={o.id}>
                {o.separator && <Menu.Separator className="my-1 h-px bg-border" />}
                <Menu.Item
                  className={itemClass}
                  disabled={o.disabled === true}
                  onSelect={() => {
                    o.run();
                  }}
                >
                  <OptionIcon kind={o.kind} /> {o.label}
                </Menu.Item>
              </div>
            ))}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      {!players && (
        <>
          <Button variant="ghost" onClick={openPlayerWindow}>
            <MonitorUp className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Player window</span>
            <span className="sr-only sm:hidden">Player window</span>
          </Button>
          <Button variant="ghost" aria-label="Delete board" onClick={onDelete}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}
