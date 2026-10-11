import { seeded } from '../terrain';
import { cellKey, cellsInPolygon, parseCell } from './cells';
import type { FloorPlan, PlanRoom } from './floorplan';

/**
 * Docks: the hanging sky-docks of Rust & Sunfire's platform cities and plain harbour piers. Drawn
 * by a box: a gantry spine three cells deep along its longer side, finger piers two cells wide
 * reaching across the rest, and berths between them, each wide enough for a ship
 * (`berth` cells). The deck is one room (railings round its edges come from the style); cranes,
 * cargo and mooring posts are its furniture (the `dock` recipe). `dockBerths` gives each berth's
 * box, for docking a ship in it. Pure.
 */

export interface DockRequest {
  footprint: readonly number[];
  cell: number;
  seed: number;
  /** A berth's width in cells (the ship's beam and some room). */
  berth: number;
}

interface Layout {
  /** Box in cells. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The spine runs along x (true) or y. */
  alongX: boolean;
  /** Where each finger starts, across the spine's length (cells). */
  fingers: number[];
}

const SPINE = 3;
const FINGER = 2;

function layoutOf(req: DockRequest): Layout | null {
  const cells = cellsInPolygon(req.footprint, req.cell);
  if (cells.size === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const k of cells) {
    const [x, y] = parseCell(k);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  const alongX = x1 - x0 >= y1 - y0;
  const length = alongX ? x1 - x0 : y1 - y0;
  const step = req.berth + FINGER;
  const fingers: number[] = [];
  for (let at = 0; at + FINGER <= length; at += step) fingers.push(at);
  // The last finger closes the last berth when there is room for it.
  const last = fingers[fingers.length - 1] ?? 0;
  if (length - FINGER - (last + FINGER) >= req.berth - 1) fingers.push(length - FINGER);
  return { x0, y0, x1, y1, alongX, fingers };
}

/** The deck: the spine and the fingers, one room. */
export function planDock(req: DockRequest): FloorPlan {
  const l = layoutOf(req);
  if (!l) return { rooms: [], doors: [], windows: [], stairs: [], walls: [] };
  const deck: string[] = [];
  const across = l.alongX ? l.y1 - l.y0 : l.x1 - l.x0;
  const length = l.alongX ? l.x1 - l.x0 : l.y1 - l.y0;
  for (let a = 0; a < length; a++)
    for (let b = 0; b < across; b++) {
      const onFinger = l.fingers.some((f) => a >= f && a < f + FINGER);
      if (b >= SPINE && !onFinger) continue;
      deck.push(l.alongX ? cellKey(l.x0 + a, l.y0 + b) : cellKey(l.x0 + b, l.y0 + a));
    }
  const rand = seeded((req.seed * 31 + 11) >>> 0);
  const room: PlanRoom = {
    id: 1,
    cells: deck.sort(),
    type: 'dock',
    seed: Math.floor(rand() * 2 ** 31),
  };
  return { rooms: [room], doors: [], windows: [], stairs: [], walls: [] };
}

/**
 * The berths: the open boxes between the fingers (map pixels), and the way a ship in it points
 * (its bow away from the spine, out to the open sky).
 */
export function dockBerths(
  req: DockRequest,
): { x0: number; y0: number; x1: number; y1: number; heading: 0 | 90 | 180 | 270 }[] {
  const l = layoutOf(req);
  if (!l) return [];
  const c = req.cell;
  const out: { x0: number; y0: number; x1: number; y1: number; heading: 0 | 90 | 180 | 270 }[] = [];
  for (let i = 0; i + 1 < l.fingers.length; i++) {
    const a0 = (l.fingers[i] ?? 0) + FINGER;
    const a1 = l.fingers[i + 1] ?? 0;
    if (a1 - a0 < 3) continue;
    // A cell clear of the fingers on each side, half a cell off the spine.
    if (l.alongX)
      out.push({
        x0: (l.x0 + a0) * c + c * 0.5,
        x1: (l.x0 + a1) * c - c * 0.5,
        y0: (l.y0 + SPINE) * c + c * 0.5,
        y1: l.y1 * c,
        heading: 180,
      });
    else
      out.push({
        x0: (l.x0 + SPINE) * c + c * 0.5,
        x1: l.x1 * c,
        y0: (l.y0 + a0) * c + c * 0.5,
        y1: (l.y0 + a1) * c - c * 0.5,
        heading: 90,
      });
  }
  return out;
}
