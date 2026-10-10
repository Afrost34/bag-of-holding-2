import type { MapItem } from './model';

/**
 * A pin leads to one thing, followed by clicking it: a journal note, another map (the inside of
 * a building, a region), a compendium entry or a page of the app (a character, a board…). Older pins may hold several; the map wins, then
 * the note, then the entry.
 */

type Pin = Extract<MapItem, { kind: 'pin' }>;

export type PinLink =
  | { kind: 'note'; path: string }
  | { kind: 'map'; id: string }
  | { kind: 'entity'; key: string }
  /** A page of the app: a character, board, encounter, roll table or card sheet (its route). */
  | { kind: 'page'; path: string };

export function pinLink(pin: Pin): PinLink | null {
  if (pin.map) return { kind: 'map', id: pin.map };
  if (pin.note) return { kind: 'note', path: pin.note };
  if (pin.entity) return { kind: 'entity', key: pin.entity };
  if (pin.page) return { kind: 'page', path: pin.page };
  return null;
}

/** The pin leading to `link` only (or to nothing). */
export function withPinLink(pin: Pin, link: PinLink | null): Pin {
  const { note: _n, map: _m, entity: _e, page: _p, ...rest } = pin;
  if (!link) return rest;
  if (link.kind === 'note') return { ...rest, note: link.path };
  if (link.kind === 'map') return { ...rest, map: link.id };
  if (link.kind === 'page') return { ...rest, page: link.path };
  return { ...rest, entity: link.key };
}

/** Whether a pin is left off the map in the player window. */
export const hiddenFromPlayers = (item: MapItem) => item.kind === 'pin' && item.secret === true;
