import { cn } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { NodeResizer, useStore, type NodeProps } from '@xyflow/react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Frame,
  Layers,
  MonitorUp,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { memo, useState, type ReactNode } from 'react';
import { SHOWABLE_KINDS, type BoardCard } from '../../app/boards/model';
import { CardBody } from './bodies';
import { CardLinks } from './CardLinks';
import { useBoardActions } from './context';
import { FAR_ZOOM, KIND_ICONS, useCardTitle, type CardNodeType } from './kinds';

const useFar = () => useStore((s) => s.transform[2] < FAR_ZOOM);

const itemClass =
  'flex items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-sunken';

/** The ⋮ menu of a card (or of a tab in a stack). */
function CardMenu({ card, title, inStack }: { card: BoardCard; title: string; inStack?: boolean }) {
  const actions = useBoardActions();
  const showable = SHOWABLE_KINDS.has(card.kind);
  const openable = card.kind === 'entity' || card.kind === 'note';
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={`${title} menu`} className="nodrag rounded p-1 hover:bg-black/10">
        <MoreVertical className="h-4 w-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-48 rounded-md border border-border bg-surface p-1 text-text shadow-card"
        >
          {openable && (
            <Menu.Item
              className={itemClass}
              onSelect={() => {
                actions.open(card, false);
              }}
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Open
            </Menu.Item>
          )}
          {showable && (
            <Menu.Item
              className={itemClass}
              onSelect={() => {
                actions.show(card);
              }}
            >
              <MonitorUp className="h-4 w-4" aria-hidden />{' '}
              {card.shown ? 'Hide from players' : 'Show to players'}
            </Menu.Item>
          )}
          {inStack && (
            <Menu.Item
              className={itemClass}
              onSelect={() => {
                actions.unstack(card.id);
              }}
            >
              <Layers className="h-4 w-4" aria-hidden /> Take out of the stack
            </Menu.Item>
          )}
          {card.parent && (
            <Menu.Item
              className={itemClass}
              onSelect={() => {
                actions.unframe(card.id);
              }}
            >
              <Frame className="h-4 w-4" aria-hidden /> Take out of the frame
            </Menu.Item>
          )}
          <Menu.Item
            className={itemClass}
            onSelect={() => {
              actions.remove(card.id);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Remove
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Card chrome: title bar (drag handle), collapse, menu, resize handles. */
function Shell({
  card,
  title,
  selected,
  bar,
  children,
}: {
  card: BoardCard;
  title: string;
  selected: boolean;
  /** Replaces the title in the bar (a stack's tabs). */
  bar?: ReactNode;
  children: ReactNode;
}) {
  const actions = useBoardActions();
  const far = useFar();
  const Icon = KIND_ICONS[card.kind];
  return (
    <section
      aria-label={title}
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-lg border bg-surface text-text shadow-card',
        selected ? 'border-accent' : 'border-border',
      )}
    >
      <NodeResizer
        isVisible={selected && !card.collapsed}
        minWidth={180}
        minHeight={100}
        lineClassName="!border-accent"
        handleClassName="!h-3 !w-3 !border-accent !bg-surface"
        onResizeEnd={(_, p) => {
          actions.update(card.id, (c) => ({
            ...c,
            x: Math.round(p.x),
            y: Math.round(p.y),
            w: Math.round(p.width),
            h: Math.round(p.height),
          }));
        }}
      />
      <header className="card-drag flex h-10 shrink-0 cursor-grab items-center gap-1 bg-header px-2 text-header-fg active:cursor-grabbing">
        <button
          type="button"
          aria-label={card.collapsed ? `Expand ${title}` : `Collapse ${title}`}
          aria-expanded={!card.collapsed}
          onClick={() => {
            actions.update(card.id, (c) => {
              const { collapsed: _c, ...rest } = c;
              return c.collapsed ? rest : { ...rest, collapsed: true };
            });
          }}
          className="nodrag rounded p-0.5 hover:bg-black/10"
        >
          {card.collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </button>
        {bar ?? (
          <>
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <h3 className="min-w-0 flex-1 truncate font-serif text-sm font-bold">{title}</h3>
          </>
        )}
        {card.shown && (
          <MonitorUp className="h-4 w-4 shrink-0 text-accent-ink" aria-label="Shown to players" />
        )}
        <CardMenu card={card} title={title} />
      </header>
      {!card.collapsed &&
        (far ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center font-serif text-4xl font-bold break-words text-muted">
            {title}
          </div>
        ) : (
          <div className="nowheel nodrag min-h-0 flex-1 cursor-auto overflow-auto p-3 text-sm select-text">
            {children}
          </div>
        ))}
    </section>
  );
}

export const CardNode = memo(function CardNode({ data, selected }: NodeProps<CardNodeType>) {
  const title = useCardTitle(data.card);
  return (
    <Shell card={data.card} title={title} selected={selected}>
      <CardLinks card={data.card}>
        <CardBody card={data.card} />
      </CardLinks>
    </Shell>
  );
});

function StackTab({
  card,
  active,
  onPick,
}: {
  card: BoardCard;
  active: boolean;
  onPick: () => void;
}) {
  const title = useCardTitle(card);
  return (
    <span
      role="tab"
      aria-selected={active}
      className={cn(
        'nodrag flex max-w-40 min-w-0 shrink items-center rounded-t px-1',
        active ? 'bg-surface text-text' : 'opacity-80 hover:opacity-100',
      )}
    >
      <button
        type="button"
        onClick={onPick}
        className="min-w-0 truncate py-1 text-xs font-semibold"
      >
        {title}
      </button>
      {active && <CardMenu card={card} title={title} inStack />}
    </span>
  );
}

export const StackNode = memo(function StackNode({ data, selected }: NodeProps<CardNodeType>) {
  const { card } = data;
  const actions = useBoardActions();
  const members = data.members ?? [];
  const index = card.kind === 'stack' ? Math.min(card.active, members.length - 1) : 0;
  const active = members[index];
  const activeTitle = useCardTitle(active ?? card);
  return (
    <Shell
      card={card}
      title={`Stack: ${activeTitle}`}
      selected={selected}
      bar={
        <div
          role="tablist"
          aria-label="Stacked cards"
          className="flex min-w-0 flex-1 items-end gap-0.5 self-end overflow-hidden"
        >
          {members.map((m, i) => (
            <StackTab
              key={m.id}
              card={m}
              active={i === index}
              onPick={() => {
                actions.update(card.id, (c) => (c.kind === 'stack' ? { ...c, active: i } : c));
              }}
            />
          ))}
        </div>
      }
    >
      {active && (
        <CardLinks card={card}>
          <CardBody card={active} />
        </CardLinks>
      )}
    </Shell>
  );
});

export const FrameNode = memo(function FrameNode({ data, selected }: NodeProps<CardNodeType>) {
  const { card } = data;
  const actions = useBoardActions();
  const far = useFar();
  const [renaming, setRenaming] = useState(false);
  const title = card.kind === 'frame' ? card.title : '';
  return (
    <section
      aria-label={`Frame ${title}`}
      className={cn(
        'h-full rounded-xl border-2 border-dashed bg-sunken/60',
        selected ? 'border-accent' : 'border-border-strong',
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={160}
        lineClassName="!border-accent"
        handleClassName="!h-3 !w-3 !border-accent !bg-surface"
        onResizeEnd={(_, p) => {
          actions.update(card.id, (c) => ({
            ...c,
            x: Math.round(p.x),
            y: Math.round(p.y),
            w: Math.round(p.width),
            h: Math.round(p.height),
          }));
        }}
      />
      <header className="card-drag flex cursor-grab items-center gap-1 px-2 py-1">
        <Frame className="h-4 w-4 text-muted" aria-hidden />
        {/* The title drags the frame; a double-click (or the pencil) renames it. */}
        {renaming ? (
          <input
            defaultValue={title}
            aria-label="Frame title"
            autoFocus
            onBlur={(e) => {
              const t = e.target.value.trim() || title;
              actions.update(card.id, (c) => (c.kind === 'frame' ? { ...c, title: t } : c));
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
            }}
            className={cn(
              'nodrag min-w-0 flex-1 rounded bg-surface px-1 font-serif font-bold focus:outline-none',
              far ? 'text-5xl' : 'text-base',
            )}
          />
        ) : (
          <span
            onDoubleClick={() => {
              setRenaming(true);
            }}
            className={cn(
              'min-w-0 flex-1 truncate font-serif font-bold select-none',
              far ? 'text-5xl' : 'text-base',
            )}
          >
            {title}
          </span>
        )}
        {!renaming && (
          <button
            type="button"
            aria-label={`Rename frame ${title}`}
            onClick={() => {
              setRenaming(true);
            }}
            className="nodrag rounded p-1 text-muted hover:bg-sunken"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <CardMenu card={card} title={`Frame ${title}`} />
      </header>
    </section>
  );
});
