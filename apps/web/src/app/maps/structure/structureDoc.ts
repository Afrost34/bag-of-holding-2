import { newId } from '../../cards/model';
import {
  addItem,
  type BuildingSpec,
  type Layer,
  type MapDoc,
  type MapItem,
  type StylePalette,
  type Variant,
} from '../model';
import { squaresOf, parsePackRef } from '../packModel';
import { pointAlong, polylineLength } from '../spline';
import { seeded } from '../terrain';
import { stampUnit } from '../units';
import { cellKey, cellsInPolygon, components, parseCell, traceCells } from './cells';
import { archetypeById } from './archetypes';
import { planDungeon } from './dungeonplan';
import { planShip, shipClassOf, shipParts } from './shipplan';
import { planFloor, type FloorPlan, type PlanRoom } from './floorplan';
import { kitParts } from '../kits/kitDoc';
import { pickFurnishing, roomFurniture } from './furnish';
import { resolveStyle, styleById } from './styles';
import type { RecipeOptions } from '../dress/recipes';

/**
 * Generated buildings on a map: one `structure` item per floor, each on a layer of its own with a
 * variant that shows it (step floors with Page Up and Page Down), tied by `group`. A floor is
 * drawn as ordinary rooms and stamps made from its plan (`structureParts`): the scene draws those,
 * and Bake puts them on the map in its place. Walls can be bent (corners dragged), cut at 45° and
 * made a little crooked; every point of the plan moves with them, so walls stay joined. Pure.
 */

export type StructureItem = Extract<MapItem, { kind: 'structure' }>;
type RoomItem = Extract<MapItem, { kind: 'room' }>;
type StampItem = Extract<MapItem, { kind: 'stamp' }>;

const allItems = (doc: MapDoc): MapItem[] => doc.layers.flatMap((l) => l.items);

/** The name of a floor (−1 the cellar, 0 the ground floor). */
export function floorName(floor: number): string {
  if (floor < 0) return floor === -1 ? 'Cellar' : `Cellar ${String(-floor)}`;
  return (
    ['Ground floor', 'First floor', 'Second floor', 'Third floor'][floor] ??
    `Floor ${String(floor)}`
  );
}

// region Bending the walls

/** How far each corner of the footprint moves: dragged by hand, plus a little crookedness. */
function offsets(item: StructureItem, cell: number): number[] {
  const n = Math.floor(item.points.length / 2);
  const rand = seeded(item.spec.seed ^ 0x2c1b3c6d);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const crooked = item.spec.crooked * cell * 0.3;
    out.push(
      (item.bends?.[i * 2] ?? 0) + (rand() * 2 - 1) * crooked,
      (item.bends?.[i * 2 + 1] ?? 0) + (rand() * 2 - 1) * crooked,
    );
  }
  return out;
}

/**
 * Moves a point the way the corners near it moved (inverse-distance weighting, fading out a few
 * squares away), so a wall's ends and the walls that meet it move together.
 */
function bender(item: StructureItem, cell: number): (x: number, y: number) => [number, number] {
  const off = offsets(item, cell);
  if (off.every((v) => Math.abs(v) < 1e-9)) return (x, y) => [x, y];
  const pts = item.points;
  const far = 1 / (cell * cell * 9);
  return (x, y) => {
    let wx = 0;
    let wy = 0;
    let sum = far;
    for (let i = 0; i * 2 + 1 < pts.length; i++) {
      const dx = (pts[i * 2] ?? 0) - x;
      const dy = (pts[i * 2 + 1] ?? 0) - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-6) return [x + (off[i * 2] ?? 0), y + (off[i * 2 + 1] ?? 0)];
      const w = 1 / d2;
      wx += w * (off[i * 2] ?? 0);
      wy += w * (off[i * 2 + 1] ?? 0);
      sum += w;
    }
    return [x + wx / sum, y + wy / sum];
  };
}

/** An outline with corners cut at 45°, a square back along each side, where `cut` says. */
function chamfer(outline: readonly number[], cut: (x: number, y: number) => boolean, size: number) {
  const n = Math.floor(outline.length / 2);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = outline[i * 2] ?? 0;
    const y = outline[i * 2 + 1] ?? 0;
    if (!cut(x, y)) {
      out.push(x, y);
      continue;
    }
    const px = outline[((i - 1 + n) % n) * 2] ?? 0;
    const py = outline[((i - 1 + n) % n) * 2 + 1] ?? 0;
    const nx = outline[((i + 1) % n) * 2] ?? 0;
    const ny = outline[((i + 1) % n) * 2 + 1] ?? 0;
    const towards = (ax: number, ay: number) => {
      const len = Math.hypot(ax - x, ay - y) || 1;
      const d = Math.min(size, len / 2);
      return [x + ((ax - x) / len) * d, y + ((ay - y) / len) * d];
    };
    out.push(...towards(px, py), ...towards(nx, ny));
  }
  return out;
}

