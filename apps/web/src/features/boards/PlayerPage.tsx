import type { EntityDetail } from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import { cn } from '@boh/ui';
import {
  applyNodeChanges,
  Background,
  Controls,
  NodeResizer,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sendPlayerAction, usePlayerShow, type PlayerShow } from '../../app/boards/player';
import { useTheme } from '../../app/theme';
import { useCampaigns } from '../../app/campaigns/store';
import { NoteViewer } from '../../app/journal/notes/NoteViewer';
import { useJournal } from '../../app/journal/store';
import { playerPlaces, sortInitiative, timerLeft, type BoardCard } from '../../app/boards/model';
import { ImageBody } from './bodies';
import { MapBody } from './widgetBodies';
import { NotesProvider } from '../../app/journal/notes/NotesProvider';

/** The player window: what the DM shows from a board, filling the screen. */
export function PlayerPage() {
  const { item, seq } = usePlayerShow();
  useEffect(() => {
    document.title = 'Bag of Holding — players';
  }, []);
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-bg p-6 text-text">
      {item ? (
        <Shown key={item.kind === 'board' ? `board:${item.boardId}` : seq} item={item} />
      ) : (
        <p className="text-center font-serif text-2xl text-muted">
          Waiting for the DM to show something…
        </p>
      )}
    </div>
  );
}

function Shown({ item }: { item: PlayerShow }) {
  switch (item.kind) {
    case 'image':
      return (
        <div className="h-full w-full">
          <ImageBody src={item.src} caption={item.caption} campaignId={item.campaignId} />
        </div>
      );
    case 'entity':
      return <ShownEntity entity={item.entity} />;
    case 'note':
      return <ShownNote campaignId={item.campaignId} path={item.path} />;
    case 'board':
      return (
        <ReactFlowProvider>
          <PlayerBoard item={item} />
        </ReactFlowProvider>
      );
    case 'text':
      return (
        <article className="max-w-3xl text-xl leading-relaxed">
          {item.title && <h1 className="mb-4 font-serif text-3xl font-bold">{item.title}</h1>}
          <p className="whitespace-pre-wrap">{item.text}</p>
        </article>
      );
  }
}

function ShownEntity({ entity: e }: { entity: EntityDetail }) {
  return (
    <article className="max-h-full w-full max-w-3xl self-start text-lg">
      <h1 className="mb-3 font-serif text-3xl font-bold">{e.name}</h1>
      <EntityView type={e.type} data={e.data} edition={e.edition} />
    </article>
  );
}

function ShownNote({
  campaignId,
  path,
  bare = false,
}: {
  campaignId: string;
  path: string;
  /** Inside a card that has the title already. */
  bare?: boolean;
}) {
  const { campaigns, loaded, load } = useCampaigns();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  // Read again each time it is shown: the DM may have edited it since.
  useEffect(() => {
    const journal = useJournal.getState();
    if (journal.campaignId === campaignId) void journal.refresh();
  }, [campaignId]);
  const campaign = campaigns.find((c) => c.id === campaignId);
  const text = useJournal((s) => (s.campaignId === campaignId ? s.notes.get(path) : undefined));
  return (
    <NotesProvider campaign={campaign}>
      <article className="max-h-full w-full max-w-3xl self-start text-lg">
        {!bare && (
          <h1 className="mb-3 font-serif text-3xl font-bold">
            {path.split('/').pop()?.replace(/\.md$/i, '')}
          </h1>
        )}
        {text !== undefined && campaign && <NoteViewer key={text} text={text} />}
      </article>
    </NotesProvider>
  );
}

interface PlayerNodeData extends Record<string, unknown> {
  card: BoardCard;
  title: string;
  entity: EntityDetail | undefined;
  campaignId: string | undefined;
  boardId: string;
}
type PlayerNodeType = Node<PlayerNodeData, 'player'>;

/** A shown card in the player window: moved by its title bar, resized from its edges. */
const PlayerNode = memo(function PlayerNode({ data, selected }: NodeProps<PlayerNodeType>) {
  const { card, title, entity, campaignId, boardId } = data;
  const place = (w: number, h: number, x: number, y: number) => {
    sendPlayerAction({ type: 'place', boardId, cardId: card.id, place: { x, y, w, h } });
  };
  return (
    <section
      aria-label={title}
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-lg border bg-surface shadow-card',
        selected ? 'border-accent' : 'border-border',
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={80}
        onResizeEnd={(_, p) => {
          place(p.width, p.height, p.x, p.y);
        }}
      />
      <header className="player-drag flex shrink-0 cursor-grab items-center gap-2 bg-header px-3 py-1.5 text-header-fg active:cursor-grabbing">
        <h2 className="min-w-0 flex-1 truncate font-serif font-bold">{title}</h2>
        <button
          type="button"
          aria-label={'Take ' + title + ' off the screen'}
          onClick={() => {
            sendPlayerAction({ type: 'hide', boardId, cardId: card.id });
          }}
          className="nodrag rounded p-0.5 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      <div className="nowheel nodrag min-h-0 flex-1 cursor-auto overflow-auto p-3 select-text">
        <PlayerCardBody card={card} entity={entity} campaignId={campaignId} />
      </div>
    </section>
  );
});

