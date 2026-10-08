import { Button } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, MonitorUp, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppLink } from '../../app/AppLink';
import {
  absolutePosition,
  addBoardCards,
  contentOf,
  COLLAPSED_H,
  dropCard,
  moveBoardCards,
  removeBoardCard,
  setFrame,
  SIZES,
  unstack,
  updateBoardCard,
  type Board,
  type BoardCard,
  type CardContent,
} from '../../app/boards/model';
import { openPlayerWindow, sendToPlayers } from '../../app/boards/player';
import { useBoard, useBoards } from '../../app/boards/store';
import { emptyHistory, record, redo, typingIn, undo } from '../../app/history';
import { useCampaigns } from '../../app/campaigns/store';
import { entityPath } from '../../app/data/entities';
import { useEncounters } from '../../app/encounters/store';
import { journalPath } from '../../app/journal/paths';
import { generateNpc } from '../../app/boards/npc';
import { useCharacters } from '../../app/characters/store';
import { useJournal } from '../../app/journal/store';
import { useMaps } from '../../app/maps/store';
import { useAppNavigate } from '../../app/navigation';
import { EntitySearch } from '../../app/search/EntitySearch';
import { shrinkImage } from '../../app/shrinkImage';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { useTheme } from '../../app/theme';
import { BoardActionsContext, PlayersBoardContext, type BoardActions } from './context';
import { KIND_ICONS, KIND_LABELS, type CardNodeType } from './kinds';
import { CardNode, FrameNode, StackNode } from './nodes';
import { NotesProvider } from '../../app/journal/notes/NotesProvider';

const NODE_TYPES = { card: CardNode, stack: StackNode, frame: FrameNode };

/** One board: an infinite canvas of cards. */
export function BoardPage({ id, focus }: { id: string; focus?: string }) {
  const { loaded, load } = useBoards();
  const board = useBoard(id);
  const { campaigns, loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const { loaded: encountersLoaded, load: loadEncounters } = useEncounters();
  usePageTitle(board?.name ?? 'Board');
  useEffect(() => {
    if (!loaded) void load();
    if (!campaignsLoaded) void loadCampaigns();
    if (!encountersLoaded) void loadEncounters();
  }, [loaded, load, campaignsLoaded, loadCampaigns, encountersLoaded, loadEncounters]);

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!board) return <p className="p-8">This board does not exist (any more).</p>;
  const campaign = campaigns.find((c) => c.id === board.campaign);
  return (
    <div className="flex h-full flex-col">
      <ReactFlowProvider>
        <NotesProvider campaign={campaign}>
          <BoardEditor board={board} {...(focus ? { focus } : {})} />
        </NotesProvider>
      </ReactFlowProvider>
    </div>
  );
}

/** Nodes for the cards, frames first (React Flow wants parents before their children). */
function toNodes(cards: readonly BoardCard[], cache: WeakMap<BoardCard, CardNodeType>) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const drawn = cards.filter((c) => !c.inStack);
  const ordered = [
    ...drawn.filter((c) => c.kind === 'frame'),
    ...drawn.filter((c) => c.kind !== 'frame'),
  ];
  return ordered.map((card): CardNodeType => {
    const cached = card.kind === 'stack' ? undefined : cache.get(card);
    if (cached) return cached;
    const node: CardNodeType = {
      id: card.id,
      type: card.kind === 'frame' ? 'frame' : card.kind === 'stack' ? 'stack' : 'card',
      position: { x: card.x, y: card.y },
      data: {
        card,
        ...(card.kind === 'stack'
          ? {
              members: card.items.flatMap((i) => {
                const m = byId.get(i);
                return m ? [m] : [];
              }),
            }
          : {}),
      },
      width: card.w,
      height: card.collapsed ? COLLAPSED_H : card.h,
      dragHandle: '.card-drag',
      ...(card.parent && byId.has(card.parent) ? { parentId: card.parent } : {}),
      ...(card.kind === 'frame' ? { zIndex: -1 } : {}),
    };
    cache.set(card, node);
    return node;
  });
}