const moved = (flat: readonly number[], bend: (x: number, y: number) => [number, number]) => {
  const out: number[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push(...bend(flat[i] ?? 0, flat[i + 1] ?? 0));
  return out;
};

/** The corners of the footprint that are cut. */
function cutCorners(item: StructureItem) {
  const cuts = new Set<string>();
  for (const i of item.chamfers ?? [])
    cuts.add(`${String(item.points[i * 2] ?? NaN)},${String(item.points[i * 2 + 1] ?? NaN)}`);
  return (x: number, y: number) => cuts.has(`${String(x)},${String(y)}`);
}

/** The footprint as it is drawn: corners cut, then bent. */
export function footprintOf(item: StructureItem, cell: number): number[] {
  return moved(chamfer(item.points, cutCorners(item), cell), bender(item, cell));
}

// endregion

// region Plans

/** Rooms planned per floor; a plan is made again only when what it is made from changes. */
const plans = new WeakMap<StructureItem, { cell: number; plan: FloorPlan }>();

/** The plan of a floor (on the footprint's whole cells, before bending). */
export function planOf(item: StructureItem, cell: number): FloorPlan {
  const known = plans.get(item);
  if (known?.cell === cell) return known.plan;
  const layout = archetypeById(item.spec.archetype).layout;
  const ship = layout === 'ship' ? shipClassOf(item.spec.archetype) : undefined;
  const plan = ship
    ? ship.boat
      ? { rooms: [], doors: [], windows: [], stairs: [], walls: [] }
      : planShip({
          hull: item.points,
          cell,
          seed: item.spec.seed,
          ...(item.spec.stairSeed !== undefined ? { stairSeed: item.spec.stairSeed } : {}),
          floor: item.floor,
          heading: item.spec.ship?.heading ?? 0,
          rooms: item.spec.rooms,
          lowerDeck: item.spec.cellar,
          locked: item.rooms ?? [],
          cabin: ship.cabin,
        })
    : layout && layout !== 'ship'
      ? planDungeon({
          footprint: item.points,
          cell,
          seed: item.spec.seed,
          rooms: item.spec.rooms,
          layout,
          locked: item.rooms ?? [],
        })
      : planFloor({
          footprint: item.points,
          cell,
          seed: item.spec.seed,
          ...(item.spec.stairSeed !== undefined ? { stairSeed: item.spec.stairSeed } : {}),
          floor: item.floor,
          rooms: item.spec.rooms,
          locked: item.rooms ?? [],
          stairs: item.spec.upper > 0 || item.spec.cellar,
          entrance: item.floor === 0,
          windows: item.spec.windows && item.floor >= 0,
        });
  let rooms = withTypes(plan.rooms, item.spec.archetype, item.floor);
  // A sky ship's biggest room below is its engine room, round the shard core.
  if (ship && item.spec.ship?.medium === 'sky' && item.floor < 0) {
    const open = rooms.filter((r) => !r.locked && r.type !== 'stairs');
    const big = open.sort((a, b) => b.cells.length - a.cells.length)[0];
    if (big) rooms = rooms.map((r) => (r === big ? { ...r, type: 'engine-room' } : r));
  }
  const typed = { ...plan, rooms };
  plans.set(item, { cell, plan: typed });
  return typed;
}

/**
 * Rooms given the types of the building's programme for their floor, the biggest room the first
 * type (a tavern's common room), the rest in order and round again. Locked rooms keep theirs.
 */
export function withTypes(
  rooms: readonly PlanRoom[],
  archetype: string,
  floor: number,
): PlanRoom[] {
  const programme = archetypeById(archetype).programme;
  const list = floor < 0 ? programme.cellar : floor > 0 ? programme.upper : programme.ground;
  if (list.length === 0) return [...rooms];
  const open = rooms
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.locked && r.type === 'room')
    .sort((a, b) => b.r.cells.length - a.r.cells.length || a.r.id - b.r.id);
  const types = new Map<number, string>();
  open.forEach(({ i }, k) => {
    types.set(
      i,
      list[k < list.length ? k : 1 + ((k - 1) % Math.max(1, list.length - 1))] ?? 'room',
    );
  });
  return rooms.map((r, i) => ({ ...r, type: types.get(i) ?? r.type }));
}

/** The settings a new building starts from: its archetype's, the pictures its style picks. */
export function newBuildingSpec(
  settings: {
    archetype: string;
    style: string;
    upper: number;
    cellar: boolean;
    rooms: number;
    windows: boolean;
    crooked: number;
    name?: string;
    dressing?: BuildingSpec['dressing'];
    condition?: BuildingSpec['condition'];
    /** A ship: sea or sky, and where its bow points. */
    medium?: 'sea' | 'sky';
    heading?: 0 | 90 | 180 | 270;
  },
  entries: Parameters<typeof resolveStyle>[1],
  seed: number,
  wall: number,
  options: RecipeOptions,
): BuildingSpec {
  const archetype = archetypeById(settings.archetype);
  const style = styleById(settings.style);
  const name = settings.name?.trim() ?? '';
  return {
    type: 'building',
    name: name.length > 0 ? name : archetype.name,
    seed,
    archetype: archetype.id,
    // A dungeon is one floor, underground, without windows; a ship may have a deck below.
    upper: archetype.layout ? 0 : Math.max(0, Math.min(3, settings.upper)),
    cellar: archetype.layout && archetype.layout !== 'ship' ? false : settings.cellar,
    rooms: Math.max(1, settings.rooms),
    style: settings.style,
    palette: resolveStyle(styleById(settings.style), entries),
    dressing: settings.dressing ?? 'lived-in',
    // A style that starts ruined (Heliark ruins) is ruined unless asked for worse or better.
    condition:
      (settings.condition ?? 'kept') === 'kept'
        ? (style.condition ?? 'kept')
        : (settings.condition ?? 'kept'),
    ...pickFurnishing({ archetype: archetype.id }, entries, options),
    roof: style.roofKind,
    windows: archetype.layout ? false : settings.windows,
    ...(archetype.layout === 'ship'
      ? { ship: { medium: settings.medium ?? 'sea', heading: settings.heading ?? 0 } }
      : {}),
    crooked: Math.max(0, Math.min(1, settings.crooked)),
    wall,
  };
}

