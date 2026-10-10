import { targetLine } from './labels';
import type { MapDoc, MapItem } from './model';
import { pointAlong, polylineLength } from './spline';

/**
 * Finding things on a map by name: pins by their label and text on the map by what it says, each
 * with the place to go to. Pure.
 */

export interface MapHit {
  id: string;
  /** What it is called. */
  label: string;
  kind: 'pin' | 'text';
  /** Where it is (a label that runs along a river: the middle of it). */
  at: { x: number; y: number };
  /** The pin's category name, if any. */
  category?: string;
}

const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

function placeOf(doc: MapDoc, item: Extract<MapItem, { kind: 'text' }>): { x: number; y: number } {
  const line = targetLine(doc, item.follow);
  if (!line) return { x: item.x, y: item.y };
  const at = pointAlong(line, polylineLength(line) * (item.along ?? 0.5));
  return { x: at.x, y: at.y };
}

/** Pins and text whose name has every word of the search, pins first, then alphabetically. */
export function searchMap(doc: MapDoc, query: string, limit = 12): MapHit[] {
  const wanted = words(query);
  if (wanted.length === 0) return [];
  const hits: MapHit[] = [];
  for (const layer of doc.layers)
    for (const item of layer.items) {
      if (item.kind === 'pin') {
        const category = doc.pinCategories?.find((c) => c.id === item.category)?.name;
        const hay = `${item.label} ${category ?? ''}`.toLowerCase();
        if (wanted.every((w) => hay.includes(w)))
          hits.push({
            id: item.id,
            label: item.label || 'Pin',
            kind: 'pin',
            at: { x: item.x, y: item.y },
            ...(category ? { category } : {}),
          });
      } else if (item.kind === 'text') {
        const hay = item.text.toLowerCase();
        if (wanted.every((w) => hay.includes(w)))
          hits.push({ id: item.id, label: item.text, kind: 'text', at: placeOf(doc, item) });
      }
    }
  return hits
    .sort((a, b) =>
      a.kind === b.kind ? a.label.localeCompare(b.label, 'en') : a.kind === 'pin' ? -1 : 1,
    )
    .slice(0, limit);
}
