import { removeItems } from './arrange';
import type { MapDoc, MapItem } from './model';
import { pointInPolygon } from './polygon';
import { doorOnWall, roomOutline } from './rooms';
import { polygonArea } from './spline';

/**
 * The union of two simple polygons (x, y pairs), for merging rooms that overlap or touch: both are
 * cut at every place their edges cross, the pieces on the outside are kept, and the kept pieces are
 * joined end to end. Pieces on a shared wall are dropped (it is inside the merged room). Null when
 * the two share no area or wall, or the result is not one outline.
 */

interface Pt {
  x: number;
  y: number;
}
interface Edge {
  a: Pt;
  b: Pt;
}

const EPS = 0.01;
const key = (p: Pt): string => `${String(Math.round(p.x / EPS))},${String(Math.round(p.y / EPS))}`;

const pairs = (poly: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < poly.length; i += 2) out.push({ x: poly[i] ?? 0, y: poly[i + 1] ?? 0 });
  // A last point on the first one is the same corner.
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && out.length > 1 && key(first) === key(last)) out.pop();
  return out;
};

/** Counter-clockwise (positive area on screen coordinates, which run down). */
const upright = (pts: Pt[]): Pt[] =>
  polygonArea(pts.flatMap((p) => [p.x, p.y])) < 0 ? [...pts].reverse() : pts;

const edgesOf = (pts: Pt[]): Edge[] =>
  pts.map((a, i) => ({ a, b: pts[(i + 1) % pts.length] ?? a }));

/** Where two segments cross, as the fraction along each (null when parallel or apart). */
function cross(e: Edge, f: Edge): { t: number; u: number } | null {
  const rx = e.b.x - e.a.x;
  const ry = e.b.y - e.a.y;
  const sx = f.b.x - f.a.x;
  const sy = f.b.y - f.a.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((f.a.x - e.a.x) * sy - (f.a.y - e.a.y) * sx) / denom;
  const u = ((f.a.x - e.a.x) * ry - (f.a.y - e.a.y) * rx) / denom;
  return t > 1e-9 && t < 1 - 1e-9 && u > -1e-9 && u < 1 + 1e-9 ? { t, u } : null;
}

/** The edges of `own` cut wherever the edges of `other` cross them or have an end on them. */
function cutAt(own: Edge[], other: Edge[]): Edge[] {
  const out: Edge[] = [];
  for (const e of own) {
    const ts = new Set<number>();
    for (const f of other) {
      const c = cross(e, f);
      if (c) ts.add(c.t);
      // An end of the other edge lying on this one cuts it there too.
      for (const p of [f.a, f.b]) {
        const dx = e.b.x - e.a.x;
        const dy = e.b.y - e.a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        const t = ((p.x - e.a.x) * dx + (p.y - e.a.y) * dy) / len2;
        const off = Math.abs((p.x - e.a.x) * dy - (p.y - e.a.y) * dx) / Math.sqrt(len2);
        if (off < 0.05 && t > 1e-6 && t < 1 - 1e-6) ts.add(t);
      }
    }
    const sorted = [0, ...[...ts].sort((p, q) => p - q), 1];
    for (let i = 0; i + 1 < sorted.length; i++) {
      const t0 = sorted[i] ?? 0;
      const t1 = sorted[i + 1] ?? 1;
      if (t1 - t0 < 1e-9) continue;
      out.push({
        a: { x: e.a.x + (e.b.x - e.a.x) * t0, y: e.a.y + (e.b.y - e.a.y) * t0 },
        b: { x: e.a.x + (e.b.x - e.a.x) * t1, y: e.a.y + (e.b.y - e.a.y) * t1 },
      });
    }
  }
  return out;
}

/** Whether a point is on the outline, and the direction of the wall there if it is. */
function onOutline(p: Pt, edges: Edge[]): { angle: number } | null {
  for (const e of edges) {
    const dx = e.b.x - e.a.x;
    const dy = e.b.y - e.a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = ((p.x - e.a.x) * dx + (p.y - e.a.y) * dy) / len2;
    const off = Math.abs((p.x - e.a.x) * dy - (p.y - e.a.y) * dx) / Math.sqrt(len2);
    if (t >= -1e-6 && t <= 1 + 1e-6 && off < 0.05) return { angle: Math.atan2(dy, dx) };
  }
  return null;
}

const sameWay = (a: number, b: number): boolean => Math.cos(a - b) > 0;

