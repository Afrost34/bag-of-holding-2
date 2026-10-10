import type { MapDoc } from './model';
import { isPortalPicture } from './portal';
import { roomOutline } from './rooms';

/**
 * Universal VTT (`.dd2vtt`, Dungeondraft's export): the map's picture and where its walls and doors
 * are, in grid squares, for Foundry, Roll20 and Fantasy Grounds. Pure: the picture comes in as
 * base64 PNG.
 */

interface P {
  x: number;
  y: number;
}

export interface Uvtt {
  format: number;
  resolution: { map_origin: P; map_size: P; pixels_per_grid: number };
  line_of_sight: P[][];
  objects_line_of_sight: P[][];
  portals: {
    position: P;
    bounds: [P, P];
    rotation: number;
    closed: boolean;
    freestanding: boolean;
  }[];
  environment: { baked_lighting: boolean; ambient_light: string };
  lights: never[];
  image: string;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The walls (open lines and room outlines) and doors of a map, in squares of its grid. */
export function wallsAndDoors(doc: MapDoc): Pick<Uvtt, 'line_of_sight' | 'portals'> {
  const s = doc.grid.size;
  const line = (points: readonly number[], closed: boolean): P[] => {
    const out: P[] = [];
    for (let i = 0; i + 1 < points.length; i += 2)
      out.push({ x: round((points[i] ?? 0) / s), y: round((points[i + 1] ?? 0) / s) });
    const first = out[0];
    if (closed && first) out.push(first);
    return out;
  };
  const portal = (x: number, y: number, angle: number, width: number, closed: boolean) => {
    const dx = (Math.cos(angle) * width) / 2;
    const dy = (Math.sin(angle) * width) / 2;
    return {
      position: { x: round(x / s), y: round(y / s) },
      bounds: [
        { x: round((x - dx) / s), y: round((y - dy) / s) },
        { x: round((x + dx) / s), y: round((y + dy) / s) },
      ] as [P, P],
      rotation: round(angle),
      closed,
      freestanding: false,
    };
  };
  const line_of_sight: P[][] = [];
  const portals: Uvtt['portals'] = [];
  for (const layer of doc.layers)
    for (const item of layer.items) {
      if (item.kind === 'wall') {
        const l = line(item.points, false);
        if (l.length >= 2) line_of_sight.push(l);
      } else if (item.kind === 'room') {
        const l = line(roomOutline(item.points, item.smooth), true);
        if (l.length >= 3) line_of_sight.push(l);
        for (const d of item.doors ?? [])
          portals.push(portal(d.x, d.y, d.angle, s, d.kind !== 'arch' && d.kind !== 'portcullis'));
      } else if (item.kind === 'stamp' && isPortalPicture(item.stamp)) {
        portals.push(
          portal(item.x, item.y, (item.rotation * Math.PI) / 180, Math.max(item.w, item.h), true),
        );
      }
    }
  return { line_of_sight, portals };
}

/** The file's content for a map and its picture (`pixelsPerGrid`: the picture's pixels per square). */
export function buildUvtt(doc: MapDoc, imageBase64: string, pixelsPerGrid: number): Uvtt {
  return {
    format: 0.3,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: round(doc.width / doc.grid.size), y: round(doc.height / doc.grid.size) },
      pixels_per_grid: Math.round(pixelsPerGrid),
    },
    ...wallsAndDoors(doc),
    objects_line_of_sight: [],
    environment: { baked_lighting: true, ambient_light: 'ffffffff' },
    lights: [],
    image: imageBase64,
  };
}
