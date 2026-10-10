import type { MapDoc } from './model';

/**
 * A map's scale bar: a round distance (1, 2 or 5 × 10ⁿ) up to about a third of the map wide, in the
 * map's unit (miles or km on a world map, feet on a battle map by its grid). Drawn by the scene
 * in the map's bottom-left corner, plain or as on an old map.
 */

export type ScaleBarStyle = 'plain' | 'fantasy';

export interface ScaleBarSpec {
  /** Length in map pixels. */
  length: number;
  /** The distance it stands for. */
  distance: number;
  /** `ft`, `mi` or `km`. */
  unit: string;
  /** Alternating blocks along it. */
  segments: number;
}

/** The roundest distance of 1, 2 or 5 × 10ⁿ not above `max`. */
export function roundDistance(max: number): number {
  if (max <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(max));
  const lead = max / power;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power;
}

export function scaleBarSpec(doc: MapDoc): ScaleBarSpec | null {
  // A map with a hidden grid and no scale has no size to show.
  if (!doc.scale && !doc.grid.visible) return null;
  const perPixel = doc.scale
    ? doc.scale.perPixel
    : doc.grid.size > 0 && doc.grid.feet > 0
      ? doc.grid.feet / doc.grid.size
      : 0;
  if (perPixel <= 0) return null;
  const unit = doc.scale ? doc.scale.unit : 'ft';
  const distance = roundDistance(doc.width * 0.3 * perPixel);
  if (distance <= 0) return null;
  const lead = Math.round(distance / 10 ** Math.floor(Math.log10(distance)));
  return { length: distance / perPixel, distance, unit, segments: lead === 5 ? 5 : 4 };
}

/** "100 miles", "5 km", "30 ft". */
export function scaleBarLabel(spec: ScaleBarSpec): string {
  const n = spec.distance.toLocaleString('en-US');
  if (spec.unit === 'mi') return `${n} ${spec.distance === 1 ? 'mile' : 'miles'}`;
  return `${n} ${spec.unit}`;
}
