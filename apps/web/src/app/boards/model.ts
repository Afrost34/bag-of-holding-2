import { newId } from '../cards/model';
import type { CombatState } from './combat';
import type { Npc } from './npc';

/**
 * DM boards: infinite canvases of cards (compendium entries, journal notes, images, dice,
 * timers, initiative…), many per campaign.
 *
 *   boards/<id>.json                       boards kept outside any campaign
 *   campaigns/<campaign>/boards/<id>.json  a campaign's boards
 *
 * Cards store references (`spell:fireball@xphb`, a journal note's path), never 5etools text.
 * Positions are canvas pixels; a card inside a frame is placed relative to the frame. A card in a
 * stack is not drawn on its own: the stack shows its members as tabs.
 */

export const BOARDS_DIR = 'boards';

export interface InitiativeRow {
  id: string;
  name: string;
  initiative: number;
  hp?: string;
  note?: string;
}

/** What a card shows. */
export type CardContent =
  | { kind: 'entity'; key: string }
  | { kind: 'note'; path: string }
  /**
   * `journal:<path>` (a picture in the campaign journal's files), `data:` URL (a shrunk upload, on
   * boards outside campaigns) or `art:<path>` (5etools art).
   */
  | { kind: 'image'; src: string; caption?: string }
  | { kind: 'text'; text: string }
  | { kind: 'dice'; formulas: string[] }
  /**
   * A countdown. Running: `startedAt` is when it last started and `elapsed` what ran before;
   * paused: only `elapsed`.
   */
  | { kind: 'timer'; seconds: number; elapsed: number; startedAt?: number }
  | { kind: 'initiative'; rows: InitiativeRow[]; turn: number; round: number }
  /** A combat tracker (see `combat.ts`); `encounter` is the encounter it was started from. */
  | ({ kind: 'combat'; encounter?: string } & CombatState)
  /** An encounter of the campaign, with its difficulty and a button to start the fight. */
  | { kind: 'encounter'; encounter: string }
  /** A map from the Maps module, viewed (not edited) on the board. */
  | { kind: 'map'; map: string }
  /** A character of the campaign at a glance; the sections shown are the DM's choice. */
  | {
      kind: 'character';
      character: string;
      show: { spells: boolean; features: boolean; inventory: boolean; story?: boolean };
    }
  /** The campaign's calendar: today, this month and what comes next. */
  | { kind: 'calendar' }
  /** A generated NPC (the DM's own text from then on). */
  | { kind: 'npc'; npc: Npc }
  | { kind: 'frame'; title: string }
  | { kind: 'stack'; items: string[]; active: number };

export type CardKind = CardContent['kind'];

export type BoardCard = CardContent & {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Shows the title bar only. */
  collapsed?: boolean;
  /** A title of its own (otherwise the entity's or note's name). */
  title?: string;
  /** The frame it sits in; `x`/`y` are then relative to the frame. */
  parent?: string;
  /** The stack it is a tab of; not drawn on its own. */
  inStack?: string;
};

export interface Board {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cards: BoardCard[];
  /** Where the canvas was last looked at. */
  viewport?: { x: number; y: number; zoom: number };
  /** The players' board (the player window), not listed with the DM's boards. */
  players?: true;
  /** The campaign it belongs to; absent outside campaigns. Not stored: it is where the file is. */
  campaign?: string;
}

/** A card's default size. */
export const SIZES: Record<CardKind, { w: number; h: number }> = {
  entity: { w: 340, h: 380 },
  note: { w: 340, h: 320 },
  image: { w: 320, h: 260 },
  text: { w: 240, h: 170 },
  dice: { w: 280, h: 190 },
  timer: { w: 240, h: 150 },
  initiative: { w: 320, h: 300 },
  combat: { w: 480, h: 560 },
  encounter: { w: 340, h: 320 },
  map: { w: 520, h: 400 },
  character: { w: 460, h: 620 },
  npc: { w: 340, h: 380 },
  frame: { w: 760, h: 480 },
  stack: { w: 340, h: 380 },
  calendar: { w: 340, h: 460 },
};

