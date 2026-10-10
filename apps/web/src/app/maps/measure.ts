import { distanceFeet, snapToCell } from './geometry';
import type { Grid } from './model';
import { scaledDistance, measureTotal, type MapScale, type TravelSpeed } from './travel';

interface Point {
  x: number;
  y: number;
}

/** What a map measures with: its real scale (world maps) or its grid (battle maps). */
export interface MeasureBasis {
  scale?: MapScale | undefined;
  travel?: readonly TravelSpeed[] | undefined;
  grid: Grid;
}

/** Where a click lands for measuring: anywhere on a scaled map, a cell's middle on a grid. */
export function measurePoint(p: Point, basis: MeasureBasis): Point {
  return basis.scale ? p : snapToCell(p, basis.grid);
}

/**
 * A path measured point after point: its whole length as one line, with travel times on a
 * scaled map ("1,920 km · Skiff: 1.4 days"), in feet on a grid ("35 ft"). Null below two points.
 */
export function measurePath(points: readonly Point[], basis: MeasureBasis): string | null {
  if (points.length < 2) return null;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    total += basis.scale ? scaledDistance(a, b, basis.scale) : distanceFeet(a, b, basis.grid);
  }
  return basis.scale ? measureTotal(total, basis.scale, basis.travel) : `${String(total)} ft`;
}
