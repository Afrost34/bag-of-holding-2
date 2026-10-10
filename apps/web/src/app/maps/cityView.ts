import { Container, Graphics } from 'pixi.js';
import type { DistrictGeo } from './city';
import {
  DISTRICT_STYLES,
  districtOutline,
  roofColorOf,
  type BuildingItem,
  type DistrictItem,
} from './cityDoc';
import { centroid, longestEdge, splitPolygon } from './polyclip';

/**
 * Towns drawn: a district's streets, yards, buildings and wall; a building on its own. A roof is
 * its colour, a darker half and a ridge along the long side, so a town reads as seen from above
 * with the sun in the west.
 */

const color = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);
const INK = 0x2b2118;

/** One roof: colour, shaded half, ridge line and outline. */
export function drawRoof(
  g: Graphics,
  poly: number[],
  roofColor: string,
  roof: BuildingItem['roof'],
): void {
  if (poly.length < 6) return;
  const base = color(roofColor);
  g.poly(poly).fill({ color: base });
  if (roof !== 'flat') {
    const edge = longestEdge(poly);
    const c = centroid(poly);
    // The half away from the sun, darker.
    const [a, b] = splitPolygon(poly, c, edge.angle);
    const shaded = Math.sin(edge.angle) >= 0 ? b : a;
    if (shaded.length >= 6)
      g.poly(shaded).fill({ color: 0x000000, alpha: roof === 'thatch' ? 0.16 : 0.24 });
    const half = edge.length * 0.42;
    const dx = Math.cos(edge.angle) * half;
    const dy = Math.sin(edge.angle) * half;
    g.moveTo(c.x - dx, c.y - dy)
      .lineTo(c.x + dx, c.y + dy)
      .stroke({ color: INK, width: roof === 'thatch' ? 1.2 : 1.6, alpha: 0.55, cap: 'round' });
  } else {
    // A flat roof: a lighter parapet line just inside the edge.
    g.poly(poly).stroke({ color: 0xffffff, width: 2, alpha: 0.25, join: 'round' });
  }
  g.poly(poly).stroke({ color: INK, width: 1.3, alpha: 0.8, join: 'round' });
}

export function buildingView(item: BuildingItem): Container {
  const g = new Graphics();
  drawRoof(g, item.points, item.color, item.roof);
  return g;
}

/** A district: street ground, the yards of its blocks, its buildings, and the wall if it has one. */
export function districtView(item: DistrictItem, geo: DistrictGeo): Container {
  const holder = new Container();
  const style = DISTRICT_STYLES[item.style];
  const outline = districtOutline(item);
  const ground = new Graphics();
  if (outline.length >= 6) {
    ground.poly(outline).fill({ color: color(style.street) });
    for (const block of geo.blocks) {
      ground.poly(block).fill({ color: color(style.yard) });
      ground.poly(block).stroke({ color: INK, width: 0.8, alpha: 0.25, join: 'round' });
    }
    if (geo.plaza) {
      ground
        .circle(geo.plaza.x, geo.plaza.y, geo.plaza.r)
        .fill({ color: color(style.street) })
        .stroke({ color: INK, width: 1, alpha: 0.35 });
    }
  }
  holder.addChild(ground);
  const houses = new Graphics();
  for (const b of geo.buildings)
    drawRoof(houses, b.poly, roofColorOf(item.style, b.tone), style.roof);
  holder.addChild(houses);
  if (item.wall && outline.length >= 6) {
    const wall = new Graphics();
    const width = Math.max(5, item.blockSize * 0.07);
    wall.poly(outline).stroke({ color: INK, width: width + 3, alpha: 0.9, join: 'round' });
    wall.poly(outline).stroke({ color: 0x9a9185, width, join: 'round' });
    // A tower at each corner of the outline.
    for (let i = 0; i + 1 < item.points.length; i += 2) {
      const x = item.points[i] ?? 0;
      const y = item.points[i + 1] ?? 0;
      wall
        .circle(x, y, width * 1.35)
        .fill({ color: 0x8a8175 })
        .stroke({ color: INK, width: 1.6 });
    }
    holder.addChild(wall);
  }
  return holder;
}