/** Height of a collapsed card (its title bar). */
export const COLLAPSED_H = 40;

export function boardDir(campaign?: string): string {
  return campaign ? `campaigns/${campaign}/${BOARDS_DIR}` : BOARDS_DIR;
}

export function boardPath(id: string, campaign?: string): string {
  return `${boardDir(campaign)}/${id}.json`;
}

export function newBoard(name: string, existingIds: readonly string[], now: string): Board {
  return {
    version: 1,
    id: newId(existingIds),
    name: name.trim() || 'Board',
    createdAt: now,
    updatedAt: now,
    cards: [],
  };
}

const GAP = 24;

/** Where the next new card goes when no place is given: right of everything, top-aligned. */
function nextFree(board: Board): { x: number; y: number } {
  const top = board.cards.filter((c) => !c.parent && !c.inStack);
  if (top.length === 0) return { x: 0, y: 0 };
  return {
    x: Math.max(...top.map((c) => c.x + c.w)) + GAP,
    y: Math.min(...top.map((c) => c.y)),
  };
}

/**
 * The free place nearest to `at` for a card of `size`: where it overlaps no card (frames
 * included), searched ring by ring outwards.
 */
function freeSpot(
  board: Board,
  at: { x: number; y: number },
  size: { w: number; h: number },
): { x: number; y: number } {
  const rects = board.cards
    .filter((c) => !c.inStack)
    .map((c) => ({ ...absolutePosition(board, c), w: c.w, h: c.collapsed ? COLLAPSED_H : c.h }));
  const free = (p: { x: number; y: number }) =>
    !rects.some(
      (r) =>
        p.x < r.x + r.w + GAP &&
        r.x < p.x + size.w + GAP &&
        p.y < r.y + r.h + GAP &&
        r.y < p.y + size.h + GAP,
    );
  const STEP = 40;
  for (let ring = 0; ring <= 60; ring++) {
    const spots: { x: number; y: number; d: number }[] = [];
    for (let i = -ring; i <= ring; i++)
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        spots.push({ x: at.x + i * STEP, y: at.y + j * STEP, d: i * i + j * j });
      }
    spots.sort((p, q) => p.d - q.d);
    const spot = spots.find(free);
    if (spot) return { x: Math.round(spot.x), y: Math.round(spot.y) };
  }
  return nextFree(board);
}

/**
 * Adds cards side by side, from the free place nearest `at` (canvas pixels) or right of what is
 * already there. Returns
 * the board and the new cards' ids.
 */
export function addBoardCards(
  board: Board,
  contents: readonly CardContent[],
  at?: { x: number; y: number },
): { board: Board; ids: string[] } {
  const ids = board.cards.map((c) => c.id);
  const added: BoardCard[] = [];
  const first = contents[0];
  const start = at && first ? freeSpot(board, at, SIZES[first.kind]) : nextFree(board);
  let x = start.x;
  const y = start.y;
  for (const content of contents) {
    const id = newId(ids);
    ids.push(id);
    const size = SIZES[content.kind];
    added.push({ ...content, id, x, y, ...size });
    x += size.w + GAP;
  }
  return { board: { ...board, cards: [...board.cards, ...added] }, ids: added.map((c) => c.id) };
}

export function updateBoardCard(
  board: Board,
  id: string,
  change: (card: BoardCard) => BoardCard,
): Board {
  return { ...board, cards: board.cards.map((c) => (c.id === id ? change(c) : c)) };
}

export function moveBoardCards(
  board: Board,
  positions: ReadonlyMap<string, { x: number; y: number }>,
): Board {
  return {
    ...board,
    cards: board.cards.map((c) => {
      const p = positions.get(c.id);
      return p ? { ...c, x: Math.round(p.x), y: Math.round(p.y) } : c;
    }),
  };
}

/** Where a card is on the canvas (frames place their cards relative to themselves). */
export function absolutePosition(board: Board, card: BoardCard): { x: number; y: number } {
  const frame = card.parent ? board.cards.find((c) => c.id === card.parent) : undefined;
  return frame ? { x: frame.x + card.x, y: frame.y + card.y } : { x: card.x, y: card.y };
}

