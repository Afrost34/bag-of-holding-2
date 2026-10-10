import {
  Brush,
  Castle,
  DoorOpen,
  CloudFog,
  Crosshair,
  Eraser,
  Hand,
  House,
  MapPin,
  MousePointer2,
  PaintRoller,
  Route,
  Ruler,
  Shapes,
  Square,
  Spline,
  Waves,
  Stamp,
  Trees,
  Triangle,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { MapKind, TemplateShape } from '../../app/maps/model';
import type { RoofStyle } from '../../app/maps/cityDoc';
import type { DoorKind } from '../../app/maps/rooms';
import type { PathStyle } from '../../app/maps/shapes';
import type { TerrainId } from '../../app/maps/terrain';

export type Tool =
  | 'select'
  | 'pan'
  | 'stamp'
  | 'pen'
  | 'terrain'
  | 'eraser'
  | 'wall'
  | 'route'
  | 'text'
  | 'measure'
  | 'template'
  | 'pin'
  | 'fog'
  | 'area'
  | 'path'
  | 'scatter'
  | 'district'
  | 'building'
  | 'room'
  | 'door'
  | 'calibrate';

/** The tool bar, in order; calibrate lives in the grid panel. */
export const TOOLS: { id: Tool; label: string; icon: LucideIcon; key: string }[] = [
  { id: 'select', label: 'Select and move', icon: MousePointer2, key: 'v' },
  { id: 'pan', label: 'Pan', icon: Hand, key: 'h' },
  { id: 'stamp', label: 'Stamp', icon: Stamp, key: 's' },
  { id: 'pen', label: 'Brush', icon: Brush, key: 'b' },
  { id: 'terrain', label: 'Terrain brush', icon: PaintRoller, key: 'g' },
  { id: 'eraser', label: 'Eraser', icon: Eraser, key: 'e' },
  { id: 'area', label: 'Terrain shape', icon: Shapes, key: 'a' },
  { id: 'path', label: 'Road or river', icon: Waves, key: 'l' },
  { id: 'scatter', label: 'Scatter', icon: Trees, key: 'x' },
  { id: 'district', label: 'District', icon: Castle, key: 'c' },
  { id: 'building', label: 'Building', icon: House, key: 'q' },
  { id: 'room', label: 'Room', icon: Square, key: 'r' },
  { id: 'door', label: 'Door', icon: DoorOpen, key: 'd' },
  { id: 'wall', label: 'Wall', icon: Spline, key: 'w' },
  { id: 'text', label: 'Text', icon: Type, key: 't' },
  { id: 'measure', label: 'Measure', icon: Ruler, key: 'm' },
  { id: 'template', label: 'Spell template', icon: Triangle, key: 'a' },
  { id: 'pin', label: 'Pin', icon: MapPin, key: 'p' },
  { id: 'route', label: 'Route', icon: Route, key: 'o' },
  { id: 'fog', label: 'Fog', icon: CloudFog, key: 'f' },
];

/** The Creator draws the map; the Viewer uses it (pins, routes, ranges). Both can measure. */
export type MapMode = 'creator' | 'viewer';

const CREATOR_TOOLS = new Set<Tool>([
  'select',
  'pan',
  'stamp',
  'pen',
  'terrain',
  'eraser',
  'area',
  'path',
  'scatter',
  'district',
  'building',
  'room',
  'door',
  'wall',
  'text',
  'measure',
]);
const VIEWER_TOOLS = new Set<Tool>(['pan', 'select', 'pin', 'route', 'measure', 'template', 'fog']);

/** The tools a mode shows, in tool bar order. Routes are for world maps, templates for battle maps. */
export function toolsFor(kind: MapKind, mode: MapMode): typeof TOOLS {
  const set = mode === 'creator' ? CREATOR_TOOLS : VIEWER_TOOLS;
  return TOOLS.filter((t) => {
    if (!set.has(t.id)) return false;
    if (t.id === 'route') return kind === 'world';
    if (t.id === 'template') return kind === 'battle';
    return true;
  });
}

export const CALIBRATE_ICON = Crosshair;

export interface BrushSettings {
  color: string;
  width: number;
  /** 0.1–1. */
  opacity: number;
  /** The terrain brush paints a texture. */
  texture?: TerrainId;
}

/** Tools that have settings in the side panel. */
export const TOOLS_WITH_SETTINGS = new Set<Tool>([
  'stamp',
  'pen',
  'terrain',
  'eraser',
  'template',
  'fog',
  'area',
  'path',
  'scatter',
  'district',
  'building',
  'room',
  'door',
]);

export interface TemplateSettings {
  shape: TemplateShape;
  feet: number;
  color: string;
}

export const PEN_COLORS = ['#111111', '#b91c1c', '#1d4ed8', '#15803d', '#7c3aed', '#ffffff'];

/** The fog tool: lay fog over an area, or cut a hole in it; a rectangle or a polygon. */
export interface FogSettings {
  mode: 'hide' | 'reveal';
  shape: 'rect' | 'polygon';
}

/** The terrain shape tool: what the area is, and how its edge looks. */
export interface AreaSettings {
  texture: TerrainId;
  edge: 'none' | 'ink' | 'shore';
  /** 0 straight corners, 1 fully rounded. */
  smooth: number;
  opacity: number;
}

/** The road and river tool. */
export interface PathSettings {
  style: PathStyle;
  width: number;
  smooth: number;
  /** Rivers widen along their way. */
  taper: boolean;
}

/** A random island or archipelago, placed in the middle of the view. */
export interface IslandRequest {
  /** Mean radius as a fraction of the map's shorter side. */
  size: number;
  ruggedness: number;
  elongation: number;
  count: number;
  seed: number;
}

/** The building tool: a rectangle or an outline, with a roof; or one placed from the library. */
export interface BuildingSettings {
  shape: 'rect' | 'polygon';
  roof: RoofStyle;
  color: string;
  /** A saved building to place with a click, or null to draw. */
  libraryId: string | null;
}

/** The room and door tools. */
export interface RoomSettings {
  shape: 'rect' | 'polygon';
  floor: TerrainId;
  wallStyle: 'stone' | 'cave' | 'wood';
  /** Wall thickness in map pixels. */
  wall: number;
  smooth: number;
  doorKind: DoorKind;
}
