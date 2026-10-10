import { generateDistrict, type DistrictGeo, type DistrictSpec } from './city';
import { generateIsland } from './islandgen';
import { addItem, type MapDoc, type MapItem } from './model';
import { centroid } from './polyclip';
import { placementRules } from './scatterDoc';
import { nearestOnPolyline, splinePoints } from './spline';

/**
 * Districts and buildings as parts of a map: the styles a district can have, how an item
 * becomes the numbers the generator works from (its outline, what it keeps clear of), and what
 * can be done with the result: erase a building, or bake the district into buildings of its own.
 */

export type DistrictItem = Extract<MapItem, { kind: 'district' }>;
export type BuildingItem = Extract<MapItem, { kind: 'building' }>;
export type DistrictStyleId = DistrictItem['style'];
export type RoofStyle = BuildingItem['roof'];

export interface DistrictStyle {
  name: string;
  hint: string;
  blockSize: number;
  streetWidth: number;
  lotArea: number;
  gap: number;
  density: number;
  jitter: number;
  plaza: number;
  /** Colours: the street, the yards between buildings, and the roofs to pick from. */
  street: string;
  yard: string;
  roofs: string[];
  roof: RoofStyle;
}

export const DISTRICT_STYLES: Record<DistrictStyleId, DistrictStyle> = {
  town: {
    name: 'Town',
    hint: 'houses and shops',
    blockSize: 130,
    streetWidth: 14,
    lotArea: 1500,
    gap: 5,
    density: 0.95,
    jitter: 0.45,
    plaza: 0,
    street: '#b8a98a',
    yard: '#a9b27c',
    roofs: ['#b5543a', '#c4663f', '#9c4a35', '#a85d3e', '#7d5a46'],
    roof: 'tiles',
  },
  dense: {
    name: 'Crowded quarter',
    hint: 'small, packed, crooked',
    blockSize: 100,
    streetWidth: 10,
    lotArea: 800,
    gap: 3,
    density: 0.98,
    jitter: 0.7,
    plaza: 0,
    street: '#a99b80',
    yard: '#9ca07a',
    roofs: ['#8a6a4a', '#7a5c40', '#9a7b55', '#6f5a45'],
    roof: 'thatch',
  },
  noble: {
    name: 'Noble quarter',
    hint: 'big houses with gardens',
    blockSize: 210,
    streetWidth: 20,
    lotArea: 3800,
    gap: 22,
    density: 0.8,
    jitter: 0.25,
    plaza: 0,
    street: '#c2b69a',
    yard: '#8fae6c',
    roofs: ['#5f6b7a', '#6c7a8c', '#7d6a5a'],
    roof: 'slate',
  },
  market: {
    name: 'Market quarter',
    hint: 'an open square in the middle',
    blockSize: 140,
    streetWidth: 16,
    lotArea: 1700,
    gap: 5,
    density: 0.95,
    jitter: 0.4,
    plaza: 0.25,
    street: '#c9b88c',
    yard: '#b3a57a',
    roofs: ['#c2573b', '#d08a3e', '#a8453a', '#3f6f7a'],
    roof: 'tiles',
  },
  ward: {
    name: 'Keep or temple ward',
    hint: 'large stone halls',
    blockSize: 170,
    streetWidth: 18,
    lotArea: 2600,
    gap: 8,
    density: 0.9,
    jitter: 0.15,
    plaza: 0,
    street: '#a8a39a',
    yard: '#9aa08a',
    roofs: ['#6a6a6a', '#7a7770', '#59616b'],
    roof: 'flat',
  },
};

export const ROOF_STYLES: { id: RoofStyle; name: string }[] = [
  { id: 'tiles', name: 'Tiles' },
  { id: 'thatch', name: 'Thatch' },
  { id: 'slate', name: 'Slate' },
  { id: 'flat', name: 'Flat roof' },
];

/** What the District tool makes new districts from. */
export interface DistrictSettings {
  style: DistrictStyleId;
  /** Multiplies streets and lots: the same style for a village or a capital. */
  scale: number;
  blockSize: number;
  streetWidth: number;
  lotArea: number;
  gap: number;
  density: number;
  jitter: number;
  angle: number;
  plaza: number;
  wall: boolean;
  avoid: 'auto' | 'none';
}