/** The floor of a level: the ground floor's own, the upper floors', the cellar's. */
const floorFor = (palette: StylePalette, floor: number) =>
  floor < 0 ? palette.cellarFloor : floor > 0 ? palette.upperFloor : palette.floor;

/** Whether a floor is drawn under its roof (the map's roofs are shown, and it is not a cellar). */
export const roofedOver = (doc: MapDoc, item: StructureItem): boolean =>
  item.floor >= 0 && doc.hideRoofs !== true && !isDungeon(item.spec);

/** A dungeon or cave (an archetype with a dungeon layout): one floor, underground, no roof. */
export const isDungeon = (spec: BuildingSpec): boolean =>
  archetypeById(spec.archetype).layout !== undefined;

/**
 * A cave's rim from its cells' stair-stepped outline: a point every one and a half squares along
 * it, each nudged a little at random, so the rounded wall reads as rock rather than as a grid.
 */
export function caveRim(outline: readonly number[], cell: number, seed: number): number[] {
  if (outline.length < 6) return [...outline];
  const ring = [...outline, outline[0] ?? 0, outline[1] ?? 0];
  const length = polylineLength(ring);
  const count = Math.max(6, Math.round(length / (cell * 1.5)));
  const rand = seeded(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const at = pointAlong(ring, (i / count) * length);
    out.push(
      Math.round(at.x + (rand() - 0.5) * cell * 0.5),
      Math.round(at.y + (rand() - 0.5) * cell * 0.5),
    );
  }
  return out;
}
const parts = new WeakMap<StructureItem, { key: string; items: MapItem[] }>();

/** Styles whose walls are drawn as wood without packs. */
const WOODEN = new Set(['timber', 'shack', 'arctic']);

/** Working rooms: on the ground floor they get the style's hard floor (flagstone, metal…). */
const HARD_ROOMS = new Set([
  'foundry',
  'refinery',
  'winch-room',
  'arena-floor',
  'kitchen',
  'storage',
  'smithy',
  'workshop',
  'armory',
  'prison',
  'guardhouse',
  'barracks',
  'temple',
  'shrine',
  'crypt',
]);

/** Rooms with a hearth: a chimney stands on the roof above them. */
const HEARTHS = new Set(['kitchen', 'tavern', 'smithy', 'living-room', 'guardhouse', 'foundry']);

/** Roof colours when no pack texture was picked. */
const ROOF_COLORS: Record<BuildingSpec['roof'], string> = {
  tiles: '#9a4b36',
  thatch: '#b39252',
  slate: '#5d6670',
  flat: '#7a7064',
};

/**
 * The roof over a floor (shown while the map's roofs are, so Hide roofs shows the rooms), with a
 * chimney over each hearth: in the hearth room's cell nearest the outer wall.
 */
function roofParts(item: StructureItem, plan: FloorPlan, cell: number, unit: number): MapItem[] {
  const spec = item.spec;
  const footprint = footprintOf(item, cell);
  const out: MapItem[] = [
    {
      kind: 'building',
      id: `${item.id}~roof`,
      points: footprint.map(Math.round),
      roof: spec.roof,
      color: ROOF_COLORS[spec.roof],
      ...(spec.palette.roof ? { roofTexture: spec.palette.roof } : {}),
      ...(spec.name ? { name: spec.name } : {}),
    },
  ];
  const chimney = spec.palette.chimney;
  if (!chimney) return out;
  const bend = bender(item, cell);
  const all = plan.rooms.flatMap((r) => r.cells.map(parseCell));
  const cx = all.reduce((a, c) => a + c[0], 0) / Math.max(1, all.length);
  const cy = all.reduce((a, c) => a + c[1], 0) / Math.max(1, all.length);
  for (const room of plan.rooms) {
    if (!HEARTHS.has(room.type)) continue;
    let best: [number, number] | null = null;
    let far = -1;
    for (const c of room.cells.map(parseCell)) {
      const d = Math.hypot(c[0] + 0.5 - cx, c[1] + 0.5 - cy);
      if (d > far) {
        far = d;
        best = c;
      }
    }
    if (!best) continue;
    const [x, y] = bend((best[0] + 0.5) * cell, (best[1] + 0.5) * cell);
    out.push({
      kind: 'stamp',
      id: `${item.id}~ch${String(room.id)}`,
      stamp: chimney,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(unit),
      h: Math.round(unit),
      rotation: 0,
    });
  }
  return out;
}

/**
 * A floor as ordinary items: a room for each room of the plan (its floor, walls and doorways,
 * joined to the rooms it touches), and stamps for the doors, windows and stairs. Ids are the
 * structure's own and a suffix, the same every time, so the scene redraws only what changed.
 */
