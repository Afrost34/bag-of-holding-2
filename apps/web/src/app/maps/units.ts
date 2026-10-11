import type { MapScale } from './travel';

/** What of a map the real sizes are worked out from (a `MapDoc` has all of it). */
export interface Sized {
  scale?: MapScale | undefined;
  grid: { feet: number; size: number };
  width?: number;
  height?: number;
  stampScale?: number | undefined;
}

/**
 * Real sizes: a map covers so many meters or kilometers, and what is drawn on it is as large, on
 * that scale, as it would be in the world. A map's scale is one of two things it already has: the
 * feet one grid square stands for (battle maps) or, for a large map, the distance one pixel covers
 * (`doc.scale`). Pure.
 */

export const FEET = 0.3048;
export const MILE = 1609.344;

/** How far one square of the asset packs is: they are drawn at 200 pixels to 5 feet. */
export const PACK_SQUARE_M = 5 * FEET;

export type LengthUnit = 'm' | 'km' | 'ft' | 'mi';

export const LENGTH_UNITS: { id: LengthUnit; label: string; meters: number }[] = [
  { id: 'm', label: 'Meters', meters: 1 },
  { id: 'km', label: 'Kilometers', meters: 1000 },
  { id: 'ft', label: 'Feet', meters: FEET },
  { id: 'mi', label: 'Miles', meters: MILE },
];

export const metersIn = (unit: LengthUnit): number =>
  LENGTH_UNITS.find((u) => u.id === unit)?.meters ?? 1;

/** How many meters one pixel of the map is. */
export function metersPerPixel(doc: Pick<Sized, 'scale' | 'grid'>): number {
  if (doc.scale) return doc.scale.perPixel * (doc.scale.unit === 'mi' ? MILE : 1000);
  return (doc.grid.feet * FEET) / Math.max(1, doc.grid.size);
}

/** The real size of the map in meters. */
export function mapSizeMeters(
  doc: Required<Pick<Sized, 'grid' | 'width' | 'height'>> & Pick<Sized, 'scale'>,
): {
  w: number;
  h: number;
} {
  const k = metersPerPixel(doc);
  return { w: doc.width * k, h: doc.height * k };
}

/** Meters as pixels of the map. */
export const metersToPx = (doc: Pick<Sized, 'scale' | 'grid'>, meters: number): number =>
  meters / metersPerPixel(doc);

/**
 * How many pixels one square of a pack picture (a `_2x2` stamp is two of them across) covers on
 * this map: true to scale, times the map's own "scale all stamps" factor (×1 by default).
 */
export function stampUnit(doc: Pick<Sized, 'scale' | 'grid' | 'stampScale'>): number {
  return metersToPx(doc, PACK_SQUARE_M) * (doc.stampScale ?? 1);
}

/** "12 m", "1.5 km", "340 m": a length in meters, in the unit that reads best. */
export function formatLength(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${(km >= 100 ? Math.round(km) : Math.round(km * 10) / 10).toLocaleString('en-US')} km`;
  }
  if (meters >= 10) return `${String(Math.round(meters))} m`;
  return `${String(Math.round(meters * 10) / 10)} m`;
}

/** Nice grid cell lengths, in meters, for maps of different sizes. */
const CELLS = [
  FEET * 5,
  2,
  5,
  10,
  20,
  50,
  100,
  200,
  500,
  1000,
  2000,
  5000,
  10_000,
  20_000,
  50_000,
  100_000,
];

/** The most squares across a map. */
export const MAX_ACROSS = 200;

/**
 * The grid cell (meters) for a map of this width: the packs' 5 feet while the map is small enough,
 * else the next round length that keeps it within `MAX_ACROSS` squares.
 */
export function cellFor(widthM: number, heightM: number): number {
  const longest = Math.max(widthM, heightM);
  return CELLS.find((c) => longest / c <= MAX_ACROSS) ?? CELLS[CELLS.length - 1] ?? 1;
}

/** The squares across and down for a size and a cell. */
export function squaresFor(
  widthM: number,
  heightM: number,
  cell: number,
): { w: number; h: number } {
  const n = (m: number) => Math.min(MAX_ACROSS, Math.max(1, Math.round(m / cell)));
  return { w: n(widthM), h: n(heightM) };
}

/** Whether a grid cell is the packs' 5 feet (a battle map): no scale of its own is kept then. */
export const isStandardCell = (cellM: number): boolean => Math.abs(cellM - PACK_SQUARE_M) < 0.01;

/**
 * The squares and grid cell for a map of a given real size (in `unit`); `cell` (meters) is the
 * grid square asked for, or absent to take the one that suits the size.
 */
export function planMap(
  width: number,
  height: number,
  unit: LengthUnit,
  cell?: number,
): { squares: { w: number; h: number }; cell: number } {
  const k = metersIn(unit);
  const widthM = Math.max(0.1, width * k);
  const heightM = Math.max(0.1, height * k);
  const chosen = cell && cell > 0 ? cell : cellFor(widthM, heightM);
  // A cell too small to fit the map in the most squares grows to fit.
  const fitted = Math.max(chosen, Math.max(widthM, heightM) / MAX_ACROSS);
  return { squares: squaresFor(widthM, heightM, fitted), cell: fitted };
}
