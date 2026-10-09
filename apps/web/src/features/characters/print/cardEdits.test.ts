import { describe, expect, it } from 'vitest';
import { inOrder, moveCard, plainText } from './cardEdits';

describe('printed cards arranged by hand', () => {
  it('reads entries as plain paragraphs to edit', () => {
    expect(
      plainText([
        'The target takes {@damage 1d8} thunder damage.',
        { type: 'entries', name: 'Cantrip Upgrade', entries: ['It grows at {@b level 5}.'] },
        { type: 'list', items: ['First', 'Second'] },
        { type: 'table', rows: [] },
      ]),
    ).toBe(
      'The target takes 1d8 thunder damage.\n\nCantrip Upgrade. It grows at level 5.\n\n• First\n\n• Second',
    );
  });

  it('keeps the player’s order and moves a card within its group', () => {
    const cards = ['a', 'b', 'c'].map((id) => ({ id }));
    expect(inOrder(cards, ['c']).map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(moveCard([], ['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveCard(['x', 'a', 'c', 'b'], ['a', 'b', 'c'], 'a', 1)).toEqual(['x', 'c', 'a', 'b']);
    expect(moveCard(['a'], ['a', 'b'], 'a', -1)).toEqual(['a']);
  });
});