function BoardEditor({ board, focus }: { board: Board; focus?: string }) {
  const navigate = useAppNavigate();
  const flow = useReactFlow();
  const theme = useTheme((s) => s.mode);
  const wrapper = useRef<HTMLDivElement>(null);
  const boardId = board.id;
  const campaignId = board.campaign;

  /** Versions to undo and redo, and whether there are any (for the buttons). */
  const history = useRef(emptyHistory<Board>());
  const [can, setCan] = useState({ undo: false, redo: false });
  const showSteps = useCallback(() => {
    setCan({ undo: history.current.past.length > 0, redo: history.current.future.length > 0 });
  }, []);
  // Another board: its own history.
  useEffect(() => {
    history.current = emptyHistory<Board>();
    showSteps();
  }, [boardId, showSteps]);
  /** Saves a new version of the board, keeping the one it replaces for undo. */
  const saveChange = useCallback(
    (before: Board, next: Board, fold = false) => {
      if (next === before) return;
      // Typing in a card folds into one step; cards added, moved or removed are a step each.
      history.current = record(history.current, before, Date.now(), fold ? 600 : 0);
      showSteps();
      useBoards.getState().save(next);
    },
    [showSteps],
  );
  /** Changes the board as it is now (not as it was at the last render). */
  const commit = useCallback(
    (change: (b: Board) => Board, fold = false) => {
      const current = useBoards.getState().boards.find((b) => b.id === boardId);
      if (current) saveChange(current, change(current), fold);
    },
    [boardId, saveChange],
  );
  const step = useCallback(
    (which: typeof undo) => {
      const s = useBoards.getState();
      const current = s.boards.find((b) => b.id === boardId);
      const done = current && which(history.current, current);
      if (!done) return;
      history.current = done.history;
      showSteps();
      // The view stays where it is.
      const { viewport: _v, ...value } = done.value;
      s.save(current.viewport ? { ...value, viewport: current.viewport } : value);
    },
    [boardId, showSteps],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || typingIn(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) step(undo);
      else if (key === 'y' || (key === 'z' && e.shiftKey)) step(redo);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [step]);

  const actions = useMemo<BoardActions>(
    () => ({
      update: (id, change) => {
        commit((b) => updateBoardCard(b, id, change), true);
      },
      remove: (id) => {
        commit((b) => removeBoardCard(b, id));
      },
      unstack: (id) => {
        commit((b) => unstack(b, id));
      },
      unframe: (id) => {
        commit((b) => setFrame(b, id, null));
      },
      addBeside: (id, contents) => {
        commit((b) => {
          const card = b.cards.find((c) => c.id === id);
          if (!card) return b;
          const at = absolutePosition(b, card);
          return addBoardCards(b, contents, { x: at.x + card.w + 24, y: at.y }).board;
        });
      },
      show: (card) => {
        // A stack sends its cards; anything else, a copy of itself.
        const current = useBoards.getState().boards.find((b) => b.id === boardId);
        const cards =
          card.kind === 'stack'
            ? card.items.flatMap((id) => current?.cards.find((c) => c.id === id) ?? [])
            : [card];
        void sendToPlayers(cards.map(contentOf), campaignId);
      },
      open: (card, newTab) => {
        if (card.kind === 'entity') navigate(entityPath(card.key), { newTab });
        if (card.kind === 'note') navigate(journalPath(card.path), { newTab });
      },
    }),
    [commit, navigate, boardId, campaignId],
  );

  // React Flow moves nodes while dragging; the board is saved when a drag ends.
  // Unchanged cards keep their node objects, so React Flow redraws only what changed.
  const [cache] = useState(() => new WeakMap<BoardCard, CardNodeType>());
  const derived = useMemo(() => toNodes(board.cards, cache), [board.cards, cache]);
  const [nodes, setNodes] = useState(derived);
  const [shownFrom, setShownFrom] = useState(derived);
  if (shownFrom !== derived) {
    setShownFrom(derived);
    const selected = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    setNodes(derived.map((n) => (selected.has(n.id) ? { ...n, selected: true } : n)));
  }
  const onNodesChange = useCallback((changes: NodeChange<CardNodeType>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, []);

  const centre = () => {
    const r = wrapper.current?.getBoundingClientRect();
    return r
      ? flow.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      : { x: 0, y: 0 };
  };
  /**
   * Adds cards in the free place nearest `at` (where the board was right-clicked) or the middle
   * of the screen, and brings them into view.
   */
  const add = (contents: CardContent[], at?: { x: number; y: number }) => {
    const first = contents[0];
    const s = useBoards.getState();
    const current = s.boards.find((b) => b.id === boardId);
    const r = wrapper.current?.getBoundingClientRect();
    if (!first || !current || !r) return;
    const c = centre();
    const size = SIZES[first.kind];
    const { board: next, ids } = addBoardCards(
      current,
      contents,
      at ?? { x: c.x - size.w / 2, y: c.y - size.h / 2 },
    );
    saveChange(current, next);
    const card = next.cards.find((x) => x.id === ids[0]);
    if (!card) return;
    const topLeft = flow.screenToFlowPosition({ x: r.left, y: r.top });
    const bottomRight = flow.screenToFlowPosition({ x: r.right, y: r.bottom });
    const seen =
      card.x >= topLeft.x &&
      card.y >= topLeft.y &&
      card.x + Math.min(card.w, bottomRight.x - topLeft.x) <= bottomRight.x &&
      card.y + 40 <= bottomRight.y;
    if (!seen)
      void flow.setCenter(
        card.x + card.w / 2,
        card.y + Math.min(card.h, (bottomRight.y - topLeft.y) / 2),
        {
          zoom: flow.getZoom(),
          duration: 200,
        },
      );
  };

  // A card asked for in the URL is brought into view once the canvas is ready.
  const [focused, setFocused] = useState<string | null>(null);
  useEffect(() => {
    if (!focus || focused === focus) return;
    const card = useBoards
      .getState()
      .boards.find((b) => b.id === boardId)
      ?.cards.find((c) => c.id === focus);
    if (!card) return;
    const t = setTimeout(() => {
      const at = absolutePosition(
        useBoards.getState().boards.find((b) => b.id === boardId) ?? board,
        card,
      );
      void flow.setCenter(at.x + card.w / 2, at.y + Math.min(card.h, 400) / 2, {
        zoom: Math.max(flow.getZoom(), 0.8),
        duration: 300,
      });
      setFocused(focus);
    }, 50);
    return () => {
      clearTimeout(t);
    };
  }, [focus, focused, boardId, board, flow]);

  const [panel, setPanel] = useState<{
    kind: PanelKind;
    at?: { x: number; y: number };
    near?: { left: number; top: number };
  } | null>(null);
  // Right-click on the board: the Add menu, there.
  const [menu, setMenu] = useState<{ x: number; y: number; at: { x: number; y: number } } | null>(
    null,
  );
  /** A panel's place by a right-clicked point, kept inside the canvas. */
  const panelSpot = (at: { x: number; y: number }) => {
    const r = wrapper.current?.getBoundingClientRect();
    if (!r) return { left: 8, top: 8 };
    const p = flow.flowToScreenPosition(at);
    const width = Math.min(384, r.width - 16);
    return {
      left: Math.round(Math.max(8, Math.min(p.x - r.left, r.width - width - 8))),
      top: Math.round(Math.max(8, Math.min(p.y - r.top, r.height - 320))),
    };
  };

  const options = useAddOptions(
    board,
    (contents, at) => {
      add(contents, at);
    },
    (kind, at) => {
      setPanel({ kind, ...(at ? { at, near: panelSpot(at) } : {}) });
    },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <BoardActionsContext.Provider value={actions}>
      <PlayersBoardContext.Provider value={board.players === true}>
        <Toolbar
          board={board}
          onRename={(name) => {
            commit((b) => ({ ...b, name }));
          }}
          options={options}
          onDelete={() => {
            setConfirmDelete(true);
          }}
          onUndo={
            can.undo
              ? () => {
                  step(undo);
                }
              : undefined
          }
          onRedo={
            can.redo
              ? () => {
                  step(redo);
                }
              : undefined
          }
        />
        {confirmDelete && (
          <div
            role="alertdialog"
            aria-label="Delete this board?"
            className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 text-sm"
          >
            <span className="flex-1">Delete “{board.name}” and all its cards?</span>
            <Button
              variant="primary"
              onClick={() => {
                void useBoards
                  .getState()
                  .remove(board.id)
                  .then(() => {
                    navigate('/boards');
                  });
              }}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmDelete(false);
              }}
            >
              Cancel
            </Button>
          </div>
        )}
        <div ref={wrapper} className="relative min-h-0 flex-1">
          {panel && (
            <Panel
              title={PANEL_TITLES[panel.kind]}
              {...(panel.near ? { near: panel.near } : {})}
              onClose={() => {
                setPanel(null);
              }}
            >
              {panel.kind === 'entity' ? (
                <EntitySearch
                  label="Find a compendium entry"
                  placeholder="Spell, item, creature…"
                  onAdd={(key) => {
                    add([{ kind: 'entity', key }], panel.at);
                  }}
                />
              ) : panel.kind === 'note' ? (
                <NotePicker
                  onPick={(path) => {
                    add([{ kind: 'note', path }], panel.at);
                  }}
                />
              ) : panel.kind === 'map' ? (
                <MapPicker
                  campaign={board.campaign}
                  onPick={(map) => {
                    add([{ kind: 'map', map }], panel.at);
                    setPanel(null);
                  }}
                />
              ) : (
                <CharacterPicker
                  campaign={board.campaign}
                  onPick={(character) => {
                    add(
                      [
                        {
                          kind: 'character',
                          character,
                          show: { spells: false, features: false, inventory: false },
                        },
                      ],
                      panel.at,
                    );
                    setPanel(null);
                  }}
                />
              )}
            </Panel>
          )}
          {menu && (
            <ContextAddMenu
              x={menu.x}
              y={menu.y}
              options={options}
              at={menu.at}
              onClose={() => {
                setMenu(null);
              }}
            />
          )}
          <ReactFlow
            nodes={nodes}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={(_, node, dragged) => {
              const moved = new Map(dragged.map((n) => [n.id, n.position]));
              commit((b) => {
                const next = moveBoardCards(b, moved);
                return dragged.length === 1 ? dropCard(next, node.id) : next;
              });
            }}
            onMoveEnd={(_, vp) => {
              // Where the board is looked at is kept, but is not a change to undo.
              const s = useBoards.getState();
              const current = s.boards.find((b) => b.id === boardId);
              if (current)
                s.save({
                  ...current,
                  viewport: { x: Math.round(vp.x), y: Math.round(vp.y), zoom: vp.zoom },
                });
            }}
            {...(board.viewport
              ? { defaultViewport: board.viewport }
              : { fitView: true, fitViewOptions: { maxZoom: 1 } })}
            minZoom={0.05}
            maxZoom={2}
            onlyRenderVisibleElements
            deleteKeyCode={['Delete', 'Backspace']}
            onBeforeDelete={({ nodes: gone }) => {
              // Only the cards picked go (a frame's cards stay, freed), as the card's own delete
              // button does; the board store then redraws the canvas.
              const ids = gone.filter((n) => n.selected).map((n) => n.id);
              if (ids.length) commit((b) => ids.reduce(removeBoardCard, b));
              return Promise.resolve(false);
            }}
            nodesConnectable={false}
            zoomOnDoubleClick={false}
            onPaneContextMenu={(e) => {
              e.preventDefault();
              const r = wrapper.current?.getBoundingClientRect();
              if (!r) return;
              setMenu({
                x: e.clientX - r.left,
                y: e.clientY - r.top,
                at: flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
              });
            }}
            onPaneClick={() => {
              setMenu(null);
            }}
            colorMode={theme}
            aria-label="Board canvas"
          >
            <Background gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </PlayersBoardContext.Provider>
    </BoardActionsContext.Provider>
  );
}

