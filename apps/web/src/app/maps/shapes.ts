import { type Container, Graphics, type FillPattern } from 'pixi.js';
import { dashSegments, dotsAlong } from './lettering';
import type { MapItem } from './model';
import { endFactor, hasSoftEnds, piecesAlong } from './pathEnds';
import { bounds, growPolygon, polygonArea, ribbon, splinePoints } from './spline';

/**
 * Terrain shapes (land, water, forest floor…) and paths (roads, trails, rivers, fences): drawn
 * from their control points, rounded as much as they ask. Outlines come from the same functions,
 * so picking and drawing agree.
 */

type Shape = Extract<MapItem, { kind: 'shape' }>;
type Path = Extract<MapItem, { kind: 'path' }>;

export const PATH_STYLES = [
  { id: 'road', name: 'Road', width: 24, color: '#d9c79e' },
  { id: 'trail', name: 'Trail', width: 8, color: '#6b4f33' },
  { id: 'river', name: 'River', width: 46, color: '#3d7fb0' },
  { id: 'fence', name: 'Fence or hedge', width: 8, color: '#3b2d1f' },
] as const;
export type PathStyle = (typeof PATH_STYLES)[number]['id'];

const color = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);

/** The rounded outline of a shape, as x, y pairs. */
export const shapeOutline = (item: Shape): number[] => splinePoints(item.points, true, item.smooth);

/** The rounded outlines of the holes cut in a shape. */
export const shapeHoles = (item: Shape): number[][] =>
  (item.holes ?? []).filter((h) => h.length >= 6).map((h) => splinePoints(h, true, item.smooth));

/** The rounded line of a path. */
export const pathLine = (item: Path): number[] => {
  if (!item.loop || item.points.length < 6) return splinePoints(item.points, false, item.smooth);
  const ring = splinePoints(item.points, true, item.smooth);
  return [...ring, ring[0] ?? 0, ring[1] ?? 0];
};

/** How wide the glow and waves of a coast are: in proportion to the shape, within limits. */
const shoreStep = (outline: readonly number[]): number => {
  const b = bounds(outline);
  const size = Math.sqrt(Math.abs(polygonArea(outline)));
  return Math.max(5, Math.min(40, size * 0.025 + 2, (b.x1 - b.x0) / 6));
};

/** A shape drawn: a shore glow and wave lines round it, the fill, and an ink line. */
export function shapeView(item: Shape, pattern: FillPattern | null): Container {
  const outline = shapeOutline(item);
  const g = new Graphics();
  if (outline.length >= 6) {
    const step = shoreStep(outline);
    if (item.edge === 'shore') {
      // Shallow water round the coast: soft bands fading outwards, then two wave lines.
      for (let k = 4; k >= 1; k--)
        g.poly(outline).stroke({
          color: 0xb8e0f0,
          width: step * k * 1.1,
          alpha: 0.16,
          join: 'round',
        });
      for (const [k, alpha] of [
        [2.4, 0.6],
        [3.9, 0.35],
      ] as const)
        g.poly(growPolygon(outline, step * k)).stroke({ color: 0xffffff, width: 1.4, alpha });
    }
    g.poly(outline).fill(pattern ? { fill: pattern } : { color: color(item.color) });
    const holes = shapeHoles(item);
    for (const hole of holes) g.poly(hole).cut();
    if (item.edge === 'dashed') {
      // A dashed border, as round a region on a map of kingdoms.
      const unit = Math.max(6, Math.sqrt(Math.abs(polygonArea(outline))) * 0.03);
      for (const ring of [outline, ...holes])
        for (const seg of dashSegments([...ring, ring[0] ?? 0, ring[1] ?? 0], unit * 2, unit)) {
          g.moveTo(seg[0] ?? 0, seg[1] ?? 0);
          for (let i = 2; i + 1 < seg.length; i += 2) g.lineTo(seg[i] ?? 0, seg[i + 1] ?? 0);
          g.stroke({ color: 0x2b2118, width: Math.max(2, unit * 0.35), alpha: 0.85, cap: 'round' });
        }
    } else if (item.edge !== 'none') {
      g.poly(outline).stroke({ color: 0x2b2118, width: 1.8, alpha: 0.75, join: 'round' });
      for (const hole of holes)
        g.poly(hole).stroke({ color: 0x2b2118, width: 1.8, alpha: 0.75, join: 'round' });
    }
  }
  g.alpha = item.opacity;
  return g;
}

