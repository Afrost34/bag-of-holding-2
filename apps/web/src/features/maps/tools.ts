import {
  Brush,
  Castle,
  DoorOpen,
  CloudFog,
  Crosshair,
  Eraser,
  Hand,
  House,
  Lightbulb,
  Mountain,
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
import type { TemplateShape } from '../../app/maps/model';
import type { RoofStyle } from '../../app/maps/cityDoc';
import type { BrushMode } from '../../app/maps/elevation';
import type { PathEnd } from '../../app/maps/pathEnds';
import type { DoorKind } from '../../app/maps/rooms';
import type { PathStyle } from '../../app/maps/shapes';
import type { TerrainRef } from '../../app/maps/terrain';

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
  | 'elevation'
  | 'light'
  | 'calibrate';

/** The tool bar, in order; calibrate lives in the grid panel. */
export const TOOLS: { id: Tool; label: string; icon: LucideIcon; key: string }[] = [
  { id: 'select', label: 'Select and move', icon: MousePointer2, key: 'v' },
  { id: 'pan', label: 'Pan', icon: Hand, key: 'h' },
  { id: 'stamp', label: 'Stamp', icon: Stamp, key: 'i' },
  { id: 'pen', label: 'Brush', icon: Brush, key: 'b' },
  { id: 'terrain', label: 'Terrain brush', icon: PaintRoller, key: 'u' },
  { id: 'eraser', label: 'Eraser', icon: Eraser, key: 'e' },
  { id: 'area', label: 'Terrain shape', icon: Shapes, key: 'a' },
  { id: 'path', label: 'Road or river', icon: Waves, key: 'l' },
  { id: 'elevation', label: 'Elevation', icon: Mountain, key: 'j' },
  { id: 'scatter', label: 'Scatter', icon: Trees, key: 'x' },
  { id: 'district', label: 'District', icon: Castle, key: 'c' },
  { id: 'building', label: 'Building', icon: House, key: 'q' },
  { id: 'room', label: 'Room', icon: Square, key: 'r' },
  { id: 'door', label: 'Door', icon: DoorOpen, key: 'd' },
  { id: 'wall', label: 'Wall', icon: Spline, key: 'w' },
  { id: 'light', label: 'Light', icon: Lightbulb, key: 'k' },
  { id: 'text', label: 'Text', icon: Type, key: 't' },
  { id: 'measure', label: 'Measure', icon: Ruler, key: 'm' },
  { id: 'template', label: 'Spell template', icon: Triangle, key: 'y' },
  { id: 'pin', label: 'Pin', icon: MapPin, key: 'p' },
  { id: 'route', label: 'Route', icon: Route, key: 'o' },
  { id: 'fog', label: 'Fog', icon: CloudFog, key: 'f' },
];

/** Tools that belong together sit together in the tool bar, under a heading (Dungeondraft's tabs). */
export const TOOL_GROUP: Record<Tool, number> = {
  select: 0,
  pan: 0,
  pen: 1,
  terrain: 1,
  area: 1,
  path: 1,
  elevation: 1,
  eraser: 1,
  district: 2,
  building: 2,
  room: 2,
  door: 2,
  wall: 2,
  stamp: 3,
  scatter: 3,
  light: 4,
  text: 5,
  measure: 5,
  calibrate: 5,
  template: 6,
  pin: 6,
  route: 6,
  fog: 6,
};

/** The heading above each group of the tool bar. */
export const GROUP_LABELS = [
  'Move',
  'Terrain',
  'Design',
  'Objects',
  'Effects',
  'Notes',
  'Play',
] as const;

/** What a tool does and how to use it: shown in the bar under the map. */
export const TOOL_HINTS: Record<Tool, string> = {
  select: 'Click to select, drag to move, drag the handles to change points. Delete removes.',
  pan: 'Drag to move the map; scroll to zoom.',
  stamp: 'Pick a picture in the library, then click to place it. A mirrors, scroll turns.',
  pen: 'Drag to paint with the brush. Alt erases.',
  terrain: 'Drag to paint the ground with the chosen texture.',
  eraser: 'Drag over what you want to take away.',
  area: 'Click to place points; double-click or Enter to close the shape.',
  path: 'Click to place points; double-click or Enter to finish the road or river.',
  elevation: 'Drag to raise or lower the ground.',
  scatter: 'Drag to scatter the chosen pictures along the stroke.',
  light: 'Click to place a light. Drag it to move it.',
  district: 'Click the corners of the district; double-click or Enter to finish.',
  building: 'Click the corners of the building; double-click or Enter to finish.',
  room: 'Click the corners of the room; double-click or Enter to finish.',
  door: 'Click a wall to put a door on it.',
  wall: 'Click to add corners; double-click or Enter to finish the wall.',
  text: 'Click where the text goes.',
  measure: 'Click the start, then the end. Escape clears.',
  calibrate: 'Drag over one grid cell of the picture.',
  template: 'Drag to place a spell template.',
  pin: 'Click to drop a pin.',
  route: 'Click the stops of the route; double-click or Enter to finish.',
  fog: 'Click the corners of an area; double-click or Enter to finish.',
};

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
  'elevation',
  'district',
  'building',
  'room',
  'door',
  'wall',
  'light',
  'text',
  'measure',
]);
const VIEWER_TOOLS = new Set<Tool>(['pan', 'select', 'pin', 'route', 'measure', 'template', 'fog']);

/** The tools a mode shows, in tool bar order. A map has no type: every tool is always there. */
export function toolsFor(mode: MapMode): typeof TOOLS {
  const set = mode === 'creator' ? CREATOR_TOOLS : VIEWER_TOOLS;
  return TOOLS.filter((t) => set.has(t.id));
}

export const CALIBRATE_ICON = Crosshair;

export interface BrushSettings {
  color: string;
  width: number;
  /** 0.1–1. */
  opacity: number;
  /** The terrain brush paints a texture. */
  texture?: TerrainRef;
  /** 0–1: the stroke's edge fades out (the terrain brush). */
  soft?: number;
  /** A dark line round the stroke (the terrain brush). */
  border?: boolean;
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
  'elevation',
  'light',
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
  texture: TerrainRef;
  edge: 'none' | 'ink' | 'shore' | 'dashed';
  /** 0 straight corners, 1 fully rounded. */
  smooth: number;
  opacity: number;
}

/** The light tool: what the next light is like. */
export interface LightSettings {
  /** Range in grid squares. */
  squares: number;
  color: string;
  intensity: number;
  shadows: boolean;
}

/** The road and river tool. */
export interface PathSettings {
  style: PathStyle;
  width: number;
  smooth: number;
  /** Rivers widen along their way. */
  taper: boolean;
  start: PathEnd;
  end: PathEnd;
  /** The last point joins the first. */
  loop: boolean;
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
  floor: TerrainRef;
  wallStyle: 'stone' | 'cave' | 'wood';
  /** Wall thickness in map pixels. */
  wall: number;
  smooth: number;
  doorKind: DoorKind;
  /** A pack's wall strip for walls and room walls; absent: the drawn style. */
  wallTexture?: string;
}

/** The elevation brush: what it does, how wide, how hard. */
export interface ElevationBrush {
  mode: BrushMode;
  radius: number;
  strength: number;
}
