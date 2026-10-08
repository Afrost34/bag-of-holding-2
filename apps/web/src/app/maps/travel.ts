/**
 * A map's real-world size (a world or region map): how far one pixel is, and the speeds a party
 * travels at, so a measure says how far and how long ("1,920 km · Merchant skyship: 2 days").
 */

export type DistanceUnit = 'km' | 'mi';

/** A point on the map, in pixels (as in `geometry.ts`, which this file cannot import). */
interface Point {
  x: number;
  y: number;
}

export interface MapScale {
  unit: DistanceUnit;
  /** Distance (in `unit`) one pixel of the map covers. */
  perPixel: number;
}

export interface TravelSpeed {
  name: string;
  /** Distance (in the map's unit) covered in a day of travel. */
  perDay: number;
}

/** A party on foot at a normal pace (24 miles a day, PHB 2024), when a map names no speeds. */
export const DEFAULT_SPEEDS: Record<DistanceUnit, TravelSpeed[]> = {
  km: [{ name: 'On foot', perDay: 39 }],
  mi: [{ name: 'On foot', perDay: 24 }],
};

/** The scale that makes the map's width a given distance. */
export function scaleForWidth(widthPx: number, distance: number, unit: DistanceUnit): MapScale {
  return { unit, perPixel: distance / Math.max(1, widthPx) };
}

export function scaledDistance(a: Point, b: Point, scale: MapScale): number {
  return Math.hypot(b.x - a.x, b.y - a.y) * scale.perPixel;
}

/** "1,920 km", "12.5 km", "800 m". */
export function formatDistance(distance: number, unit: DistanceUnit): string {
  if (unit === 'km' && distance < 1) return `${String(Math.round(distance * 1000))} m`;
  const rounded = distance < 100 ? Math.round(distance * 10) / 10 : Math.round(distance);
  return `${rounded.toLocaleString('en-US')} ${unit}`;
}

/** "2 days", "1.4 days", "about 7 hours", "under an hour". */
export function formatDuration(days: number): string {
  if (days >= 1) {
    const d = Math.round(days * 10) / 10;
    return `${d.toLocaleString('en-US')} ${d === 1 ? 'day' : 'days'}`;
  }
  const hours = Math.round(days * 24);
  if (hours < 1) return 'under an hour';
  return `about ${String(hours)} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** How long each speed takes over a distance. */
export function travelTimes(
  distance: number,
  speeds: readonly TravelSpeed[],
): { name: string; time: string }[] {
  return speeds
    .filter((s) => s.perDay > 0)
    .map((s) => ({ name: s.name, time: formatDuration(distance / s.perDay) }));
}

/** The length of a route (`x0, y0, x1, y1…`), stop to stop. */
export function routeLength(points: readonly number[], scale: MapScale): number {
  let total = 0;
  for (let i = 2; i + 1 < points.length; i += 2)
    total += scaledDistance(
      { x: points[i - 2] ?? 0, y: points[i - 1] ?? 0 },
      { x: points[i] ?? 0, y: points[i + 1] ?? 0 },
      scale,
    );
  return total;
}

/** The speeds of a map, or on foot when it names none. */
export const speedsOf = (scale: MapScale, speeds: readonly TravelSpeed[] | undefined) =>
  speeds?.length ? speeds : DEFAULT_SPEEDS[scale.unit];

/** One line for a measure: the distance, then the time at each speed. */
export function measureLine(
  a: Point,
  b: Point,
  scale: MapScale,
  speeds: readonly TravelSpeed[] | undefined,
): string {
  const distance = scaledDistance(a, b, scale);
  const times = travelTimes(distance, speeds?.length ? speeds : DEFAULT_SPEEDS[scale.unit]);
  return [formatDistance(distance, scale.unit), ...times.map((t) => `${t.name}: ${t.time}`)].join(
    ' · ',
  );
}