export const settingsFromStyle = (style: DistrictStyleId, scale = 1): DistrictSettings => {
  const s = DISTRICT_STYLES[style];
  return {
    style,
    scale,
    blockSize: s.blockSize,
    streetWidth: s.streetWidth,
    lotArea: s.lotArea,
    gap: s.gap,
    density: s.density,
    jitter: s.jitter,
    angle: 0,
    plaza: s.plaza,
    wall: false,
    avoid: 'auto',
  };
};

export const DEFAULT_DISTRICT: DistrictSettings = settingsFromStyle('town');

/** A district item from settings and its outline. */
export function makeDistrict(
  id: string,
  s: DistrictSettings,
  points: number[],
  seed: number,
  smooth = 0.25,
): DistrictItem {
  return {
    kind: 'district',
    id,
    points,
    smooth,
    seed,
    style: s.style,
    blockSize: Math.round(s.blockSize * s.scale),
    streetWidth: Math.round(s.streetWidth * s.scale),
    lotArea: Math.round(s.lotArea * s.scale * s.scale),
    gap: Math.round(s.gap * s.scale),
    density: s.density,
    jitter: s.jitter,
    angle: s.angle,
    plaza: s.plaza,
    wall: s.wall,
    avoid: s.avoid,
  };
}

export const districtOutline = (item: DistrictItem): number[] =>
  splinePoints(item.points, true, item.smooth);

/** Everything the generator needs for a district in this map. */
export function districtSetup(
  doc: MapDoc,
  item: DistrictItem,
): { spec: DistrictSpec; rules: ReturnType<typeof placementRules> } {
  return {
    spec: {
      outline: districtOutline(item),
      seed: item.seed,
      blockSize: item.blockSize,
      streetWidth: item.streetWidth,
      lotArea: item.lotArea,
      gap: item.gap,
      density: item.density,
      jitter: item.jitter,
      angle: item.angle,
      plaza: item.plaza,
      maxBuildings: 5000,
    },
    rules: placementRules(doc, { avoid: item.avoid }),
  };
}

/** The district as generated now, without the buildings erased. */
export function districtGeo(doc: MapDoc, item: DistrictItem): DistrictGeo {
  const { spec, rules } = districtSetup(doc, item);
  const geo = generateDistrict(spec, rules.obstacles, rules.allowed);
  const removed = new Set(item.removed ?? []);
  return removed.size === 0
    ? geo
    : { ...geo, buildings: geo.buildings.filter((b) => !removed.has(b.key)) };
}

/** A roof colour for a building of a district, from its tone. */
export const roofColorOf = (style: DistrictStyleId, tone: number): string => {
  const roofs = DISTRICT_STYLES[style].roofs;
  return roofs[Math.min(roofs.length - 1, Math.floor(tone * roofs.length))] ?? '#a85d3e';
};

const allItems = (doc: MapDoc) => doc.layers.flatMap((l) => l.items);

/**
 * The eraser went along `path`: generated buildings within `radius` of it are taken out of their
 * district (kept as a list of keys, so they stay out while the streets stay).
 */
export function eraseBuildings(doc: MapDoc, path: readonly number[], radius: number): MapDoc {
  let next = doc;
  for (const item of allItems(doc)) {
    if (item.kind !== 'district') continue;
    const hits = districtGeo(doc, item).buildings.filter((b) => {
      const c = centroid(b.poly);
      return nearestOnPolyline(path.length >= 4 ? path : [...path, ...path], c).dist <= radius;
    });
    if (hits.length === 0) continue;
    const removed = [...(item.removed ?? []), ...hits.map((b) => b.key)];
    next = {
      ...next,
      layers: next.layers.map((l) => ({
        ...l,
        items: l.items.map((i) =>
          i.id === item.id && i.kind === 'district' ? { ...i, removed } : i,
        ),
      })),
    };
  }
  return next;
}

/**
 * The district's generated buildings become buildings of their own (so each can be moved, reshaped
 * and recoloured, and stays put whatever happens to the streets); the district keeps its streets,
 * yards and wall.
 */
