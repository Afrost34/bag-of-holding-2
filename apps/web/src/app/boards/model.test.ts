import { describe, expect, it } from 'vitest';
import {
  addBoardCards,
  absolutePosition,
  dropCard,
  moveBoardCards,
  newBoard,
  parseBoard,
  contentOf,
  playersBoardId,
  removeBoardCard,
  serializeBoard,
  setFrame,
  SIZES,
  stackOnto,
  duplicateCards,
  findCardShowing,
  timerLeft,
  unstack,
  type Board,
  type BoardCard,
} from './model';

const empty = (): Board => newBoard('Session 1', [], '2026-10-07T00:00:00Z');
const byId = (b: Board, id: string | undefined) => b.cards.find((c) => c.id === id);
const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('boards', () => {
  it('adds cards side by side, right of what is there', () => {
    let { board, ids } = addBoardCards(empty(), [
      { kind: 'entity', key: 'spell:fireball@xphb' },
      { kind: 'text', text: 'Hello' },
    ]);
    expect(byId(board, ids[0])).toMatchObject({ x: 0, y: 0, ...SIZES.entity });
    expect(byId(board, ids[1])?.x).toBe(SIZES.entity.w + 24);
    ({ board, ids } = addBoardCards(board, [{ kind: 'dice', formulas: ['1d20'] }]));
    expect(byId(board, ids[0])?.x).toBe(SIZES.entity.w + 24 + SIZES.text.w + 24);
    ({ board, ids } = addBoardCards(board, [{ kind: 'text', text: '' }], { x: 5, y: 500 }));
    expect(byId(board, ids[0])).toMatchObject({ x: 5, y: 500 });
    // The same spot again: the nearest free place, not hidden under the first.
    const first = byId(board, ids[0]);
    ({ board, ids } = addBoardCards(board, [{ kind: 'text', text: '' }], { x: 5, y: 500 }));
    const second = byId(board, ids[0]);
    expect(second && first && overlaps(second, first)).toBe(false);
    expect(Math.hypot((second?.x ?? 0) - 5, (second?.y ?? 0) - 500)).toBeLessThan(400);
  });

  it('puts cards in frames and takes them out without moving them on screen', () => {
    const start = addBoardCards(empty(), [{ kind: 'frame', title: 'Town' }], { x: 100, y: 100 });
    const frame = start.ids[0] ?? '';
    const added = addBoardCards(start.board, [{ kind: 'text', text: 'x' }]);
    const card = added.ids[0] ?? '';
    const withCard = moveBoardCards(added.board, new Map([[card, { x: 150, y: 180 }]]));
    const framed = setFrame(withCard, card, frame);
    expect(byId(framed, card)).toMatchObject({ parent: frame, x: 50, y: 80 });
    expect(absolutePosition(framed, byId(framed, card) ?? ({} as never))).toEqual({
      x: 150,
      y: 180,
    });
    const out = setFrame(framed, card, null);
    expect(byId(out, card)).toMatchObject({ x: 150, y: 180 });
    expect(byId(out, card)?.parent).toBeUndefined();
    // Removing the frame keeps its cards where they were.
    const gone = removeBoardCard(framed, frame);
    expect(gone.cards).toHaveLength(1);
    expect(byId(gone, card)).toMatchObject({ x: 150, y: 180 });
  });

  it('stacks cards into tabbed piles and undoes a stack of one', () => {
    const { board, ids } = addBoardCards(empty(), [
      { kind: 'text', text: 'a' },
      { kind: 'text', text: 'b' },
      { kind: 'text', text: 'c' },
    ]);
    const [a = '', b = '', c = ''] = ids;
    const two = stackOnto(board, b, a);
    const stack = two.cards.find((x) => x.kind === 'stack');
    expect(stack).toMatchObject({ items: [a, b], active: 1, x: 0, y: 0 });
    expect(byId(two, a)?.inStack).toBe(stack?.id);
    const three = stackOnto(two, c, stack?.id ?? '');
    expect(three.cards.find((x) => x.kind === 'stack')).toMatchObject({
      items: [a, b, c],
      active: 2,
    });

    const less = unstack(three, c);
    expect(less.cards.find((x) => x.kind === 'stack')).toMatchObject({ items: [a, b], active: 1 });
    expect(byId(less, c)?.inStack).toBeUndefined();
    const none = unstack(less, b);
    expect(none.cards.some((x) => x.kind === 'stack')).toBe(false);
    expect(none.cards.every((x) => !x.inStack)).toBe(true);

    // Removing a stack removes its cards.
    expect(removeBoardCard(three, stack?.id ?? '').cards).toHaveLength(0);
  });

  it('drops a card on a title bar to stack it, in a frame to group it', () => {
    let { board, ids } = addBoardCards(empty(), [{ kind: 'frame', title: 'Town' }], {
      x: 0,
      y: 0,
    });
    const frame = ids[0] ?? '';
    ({ board, ids } = addBoardCards(board, [{ kind: 'text', text: 'a' }], { x: 1000, y: 0 }));
    const a = ids[0] ?? '';
    ({ board, ids } = addBoardCards(board, [{ kind: 'text', text: 'b' }], { x: 2000, y: 0 }));
    const b = ids[0] ?? '';
    const move = (bd: Board, id: string, x: number, y: number) =>
      bd.cards.map((c) => (c.id === id ? { ...c, x, y } : c));

    // Into the frame (its title bar lands inside).
    const framed = dropCard({ ...board, cards: move(board, a, 100, 100) }, a);
    expect(byId(framed, a)).toMatchObject({ parent: frame, x: 100, y: 100 });
    // Out again.
    const out = dropCard({ ...framed, cards: move(framed, a, 2000, 2000) }, a);
    expect(byId(out, a)?.parent).toBeUndefined();
    expect(byId(out, a)).toMatchObject({ x: 2000, y: 2000 });
    // Title bar on b's title bar: a stack.
    const stacked = dropCard({ ...board, cards: move(board, a, 2010, 5) }, a);
    expect(stacked.cards.find((c) => c.kind === 'stack')).toMatchObject({ items: [b, a] });
    // On b's body (below the title bar): just moved, nothing else.
    const beside = dropCard({ ...board, cards: move(board, a, 2010, 100) }, a);
    expect(beside.cards.some((c) => c.kind === 'stack' || c.parent)).toBe(false);
  });

  it('counts timers down', () => {
    expect(timerLeft({ seconds: 60, elapsed: 0, startedAt: 1000 }, 31_000)).toBe(30);
    expect(timerLeft({ seconds: 60, elapsed: 50_000 }, 999_999)).toBe(10);
    expect(timerLeft({ seconds: 60, elapsed: 0, startedAt: 0 }, 90_000)).toBe(0);
  });

  it('opens old initiative cards as combat cards', () => {
    const old = {
      name: 'Old',
      cards: [
        {
          id: 'i',
          kind: 'initiative',
          x: 0,
          y: 0,
          w: 320,
          h: 300,
          rows: [
            { id: '1', name: 'Goblin', initiative: 12, hp: '7' },
            { id: '2', name: 'Lia', initiative: 18 },
          ],
          turn: 1,
          round: 3,
        },
      ],
    };
    const card = parseBoard(JSON.stringify(old), 'b')?.cards[0];
    expect(card).toMatchObject({ kind: 'combat', turn: null, round: 3, w: 320 });
    expect(card?.kind === 'combat' && card.combatants.map((c) => [c.name, c.hp])).toEqual([
      ['Lia', 0],
      ['Goblin', 7],
    ]);
  });

  it('reads back what it writes and skips cards it does not know', () => {
    const { board } = addBoardCards(empty(), [{ kind: 'note', path: 'People/Ana.md' }]);
    const text = serializeBoard({ ...board, campaign: 'c', viewport: { x: 1, y: 2, zoom: 0.5 } });
    expect(text).not.toContain('"campaign"');
    const back = parseBoard(text, board.id, 'c');
    expect(back).toEqual({ ...board, campaign: 'c', viewport: { x: 1, y: 2, zoom: 0.5 } });
    const odd = JSON.parse(text) as { cards: unknown[] };
    odd.cards.push({ id: 'z', kind: 'teleporter' });
    expect(parseBoard(JSON.stringify(odd), board.id)?.cards).toHaveLength(1);
    expect(parseBoard('nope', 'x')).toBeNull();
  });
});

