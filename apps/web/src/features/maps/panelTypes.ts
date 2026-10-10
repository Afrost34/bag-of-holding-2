/** Types and styles shared by the map maker's side panels. */
import type { Point } from '../../app/maps/geometry';
import { type MapDoc, type MapItem } from '../../app/maps/model';
import { type DistrictSettings } from '../../app/maps/cityDoc';
import { type ScatterSettings } from '../../app/maps/scatterDoc';
import {
  type BrushSettings,
  type BuildingSettings,
  type AreaSettings,
  type FogSettings,
  type IslandRequest,
  type PathSettings,
  type RoomSettings,
  type MapMode,
  type TemplateSettings,
  type Tool,
} from './tools';

export type Tab = 'stamps' | 'layers' | 'pins' | 'grid' | 'item';

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
  stamp: string | null;
  /** `squares`: the stamp's own size in grid squares, when its name says it. */
  setStamp: (path: string, aspect: number, squares?: { w: number; h: number }) => void;
  brush: BrushSettings;
  setBrush: (b: BrushSettings) => void;
  terrain: BrushSettings;
  setTerrain: (b: BrushSettings) => void;
  /** The eraser's width, in map pixels. */
  eraser: number;
  setEraser: (w: number) => void;
  template: TemplateSettings;
  setTemplate: (t: TemplateSettings) => void;
  fog: FogSettings;
  setFog: (f: FogSettings) => void;
  roomSet: RoomSettings;
  setRoomSet: (s: RoomSettings) => void;
  /** A dungeon of this many rooms, filling the view. */
  onGenerateDungeon: (rooms: number) => void;
  /** A cave in the middle of the view. */
  onGenerateCave: () => void;
  district: DistrictSettings;
  setDistrict: (s: DistrictSettings) => void;
  buildingSet: BuildingSettings;
  setBuildingSet: (s: BuildingSettings) => void;
  /** A walled town with a market quarter, in the middle of the view. */
  onGenerateTown: () => void;
  scatter: ScatterSettings;
  setScatter: (s: ScatterSettings) => void;
  /** Scatter inside the picked shape, or along the picked path. */
  onScatterOn: (item: MapItem) => void;
  area: AreaSettings;
  setArea: (a: AreaSettings) => void;
  pathSet: PathSettings;
  setPathSet: (p: PathSettings) => void;
  /** Islands to drop in the middle of the view. */
  onGenerate: (request: IslandRequest) => void;
  /** Covers the whole map with the chosen terrain, under everything on the layer. */
  onFillMap: () => void;
  snap: boolean;
  setSnap: (s: boolean) => void;
  /** Starts measuring from a point (a pin's "Measure from here"). */
  onMeasureFrom?: (p: Point) => void;
}

export const field =
  'w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none';
