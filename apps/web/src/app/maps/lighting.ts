import { layerShown, type MapDoc } from './model';
import { roomOutline } from './rooms';

/**
 * Lights (Dungeondraft's light tool and environment): what blocks light, and the area a light
 * reaches. Pure; `scene.ts` paints the result.
 */

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** The ambient colours offered for a map (daylight is no ambient at all). */
export const AMBIENTS: { id: string; name: string; color: string | null }[] = [
  { id: 'day', name: 'Daylight', color: null },
  { id: 'dusk', name: 'Dusk', color: '#9a7a8a' },
  { id: 'night', name: 'Night', color: '#2b3157' },
  { id: 'dark', name: 'Pitch dark', color: '#0c0c14' },
  { id: 'candle', name: 'Dim and warm', color: '#5a4636' },
];

const pairsOf = (flat: readonly number[], closed: boolean): Segment[] => {
  const out: Segment[] = [];
  const n = Math.floor(flat.length / 2);
  for (let i = 0; i + 1 < n; i++)
    out.push({
      ax: flat[i * 2] ?? 0,
      ay: flat[i * 2 + 1] ?? 0,
      bx: flat[i * 2 + 2] ?? 0,
      by: flat[i * 2 + 3] ?? 0,
    });
  if (closed && n > 2)
    out.push({
      ax: flat[(n - 1) * 2] ?? 0,
      ay: flat[(n - 1) * 2 + 1] ?? 0,
      bx: flat[0] ?? 0,
      by: flat[1] ?? 0,
    });
  return out;
};

/** A segment with the part within `half` of a point taken out, when the point is on it. */
function openUp(seg: Segment, at: { x: number; y: number }, half: number): Segment[] {
  const dx = seg.bx - seg.ax;
  const dy = seg.by - seg.ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [seg];
  const t = ((at.x - seg.ax) * dx + (at.y - seg.ay) * dy) / len;
  const off = Math.abs((at.x - seg.ax) * dy - (at.y - seg.ay) * dx) / len;
  if (off > 3 || t < -half || t > len + half) return [seg];
  const from = Math.max(0, t - half);
  const to = Math.min(len, t + half);
  const point = (d: number) => ({ x: seg.ax + (dx * d) / len, y: seg.ay + (dy * d) / len });
  const out: Segment[] = [];
  if (from > 0.5) {
    const p = point(from);
    out.push({ ax: seg.ax, ay: seg.ay, bx: p.x, by: p.y });
  }
  if (to < len - 0.5) {
    const p = point(to);
    out.push({ ax: p.x, ay: p.y, bx: seg.bx, by: seg.by });
  }
  return out;
}

/**
 * What blocks light: walls, the outlines of rooms (open at archways and portcullises, shut at
 * doors) and of buildings, on the layers that are shown.
 */
export function lightSegments(doc: MapDoc): Segment[] {
  const out: Segment[] = [];
  for (const layer of doc.layers) {
    if (!layerShown(doc, layer) || layer.picture) continue;
    for (const item of layer.items) {
      if (item.kind === 'stamp' && item.blockLight) {
        // Its outline: the picture's box, turned.
        const a = (item.rotation * Math.PI) / 180;
        const corner = (sx: number, sy: number) => {
          const dx = (sx * item.w) / 2;
          const dy = (sy * item.h) / 2;
          return [
            item.x + dx * Math.cos(a) - dy * Math.sin(a),
            item.y + dx * Math.sin(a) + dy * Math.cos(a),
          ];
        };
        out.push(
          ...pairsOf(
            [...corner(-1, -1), ...corner(1, -1), ...corner(1, 1), ...corner(-1, 1)],
            true,
          ),
        );
      } else if (item.kind === 'wall') out.push(...pairsOf(item.points, false));
      else if (item.kind === 'building') out.push(...pairsOf(item.points, true));
      else if (item.kind === 'room') {
        let segs = pairsOf(roomOutline(item.points, item.smooth), true);
        for (const door of item.doors ?? [])
          if (door.kind === 'arch' || door.kind === 'portcullis')
            segs = segs.flatMap((s) => openUp(s, door, doc.grid.size * 0.5));
        out.push(...segs);
      }
    }
  }
  return out;
}

/** The nearest distance along a ray (from the origin, direction dx, dy) to a segment, or null. */
function rayHit(ox: number, oy: number, dx: number, dy: number, s: Segment): number | null {
  const sx = s.bx - s.ax;
  const sy = s.by - s.ay;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((s.ax - ox) * sy - (s.ay - oy) * sx) / denom;
  const u = ((s.ax - ox) * dy - (s.ay - oy) * dx) / denom;
  return t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
}

/**
 * The area a light at (x, y) can see within `range`, as a polygon (x, y pairs): rays go to every
 * wall end, and the nearest wall on each stops it. Walls beyond the range are left out.
 */
export function visibilityPolygon(
  x: number,
  y: number,
  range: number,
  walls: readonly Segment[],
): number[] {
  const reach = range * 1.05;
  const near = walls.filter((s) => {
    const minX = Math.min(s.ax, s.bx) - reach;
    const maxX = Math.max(s.ax, s.bx) + reach;
    const minY = Math.min(s.ay, s.by) - reach;
    const maxY = Math.max(s.ay, s.by) + reach;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });
  // The edge of the range is a box round the light, so every ray ends somewhere.
  const box: Segment[] = [
    { ax: x - reach, ay: y - reach, bx: x + reach, by: y - reach },
    { ax: x + reach, ay: y - reach, bx: x + reach, by: y + reach },
    { ax: x + reach, ay: y + reach, bx: x - reach, by: y + reach },
    { ax: x - reach, ay: y + reach, bx: x - reach, by: y - reach },
  ];
  const all = [...near, ...box];
  const angles: number[] = [];
  for (const s of all) {
    for (const [px, py] of [
      [s.ax, s.ay],
      [s.bx, s.by],
    ] as const) {
      const a = Math.atan2(py - y, px - x);
      angles.push(a - 0.0001, a, a + 0.0001);
    }
  }
  angles.sort((p, q) => p - q);
  const out: number[] = [];
  for (const a of angles) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = Infinity;
    for (const s of all) {
      const t = rayHit(x, y, dx, dy, s);
      if (t !== null && t < best) best = t;
    }
    if (best === Infinity) continue;
    out.push(x + dx * best, y + dy * best);
  }
  return out;
}