export function structureParts(doc: MapDoc, item: StructureItem): MapItem[] {
  const cell = doc.grid.size;
  const unit = stampUnit(doc);
  const roofed = roofedOver(doc, item);
  const key = `${String(cell)}|${String(unit)}|${String(roofed)}|${String(doc.hideRoofs === true)}`;
  const known = parts.get(item);
  if (known?.key === key) return known.items;
  const plan = planOf(item, cell);
  const bend = bender(item, cell);
  const cut = cutCorners(item);
  const palette = item.spec.palette;
  const packDoor = palette.door !== undefined;
  const wood = WOODEN.has(item.spec.style);
  const out: MapItem[] = [];
  const cave = archetypeById(item.spec.archetype).layout === 'caves';
  // Each room's floor outline (furniture is laid inside it).
  const outlines = plan.rooms.map((room) =>
    moved(chamfer(traceCells(new Set(room.cells), cell), cut, cell), bend),
  );
  const ship = archetypeById(item.spec.archetype).layout === 'ship';
  const boat = shipClassOf(item.spec.archetype)?.boat !== undefined;
  // A ship's deck is its hull: one room, its rim the hull wall; walls between its rooms inside.
  if (ship) {
    if (!boat)
      out.push({
        kind: 'room',
        id: `${item.id}~hull`,
        points: footprintOf(item, cell),
        smooth: 0,
        floor: floorFor(palette, item.floor),
        wall: item.spec.wall,
        wallStyle: 'wood',
        ...(palette.wall ? { wallTexture: palette.wall } : {}),
      });
  }
  // Caverns open into each other: one rounded room for each cave, its rim a cave wall.
  else if (cave)
    components(new Set(plan.rooms.flatMap((r) => r.cells))).forEach((group, n) => {
      out.push({
        kind: 'room',
        id: `${item.id}~cave${String(n)}`,
        points: caveRim(moved(traceCells(new Set(group), cell), bend), cell, item.spec.seed + n),
        smooth: 0.75,
        floor: floorFor(palette, item.floor),
        wall: item.spec.wall,
        wallStyle: 'cave',
        ...(palette.wall ? { wallTexture: palette.wall } : {}),
      });
    });
  else
    plan.rooms.forEach((room, i) => {
      const outline = outlines[i] ?? [];
      const doors = plan.doors
        .filter((d) => d.rooms[0] === i)
        .map((d) => {
          const [x, y] = bend(d.x, d.y);
          return { x, y, angle: d.angle, kind: packDoor ? ('gap' as const) : ('door' as const) };
        });
      const r: RoomItem = {
        kind: 'room',
        id: `${item.id}~r${String(room.id)}`,
        points: outline,
        smooth: 0,
        floor:
          item.floor === 0 && palette.hardFloor && HARD_ROOMS.has(room.type)
            ? palette.hardFloor
            : floorFor(palette, item.floor),
        wall: item.spec.wall,
        wallStyle: wood ? 'wood' : 'stone',
        ...(palette.wall ? { wallTexture: palette.wall } : {}),
        // Doorways are drawn over everything on the layer, the roof too: none while it is on.
        ...(doors.length && !roofed ? { doors } : {}),
      };
      out.push(r);
    });
  // Furniture, room by room, on the floors and under the walls between rooms.
  // Under the roof only the outer walls stay (they cast shadows outside).
  (roofed ? [] : plan.rooms).forEach((room, i) => {
    const outline = outlines[i];
    if (!outline) return;
    const doors = plan.doors
      .filter((d) => d.rooms.includes(i))
      .map((d) => {
        const [x, y] = bend(d.x, d.y);
        return { x, y };
      });
    out.push(
      ...roomFurniture(doc, item.spec, room, outline, doors, `${item.id}~f${String(room.id)}.`),
    );
  });
  // Walls between rooms (touching rooms would otherwise share a floor), over the floors, open
  // where a door is.
  let wallNo = 0;
  for (const seg of roofed ? [] : plan.walls)
    for (const piece of openings(seg, plan.doors, cell * 0.9)) {
      const [ax, ay] = bend(piece[0] ?? 0, piece[1] ?? 0);
      const [bx, by] = bend(piece[2] ?? 0, piece[3] ?? 0);
      out.push({
        kind: 'wall',
        id: `${item.id}~iw${String(wallNo++)}`,
        points: [ax, ay, bx, by],
        joint: 'sharp',
        ...((palette.parts?.innerWall ?? palette.wall)
          ? { texture: palette.parts?.innerWall ?? palette.wall }
          : {}),
      });
    }
  const stamp = (
    suffix: string,
    ref: string,
    x: number,
    y: number,
    rotation: number,
    size?: { w: number; h: number },
  ): StampItem => {
    const squares = size ?? squaresOf(parsePackRef(ref)?.path ?? '') ?? { w: 1, h: 1 };
    return {
      kind: 'stamp',
      id: `${item.id}~${suffix}`,
      stamp: ref,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(squares.w * (size ? 1 : unit)),
      h: Math.round(squares.h * (size ? 1 : unit)),
      rotation: Math.round(((rotation * 180) / Math.PI + 360) % 360),
    };
  };
  if (palette.stairs && plan.stairs.length > 0 && !roofed) {
    const cells = plan.stairs.map(parseCell);
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const w = Math.max(...xs) - x0 + 1;
    const h = Math.max(...ys) - y0 + 1;
    const [cx, cy] = bend((x0 + w / 2) * cell, (y0 + h / 2) * cell);
    // The picture runs up and down (1 × 3): turned when the stairwell runs across.
    const across = w > h;
    out.push(
      stamp('stairs', palette.stairs, cx, cy, across ? Math.PI / 2 : 0, {
        w: (across ? h : w) * cell,
        h: (across ? w : h) * cell,
      }),
    );
  }
  // Under the roof, doors and windows are hidden with the rooms (they would stick out of the eaves).
  if (palette.door && !roofed)
    plan.doors.forEach((d, k) => {
      const [x, y] = bend(d.x, d.y);
      out.push(stamp(`d${String(k)}`, palette.door ?? '', x, y, d.angle));
    });
  if (palette.window && !roofed)
    plan.windows.forEach((w, k) => {
      const [x, y] = bend(w.x, w.y);
      out.push(stamp(`w${String(k)}`, palette.window ?? '', x, y, w.angle));
    });
  if (roofed) out.push(...roofParts(item, plan, cell, unit));
  // A ship's main deck: masts, cannons, rigging; the sails while the map's roofs are shown.
  if (ship && item.floor === 0)
    out.push(
      ...shipParts(item.id, item.spec, footprintOf(item, cell), unit, {
        sails: doc.hideRoofs !== true,
      }),
    );
  parts.set(item, { key, items: out });
  return out;
}

