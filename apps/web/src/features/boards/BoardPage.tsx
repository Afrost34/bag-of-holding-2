import { Button } from '@boh/ui';
import {
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  absolutePosition,
  addBoardCards,
  COLLAPSED_H,
  contentOf,
  dropCard,
  findCardShowing,
  duplicateCards,
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
import { sendToPlayers } from '../../app/boards/player';
import { useBoard, useBoards } from '../../app/boards/store';
import { useLastBoard } from '../../app/boards/lastBoard';
import { useCampaigns } from '../../app/campaigns/store';
import { entityPath } from '../../app/data/entities';
import { useEncounters } from '../../app/encounters/store';
import { emptyHistory, record, redo, typingIn, undo } from '../../app/history';
import { NotesProvider } from '../../app/journal/notes/NotesProvider';
import { journalPath } from '../../app/journal/paths';
import { useAppNavigate } from '../../app/navigation';
import { EntitySearch } from '../../app/search/EntitySearch';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { useTheme } from '../../app/theme';
import { PANEL_TITLES, useAddOptions, type PanelKind } from './addOptions';
import { CharacterPicker, MapPicker, NotePicker, Panel } from './BoardPickers';
import { ContextAddMenu, Toolbar } from './BoardToolbar';
import { BoardActionsContext, PlayersBoardContext, type BoardActions } from './context';
import { type CardNodeType } from './kinds';
import { CardNode, FrameNode, StackNode } from './nodes';

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
          <BoardEditor key={board.id} board={board} {...(focus ? { focus } : {})} />
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
  // Boards opens this one again next time (not the players' board: it lives in its window).
  const remember = useLastBoard((s) => s.remember);
  useEffect(() => {
    if (!board.players) remember(board.id, board.campaign);
  }, [board.id, board.campaign, board.players, remember]);
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

  /** Brings a card into view (set below, once the canvas's nodes exist). */
  const reveal = useRef<(current: Board, card: BoardCard) => void>(() => undefined);
  /** Cards to select once the board shows them (the copies Ctrl+D just made). */
  const [selectAfter, setSelectAfter] = useState<string[] | null>(null);
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
      duplicate: (ids) => {
        let copies: string[] = [];
        commit((b) => {
          const done = duplicateCards(b, ids);
          copies = done.ids;
          return done.board;
        });
        setSelectAfter(copies);
      },
      addBeside: (id, contents) => {
        // Already on the board (the note a link leads to…): brought into view, not added again.
        const current = useBoards.getState().boards.find((b) => b.id === boardId);
        const [only] = contents;
        const existing =
          current && contents.length === 1 && only ? findCardShowing(current, only) : undefined;
        if (current && existing) {
          reveal.current(current, existing);
          return;
        }
        commit((b) => {
          const card = b.cards.find((c) => c.id === id);
          if (!card) return b;
          const at = absolutePosition(b, card);
          // Opened from a link: the card fits what it shows.
          return addBoardCards(b, contents, { x: at.x + card.w + 24, y: at.y }, { fit: true })
            .board;
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
    // Copies just made are selected instead of their originals (Ctrl+D again copies them).
    const selected = new Set(selectAfter ?? nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectAfter) setSelectAfter(null);
    setNodes(
      // Unchanged cards keep their node objects (derived nodes are never selected).
      derived.map((n) => (selected.has(n.id) ? { ...n, selected: true } : n)),
    );
  }
  // Ctrl+D copies the selected cards.
  const selectedIds = useRef<string[]>([]);
  useEffect(() => {
    selectedIds.current = nodes.filter((n) => n.selected).map((n) => n.id);
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || typingIn(e.target)) return;
      if (e.key.toLowerCase() !== 'd' || selectedIds.current.length === 0) return;
      e.preventDefault();
      actions.duplicate(selectedIds.current);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [actions]);
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

  /**
   * Brings a card into view: centred, selected and flashed; in a stack, the stack on its tab.
   */
  function revealCard(current: Board, card: BoardCard) {
    const stack = card.inStack
      ? current.cards.find((c) => c.id === card.inStack && c.kind === 'stack')
      : undefined;
    if (stack?.kind === 'stack') {
      const active = stack.items.indexOf(card.id);
      if (active >= 0 && active !== stack.active)
        commit((b) =>
          updateBoardCard(b, stack.id, (c) => (c.kind === 'stack' ? { ...c, active } : c)),
        );
    }
    const shown = stack ?? card;
    const at = absolutePosition(current, shown);
    void flow.setCenter(at.x + shown.w / 2, at.y + Math.min(shown.h, 400) / 2, {
      zoom: Math.max(flow.getZoom(), 0.6),
      duration: 300,
    });
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === shown.id })));
    const el = document.querySelector(`.react-flow__node[data-id="${shown.id}"]`);
    el?.classList.add('boh-flash');
    setTimeout(() => {
      el?.classList.remove('boh-flash');
    }, 1600);
  }

  useEffect(() => {
    reveal.current = revealCard;
  });

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
            onlyRenderVisibleElements={false}
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
