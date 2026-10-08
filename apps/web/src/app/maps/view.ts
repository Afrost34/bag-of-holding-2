import type { Point } from './geometry';

/** A view of the map as it was set by hand: the host's size then, its zoom and its middle. */
export interface ViewBase {
  w: number;
  h: number;
  zoom: number;
  /** The map point in the middle of the host. */
  middle: Point;
}

/**
 * The view for a host resized to `next`, scaled from `base` (never from the previous resize,
 * so a host that shrinks and grows back shows exactly what it showed before): the same middle,
 * zoomed by how much the host grew, so the same part of the map still fits.
 */
export function resizedView(
  base: ViewBase,
  next: { w: number; h: number },
): { x: number; y: number; zoom: number } {
  const zoom = base.zoom * Math.min(next.w / base.w, next.h / base.h);
  return { x: next.w / 2 - base.middle.x * zoom, y: next.h / 2 - base.middle.y * zoom, zoom };
}