/** Puts a card into a frame (or takes it out, with `null`), keeping it where it is on screen. */
export function setFrame(board: Board, id: string, frameId: string | null): Board {
  const card = board.cards.find((c) => c.id === id);
  if (!card || card.kind === 'frame' || (card.parent ?? null) === frameId) return board;
  const abs = absolutePosition(board, card);
  const frame = frameId ? board.cards.find((c) => c.id === frameId) : undefined;
  if (frameId && frame?.kind !== 'frame') return board;
  return updateBoardCard(board, id, (c) => {
    const { parent: _parent, ...rest } = c;
    return frame
      ? { ...rest, parent: frame.id, x: abs.x - frame.x, y: abs.y - frame.y }
      : { ...rest, ...abs };
  });
}

/**
 * Drops a card on another: onto a stack it becomes its last tab; onto a card, the two become a
 * new stack where the target was. Frames and stacks cannot be stacked themselves.
 */
export function stackOnto(board: Board, id: string, targetId: string): Board {
  const card = board.cards.find((c) => c.id === id);
  const target = board.cards.find((c) => c.id === targetId);
  if (!card || !target || id === targetId) return board;
  if (card.kind === 'frame' || card.kind === 'stack' || target.kind === 'frame') return board;
  const out = (c: BoardCard, stack: string): BoardCard => {
    const { parent: _parent, ...rest } = c;
    return { ...rest, inStack: stack };
  };
  if (target.kind === 'stack') {
    return {
      ...board,
      cards: board.cards.map((c) =>
        c.id === id
          ? out(c, target.id)
          : c.id === target.id && c.kind === 'stack'
            ? { ...c, items: [...c.items, id], active: c.items.length }
            : c,
      ),
    };
  }
  const stackId = newId(board.cards.map((c) => c.id));
  const stack: BoardCard = {
    kind: 'stack',
    items: [target.id, id],
    active: 1,
    id: stackId,
    x: target.x,
    y: target.y,
    w: target.w,
    h: target.h,
    ...(target.parent ? { parent: target.parent } : {}),
  };
  return {
    ...board,
    cards: [
      ...board.cards.map((c) => (c.id === id || c.id === target.id ? out(c, stackId) : c)),
      stack,
    ],
  };
}

/** Takes a tab out of its stack, next to it; a stack left with one card is undone. */
export function unstack(board: Board, id: string): Board {
  const card = board.cards.find((c) => c.id === id);
  const stack = board.cards.find((c) => c.id === card?.inStack);
  if (!card || stack?.kind !== 'stack') return board;
  const items = stack.items.filter((i) => i !== id);
  const place = (c: BoardCard, x: number, y: number): BoardCard => {
    const { inStack: _inStack, ...rest } = c;
    return { ...rest, x, y, ...(stack.parent ? { parent: stack.parent } : {}) };
  };
  let cards = board.cards.map((c) =>
    c.id === id ? place(c, stack.x + stack.w + GAP, stack.y) : c,
  );
  if (items.length <= 1) {
    cards = cards
      .filter((c) => c.id !== stack.id)
      .map((c) => (items.includes(c.id) ? place(c, stack.x, stack.y) : c));
  } else {
    cards = cards.map((c) =>
      c.id === stack.id && c.kind === 'stack'
        ? { ...c, items, active: Math.min(c.active, items.length - 1) }
        : c,
    );
  }
  return { ...board, cards };
}

/**
 * Removes a card. A frame's cards stay where they are on the canvas; a stack's cards go with it.
 */
export function removeBoardCard(board: Board, id: string): Board {
  const card = board.cards.find((c) => c.id === id);
  if (!card) return board;
  let next: Board = board;
  if (card.inStack) next = unstack(next, id);
  for (const c of next.cards) if (c.parent === id) next = setFrame(next, c.id, null);
  const gone = new Set([id, ...(card.kind === 'stack' ? card.items : [])]);
  return { ...next, cards: next.cards.filter((c) => !gone.has(c.id)) };
}

