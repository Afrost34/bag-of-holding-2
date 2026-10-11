import { centroid, longestEdge, splitPolygon } from './polyclip';

/**
 * The slopes of a roof and how a roof texture lies on them. The packs' roof textures are tiles
 * with the hem of the roof along their bottom edge: the shingles run down from the ridge to the
 * eave. So each slope gets the texture turned until its bottom edge faces away from the ridge, and
 * stretched a little so a whole number of rows fits from ridge to eave and the hem ends exactly
 * on the edge of the roof, not cut half way through a row. Pure.
 */

export interface RoofPlane {
  /** The slope's outline. */
  poly: number[];
  /** A point on the ridge. */
  origin: { x: number; y: number };
  /** Unit vector from the ridge down to the eave. */
  down: { x: number; y: number };
  /** How far the slope reaches from the ridge (map pixels). */
  depth: number;
}

/** The slopes of a roof: two halves either side of the ridge, or one plane for a flat or shed roof. */
export function roofPlanes(poly: readonly number[], gabled: boolean): RoofPlane[] {
  if (poly.length < 6) return [];
  const edge = longestEdge(poly);
  const c = centroid(poly);
  const nx = -Math.sin(edge.angle);
  const ny = Math.cos(edge.angle);
  if (!gabled) {
    // One slope: the ridge is the far edge, the eave the near one.
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i + 1 < poly.length; i += 2) {
      const d = ((poly[i] ?? 0) - c.x) * nx + ((poly[i + 1] ?? 0) - c.y) * ny;
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    return [
      {
        poly: [...poly],
        origin: { x: c.x + nx * lo, y: c.y + ny * lo },
        down: { x: nx, y: ny },
        depth: Math.max(1, hi - lo),
      },
    ];
  }
  const planes: RoofPlane[] = [];
  for (const half of splitPolygon(poly, c, edge.angle)) {
    if (half.length < 6) continue;
    const hc = centroid(half);
    const side = (hc.x - c.x) * nx + (hc.y - c.y) * ny >= 0 ? 1 : -1;
    const down = { x: nx * side, y: ny * side };
    let depth = 0;
    for (let i = 0; i + 1 < half.length; i += 2)
      depth = Math.max(
        depth,
        ((half[i] ?? 0) - c.x) * down.x + ((half[i + 1] ?? 0) - c.y) * down.y,
      );
    planes.push({ poly: half, origin: c, down, depth: Math.max(1, depth) });
  }
  return planes;
}

export interface TextureFit {
  /** Pixi's matrix: x' = a·x + c·y + tx, y' = b·x + d·y + ty, from the picture's pixels to the map. */
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
  /** How many rows of the tile lie from the ridge to the eave. */
  rows: number;
}

/**
 * Puts a texture of `texSize` pixels on a slope, its bottom edge towards the eave. `tilePx` is
 * how large one tile should be on the map. A slope at least three quarters of a tile deep gets the
 * tile stretched (the same both ways, by a quarter at most) so that a whole number of rows fills it
 * exactly; a shallower one gets the tile at its own size, hem on the eave and the top rows under
 * the ridge, so shingles never shrink to nothing on a small roof.
 */
export function fitRoofTexture(plane: RoofPlane, texSize: number, tilePx: number): TextureFit {
  const tile = Math.max(1, tilePx);
  const natural = tile / texSize;
  const fits = plane.depth >= tile * 0.75;
  const rows = fits ? Math.max(1, Math.round(plane.depth / tile)) : 1;
  const s = fits ? plane.depth / (rows * texSize) : natural;
  // A shallow slope: slide the tile down so its hem is on the eave.
  const slide = fits ? 0 : plane.depth - texSize * s;
  // The picture's "right" is the slope's down turned a quarter: (x, y) → (y, −x).
  const rx = plane.down.y;
  const ry = -plane.down.x;
  return {
    a: rx * s,
    b: ry * s,
    c: plane.down.x * s,
    d: plane.down.y * s,
    tx: plane.origin.x + plane.down.x * slide,
    ty: plane.origin.y + plane.down.y * slide,
    rows,
  };
}