/** A path drawn in the style of a road, trail, river or fence. */
export function pathView(item: Path): Container {
  const line = pathLine(item);
  const g = new Graphics();
  if (line.length < 4) return g;
  const trace = (points: readonly number[]) => {
    g.moveTo(points[0] ?? 0, points[1] ?? 0);
    for (let i = 2; i + 1 < points.length; i += 2) g.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
  };
  const stroke = (width: number, c: number, alpha = 1) => {
    trace(line);
    g.stroke({ color: c, width, alpha, cap: 'round', join: 'round' });
  };
  // Soft ends (faded or growing): drawn piece by piece, each with its own width and opacity.
  if (item.style !== 'river' && hasSoftEnds(item.start, item.end) && !item.loop) {
    const start = item.start ?? 'hard';
    const end = item.end ?? 'hard';
    const pieces = piecesAlong(line, Math.max(6, item.width * 0.6));
    const draw = (width: number, c: number, alpha: number, only?: (t: number) => boolean) => {
      for (const piece of pieces) {
        if (only && !only(piece.t)) continue;
        const f = endFactor(piece.t, start, end);
        g.moveTo(piece.points[0] ?? 0, piece.points[1] ?? 0);
        for (let i = 2; i + 1 < piece.points.length; i += 2)
          g.lineTo(piece.points[i] ?? 0, piece.points[i + 1] ?? 0);
        g.stroke({ color: c, width: width * f.width, alpha: alpha * f.alpha, cap: 'round' });
      }
    };
    switch (item.style) {
      case 'road':
        draw(item.width + 5, 0x3b2d1f, 0.55);
        draw(item.width, color(item.color), 1);
        break;
      case 'trail': {
        // Every other piece, so the trail stays dashed.
        let n = 0;
        for (const piece of pieces) {
          if (n++ % 2 === 1) continue;
          const f = endFactor(piece.t, start, end);
          g.moveTo(piece.points[0] ?? 0, piece.points[1] ?? 0);
          for (let i = 2; i + 1 < piece.points.length; i += 2)
            g.lineTo(piece.points[i] ?? 0, piece.points[i + 1] ?? 0);
          g.stroke({
            color: color(item.color),
            width: item.width * f.width,
            alpha: f.alpha,
            cap: 'round',
          });
        }
        break;
      }
      case 'fence':
        draw(Math.max(1.5, item.width * 0.25), color(item.color), 0.9);
        break;
    }
    return g;
  }
  switch (item.style) {
    case 'road':
      stroke(item.width + 5, 0x3b2d1f, 0.55);
      stroke(item.width, color(item.color));
      break;
    case 'trail':
      for (const seg of dashSegments(line, item.width * 3, item.width * 2.2)) {
        trace(seg);
        g.stroke({ color: color(item.color), width: item.width, cap: 'round', join: 'round' });
      }
      break;
    case 'river': {
      const w = item.width;
      const start = item.start ?? 'hard';
      const end = item.end ?? 'hard';
      const rib = ribbon(line, (t) => {
        const f = endFactor(t, start, end);
        // A faded river end narrows too: one fill cannot change its opacity along the way.
        const soft = f.width * (start === 'fade' || end === 'fade' ? 0.15 + 0.85 * f.alpha : 1);
        return (item.taper === false ? w : w * (0.3 + 0.7 * t)) * soft;
      });
      if (rib.length >= 6) {
        g.poly(rib).fill({ color: color(item.color) });
        g.poly(rib).stroke({ color: 0x2a5f87, width: 1.6, alpha: 0.8, join: 'round' });
      }
      break;
    }
    case 'fence':
      stroke(Math.max(1.5, item.width * 0.25), color(item.color), 0.9);
      for (const d of dotsAlong(line, item.width * 2.4))
        g.circle(d.x, d.y, item.width * 0.4).fill({ color: color(item.color) });
      break;
  }
  return g;
}
