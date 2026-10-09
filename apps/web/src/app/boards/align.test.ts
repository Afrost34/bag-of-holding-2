import { describe, expect, it } from 'vitest';
import { alignCards } from './align';
import type { Board, BoardCard } from './model';

const card = (id: string, x: number, y: number, w = 100, h = 50, more = {}): BoardCard => ({
  id,
  kind: 'text',
  text: '',
  x,
  y,
  w,
  h,
  ...more,
});

const board = (cards: BoardCard[]): Board => ({
  version: 1,
  id: 'b',
  name: 'B',
  createdAt: '',
  updatedAt: '',
  cards,
});

const at = (b: Board) => Object.fromEntries(b.cards.map((c) => [c.id, [c.x, c.y]]));

describe('aligning cards', () => {
  const b = board([card('a', 0, 0), card('b', 50, 100, 200), card('c', 400, 30, 100, 80)]);

  it('lines up edges and middles', () => {
    expect(at(alignCards(b, ['a', 'b', 'c'], 'left'))).toEqual({
      a: [0, 0],
      b: [0, 100],
      c: [0, 30],
    });
    expect(at(alignCards(b, ['a', 'b', 'c'], 'right'))).toEqual({
      a: [400, 0],
      b: [300, 100],
      c: [400, 30],
    });
    expect(at(alignCards(b, ['a', 'c'], 'middle'))).toEqual({
      a: [0, 30],
      b: [50, 100],
      c: [400, 15],
    });
    expect(at(alignCards(b, ['a', 'b', 'c'], 'bottom'))).toEqual({
      a: [0, 100],
      b: [50, 100],
      c: [400, 70],
    });
  });

  it('spaces cards evenly, the outer ones staying put', () => {
    // From 0 to 500: 400 of cards, two gaps of 50.
    expect(at(alignCards(b, ['a', 'b', 'c'], 'row'))).toEqual({
      a: [0, 0],
      b: [150, 100],
      c: [400, 30],
    });
    expect(alignCards(b, ['a', 'b'], 'row')).toBe(b);
  });

  it('keeps cards in a frame relative to it', () => {
    const framed = board([
      { id: 'f', kind: 'frame', title: 'F', x: 1000, y: 0, w: 500, h: 500 },
      card('a', 0, 0),
      card('b', 20, 20, 100, 50, { parent: 'f' }),
    ]);
    expect(at(alignCards(framed, ['a', 'b'], 'top'))).toEqual({
      f: [1000, 0],
      a: [0, 0],
      b: [20, 0],
    });
    expect(at(alignCards(framed, ['a', 'b'], 'left'))).toEqual({
      f: [1000, 0],
      a: [0, 0],
      b: [-1000, 20],
    });
  });
});