const PLAYER_NODE_TYPES = { player: PlayerNode };

/**
 * The cards the DM shows, as a board of their own: moved, resized and taken off the screen right
 * here (the board in the DM's window keeps it), zoomed and panned like any board.
 */
function PlayerBoard({ item }: { item: Extract<PlayerShow, { kind: 'board' }> }) {
  const theme = useTheme((s) => s.mode);
  const derived = useMemo<PlayerNodeType[]>(() => {
    const places = playerPlaces(item.cards.map((c) => c.card));
    return item.cards.map(({ card, title, entity }) => {
      const place = places.get(card.id) ?? { x: 0, y: 0, w: 360, h: 320 };
      return {
        id: card.id,
        type: 'player',
        position: { x: place.x, y: place.y },
        width: place.w,
        height: place.h,
        dragHandle: '.player-drag',
        data: { card, title, entity, campaignId: item.campaignId, boardId: item.boardId },
      };
    });
  }, [item]);
  const [nodes, setNodes] = useState(derived);
  const [shownFrom, setShownFrom] = useState(derived);
  if (shownFrom !== derived) {
    setShownFrom(derived);
    const selected = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    setNodes(derived.map((n) => (selected.has(n.id) ? { ...n, selected: true } : n)));
  }
  const onNodesChange = useCallback((changes: NodeChange<PlayerNodeType>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, []);
  return (
    <div className="flex h-full w-full flex-col self-stretch">
      <h1 className="shrink-0 pb-2 text-center font-serif text-2xl font-bold">{item.name}</h1>
      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          nodeTypes={PLAYER_NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_, node) => {
            sendPlayerAction({
              type: 'place',
              boardId: item.boardId,
              cardId: node.id,
              place: {
                x: node.position.x,
                y: node.position.y,
                w: node.width ?? node.measured?.width ?? 360,
                h: node.height ?? node.measured?.height ?? 320,
              },
            });
          }}
          deleteKeyCode={['Delete', 'Backspace']}
          onBeforeDelete={({ nodes: gone }) => {
            for (const n of gone)
              if (n.selected)
                sendPlayerAction({ type: 'hide', boardId: item.boardId, cardId: n.id });
            return Promise.resolve(false);
          }}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          minZoom={0.1}
          maxZoom={3}
          nodesConnectable={false}
          zoomOnDoubleClick={false}
          colorMode={theme}
          aria-label="Player board"
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

function PlayerCardBody({
  card,
  entity,
  campaignId,
}: {
  card: BoardCard;
  entity: EntityDetail | undefined;
  campaignId: string | undefined;
}): ReactNode {
  switch (card.kind) {
    case 'entity':
      return entity ? (
        <EntityView type={entity.type} data={entity.data} edition={entity.edition} />
      ) : null;
    case 'image':
      return (
        <div className="h-[60vh]">
          <ImageBody src={card.src} caption={card.caption} campaignId={campaignId} />
        </div>
      );
    case 'text':
      return <p className="text-lg whitespace-pre-wrap">{card.text}</p>;
    case 'note':
      return campaignId ? <ShownNote campaignId={campaignId} path={card.path} bare /> : null;
    case 'initiative':
      return (
        <ol className="space-y-1 text-lg">
          <li className="text-sm font-semibold text-muted uppercase">Round {card.round}</li>
          {sortInitiative(card.rows).map((r, i) => (
            <li
              key={r.id}
              className={i === card.turn ? 'rounded bg-accent-soft px-2 font-bold' : 'px-2'}
            >
              {r.name}
            </li>
          ))}
        </ol>
      );
    case 'timer':
      return (
        <PlayerTimer seconds={card.seconds} elapsed={card.elapsed} startedAt={card.startedAt} />
      );
    case 'map':
      return (
        <div className="h-[60vh] p-3">
          <MapBody card={card} />
        </div>
      );
    case 'npc':
      return (
        <div className="space-y-1 text-lg">
          <p className="text-muted">
            A {card.npc.age} {card.npc.species.toLowerCase()} {card.npc.gender},{' '}
            {card.npc.occupation}
          </p>
          <p>{card.npc.appearance}</p>
          <p>
            {card.npc.personality}; {card.npc.voice}.
          </p>
        </div>
      );
    default:
      return null;
  }
}

function PlayerTimer({
  seconds,
  elapsed,
  startedAt,
}: {
  seconds: number;
  elapsed: number;
  startedAt?: number | undefined;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (startedAt === undefined) return;
    const t = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(t);
    };
  }, [startedAt]);
  const left = timerLeft(
    { seconds, elapsed, ...(startedAt !== undefined ? { startedAt } : {}) },
    startedAt !== undefined ? now : 0,
  );
  return (
    <p className="text-center font-mono text-6xl font-bold tabular-nums">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </p>
  );
}
