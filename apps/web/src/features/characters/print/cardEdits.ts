import { untag } from '@boh/data5e';
import { stripTags } from '@boh/renderer';

/**
 * The printed cards as the player arranged them before printing: the order of each group's
 * cards, and texts rewritten by hand. Stored in the character's preferences by card id (the ids
 * `printHidden` uses: `spell:…`, `feature:…`, `item:…`).
 */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A card's 5etools text as plain paragraphs, to start editing from: tags read as their text
 * (dice stay as "1d8", which become chips again once saved), named sub-entries as "Name. text",
 * list items as "• text". Tables and other blocks are left out.
 */
export function plainText(entries: unknown): string {
  const out: string[] = [];
  const walk = (e: unknown, prefix = '') => {
    if (typeof e === 'string') {
      out.push(prefix + stripTags(untag(e)));
      return;
    }
    if (Array.isArray(e)) {
      for (const x of e) walk(x, prefix);
      return;
    }
    if (!isObj(e)) return;
    if (e.type === 'list' && Array.isArray(e.items)) {
      for (const item of e.items) walk(item, '• ');
      return;
    }
    if (e.type === 'item' && typeof e.name === 'string') {
      const inner: unknown[] = Array.isArray(e.entries) ? (e.entries as unknown[]) : [e.entry];
      const [first, ...rest] = inner;
      walk(first, `${prefix}${e.name} `);
      for (const x of rest) walk(x);
      return;
    }
    if (Array.isArray(e.entries)) {
      const [first, ...rest] = e.entries as unknown[];
      walk(first, typeof e.name === 'string' ? `${e.name}. ` : prefix);
      for (const x of rest) walk(x);
    }
  };
  walk(entries);
  return out.filter((p) => p.trim()).join('\n\n');
}

/** Cards in the player's order: those it names first, as named; the others after, as they came. */
export function inOrder<T extends { id: string }>(
  cards: readonly T[],
  order: readonly string[],
): T[] {
  const at = new Map(order.map((id, i) => [id, i]));
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (at.get(a.c.id) ?? order.length + a.i) - (at.get(b.c.id) ?? order.length + b.i))
    .map(({ c }) => c);
}

/**
 * The order after moving one card a step up (-1) or down (+1) within its group: the whole
 * group's ids, in their new order, replace them in the stored order.
 */
export function moveCard(
  order: readonly string[],
  group: readonly string[],
  id: string,
  delta: -1 | 1,
): string[] {
  const shown = inOrder(
    group.map((g) => ({ id: g })),
    order,
  ).map((c) => c.id);
  const from = shown.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= shown.length) return [...order];
  [shown[from], shown[to]] = [shown[to] ?? '', shown[from] ?? ''];
  const others = order.filter((o) => !group.includes(o));
  return [...others, ...shown];
}
