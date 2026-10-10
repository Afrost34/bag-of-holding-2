import type { MapDoc } from './model';
import { doorOnWall, roomOutline } from './rooms';

/** Door and window pictures of a pack, which snap to a wall: `…/Doors/…`, `…/Windows/…`. */
export const isPortalPicture = (ref: string): boolean =>
  /\/(Doors|Windows)\//i.test(ref) && !/\/(Addons)\//i.test(ref);

/**
 * The closest wall to a point, among the walls drawn and the walls of rooms: where a door or a
 * window of a pack goes, and the direction of the wall there (radians). Null when none is within
 * `within`.
 */
export function portalOnWalls(
  doc: MapDoc,
  at: { x: number; y: number },
  within: number,
): { x: number; y: number; angle: number } | null {
  let best: { x: number; y: number; angle: number } | null = null;
  let bestDist = Infinity;
  for (const layer of doc.layers)
    for (const item of layer.items) {
      const found =
        item.kind === 'wall'
          ? doorOnWall(item.points, at, within, false)
          : item.kind === 'room'
            ? doorOnWall(roomOutline(item.points, item.smooth), at, within)
            : null;
      if (!found) continue;
      const d = Math.hypot(found.x - at.x, found.y - at.y);
      if (d < bestDist) {
        best = found;
        bestDist = d;
      }
    }
  return best;
}
