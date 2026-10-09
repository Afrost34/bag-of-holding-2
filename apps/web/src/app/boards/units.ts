/**
 * Distances between feet, metres, grid squares, miles and kilometres, as D&D tables use them:
 * one square is 5 feet, and metric books count 5 feet as 1.5 metres (so 30 feet is 9 metres).
 * The exact metric value is given too, for when it matters.
 */

export const UNITS = ['ft', 'm', 'sq', 'mi', 'km'] as const;
export type DistanceUnit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<DistanceUnit, string> = {
  ft: 'Feet',
  m: 'Metres',
  sq: 'Squares',
  mi: 'Miles',
  km: 'Kilometres',
};

const FEET_PER_SQUARE = 5;
const METRES_PER_FOOT = 0.3048;
/** The books' metres per foot: 5 feet = 1.5 metres. */
const TABLE_METRES_PER_FOOT = 0.3;
const FEET_PER_MILE = 5280;

/** A distance in feet, from any unit (metres read the books' way: 1.5 m a square). */
export function toFeet(value: number, unit: DistanceUnit): number {
  switch (unit) {
    case 'ft':
      return value;
    case 'm':
      return value / TABLE_METRES_PER_FOOT;
    case 'sq':
      return value * FEET_PER_SQUARE;
    case 'mi':
      return value * FEET_PER_MILE;
    case 'km':
      return (value * 1000) / METRES_PER_FOOT;
  }
}

export interface Conversion {
  unit: DistanceUnit;
  value: number;
  /** For metres: the exact value, when it differs from the books' one. */
  exact?: number;
}

/** Rounded for reading: whole when large, one or two decimals when small. */
export function round(n: number): number {
  const a = Math.abs(n);
  const places = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** The distance in every other unit. */
export function convert(value: number, unit: DistanceUnit): Conversion[] {
  const feet = toFeet(value, unit);
  const out: Conversion[] = [];
  for (const u of UNITS) {
    if (u === unit) continue;
    if (u === 'ft') out.push({ unit: u, value: round(feet) });
    if (u === 'm') {
      const table = round(feet * TABLE_METRES_PER_FOOT);
      const exact = round(feet * METRES_PER_FOOT);
      out.push({ unit: u, value: table, ...(exact !== table ? { exact } : {}) });
    }
    if (u === 'sq') out.push({ unit: u, value: round(feet / FEET_PER_SQUARE) });
    if (u === 'mi') out.push({ unit: u, value: round(feet / FEET_PER_MILE) });
    if (u === 'km') out.push({ unit: u, value: round((feet * METRES_PER_FOOT) / 1000) });
  }
  return out;
}
