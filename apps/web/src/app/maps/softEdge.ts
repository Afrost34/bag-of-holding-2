/**
 * Soft edges for a brush stroke, made of the stroke itself: the same line drawn several times,
 * each narrower and a little more opaque than the one before, so the opacity rises from nothing
 * at the edge to full inside. The texture is never blurred (a blur smears it): only how much of
 * it shows changes. Pure.
 */

export interface EdgeLayer {
  /** How wide this copy of the stroke is (map pixels). */
  width: number;
  /** Its opacity, 0–1, so that the copies together reach the wanted opacity at each distance. */
  alpha: number;
}

/** How far the soft edge reaches into the stroke from each side, in map pixels. */
export function featherOf(width: number, soft: number): number {
  return Math.min(width * 0.49, Math.max(0, width * soft * 0.5));
}

/**
 * The copies of a stroke `width` wide with a soft edge of strength `soft` (0–1), widest first.
 * Seen from the edge inwards the opacity follows a smooth ramp from 0 to 1 over the feather.
 */
export function edgeLayers(width: number, soft: number, steps?: number): EdgeLayer[] {
  const feather = featherOf(width, soft);
  if (feather < 0.5) return [{ width, alpha: 1 }];
  const n = steps ?? Math.min(18, Math.max(5, Math.round(feather / 1.5)));
  const layers: EdgeLayer[] = [];
  let before = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    const reach = t * t * (3 - 2 * t);
    const alpha = i === n - 1 ? 1 : (reach - before) / (1 - before);
    layers.push({ width: width - 2 * feather * (i / n), alpha });
    before = reach;
  }
  return layers;
}