/** A wall segment with a gap of `width` where each door on it stands. */
export function openings(
  seg: readonly number[],
  doors: readonly { x: number; y: number }[],
  width: number,
): number[][] {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = seg;
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return [];
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const cuts: [number, number][] = [];
  for (const d of doors) {
    const t = (d.x - x0) * ux + (d.y - y0) * uy;
    const off = Math.abs((d.x - x0) * uy - (d.y - y0) * ux);
    if (off < 1 && t > -width / 2 && t < len + width / 2) cuts.push([t - width / 2, t + width / 2]);
  }
  cuts.sort((a, b) => a[0] - b[0]);
  const out: number[][] = [];
  let at = 0;
  for (const [a, b] of cuts) {
    if (a > at + 1) out.push([x0 + ux * at, y0 + uy * at, x0 + ux * a, y0 + uy * a]);
    at = Math.max(at, b);
  }
  if (at < len - 1) out.push([x0 + ux * at, y0 + uy * at, x1, y1]);
  return out;
}

/** A layer's items with each structure and line kit in it given as its parts (what the scene draws). */
export function expandStructures(doc: MapDoc, items: readonly MapItem[]): MapItem[] {
  if (!items.some((i) => i.kind === 'structure' || i.kind === 'kit')) return [...items];
  return items.flatMap((i) =>
    i.kind === 'structure' ? structureParts(doc, i) : i.kind === 'kit' ? kitParts(doc, i) : [i],
  );
}

// endregion

// region Making buildings

/** A footprint on whole cells from a dragged outline: the cells it covers, outlined. */
export function footprintFrom(points: readonly number[], cell: number): number[] {
  return traceCells(cellsInPolygon(points, cell), cell);
}

export interface NewStructure {
  spec: BuildingSpec;
  /** The outline dragged (snapped to whole cells). */
  points: number[];
}

/**
 * A new building: a layer and a structure item for each of its floors (cellar, ground floor,
 * upper floors), and a variant for each floor showing the map's other layers and that floor. The
 * ground floor is shown. Returns the map and the ground floor's id.
 */
export function addStructure(
  doc: MapDoc,
  made: NewStructure,
  /** The ground floor's id, when the caller needs it beforehand (to pick it). */
  groundId?: string,
): { doc: MapDoc; id: string; group: string } {
  const cell = doc.grid.size;
  // A ship keeps its curved hull; anything else stands on whole cells.
  const points =
    archetypeById(made.spec.archetype).layout === 'ship'
      ? made.points.map(Math.round)
      : footprintFrom(made.points, cell);
  const taken = [
    ...allItems(doc).map((i) => i.id),
    ...doc.layers.map((l) => l.id),
    ...(doc.variants ?? []).map((v) => v.id),
  ];
  const fresh = () => {
    const id = newId(taken);
    taken.push(id);
    return id;
  };
  const group = fresh();
  const floors = [
    ...(made.spec.cellar ? [-1] : []),
    0,
    ...Array.from({ length: made.spec.upper }, (_, k) => k + 1),
  ];
  const base = doc.layers.map((l) => l.id);
  let out = doc;
  const floorLayers: { floor: number; layer: string; item: string }[] = [];
  for (const floor of floors) {
    const layer: Layer = {
      id: fresh(),
      name: `${made.spec.name} – ${floorName(floor)}`,
      visible: floor === 0,
      locked: false,
      items: [],
    };
    out = { ...out, layers: [...out.layers, layer] };
    const id = floor === 0 && groundId ? groundId : fresh();
    out = addItem(out, layer.id, {
      kind: 'structure',
      id,
      points,
      group,
      floor,
      spec: made.spec,
    });
    floorLayers.push({ floor, layer: layer.id, item: id });
  }
  // A variant for each floor: the layers there were, and that floor alone.
  const variants: Variant[] = floorLayers.map((f) => ({
    id: fresh(),
    name: `${made.spec.name}: ${floorName(f.floor)}`,
    layers: {
      ...Object.fromEntries(base.map((id) => [id, true])),
      ...Object.fromEntries(floorLayers.map((o) => [o.layer, o.layer === f.layer])),
    },
    items: {},
  }));
  // Variants the map had show the ground floor.
  const older = (out.variants ?? []).map((v) => ({
    ...v,
    layers: {
      ...v.layers,
      ...Object.fromEntries(floorLayers.map((o) => [o.layer, o.floor === 0])),
    },
  }));
  const ground = floorLayers.find((f) => f.floor === 0);
  const groundVariant = variants[floorLayers.findIndex((f) => f.floor === 0)];
  out = {
    ...out,
    variants: [...older, ...variants],
    ...(groundVariant ? { activeVariant: groundVariant.id } : {}),
  };
  return { doc: out, id: ground?.item ?? '', group };
}