describe('the players board', () => {
  it('is one per campaign, and takes copies of cards', () => {
    expect(playersBoardId('rust')).toBe('players-rust');
    expect(playersBoardId()).toBe('players-library');
    const card: BoardCard = {
      id: 'a',
      kind: 'text',
      text: 'Hi',
      x: 5,
      y: 6,
      w: 240,
      h: 170,
      title: 'Note',
    };
    expect(contentOf(card)).toEqual({ kind: 'text', text: 'Hi', title: 'Note' });
  });

  it('duplicates cards beside themselves, a stack with its cards', () => {
    const { board, ids } = addBoardCards(empty(), [
      { kind: 'text', text: 'a' },
      { kind: 'text', text: 'b' },
      { kind: 'dice', formulas: ['1d20'] },
    ]);
    const [a = '', b = '', d = ''] = ids;
    const stacked = stackOnto(board, b, a);
    const stack = stacked.cards.find((x) => x.kind === 'stack');
    const copy = duplicateCards(stacked, [stack?.id ?? '', d, a]);
    // The stack and the dice; a card inside a stack is copied with its stack only.
    expect(copy.ids).toHaveLength(2);
    const dice = copy.board.cards.find((c) => c.id === copy.ids[1]);
    expect(dice).toMatchObject({
      kind: 'dice',
      formulas: ['1d20'],
      x: (byId(stacked, d)?.x ?? 0) + 32,
    });
    const newStack = copy.board.cards.find((c) => c.id === copy.ids[0]);
    expect(newStack?.kind === 'stack' && newStack.items).toHaveLength(2);
    const members = copy.board.cards.filter((c) => c.inStack === newStack?.id);
    expect(members.map((c) => c.kind === 'text' && c.text)).toEqual(['a', 'b']);
    expect(copy.board.cards).toHaveLength(stacked.cards.length + 4);
  });

  it('finds the card already showing a note, an entry or a map', () => {
    const { board } = addBoardCards(empty(), [
      { kind: 'note', path: 'People/Ana.md' },
      { kind: 'entity', key: 'spell:fireball@xphb' },
    ]);
    expect(findCardShowing(board, { kind: 'note', path: 'People/Ana.md' })?.kind).toBe('note');
    expect(findCardShowing(board, { kind: 'entity', key: 'spell:fireball@xphb' })?.kind).toBe(
      'entity',
    );
    expect(findCardShowing(board, { kind: 'note', path: 'People/Bo.md' })).toBeUndefined();
  });
});
