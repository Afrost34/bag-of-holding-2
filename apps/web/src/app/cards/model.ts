/**
 * Card sheets: A4 pages of cards (spells, items, creatures, features…) sent from anywhere in the
 * app, packed into two columns and printed.
 *
 *   card-sheets/<id>.json                       sheets kept outside any campaign
 *   campaigns/<campaign>/card-sheets/<id>.json  a campaign's sheets
 *
 * A sheet stores references (`spell:fireball@xphb`), never 5etools text, in the order the cards
 * read. Where pages break is worked out when the sheet is shown (see `packCards`), except where
 * the player asked a card to start a new page.
 */

export const CARD_SHEETS_DIR = 'card-sheets';

export interface SheetCard {
  /** Unique within the sheet (the same spell can be on a sheet twice). */
  id: string;
  /** Entity key. */
  key: string;
  /** Left out of the pages and the print, kept in the list. */
  hidden?: boolean;
  /** Starts a new page. */
  breakBefore?: boolean;
}

export interface CardSheet {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cards: SheetCard[];
  /** The campaign it belongs to; absent outside campaigns. Not stored: it is where the file is. */
  campaign?: string;
}

export function sheetDir(campaign?: string): string {
  return campaign ? `campaigns/${campaign}/${CARD_SHEETS_DIR}` : CARD_SHEETS_DIR;
}

export function sheetPath(id: string, campaign?: string): string {
  return `${sheetDir(campaign)}/${id}.json`;
}

/** A short random id (sheet or card), unique among `existing`. */
export function newId(existing: readonly string[], random = Math.random): string {
  for (;;) {
    const id = Math.floor(random() * 36 ** 8)
      .toString(36)
      .padStart(8, '0');
    if (!existing.includes(id)) return id;
  }
}

export function newSheet(name: string, existingIds: readonly string[], now: string): CardSheet {
  return {
    version: 1,
    id: newId(existingIds),
    name: name.trim() || 'Cards',
    createdAt: now,
    updatedAt: now,
    cards: [],
  };
}

/** Adds cards at the end, each with a fresh id. */
export function addCards(sheet: CardSheet, keys: readonly string[]): CardSheet {
  const ids = sheet.cards.map((c) => c.id);
  const cards = [...sheet.cards];
  for (const key of keys) {
    const id = newId(ids);
    ids.push(id);
    cards.push({ id, key });
  }
  return { ...sheet, cards };
}

/** Moves a card one place up (-1) or down (+1). */
export function moveCard(sheet: CardSheet, id: string, by: -1 | 1): CardSheet {
  const i = sheet.cards.findIndex((c) => c.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= sheet.cards.length) return sheet;
  const cards = [...sheet.cards];
  const [card] = cards.splice(i, 1);
  if (card) cards.splice(j, 0, card);
  return { ...sheet, cards };
}

export function updateCard(sheet: CardSheet, id: string, patch: Partial<SheetCard>): CardSheet {
  return { ...sheet, cards: sheet.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseSheet(text: string | null, id: string, campaign?: string): CardSheet | null {
  if (text === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(json) || !Array.isArray(json.cards)) return null;
  const cards = json.cards.filter(
    (c): c is SheetCard => isObj(c) && typeof c.id === 'string' && typeof c.key === 'string',
  );
  return {
    version: 1,
    id,
    name: typeof json.name === 'string' ? json.name : 'Cards',
    createdAt: typeof json.createdAt === 'string' ? json.createdAt : '',
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '',
    cards,
    ...(campaign ? { campaign } : {}),
  };
}

export function serializeSheet(sheet: CardSheet): string {
  const { campaign: _where, ...stored } = sheet;
  return `${JSON.stringify(stored, null, 2)}\n`;
}

// region Packing

export interface PackedPage {
  /** Card ids, top to bottom, in the left and right columns. */
  columns: [string[], string[]];
  /** A card too tall for a column, given the whole page width instead. */
  wide?: string;
}

export interface PackInput {
  id: string;
  /** Height on the page, at column width, in the same unit as `pageHeight`. */
  height: number;
  /** Height across the whole page width, for cards too tall for a column. */
  wideHeight?: number;
  breakBefore?: boolean;
  /** Stays in the same column as the card after it (a heading). */
  keepWithNext?: boolean;
}

/**
 * Lays cards out on pages of two columns, in reading order: down the left column, then down
 * the right, then the next page. A card that does not fit in what is left of a column goes to
 * the next column (or page). A card taller than a whole column gets a page of its own across
 * both columns; if it is too tall even then, it is clipped on paper (the editor points it out).
 * `breakBefore` starts a new page; a `keepWithNext` card (a heading) moves on with the card after it.
 */
export function packCards(
  cards: readonly PackInput[],
  pageHeight: number,
  gap: number,
): PackedPage[] {
  const pages: PackedPage[] = [];
  let page: PackedPage = { columns: [[], []] };
  let column = 0;
  let used = 0;
  const empty = () => page.columns[0].length === 0 && page.columns[1].length === 0;
  const nextColumn = () => {
    if (column === 0) column = 1;
    else {
      pages.push(page);
      page = { columns: [[], []] };
      column = 0;
    }
    used = 0;
  };
  for (const [i, card] of cards.entries()) {
    if (card.height > pageHeight) {
      if (!empty()) pages.push(page);
      pages.push({ columns: [[], []], wide: card.id });
      page = { columns: [[], []] };
      column = 0;
      used = 0;
      continue;
    }
    if (card.breakBefore && !empty()) {
      pages.push(page);
      page = { columns: [[], []] };
      column = 0;
      used = 0;
    }
    const next = card.keepWithNext ? cards[i + 1] : undefined;
    const withNext = next && next.height <= pageHeight ? gap + next.height : 0;
    const needed = (used > 0 ? gap : 0) + card.height + withNext;
    if (used > 0 && used + needed > pageHeight) nextColumn();
    page.columns[column as 0 | 1].push(card.id);
    used += (used > 0 ? gap : 0) + card.height;
    if (used >= pageHeight) nextColumn();
  }
  if (!empty()) pages.push(page);
  return pages;
}

// endregion