/** Seconds left on a timer card at `now` (ms). */
export function timerLeft(
  card: { seconds: number; elapsed: number; startedAt?: number },
  now: number,
): number {
  const ran = card.elapsed + (card.startedAt !== undefined ? now - card.startedAt : 0);
  return Math.max(0, card.seconds - Math.floor(ran / 1000));
}

/** Initiative rows highest first (ties keep their order). */
export function sortInitiative(rows: readonly InitiativeRow[]): InitiativeRow[] {
  return [...rows].sort((a, b) => b.initiative - a.initiative);
}

/** The next turn; past the last row starts a new round. */
export function nextTurn(card: { rows: readonly InitiativeRow[]; turn: number; round: number }): {
  turn: number;
  round: number;
} {
  if (card.rows.length === 0) return { turn: 0, round: card.round };
  return card.turn + 1 >= card.rows.length
    ? { turn: 0, round: card.round + 1 }
    : { turn: card.turn + 1, round: card.round };
}

const KINDS = new Set<string>(Object.keys(SIZES));
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function parseBoard(text: string | null, id: string, campaign?: string): Board | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(json)) return null;
  const cards = (Array.isArray(json.cards) ? json.cards : []).filter(
    (c): c is BoardCard =>
      isObj(c) && typeof c.id === 'string' && typeof c.kind === 'string' && KINDS.has(c.kind),
  );
  const viewport = isObj(json.viewport)
    ? {
        x: num(json.viewport.x, 0),
        y: num(json.viewport.y, 0),
        zoom: num(json.viewport.zoom, 1),
      }
    : undefined;
  return {
    version: 1,
    id,
    name: typeof json.name === 'string' ? json.name : 'Board',
    createdAt: typeof json.createdAt === 'string' ? json.createdAt : '',
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '',
    cards: cards.map((c) => ({
      ...c,
      x: num(c.x, 0),
      y: num(c.y, 0),
      w: num(c.w, SIZES[c.kind].w),
      h: num(c.h, SIZES[c.kind].h),
    })),
    ...(viewport ? { viewport } : {}),
    ...(json.players === true ? { players: true as const } : {}),
    ...(campaign ? { campaign } : {}),
  };
}

export function serializeBoard(board: Board): string {
  const { campaign: _campaign, ...rest } = board;
  return `${JSON.stringify(rest, null, 2)}\n`;
}

const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/**
 * After a card is dragged: with its title bar over another card's title bar, it is stacked onto
 * it; else inside a frame it joins the frame, and outside its frame it leaves it.
 */
export function dropCard(board: Board, id: string): Board {
  const card = board.cards.find((c) => c.id === id);
  if (!card || card.inStack) return board;
  const abs = absolutePosition(board, card);
  const grip = { x: abs.x + card.w / 2, y: abs.y + COLLAPSED_H / 2 };
  const drawn = board.cards.filter((c) => c.id !== id && !c.inStack);
  if (card.kind !== 'frame' && card.kind !== 'stack') {
    const target = drawn
      .filter((c) => c.kind !== 'frame')
      .reverse()
      .find((c) => inside(grip, { ...absolutePosition(board, c), w: c.w, h: COLLAPSED_H }));
    if (target) return stackOnto(board, id, target.id);
  }
  if (card.kind === 'frame') return board;
  const frame = drawn
    .filter((c) => c.kind === 'frame')
    .reverse()
    .find((c) => inside(grip, c));
  return setFrame(board, id, frame?.id ?? null);
}

/**
 * The players' board of a campaign (or of the library): what the player window shows, a board like
 * any other that the DM sends cards to. One per campaign, so its id names the campaign.
 */
export const playersBoardId = (campaign?: string) => `players-${campaign ?? 'library'}`;

/** What a card holds, without where it sits: to send a copy of it somewhere else. */
export function contentOf(card: BoardCard): CardContent {
  const {
    id: _id,
    x: _x,
    y: _y,
    w: _w,
    h: _h,
    parent: _p,
    inStack: _i,
    collapsed: _c,
    ...content
  } = card;
  return content;
}