/**
 * A building given more or fewer floors: a floor added gets a layer and a variant of its own (as
 * `addStructure` makes them), a floor taken away goes with its layer and variant.
 */
export function setFloors(doc: MapDoc, group: string, upper: number, cellar: boolean): MapDoc {
  const floors = floorsOf(doc, group);
  const first = floors[0];
  if (!first) return doc;
  const spec = { ...first.spec, upper: Math.max(0, Math.min(3, upper)), cellar };
  const wanted = [
    ...(cellar ? [-1] : []),
    0,
    ...Array.from({ length: spec.upper }, (_, k) => k + 1),
  ];
  const layerOf = (id: string) => doc.layers.find((l) => l.items.some((i) => i.id === id));
  const variantName = (floor: number) => `${spec.name}: ${floorName(floor)}`;
  // Floors taken away: their layers and variants.
  const gone = floors.filter((f) => !wanted.includes(f.floor));
  const goneLayers = new Set(gone.flatMap((f) => layerOf(f.id)?.id ?? []));
  const goneVariants = new Set(gone.map((f) => variantName(f.floor)));
  let out: MapDoc = {
    ...doc,
    layers: doc.layers.filter((l) => !goneLayers.has(l.id)),
    variants: (doc.variants ?? []).filter((v) => !goneVariants.has(v.name)),
  };
  if (out.activeVariant && !out.variants?.some((v) => v.id === out.activeVariant)) {
    const { activeVariant: _a, ...rest } = out;
    out = rest;
  }
  // Floors added: a layer, the floor, and a variant showing it.
  const taken = [
    ...allItems(out).map((i) => i.id),
    ...out.layers.map((l) => l.id),
    ...(out.variants ?? []).map((v) => v.id),
  ];
  const fresh = () => {
    const id = newId(taken);
    taken.push(id);
    return id;
  };
  const have = new Set(floors.map((f) => f.floor));
  const floorLayerIds = new Set(
    floors.filter((f) => wanted.includes(f.floor)).flatMap((f) => layerOf(f.id)?.id ?? []),
  );
  for (const floor of wanted.filter((f) => !have.has(f))) {
    const layerId = fresh();
    out = {
      ...out,
      layers: [
        ...out.layers,
        {
          id: layerId,
          name: `${spec.name} – ${floorName(floor)}`,
          visible: false,
          locked: false,
          items: [],
        },
      ],
    };
    out = addItem(out, layerId, {
      kind: 'structure',
      id: fresh(),
      points: first.points,
      ...(first.bends ? { bends: first.bends } : {}),
      ...(first.chamfers ? { chamfers: first.chamfers } : {}),
      group,
      floor,
      spec,
    });
    // Other variants do not show it; its own shows it and no other floor.
    const others = new Set(floorLayerIds);
    out = {
      ...out,
      variants: [
        ...(out.variants ?? []).map((v) => ({ ...v, layers: { ...v.layers, [layerId]: false } })),
        {
          id: fresh(),
          name: variantName(floor),
          layers: {
            ...Object.fromEntries(
              out.layers.map((l) => [
                l.id,
                l.id === layerId || (!others.has(l.id) && !l.name.startsWith(`${spec.name} – `)),
              ]),
            ),
          },
          items: {},
        },
      ],
    };
    floorLayerIds.add(layerId);
  }
  return updateGroup(out, group, (i) => ({ ...i, spec }));
}

/** Every floor of a building, lowest first. */
export const floorsOf = (doc: MapDoc, group: string): StructureItem[] =>
  allItems(doc)
    .filter((i): i is StructureItem => i.kind === 'structure' && i.group === group)
    .sort((a, b) => a.floor - b.floor);

/** Every floor of a building changed alike (the spec, the footprint). */
export function updateGroup(
  doc: MapDoc,
  group: string,
  change: (item: StructureItem) => StructureItem,
): MapDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.map((i) => (i.kind === 'structure' && i.group === group ? change(i) : i)),
    })),
  };
}

/** The footprint of one floor (dragged corners, cut corners) given to every floor. */
export function syncFootprint(doc: MapDoc, id: string): MapDoc {
  const from = allItems(doc).find((i): i is StructureItem => i.kind === 'structure' && i.id === id);
  if (!from) return doc;
  return updateGroup(doc, from.group, (i) => {
    const { bends: _b, chamfers: _c, ...rest } = i;
    return {
      ...rest,
      points: from.points,
      ...(from.bends ? { bends: from.bends } : {}),
      ...(from.chamfers ? { chamfers: from.chamfers } : {}),
    };
  });
}

/**
 * The footprint grown (or started) by a dragged outline: the cells of both, outlined again. Bent
 * and cut corners are let go (the corners are new); locked rooms outside the cells are dropped.
 */
