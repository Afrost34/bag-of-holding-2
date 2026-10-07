import { describe, expect, it } from 'vitest';
import {
  addCards,
  moveCard,
  newSheet,
  packCards,
  parseSheet,
  serializeSheet,
  updateCard,
  type PackInput,
} from './model';

describe('card sheets', () => {
  it('adds, moves, hides and round-trips cards', () => {
    let sheet = newSheet('Spells', [], '2026-10-07T00:00:00Z');
    sheet = addCards(sheet, ['spell:fireball@xphb', 'spell:shield@xphb', 'spell:fireball@xphb']);
    expect(sheet.cards.map((c) => c.key)).toEqual([
      'spell:fireball@xphb',
      'spell:shield@xphb',
      'spell:fireball@xphb',
    ]);
    expect(new Set(sheet.cards.map((c) => c.id)).size).toBe(3);
    const second = sheet.cards[1]?.id ?? '';
    sheet = moveCard(sheet, second, -1);
    expect(sheet.cards[0]?.key).toBe('spell:shield@xphb');
    sheet = updateCard(sheet, second, { hidden: true });
    const back = parseSheet(serializeSheet({ ...sheet, campaign: 'rust' }), sheet.id, 'rust');
    expect(back).toEqual({ ...sheet, campaign: 'rust' });
    expect(serializeSheet({ ...sheet, campaign: 'rust' })).not.toContain('rust');
  });
});

describe('packing', () => {
  const card = (id: string, height: number, breakBefore = false): PackInput => ({
    id,
    height,
    breakBefore,
  });

  it('fills the left column, then the right, then a new page', () => {
    const pages = packCards(
      [card('a', 40), card('b', 40), card('c', 40), card('d', 40), card('e', 40)],
      100,
      10,
    );
    expect(pages.map((p) => p.columns)).toEqual([
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      [['e'], []],
    ]);
  });

  it('starts a new page where asked, and gives a too-tall card a whole page', () => {
    const pages = packCards(
      [card('a', 30), card('big', 150), card('b', 30, true), card('c', 30)],
      100,
      10,
    );
    expect(pages).toEqual([
      { columns: [['a'], []] },
      { columns: [[], []], wide: 'big' },
      { columns: [['b', 'c'], []] },
    ]);
  });

  it('packs 30 cards of mixed sizes without any column overflowing', () => {
    const heights = Array.from({ length: 30 }, (_, i) => 80 + ((i * 97) % 260));
    const cards = heights.map((h, i) => card(String(i), h));
    const pages = packCards(cards, 1060, 12);
    const placed = pages.flatMap((p) => p.columns.flat());
    expect(placed).toEqual(cards.map((c) => c.id));
    for (const p of pages)
      for (const col of p.columns) {
        const total = col.reduce(
          (n, id, k) => n + (heights[Number(id)] ?? 0) + (k > 0 ? 12 : 0),
          0,
        );
        expect(total).toBeLessThanOrEqual(1060);
      }
  });
});
