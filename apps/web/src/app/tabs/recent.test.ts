import { describe, expect, it } from 'vitest';
import { visit } from './recent';

describe('recent pages', () => {
  it('keeps the latest first, once each, and leaves out home and settings', () => {
    let pages = visit([], { path: '/boards/a', title: 'Session 1', at: 1 });
    pages = visit(pages, { path: '/compendium/spell%3Afireball%40xphb', title: 'Fireball', at: 2 });
    pages = visit(pages, { path: '/boards/a', title: 'Session 1', at: 3 });
    expect(pages.map((p) => p.title)).toEqual(['Session 1', 'Fireball']);
    expect(visit(pages, { path: '/', title: 'Home', at: 4 })).toHaveLength(2);
    expect(visit(pages, { path: '/settings/data', title: 'Data', at: 4 })).toHaveLength(2);
    for (let i = 0; i < 20; i++)
      pages = visit(pages, { path: `/x/${String(i)}`, title: 'x', at: i });
    expect(pages).toHaveLength(12);
  });
});
