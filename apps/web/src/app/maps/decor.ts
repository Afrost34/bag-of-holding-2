/**
 * Decoration of a map: a compass rose and a frame. Pure geometry (relative to a centre or the
 * map's edges); `scene.ts` draws it.
 */

export type DecorStyle = 'plain' | 'fantasy';

export interface RosePolygon {
  /** x, y pairs round a rose centred on (0, 0) with a point of length 1 towards the north. */
  points: number[];
  /** Which half is shaded, as on old maps: the left of each point is dark. */
  shaded: number[];
}

/**
 * The points of a compass rose: four long ones (N, E, S, W) and four short ones between, each
 * split down the middle so one half can be shaded. Lengths are fractions of the rose's radius.
 */
export function roseShape(style: DecorStyle): { long: RosePolygon[]; short: RosePolygon[] } {
  const make = (angle: number, length: number, width: number): RosePolygon => {
    // A point at `angle` (0 = north, clockwise).
    const dir = (a: number, d: number) => [Math.sin(a) * d, -Math.cos(a) * d];
    const tip = dir(angle, length);
    const right = dir(angle + Math.PI / 2, width);
    const left = dir(angle - Math.PI / 2, width);
    return {
      points: [...tip, ...right, 0, 0, ...left],
      shaded: [...tip, ...left, 0, 0],
    };
  };
  const long: RosePolygon[] = [];
  const short: RosePolygon[] = [];
  const wide = style === 'fantasy' ? 0.17 : 0.13;
  for (let i = 0; i < 4; i++) long.push(make((i * Math.PI) / 2, 1, wide));
  for (let i = 0; i < 4; i++) short.push(make(Math.PI / 4 + (i * Math.PI) / 2, 0.62, wide * 0.8));
  return { long, short };
}

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Line width. */
  line: number;
}

/**
 * The lines of a frame inside a map's edges: one for plain, a heavy line with a fine one inside
 * for fantasy. Rectangles run from the outside in.
 */
export function frameRects(width: number, height: number, style: DecorStyle): FrameRect[] {
  const unit = Math.min(width, height);
  const margin = unit * 0.02;
  const heavy = Math.max(3, unit * 0.008);
  const out: FrameRect[] = [
    { x: margin, y: margin, w: width - margin * 2, h: height - margin * 2, line: heavy },
  ];
  if (style === 'fantasy') {
    const gap = margin * 0.7;
    out.push({
      x: margin + gap,
      y: margin + gap,
      w: width - (margin + gap) * 2,
      h: height - (margin + gap) * 2,
      line: Math.max(1.5, heavy * 0.4),
    });
  }
  return out;
}

/** The corners of a frame, for a small ornament on each (fantasy only). */
export function frameCorners(width: number, height: number): { x: number; y: number }[] {
  const margin = Math.min(width, height) * 0.02;
  return [
    { x: margin, y: margin },
    { x: width - margin, y: margin },
    { x: width - margin, y: height - margin },
    { x: margin, y: height - margin },
  ];
}
