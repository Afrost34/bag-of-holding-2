import type { Point } from './geometry';

/**
 * Ready-made outlines for the tools that draw a closed area (terrain shape, room, building,
 * district, scatter area): a rectangle, circle, triangle or a regular polygon with any number
 * of sides, dragged out from corner to corner (or from the centre). Pure.
 */

export type ShapeKind = 'free' | 'rect' | 'circle' | 'triangle' | 'ngon';

export interface ShapeChoice {
  kind: ShapeKind;
  /** Corners of a regular polygon (3–24). */
  sides: number;
}

export const SHAPE_KINDS: { id: ShapeKind; label: string; hint: string }[] = [
  { id: 'free', label: 'Free', hint: 'Click the corners one by one' },
  { id: 'rect', label: 'Rectangle', hint: 'Drag from corner to corner' },
  { id: 'circle', label: 'Circle', hint: 'Drag out an ellipse' },
  { id: 'triangle', label: 'Triangle', hint: 'Drag out a triangle' },
  { id: 'ngon', label: 'Polygon', hint: 'Drag out a regular polygon (set its sides)' },
];

export const MIN_SIDES = 3;
export const MAX_SIDES = 24;

export const clampSides = (n: number): number =>
  Math.min(MAX_SIDES, Math.max(MIN_SIDES, Math.round(n) || MIN_SIDES));

/** Points on a circle of the outline's smoothness: enough for a round look at any rounding. */
const CIRCLE_POINTS = 32;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The box a drag makes: from the corner it began in to the pointer; `square` makes it as wide as
 * tall (Shift), `center` takes the start as the middle (Alt).
 */
export function dragBox(from: Point, to: Point, square: boolean, center: boolean): Box {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  if (center) return { x0: from.x - dx, y0: from.y - dy, x1: from.x + dx, y1: from.y + dy };
  return { x0: from.x, y0: from.y, x1: from.x + dx, y1: from.y + dy };
}

/** A regular polygon's corners in a box, the first at the top, going clockwise. */
function polygonIn(box: Box, sides: number): number[] {
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const rx = Math.abs(box.x1 - box.x0) / 2;
  const ry = Math.abs(box.y1 - box.y0) / 2;
  const out: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  return out;
}

/**
 * The outline of a shape dragged out in `box` (flat x, y pairs), or null for a free outline or a
 * box too small to be a shape (`min` map pixels).
 */
export function presetOutline(choice: ShapeChoice, box: Box, min = 8): number[] | null {
  if (choice.kind === 'free') return null;
  const x0 = Math.min(box.x0, box.x1);
  const x1 = Math.max(box.x0, box.x1);
  const y0 = Math.min(box.y0, box.y1);
  const y1 = Math.max(box.y0, box.y1);
  if (x1 - x0 < min || y1 - y0 < min) return null;
  const sorted = { x0, y0, x1, y1 };
  switch (choice.kind) {
    case 'rect':
      return [x0, y0, x1, y0, x1, y1, x0, y1];
    case 'circle':
      return polygonIn(sorted, CIRCLE_POINTS);
    case 'triangle':
      // Apex at the top middle, base along the bottom (a regular triangle would be shorter).
      return [(x0 + x1) / 2, y0, x1, y1, x0, y1];
    case 'ngon':
      return polygonIn(sorted, clampSides(choice.sides));
  }
}

/** Clicking corner by corner: no preset. */
export const FREE_SHAPE: ShapeChoice = { kind: 'free', sides: 6 };
