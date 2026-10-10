/**
 * Pages of the app a pin can lead to besides notes, maps and compendium entries: a character, a
 * board, an encounter, a roll table, a card sheet. A pin keeps the page's route (`/characters/<id>`).
 */

export const PAGE_KINDS = [
  { id: 'characters', label: 'A character' },
  { id: 'boards', label: 'A board' },
  { id: 'encounters', label: 'An encounter' },
  { id: 'tables', label: 'A roll table' },
  { id: 'cards', label: 'A card sheet' },
] as const;

export type PageKind = (typeof PAGE_KINDS)[number]['id'];

export const pagePath = (kind: PageKind, id: string): string => `/${kind}/${id}`;

/** Which kind of page a route is, and its id; null for a route that is none of them. */
export function parsePagePath(path: string): { kind: PageKind; id: string } | null {
  const m = /^\/([a-z]+)\/([^/]+)$/.exec(path);
  const kind = PAGE_KINDS.find((k) => k.id === m?.[1])?.id;
  return kind && m?.[2] ? { kind, id: decodeURIComponent(m[2]) } : null;
}