type PanelKind = 'entity' | 'note' | 'map' | 'character';

const PANEL_TITLES: Record<PanelKind, string> = {
  entity: 'Add from the compendium',
  note: 'Add a journal note',
  map: 'Add a map',
  character: 'Add a character',
};

/** One thing the Add menus offer. */
interface AddOption {
  id: string;
  label: string;
  kind: keyof typeof KIND_ICONS;
  disabled?: boolean;
  /** Picks, then adds (`at`: where the board was right-clicked). */
  run: (at?: { x: number; y: number }) => void;
  /** Starts a new group in the menu. */
  separator?: boolean;
}

/** What can be added to a board: the toolbar's Add menu and the right-click menu share it. */
function useAddOptions(
  board: Board,
  add: (contents: CardContent[], at?: { x: number; y: number }) => void,
  openPanel: (kind: PanelKind, at?: { x: number; y: number }) => void,
): AddOption[] {
  const addAttachment = useJournal((s) => s.addAttachment);
  const journalFor = useJournal((s) => s.campaignId);
  const pickPicture = (at?: { x: number; y: number }) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        // A campaign's pictures go with its journal files, full size; others are kept smaller.
        const src =
          board.campaign && journalFor === board.campaign
            ? `journal:${await addAttachment(file.name, new Uint8Array(await file.arrayBuffer()))}`
            : await shrinkImage(file, 1600);
        add([{ kind: 'image', src }], at);
      })();
    };
    input.click();
  };
  const simple = (id: string, kind: AddOption['kind'], content: () => CardContent): AddOption => ({
    id,
    label: KIND_LABELS[kind],
    kind,
    run: (at) => {
      add([content()], at);
    },
  });
  return [
    {
      id: 'entity',
      label: 'Compendium entry…',
      kind: 'entity',
      run: (at) => {
        openPanel('entity', at);
      },
    },
    {
      id: 'note',
      label: 'Journal note…',
      kind: 'note',
      disabled: !board.campaign,
      run: (at) => {
        openPanel('note', at);
      },
    },
    { id: 'image', label: 'Picture…', kind: 'image', run: pickPicture },
    {
      id: 'map',
      label: 'Map…',
      kind: 'map',
      run: (at) => {
        openPanel('map', at);
      },
    },
    {
      id: 'character',
      label: 'Character…',
      kind: 'character',
      run: (at) => {
        openPanel('character', at);
      },
    },
    { ...simple('calendar', 'calendar', () => ({ kind: 'calendar' })), disabled: !board.campaign },
    {
      ...simple('npc', 'npc', () => ({ kind: 'npc', npc: generateNpc() })),
      label: 'NPC generator',
      separator: true,
    },
    simple('text', 'text', () => ({ kind: 'text', text: '' })),
    simple('dice', 'dice', () => ({ kind: 'dice', formulas: [] })),
    simple('timer', 'timer', () => ({ kind: 'timer', seconds: 600, elapsed: 0 })),
    simple('initiative', 'initiative', () => ({ kind: 'initiative', rows: [], turn: 0, round: 1 })),
    simple('frame', 'frame', () => ({ kind: 'frame', title: 'Frame' })),
  ];
}

