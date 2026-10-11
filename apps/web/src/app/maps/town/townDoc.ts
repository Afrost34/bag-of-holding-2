import { newId } from '../../cards/model';
import { districtGeo, districtHoles, districtOutline, type DistrictItem } from '../cityDoc';
import { recipeById, type RecipeOptions } from '../dress/recipes';
import { settingsFor } from '../dress/settings';
import type { BuildingSpec, Layer, MapDoc, MapItem, Variant } from '../model';
import { pickOne, type Wanted } from '../packDefaults';
import type { PackEntry } from '../packModel';
import { makeScatter } from '../scatterDoc';
import { hash01 } from '../city';
import { centroid } from '../polyclip';
import { pointInPolygon } from '../polygon';
import { floorName, newBuildingSpec } from '../structure/structureDoc';
import type { TerrainRef } from '../terrain';
import { townLookById } from './looks';
import { planTown, type TownLot } from './townplan';

/**
 * A district turned into a town of whole buildings (`planTown`): every building with its floors,
 * rooms and furniture, the streets paved and dressed, the square paved with a market in it. The
 * town's buildings share a layer per level ("Ground floor", "Floor 2", "Cellars") and a variant
 * per level, so a town of sixty buildings is a handful of layers. The lots built are taken out of
 * the district, which keeps its wall and any lot too small to build on (drawn as a roof). Pure.
 */

type Entries = readonly Pick<PackEntry, 'path' | 'pack' | 'cat'>[];

export interface TownSettings {
  /** The look (`looks.ts`). */
  look: string;
  /** Most buildings made. */
  max: number;
  /** Pave the streets and the square. */
  pave: boolean;
  /** Crates, carts and litter in the streets, a market on the square. */
  dress: boolean;
  seed: number;
}

export const DEFAULT_TOWN: Omit<TownSettings, 'seed'> = {
  look: 'temperate',
  max: 40,
  pave: true,
  dress: true,
};

/** Timber and shacks lean a little. */
const CROOKED: Record<string, number> = { timber: 0.18, shack: 0.35, arctic: 0.15 };

const allItems = (doc: MapDoc): MapItem[] => doc.layers.flatMap((l) => l.items);

/** The first texture any of the queries finds (a pack ref). */
function firstOf(entries: Entries, wanted: readonly Wanted[]): TerrainRef | undefined {
  for (const w of wanted) {
    const e = pickOne(entries, w);
    if (e) return `pack:${e.pack}:${e.path}`;
  }
  return undefined;
}

/** A circle as an outline of points. */
function circle(x: number, y: number, r: number, n = 32): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    out.push(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r));
  }
  return out;
}

/** The levels a town has, lowest first: -1 cellars, 0 the ground floor, 1… the floors above. */
const levelsOf = (lots: readonly TownLot[]): number[] => {
  const top = Math.max(0, ...lots.map((l) => l.upper));
  return [
    ...(lots.some((l) => l.cellar) ? [-1] : []),
    ...Array.from({ length: top + 1 }, (_, k) => k),
  ];
};

const levelName = (level: number) => (level < 0 ? 'Cellars' : floorName(level));

/**
 * The districts of the town a picked district belongs to: itself, the districts inside it (a
 * walled town's market quarter) and the ones it is inside.
 */
export function townDistricts(doc: MapDoc, id: string): string[] {
  const all = allItems(doc).filter((i): i is DistrictItem => i.kind === 'district');
  const picked = all.find((d) => d.id === id);
  if (!picked) return [];
  const outline = districtOutline(picked);
  const middle = (d: DistrictItem) => centroid(districtOutline(d));
  return [
    picked.id,
    ...all
      .filter(
        (d) =>
          d !== picked &&
          (pointInPolygon(middle(d), outline) ||
            pointInPolygon(middle(picked), districtOutline(d))),
      )
      .map((d) => d.id),
  ];
}

/**
 * The town built on a district: its buildings, streets and square. Returns the map, how many
 * buildings were made and the ground floor's layer (to show), or null when nothing could be
 * built (no lot big enough on this map's grid).
 */
