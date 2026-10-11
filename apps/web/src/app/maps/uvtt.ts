import type { MapDoc } from './model';
import { isPortalPicture } from './portal';
import { roomOutline } from './rooms';

/**
 * Universal VTT (`.dd2vtt`): a map for Foundry, Roll20, Owlbear and other virtual tabletops, made of
 * the picture, the walls that block sight, the doors and windows, and the lights. Positions and sizes
 * are in grid squares, y down, rotations in radians. The field names follow Arkenforge's published
 * format; `format` 0.3 and the 8-digit colours are what Dungeondraft writes. Pure.
 */

export interface UvttPoint {
  x: number;
  y: number;
}

export interface Uvtt {
  format: number;
  resolution: {
    map_origin: UvttPoint;
    map_size: UvttPoint;
    pixels_per_grid: number;
  };
  line_of_sight: UvttPoint[][];
  objects_line_of_sight: UvttPoint[][];
  portals: {
    position: UvttPoint;
    bounds: [UvttPoint, UvttPoint];
    rotation: number;
    closed: boolean;
    freestanding: boolean;
  }[];
  environment: { baked_lighting: boolean; ambient_light: string };
  lights: {
    position: UvttPoint;
    range: number;
    intensity: number;
    color: string;
    shadows: boolean;
  }[];
  image: string;
}

/** `#rrggbb` as the `aarrggbb` the format uses. */
const argb = (hex: string): string => 'ff' + hex.replace('#', '').toLowerCase();

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** The map as a Universal VTT file: `imageBase64` is its picture, `pixelsPerGrid` the picture's squares. */
export function buildUvtt(doc: MapDoc, imageBase64: string, pixelsPerGrid: number): Uvtt {
  const gs = doc.grid.size;
  const sq = (x: number, y: number): UvttPoint => ({ x: round(x / gs), y: round(y / gs) });
  const line = (flat: readonly number[], closed: boolean): UvttPoint[] => {
    const out: UvttPoint[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) out.push(sq(flat[i] ?? 0, flat[i + 1] ?? 0));
    const first = out[0];
    if (closed && first) out.push(first);
    return out;
  };
  const sight: UvttPoint[][] = [];
  const objects: UvttPoint[][] = [];
  const portals: Uvtt['portals'] = [];
  const lights: Uvtt['lights'] = [];
  const portal = (
    x: number,
    y: number,
    angle: number,
    length: number,
    closed: boolean,
    freestanding: boolean,
  ) => {
    const dx = (Math.cos(angle) * length) / 2;
    const dy = (Math.sin(angle) * length) / 2;
    portals.push({
      position: sq(x, y),
      bounds: [sq(x - dx, y - dy), sq(x + dx, y + dy)],
      rotation: round(angle),
      closed,
      freestanding,
    });
  };
  for (const layer of doc.layers)
    for (const item of layer.items) {
      switch (item.kind) {
        case 'wall':
          if (item.points.length >= 4) sight.push(line(item.points, item.loop === true));
          break;
        case 'room': {
          const outline = roomOutline(item.points, item.smooth);
          if (outline.length >= 6) sight.push(line(outline, true));
          const width = Math.max(24, item.wall * 5.5);
          for (const d of item.doors ?? [])
            portal(d.x, d.y, d.angle, width, d.kind === 'door' || d.kind === 'portcullis', false);
          break;
        }
        case 'building':
          if (item.points.length >= 6) sight.push(line(item.points, true));
          break;
        case 'stamp': {
          const a = (item.rotation * Math.PI) / 180;
          if (isPortalPicture(item.stamp)) {
            // A door shuts; a window does not. Its long side runs along the wall.
            const wide = item.w >= item.h;
            portal(
              item.x,
              item.y,
              wide ? a : a + Math.PI / 2,
              wide ? item.w : item.h,
              /\/Doors\//i.test(item.stamp),
              false,
            );
          } else if (item.blockLight) {
            const c = Math.cos(a);
            const s = Math.sin(a);
            const corner = (u: number, v: number): UvttPoint =>
              sq(item.x + u * c - v * s, item.y + u * s + v * c);
            const hw = item.w / 2;
            const hh = item.h / 2;
            const box = [corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)];
            const first = box[0];
            objects.push(first ? [...box, first] : box);
          }
          break;
        }
        case 'light':
          lights.push({
            position: sq(item.x, item.y),
            range: round(item.range / gs),
            intensity: round(item.intensity),
            color: argb(item.color),
            shadows: item.shadows,
          });
          break;
        default:
          break;
      }
    }
  return {
    format: 0.3,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: round(doc.width / gs), y: round(doc.height / gs) },
      pixels_per_grid: pixelsPerGrid,
    },
    line_of_sight: sight,
    objects_line_of_sight: objects,
    portals,
    environment: { baked_lighting: false, ambient_light: argb(doc.ambient ?? '#ffffff') },
    lights,
    image: imageBase64,
  };
}