export function unionPolygons(a: readonly number[], b: readonly number[]): number[] | null {
  const pa = upright(pairs(a));
  const pb = upright(pairs(b));
  if (pa.length < 3 || pb.length < 3) return null;
  const flat = (pts: Pt[]) => pts.flatMap((p) => [p.x, p.y]);
  const ea = edgesOf(pa);
  const eb = edgesOf(pb);
  const sa = cutAt(ea, eb);
  const sb = cutAt(eb, ea);
  const mid = (e: Edge): Pt => ({ x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 });
  const keep: Edge[] = [];
  let touching = false;
  for (const e of sa) {
    const m = mid(e);
    const shared = onOutline(m, eb);
    if (shared) {
      touching = true;
      // The same wall run the same way: one copy is kept (from A).
      if (sameWay(Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x), shared.angle)) keep.push(e);
    } else if (!pointInPolygon(m, flat(pb))) keep.push(e);
  }
  for (const e of sb) {
    const m = mid(e);
    if (onOutline(m, ea)) {
      touching = true;
      continue;
    }
    if (!pointInPolygon(m, flat(pa))) keep.push(e);
  }
  if (keep.length === 0 || (!touching && keep.length === sa.length + sb.length)) {
    // No crossing at all: one inside the other, or apart.
    const inside = (inner: Pt[], outer: Pt[]) => inner.every((p) => pointInPolygon(p, flat(outer)));
    if (inside(pb, pa)) return flat(pa);
    if (inside(pa, pb)) return flat(pb);
    return null;
  }
  // Join the kept pieces end to end into outlines.
  const from = new Map<string, Edge[]>();
  for (const e of keep) {
    const k = key(e.a);
    from.set(k, [...(from.get(k) ?? []), e]);
  }
  const used = new Set<Edge>();
  const loops: Pt[][] = [];
  for (const start of keep) {
    if (used.has(start)) continue;
    const loop: Pt[] = [];
    let e: Edge | undefined = start;
    while (e && !used.has(e)) {
      used.add(e);
      loop.push(e.a);
      e = (from.get(key(e.b)) ?? []).find((n) => !used.has(n));
    }
    if (loop.length >= 3) loops.push(loop);
  }
  if (loops.length === 0) return null;
  // The outer outline is the biggest; others are holes (left out).
  loops.sort((p, q) => Math.abs(polygonArea(flat(q))) - Math.abs(polygonArea(flat(p))));
  const outer = loops[0];
  if (!outer) return null;
  // A corner in the middle of a straight run is no corner.
  const simple = outer.filter((p, i) => {
    const prev = outer[(i + outer.length - 1) % outer.length] ?? p;
    const next = outer[(i + 1) % outer.length] ?? p;
    const cr = (p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x);
    return Math.abs(cr) > 1e-6;
  });
  return flat(simple.length >= 3 ? simple : outer).map((v) => Math.round(v * 100) / 100);
}

type Room = Extract<MapItem, { kind: 'room' }>;

/** The rooms of a map with these ids, in the order given. */
export function roomsWithIds(doc: MapDoc, ids: readonly string[]): Room[] {
  const all = doc.layers.flatMap((l) => l.items);
  return ids.flatMap((id) => {
    const found = all.find((i) => i.id === id);
    return found?.kind === 'room' ? [found] : [];
  });
}

/**
 * The rooms picked merged into the first one: its floor and walls, the outline of them all joined
 * (corners straight), and the doors that still stand in a wall. The others go. Unchanged when
 * fewer than two are rooms or one of them does not touch the rest.
 */
export function mergeRooms(doc: MapDoc, ids: readonly string[]): MapDoc {
  const rooms = roomsWithIds(doc, ids);
  const [first, ...rest] = rooms;
  if (!first || rest.length === 0) return doc;
  let outline: number[] = roomOutline(first.points, first.smooth);
  const pending = rest.map((r) => roomOutline(r.points, r.smooth));
  // Joined as they touch: a room that meets none yet waits for the next round.
  for (let round = 0; round < pending.length + 1 && pending.length > 0; round++) {
    for (let i = 0; i < pending.length; i++) {
      const next = unionPolygons(outline, pending[i] ?? []);
      if (next) {
        outline = next;
        pending.splice(i, 1);
        i--;
      }
    }
  }
  if (pending.length > 0) return doc;
  const doors = rooms
    .flatMap((r) => r.doors ?? [])
    .filter((d) => doorOnWall(outline, d, 3) !== null);
  const merged: Room = {
    ...first,
    points: outline.map(Math.round),
    smooth: 0,
    ...(doors.length > 0 ? { doors } : {}),
  };
  if (doors.length === 0) delete merged.doors;
  const gone = rest.map((r) => r.id);
  const replaced: MapDoc = {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.map((i) => (i.id === first.id ? merged : i)),
    })),
  };
  return removeItems(replaced, gone);
}
