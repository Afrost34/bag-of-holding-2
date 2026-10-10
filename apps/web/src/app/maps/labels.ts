import type { MapDoc, MapItem } from './model';
import { pointAlong, polylineLength, splinePoints } from './spline';

/**
 * Labels that follow a river, a road, a coast: which items a label can follow, the line that
 * follows, and where each letter goes along it. Pure geometry; the scene draws the letters.
 */

export interface LabelTarget {
  id: string;
  /** What to call it in a list ("River 2", "Island 1"). */
  name: string;
  kind: 'path' | 'shape';
}

const PATH_NAMES = { road: 'Road', trail: 'Trail', river: 'River', fence: 'Fence' } as const;

const allItems = (doc: MapDoc): MapItem[] => doc.layers.flatMap((l) => l.items);

/** The paths and shapes of a map a label can follow, named with a count of their own kind. */
export function labelTargets(doc: MapDoc): LabelTarget[] {
  const counts = new Map<string, number>();
  const out: LabelTarget[] = [];
  for (const item of allItems(doc)) {
    let base: string | null = null;
    let kind: LabelTarget['kind'] = 'path';
    if (item.kind === 'path') base = PATH_NAMES[item.style];
    else if (item.kind === 'shape') {
      base = item.texture === 'water' ? 'Water' : 'Land';
      kind = 'shape';
    }
    if (!base) continue;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    out.push({ id: item.id, name: `${base} ${String(n)}`, kind });
  }
  return out;
}

/** The line of a path or the outline of a shape (closed round to where it began), or null. */
export function targetLine(doc: MapDoc, id: string | undefined): number[] | null {
  if (!id) return null;
  const item = allItems(doc).find((i) => i.id === id);
  if (item?.kind === 'path') return splinePoints(item.points, false, item.smooth);
  if (item?.kind === 'shape') {
    const outline = splinePoints(item.points, true, item.smooth);
    return [...outline, outline[0] ?? 0, outline[1] ?? 0];
  }
  return null;
}

/** What a new label on a path or shape says until it is changed. */
export function defaultLabelText(item: MapItem): string {
  if (item.kind === 'path') return PATH_NAMES[item.style];
  if (item.kind === 'shape') return item.texture === 'water' ? 'Sea' : 'Land';
  return 'Text';
}

export interface LetterOnLine {
  x: number;
  y: number;
  /** Radians. */
  angle: number;
}

/**
 * Letters of the given widths set along a line, `spacing` apart, the label's middle `middle`
 * (0–1) of the way along it, and `lift` to the side (negative: above a line that runs left to
 * right). A label longer than its line starts at the line's start.
 */
export function alongLayout(
  widths: readonly number[],
  spacing: number,
  line: readonly number[],
  middle: number,
  lift: number,
): LetterOnLine[] {
  const length = polylineLength(line);
  const total = widths.reduce((n, w) => n + w, 0) + spacing * Math.max(0, widths.length - 1);
  if (length === 0) return widths.map(() => ({ x: line[0] ?? 0, y: line[1] ?? 0, angle: 0 }));
  const centre = Math.max(0, Math.min(1, middle)) * length;
  let start = centre - total / 2;
  start = Math.max(0, Math.min(Math.max(0, length - total), start));
  let run = start;
  return widths.map((w) => {
    const at = pointAlong(line, run + w / 2);
    run += w + spacing;
    return {
      x: at.x - Math.sin(at.angle) * lift,
      y: at.y + Math.cos(at.angle) * lift,
      angle: at.angle,
    };
  });
}