export function buildTown(
  doc: MapDoc,
  districtIds: readonly string[],
  settings: TownSettings,
  entries: Entries,
  options: RecipeOptions,
): { doc: MapDoc; count: number; layer: string } | null {
  const districts = districtIds.flatMap((id) =>
    allItems(doc).filter((i): i is DistrictItem => i.kind === 'district' && i.id === id),
  );
  const first = districts[0];
  if (!first) return null;
  const look = townLookById(settings.look);
  const cell = doc.grid.size;
  // Each district's lots, then the town's nearest its middle up to the most asked for.
  const parts = districts.map((district, k) => {
    const geo = districtGeo(doc, district);
    const outline = districtOutline(district);
    const lots = planTown(geo, outline, {
      look,
      district: district.style,
      seed: settings.seed + k * 7919,
      cell,
      max: settings.max,
    });
    return { district, geo, outline, lots };
  });
  const lots = parts
    .flatMap((p) => p.lots)
    .sort((a, b) => a.ring - b.ring)
    .slice(0, Math.max(0, settings.max));
  if (lots.length === 0) return null;
  const kept = new Set(lots);

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

  // One spec per archetype and style (its pictures and furniture picked once), then each
  // building its own rooms, floors, wear and door.
  const wall = Math.max(8, Math.round(cell * 0.32));
  const templates = new Map<string, BuildingSpec>();
  const specOf = (lot: TownLot, n: number): BuildingSpec => {
    const key = `${lot.archetype}|${lot.style}`;
    let template = templates.get(key);
    if (!template) {
      template = newBuildingSpec(
        {
          archetype: lot.archetype,
          style: lot.style,
          upper: 0,
          cellar: false,
          rooms: lot.rooms,
          windows: true,
          crooked: CROOKED[lot.style] ?? 0,
        },
        entries,
        0,
        wall,
        options,
      );
      templates.set(key, template);
    }
    return {
      ...template,
      name: lot.name,
      seed: Math.floor(hash01(settings.seed, n, 17) * 2 ** 31),
      upper: lot.upper,
      cellar: lot.cellar,
      rooms: lot.rooms,
      dressing: lot.dressing,
      condition: template.condition === 'ruined' ? 'ruined' : lot.condition,
      facing: lot.facing,
      stairsAtWall: true,
    };
  };

  const town = first.style === 'noble' ? 'Noble quarter' : 'Town';
  const levels = levelsOf(lots);
  const layerOf = new Map<number, Layer>();
  const streets: Layer = {
    id: fresh(),
    name: `${town} – Streets`,
    visible: true,
    locked: false,
    items: [],
  };
  for (const level of levels)
    layerOf.set(level, {
      id: fresh(),
      name: `${town} – ${levelName(level)}`,
      visible: level === 0,
      locked: false,
      items: [],
    });

  lots.forEach((lot, n) => {
    const spec = specOf(lot, n);
    const group = fresh();
    const floors = [
      ...(lot.cellar ? [-1] : []),
      0,
      ...Array.from({ length: lot.upper }, (_, k) => k + 1),
    ];
    for (const floor of floors)
      layerOf.get(floor)?.items.push({
        kind: 'structure',
        id: fresh(),
        points: lot.footprint,
        group,
        floor,
        spec,
      });
  });

  // Each district's streets: the district less its blocks, paved; its square paved apart. Street
  // life over the paving, a market on the square.
  const streetTexture: TerrainRef = firstOf(entries, look.street) ?? look.drawn.street;
  const squareTexture: TerrainRef = firstOf(entries, look.square) ?? look.drawn.square;
  const groundLayer = layerOf.get(0);
  const life = recipeById('streets');
  const market = recipeById('market');
  const built = new Map<string, string[]>();
  parts.forEach(({ district, geo, outline, lots: own }, k) => {
    built.set(
      district.id,
      own.filter((l) => kept.has(l)).flatMap((l) => l.keys),
    );
    if (!settings.pave) return;
    const streetId = fresh();
    streets.items.push({
      kind: 'shape',
      id: streetId,
      points: outline.map(Math.round),
      smooth: 0,
      texture: streetTexture,
      color: '#9a958d',
      opacity: 1,
      edge: 'none',
      holes: [...geo.blocks, ...districtHoles(district)].map((h) => h.map(Math.round)),
    });
    const squareId = fresh();
    if (geo.plaza)
      streets.items.push({
        kind: 'shape',
        id: squareId,
        points: circle(geo.plaza.x, geo.plaza.y, geo.plaza.r),
        smooth: 0,
        texture: squareTexture,
        color: '#a9a49b',
        opacity: 1,
        edge: 'none',
      });
    if (!settings.dress || !groundLayer) return;
    if (life)
      groundLayer.items.push(
        makeScatter(
          fresh(),
          settingsFor(life, entries, options),
          { points: [], within: streetId },
          settings.seed + 11 + k,
        ),
      );
    if (market && geo.plaza)
      groundLayer.items.push(
        makeScatter(
          fresh(),
          settingsFor(market, entries, options),
          { points: [], within: squareId },
          settings.seed + 13 + k,
        ),
      );
  });

  // The lots built are the town's now; each district keeps its wall and the lots left.
  const before = doc.layers.map((l) => l.id);
  const newLayers = [streets, ...levels.map((l) => layerOf.get(l)).filter((l): l is Layer => !!l)];
  let out: MapDoc = {
    ...doc,
    layers: [
      ...doc.layers.map((l) => ({
        ...l,
        items: l.items.map((i) => {
          const keys = i.kind === 'district' ? built.get(i.id) : undefined;
          return i.kind === 'district' && keys
            ? { ...i, removed: [...new Set([...(i.removed ?? []), ...keys])] }
            : i;
        }),
      })),
      ...newLayers,
    ],
  };

  // A variant per level: the map's layers, the streets, the ground floor (houses of one floor
  // keep their roofs) and that level; the cellars alone below the streets.
  const groundId = layerOf.get(0)?.id ?? '';
  const variants: Variant[] = levels.map((level) => {
    const own = layerOf.get(level)?.id ?? '';
    return {
      id: fresh(),
      name: `${town}: ${levelName(level)}`,
      layers: {
        ...Object.fromEntries(before.map((id) => [id, true])),
        ...Object.fromEntries(
          newLayers.map((l) => [
            l.id,
            l.id === own || (level >= 0 && (l.id === streets.id || l.id === groundId)),
          ]),
        ),
      },
      items: {},
    };
  });
  const older = (out.variants ?? []).map((v) => ({
    ...v,
    layers: {
      ...v.layers,
      ...Object.fromEntries(newLayers.map((l) => [l.id, l.id === groundId || l.id === streets.id])),
    },
  }));
  const groundVariant = variants[levels.indexOf(0)];
  out = {
    ...out,
    variants: [...older, ...variants],
    ...(groundVariant ? { activeVariant: groundVariant.id } : {}),
  };
  return { doc: out, count: lots.length, layer: groundId };
}