export function mergeFootprint(doc: MapDoc, group: string, points: readonly number[]): MapDoc {
  const cell = doc.grid.size;
  const first = floorsOf(doc, group)[0];
  if (!first) return doc;
  const cells = cellsInPolygon(first.points, cell);
  for (const c of cellsInPolygon(points, cell)) cells.add(c);
  const outline = traceCells(cells, cell);
  return updateGroup(doc, group, (i) => {
    const { bends: _b, chamfers: _c, ...rest } = i;
    return { ...rest, points: outline };
  });
}

/** A floor moved by whole squares (the nearest to dx, dy), its kept rooms with it. */
export function moveStructure(
  item: StructureItem,
  dx: number,
  dy: number,
  cell: number,
): StructureItem {
  const cx = Math.round(dx / cell);
  const cy = Math.round(dy / cell);
  if (cx === 0 && cy === 0) return item;
  return {
    ...item,
    points: item.points.map((v, i) => v + (i % 2 === 0 ? cx : cy) * cell),
    ...(item.rooms
      ? {
          rooms: item.rooms.map((r) => ({
            ...r,
            cells: r.cells.map((k) => {
              const [x, y] = parseCell(k);
              return cellKey(x + cx, y + cy);
            }),
          })),
        }
      : {}),
  };
}

/** Whether a drawn outline overlaps a building or lies along its side (to grow it). */
export function touchesFootprint(
  item: StructureItem,
  points: readonly number[],
  cell: number,
): boolean {
  const mine = cellsInPolygon(item.points, cell);
  for (const key of cellsInPolygon(points, cell)) {
    if (mine.has(key)) return true;
    const [x, y] = parseCell(key);
    if (
      mine.has(cellKey(x + 1, y)) ||
      mine.has(cellKey(x - 1, y)) ||
      mine.has(cellKey(x, y + 1)) ||
      mine.has(cellKey(x, y - 1))
    )
      return true;
  }
  return false;
}

/** Every outward corner of the footprint cut at 45° (or none, again). */
export function cutAllCorners(item: StructureItem, on: boolean): StructureItem {
  const { chamfers: _c, ...rest } = item;
  if (!on) return rest;
  const n = Math.floor(item.points.length / 2);
  const outward: number[] = [];
  for (let i = 0; i < n; i++) {
    const ax = item.points[((i - 1 + n) % n) * 2] ?? 0;
    const ay = item.points[((i - 1 + n) % n) * 2 + 1] ?? 0;
    const bx = item.points[i * 2] ?? 0;
    const by = item.points[i * 2 + 1] ?? 0;
    const cx = item.points[((i + 1) % n) * 2] ?? 0;
    const cy = item.points[((i + 1) % n) * 2 + 1] ?? 0;
    // Clockwise on screen: an outward corner turns right.
    if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) > 0) outward.push(i);
  }
  return { ...rest, chamfers: outward };
}

/** The corners as drawn (dragged and crooked), where the editor shows its handles. */
export const handlesOf = (item: StructureItem, cell: number): number[] =>
  moved(item.points, bender(item, cell));

/**
 * The footprint after a handle was dragged: the drag is kept as that corner's bend. Points added
 * or taken away (the editor's other handle actions) are not for buildings: nothing changes.
 */
export function withHandles(
  item: StructureItem,
  handles: readonly number[],
  cell: number,
): StructureItem {
  if (handles.length !== item.points.length) return item;
  const before = handlesOf(item, cell);
  const bends = [...(item.bends ?? item.points.map(() => 0))];
  for (let i = 0; i < handles.length; i++)
    bends[i] = (bends[i] ?? 0) + ((handles[i] ?? 0) - (before[i] ?? 0));
  return { ...item, bends: bends.map((v) => Math.round(v * 10) / 10) };
}

// endregion

// region Rooms of a floor

/** The room of a floor at a map point (before bending: near enough to pick). */
export function roomAt(
  item: StructureItem,
  cell: number,
  p: { x: number; y: number },
): PlanRoom | undefined {
  const key = cellKey(Math.floor(p.x / cell), Math.floor(p.y / cell));
  return planOf(item, cell).rooms.find((r) => r.cells.includes(key));
}

const lockedOf = (item: StructureItem) => item.rooms ?? [];

const withLocked = (item: StructureItem, rooms: StructureItem['rooms']): StructureItem => {
  const { rooms: _r, ...rest } = item;
  return rooms && rooms.length > 0 ? { ...rest, rooms } : rest;
};

const asLocked = (r: PlanRoom) => ({ id: r.id, cells: [...r.cells], type: r.type, seed: r.seed });

/**
 * Every room of the floor as it is now, kept: a change to one room (its type, its furniture, a
 * split or a merge) leaves the others where they are. Unlock all lets Roll again cut them anew.
 */
const frozen = (item: StructureItem, cell: number) =>
  planOf(item, cell)
    .rooms.filter((r) => r.type !== 'stairs')
    .map(asLocked);

/** A room kept as it is (Roll again leaves it), or let go again. */
export function lockRoom(
  item: StructureItem,
  cell: number,
  roomId: number,
  on: boolean,
): StructureItem {
  const others = lockedOf(item).filter((r) => r.id !== roomId);
  if (!on) return withLocked(item, others);
  const room = planOf(item, cell).rooms.find((r) => r.id === roomId);
  if (!room || room.type === 'stairs') return item;
  return withLocked(item, [...others, asLocked(room)]);
}