const itemClass =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none data-[highlighted]:bg-sunken data-[disabled]:text-faint hover:bg-sunken disabled:text-faint';

function OptionIcon({ kind }: { kind: AddOption['kind'] }) {
  const I = KIND_ICONS[kind];
  return <I className="h-4 w-4" aria-hidden />;
}

/** The Add menu where the board was right-clicked; cards land there. */
function ContextAddMenu({
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

function Toolbar({
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
          to="/boards"
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

function MapPicker({
  campaign,
  onPick,
}: {
  campaign?: string | undefined;
  onPick: (id: string) => void;
}) {
  const { maps, loaded, load } = useMaps();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const mine = maps.filter((m) => (m.campaign ?? null) === (campaign ?? null));
  if (mine.length === 0)
    return (
      <p className="text-sm text-muted">
        No maps here yet:{' '}
        <AppLink to="/maps" className="text-link hover:underline">
          make one
        </AppLink>
        .
      </p>
    );
  return (
    <ul aria-label="Maps" className="max-h-72 overflow-y-auto">
      {mine.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => {
              onPick(m.id);
            }}
            className="w-full truncate px-2 py-1.5 text-left text-sm hover:bg-sunken"
          >
            {m.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

function CharacterPicker({
  campaign,
  onPick,
}: {
  campaign?: string | undefined;
  onPick: (id: string) => void;
}) {
  const { characters, loaded, load } = useCharacters();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  // The campaign's characters first, then the library's.
  const list = [...characters].sort(
    (a, b) => Number(b.campaign === campaign) - Number(a.campaign === campaign),
  );
  if (list.length === 0) return <p className="text-sm text-muted">No characters yet.</p>;
  return (
    <ul aria-label="Characters" className="max-h-72 overflow-y-auto">
      {list.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => {
              onPick(c.id);
            }}
            className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-sm hover:bg-sunken"
          >
            <span className="font-medium">{c.name}</span>
            <span className="ml-auto truncate text-xs text-muted">{c.summary}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  title,
  near,
  onClose,
  children,
}: {
  title: string;
  /** Where the board was right-clicked (px in the canvas): the panel opens there. */
  near?: { left: number; top: number };
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      style={near}
      className={`absolute z-20 rounded-lg border border-border bg-surface p-3 shadow-card ${near ? 'w-96 max-w-[calc(100%-1rem)]' : 'top-2 right-2 left-2 sm:left-auto sm:w-96'}`}
    >
      <div className="mb-2 flex items-center">
        <h2 className="flex-1 font-serif font-bold">{title}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-sunken"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {children}
    </section>
  );
}

function NotePicker({ onPick }: { onPick: (path: string) => void }) {
  const notes = useJournal((s) => s.notes);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const found = [...notes.keys()]
    .filter((p) => !q || p.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .slice(0, 50);
  return (
    <div>
      <input
        type="search"
        value={query}
        aria-label="Find a note"
        placeholder="Note name…"
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base focus:border-accent focus:outline-none sm:text-sm"
      />
      <ul aria-label="Notes" className="mt-1 max-h-72 overflow-y-auto">
        {found.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => {
                onPick(p);
              }}
              className="w-full truncate px-2 py-1.5 text-left text-sm hover:bg-sunken"
            >
              {p.replace(/\.md$/i, '')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