export function bakeDistrict(doc: MapDoc, id: string): MapDoc {
  const item = allItems(doc).find((i): i is DistrictItem => i.kind === 'district' && i.id === id);
  if (!item) return doc;
  const taken = new Set(allItems(doc).map((i) => i.id));
  const fresh = (n: number) => {
    let candidate = `${id}-b${String(n)}`;
    let k = n;
    while (taken.has(candidate)) candidate = `${id}-b${String(++k)}`;
    taken.add(candidate);
    return candidate;
  };
  const style = DISTRICT_STYLES[item.style];
  const houses: MapItem[] = districtGeo(doc, item).buildings.map((b, n) => ({
    kind: 'building',
    id: fresh(n),
    points: b.poly.map(Math.round),
    roof: style.roof,
    color: roofColorOf(item.style, b.tone),
  }));
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      items: l.items.flatMap((i) =>
        i.id === id && i.kind === 'district' ? [{ ...i, density: 0, removed: [] }, ...houses] : [i],
      ),
    })),
  };
}

/** A building from a footprint (made by hand, or taken from the library). */
export function makeBuilding(
  id: string,
  points: number[],
  roof: RoofStyle,
  color: string,
  name?: string,
): BuildingItem {
  return { kind: 'building', id, points, roof, color, ...(name ? { name } : {}) };
}

/** A rectangle's corners, turned by `angle` (radians) about its centre. */
export function rectangleFootprint(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle = 0,
): number[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].flatMap(([x = 0, y = 0]) => [
    Math.round(cx + x * cos - y * sin),
    Math.round(cy + x * sin + y * cos),
  ]);
}

/**
 * A walled town: a district of houses with a wall, and a market quarter in the middle of it.
 * Returns the items to add, outer first.
 */
export function generateTown(
  doc: MapDoc,
  centre: { x: number; y: number },
  radius: number,
  seed: number,
  scale: number,
  nextId: (taken: string[]) => string,
): MapItem[] {
  const taken = allItems(doc).map((i) => i.id);
  const id = () => {
    const n = nextId(taken);
    taken.push(n);
    return n;
  };
  const outline = generateIsland({
    x: centre.x,
    y: centre.y,
    radius,
    seed,
    ruggedness: 0.25,
    elongation: 0.1,
  });
  const outer = makeDistrict(
    id(),
    { ...settingsFromStyle('town', scale), wall: true, plaza: 0.5 },
    outline,
    seed,
    0.5,
  );
  const inner = makeDistrict(
    id(),
    { ...settingsFromStyle('market', scale), angle: 12 },
    generateIsland({
      x: centre.x,
      y: centre.y,
      radius: radius * 0.4,
      seed: seed + 1,
      ruggedness: 0.1,
      elongation: 0,
    }),
    seed + 2,
    0.5,
  );
  return [outer, inner];
}

/** The map with items added to a layer, in order. */
export function addItems(doc: MapDoc, layerId: string, items: readonly MapItem[]): MapDoc {
  return items.reduce((acc, item) => addItem(acc, layerId, item), doc);
}

/** A footprint turned by `degrees` about its middle. */
export function rotatePoints(points: readonly number[], degrees: number): number[] {
  const c = centroid(points);
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = (points[i] ?? 0) - c.x;
    const y = (points[i + 1] ?? 0) - c.y;
    out.push(Math.round(c.x + x * cos - y * sin), Math.round(c.y + x * sin + y * cos));
  }
  return out;
}

/** How a roof is lit: the sun (see `MapDoc.sun`) and whether the roofs are left off. */
export interface RoofLook {
  hide?: boolean | undefined;
  sun?: { angle: number; strength: number } | undefined;
}

/**
 * Which of the two halves of a roof, split along its ridge, is away from the sun: its centre is
 * the farther one from where the sun is. With no sun set, the old rule (the sun in the west).
 */
export function shadedHalf(
  a: readonly number[],
  b: readonly number[],
  edgeAngle: number,
  sun?: { angle: number },
): 'a' | 'b' {
  if (!sun) return Math.sin(edgeAngle) >= 0 ? 'b' : 'a';
  const centre = (p: readonly number[]) => {
    let x = 0;
    let y = 0;
    const n = p.length / 2;
    for (let i = 0; i + 1 < p.length; i += 2) {
      x += p[i] ?? 0;
      y += p[i + 1] ?? 0;
    }
    return { x: x / n, y: y / n };
  };
  const rad = (sun.angle * Math.PI) / 180;
  const lit = (p: readonly number[]) => {
    const c = centre(p);
    return c.x * Math.cos(rad) + c.y * Math.sin(rad);
  };
  return lit(a) >= lit(b) ? 'b' : 'a';
}