/** Every room let go: Roll again cuts the whole floor anew. */
export const unlockAll = (item: StructureItem): StructureItem => withLocked(item, []);

/** The building's rooms cut again (another seed); its stairs and its kept rooms stay. */
export const rollAgain = (spec: BuildingSpec, seed: number): BuildingSpec => ({
  ...spec,
  stairSeed: spec.stairSeed ?? spec.seed,
  seed,
});

/** One room of a frozen floor changed. */
function changeRoom(
  item: StructureItem,
  cell: number,
  roomId: number,
  change: (r: ReturnType<typeof asLocked>) => ReturnType<typeof asLocked>,
): StructureItem {
  const rooms = frozen(item, cell);
  if (!rooms.some((r) => r.id === roomId)) return item;
  return withLocked(
    item,
    rooms.map((r) => (r.id === roomId ? change(r) : r)),
  );
}

/** A room given another type (the floor kept as it is). */
export const setRoomType = (item: StructureItem, cell: number, roomId: number, type: string) =>
  changeRoom(item, cell, roomId, (r) => ({ ...r, type }));

/** A room's furniture laid again (another seed), the floor kept as it is. */
export const rerollRoom = (item: StructureItem, cell: number, roomId: number, seed: number) =>
  changeRoom(item, cell, roomId, (r) => ({ ...r, seed }));

/** A room cut in two across its longer side (the floor kept); null when too small. */
export function splitRoom(item: StructureItem, cell: number, roomId: number): StructureItem | null {
  const plan = planOf(item, cell);
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room || room.type === 'stairs') return null;
  const cells = room.cells.map(parseCell);
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const across = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
  const lo = across ? Math.min(...xs) : Math.min(...ys);
  const hi = across ? Math.max(...xs) : Math.max(...ys);
  if (hi - lo + 1 < 4) return null;
  const line = Math.round((lo + hi + 1) / 2);
  const a = room.cells.filter((k) => parseCell(k)[across ? 0 : 1] < line);
  const b = room.cells.filter((k) => parseCell(k)[across ? 0 : 1] >= line);
  if (a.length < 4 || b.length < 4) return null;
  const used = new Set(plan.rooms.map((r) => r.id));
  let fresh = 1;
  while (used.has(fresh)) fresh++;
  const others = frozen(item, cell).filter((r) => r.id !== roomId);
  return withLocked(item, [
    ...others,
    { id: room.id, cells: a, type: room.type, seed: room.seed },
    { id: fresh, cells: b, type: room.type, seed: room.seed + 1 },
  ]);
}

/** Two rooms that touch made one (kept); null when they do not touch. */
export function mergeRoomsOf(
  item: StructureItem,
  cell: number,
  a: number,
  b: number,
): StructureItem | null {
  const plan = planOf(item, cell);
  const ra = plan.rooms.find((r) => r.id === a);
  const rb = plan.rooms.find((r) => r.id === b);
  if (!ra || !rb || ra.type === 'stairs' || rb.type === 'stairs') return null;
  const set = new Set(rb.cells);
  const touch = ra.cells.some((k) => {
    const [x, y] = parseCell(k);
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx = 0, dy = 0]) => set.has(cellKey(x + dx, y + dy)));
  });
  if (!touch) return null;
  const others = frozen(item, cell).filter((r) => r.id !== a && r.id !== b);
  return withLocked(item, [
    ...others,
    { ...asLocked(ra), cells: [...ra.cells, ...rb.cells].sort() },
  ]);
}

/** The rooms that touch a room (for "merge with…"). */
export function neighbours(item: StructureItem, cell: number, roomId: number): PlanRoom[] {
  const plan = planOf(item, cell);
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return [];
  const near = new Set<string>();
  for (const k of room.cells) {
    const [x, y] = parseCell(k);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      near.add(cellKey(x + dx, y + dy));
  }
  return plan.rooms.filter(
    (r) => r.id !== roomId && r.type !== 'stairs' && r.cells.some((k) => near.has(k)),
  );
}

// endregion

/**
 * A building turned into what it is drawn as, floor by floor: rooms (with their doorways) and
 * stamps (doors, windows, stairs), each on its floor's layer, with ids of their own.
 */
export function bakeStructure(doc: MapDoc, group: string): MapDoc {
  const floors = new Set(floorsOf(doc, group).map((f) => f.id));
  if (floors.size === 0) return doc;
  const open: MapDoc = { ...doc, hideRoofs: true };
  const taken = new Set(allItems(doc).map((i) => i.id));
  const fresh = (base: string) => {
    let n = 0;
    let id = `${base}-${String(n)}`;
    while (taken.has(id)) id = `${base}-${String(++n)}`;
    taken.add(id);
    return id;
  };
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.flatMap((i) =>
        i.kind === 'structure' && floors.has(i.id)
          ? // Baked without its roof: a baked roof would hide the rooms for good.
            structureParts(open, i).map((p) => ({ ...p, id: fresh(i.id) }))
          : [i],
      ),
    })),
  };
}

/** The pictures a building uses, for the "used on this map" list. */
export const paletteRefs = (spec: BuildingSpec): string[] =>
  Object.values(spec.palette).filter((v): v is string => typeof v === 'string');
