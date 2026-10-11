/** Types and styles shared by the map maker's side panels. */
import type { Point } from '../../app/maps/geometry';
import type { ShapeChoice } from '../../app/maps/outline';
import { type MapDoc, type MapItem } from '../../app/maps/model';
import type { Prefab } from '../../app/maps/prefabs';
import type { TerrainRef } from '../../app/maps/terrain';
import { type DistrictSettings } from '../../app/maps/cityDoc';
import { type DressSettings } from '../../app/maps/scatterDoc';
import {
  type BrushSettings,
  type BuildingSettings,
  type KitSettings,
  type ElevationBrush,
  type AreaSettings,
  type FogSettings,
  type IslandRequest,
  type LightSettings,
  type PathSettings,
  type RoomSettings,
  type MapMode,
  type TemplateSettings,
  type Tool,
} from './tools';

export type Tab = 'stamps' | 'layers' | 'pins' | 'grid';

export interface MapPanelsProps {
  mode: MapMode;
  doc: MapDoc;
  open: boolean;
  onClose: () => void;
  commit: (change: (d: MapDoc) => MapDoc) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  selected: MapItem | null;
  /** Every picked item (the one in `selected` and those added with Shift). */
  selectedIds: string[];
  onDeselect: () => void;
  layerId: string;
  setLayerId: (id: string) => void;
  /** The variant being compared with (its layers show faintly), if any. */
  compare: string | undefined;
  setCompare: (id: string | undefined) => void;
  stamp: string | null;
  /** `squares`: the stamp's own size in grid squares, when its name says it. */
  setStamp: (path: string, aspect: number, squares?: { w: number; h: number }) => void;
  brush: BrushSettings;
  setBrush: (b: BrushSettings) => void;
  terrain: BrushSettings;
  setTerrain: (b: BrushSettings) => void;
  /** The textures used last (eight), as slots to pick from. */
  terrainSlots: string[];
  /** The eraser's width, in map pixels. */
  eraser: number;
  setEraser: (w: number) => void;
  template: TemplateSettings;
  setTemplate: (t: TemplateSettings) => void;
  fog: FogSettings;
  setFog: (f: FogSettings) => void;
  light: LightSettings;
  setLight: (l: LightSettings) => void;
  elev: ElevationBrush;
  setElev: (b: ElevationBrush) => void;
  roomSet: RoomSettings;
  setRoomSet: (s: RoomSettings) => void;
  /** A dungeon of this many rooms, filling the view. */
  /** A live dungeon of a dungeon archetype (rooms and corridors, packed, facility, caves). */
  onGenerateDungeon: (rooms: number, archetype: string) => void;
  /** A cave in the middle of the view. */
  onGenerateCave: () => void;
  district: DistrictSettings;
  setDistrict: (s: DistrictSettings) => void;
  buildingSet: BuildingSettings;
  /** The walkway tool: which kit it lays. */
  kitSet: KitSettings;
  setKitSet: (s: KitSettings) => void;
  setBuildingSet: (s: BuildingSettings) => void;
  /** A walled town with a market quarter, in the middle of the view. */
  onGenerateTown: () => void;
  scatter: DressSettings;
  setScatter: (s: DressSettings) => void;
  /** Draw an area to cut out of the picked shape (a lake in a forest). */
  onCutHole: (shapeId: string) => void;
  /** Scatter inside the picked shape, or along the picked path. */
  onScatterOn: (item: MapItem) => void;
  /** Scatter with a set of pack pictures: the Scatter tool takes them as its mix. */
  onScatterMix: (refs: string[]) => void;
  /** Place a saved prefab in the middle of the view. */
  onPlacePrefab: (prefab: Prefab) => void;
  /** Furnish a room as a tavern, a storeroom… */
  onFurnish: (roomId: string, preset: string) => void;
  area: AreaSettings;
  setArea: (a: AreaSettings) => void;
  pathSet: PathSettings;
  setPathSet: (p: PathSettings) => void;
  /** Islands to drop in the middle of the view. */
  onGenerate: (request: IslandRequest) => void;
  /** Covers the whole map with the chosen terrain, under everything on the layer. */
  onFillMap: (texture?: TerrainRef) => void;
  snap: boolean;
  setSnap: (s: boolean) => void;
  /** How the current tool draws a closed area: clicked corners, or dragged out as a preset shape. */
  draw: ShapeChoice;
  setDraw: (c: ShapeChoice) => void;
  /** Starts measuring from a point (a pin's "Measure from here"). */
  onMeasureFrom?: (p: Point) => void;
}

export const field =
  'w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none';
