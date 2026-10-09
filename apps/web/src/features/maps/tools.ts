import {
  Brush,
  Crosshair,
  Eraser,
  Hand,
  MapPin,
  MousePointer2,
  PaintRoller,
  Route,
  Ruler,
  Spline,
  Stamp,
  Triangle,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { MapKind, TemplateShape } from '../../app/maps/model';
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
  | 'calibrate';

/** The tool bar, in order; calibrate lives in the grid panel. */
export const TOOLS: { id: Tool; label: string; icon: LucideIcon; key: string }[] = [
  { id: 'select', label: 'Select and move', icon: MousePointer2, key: 'v' },
  { id: 'pan', label: 'Pan', icon: Hand, key: 'h' },
  { id: 'stamp', label: 'Stamp', icon: Stamp, key: 's' },
  { id: 'pen', label: 'Brush', icon: Brush, key: 'b' },
  { id: 'terrain', label: 'Terrain brush', icon: PaintRoller, key: 'g' },
  { id: 'eraser', label: 'Eraser', icon: Eraser, key: 'e' },
  { id: 'wall', label: 'Wall', icon: Spline, key: 'w' },
  { id: 'text', label: 'Text', icon: Type, key: 't' },
  { id: 'measure', label: 'Measure', icon: Ruler, key: 'm' },
  { id: 'template', label: 'Spell template', icon: Triangle, key: 'a' },
  { id: 'pin', label: 'Pin', icon: MapPin, key: 'p' },
  { id: 'route', label: 'Route', icon: Route, key: 'o' },
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
  'wall',
  'text',
  'measure',
]);
const VIEWER_TOOLS = new Set<Tool>(['pan', 'select', 'pin', 'route', 'measure', 'template']);

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
export const TOOLS_WITH_SETTINGS = new Set<Tool>(['stamp', 'pen', 'terrain', 'eraser', 'template']);

export interface TemplateSettings {
  shape: TemplateShape;
  feet: number;
  color: string;
}

export const PEN_COLORS = ['#111111', '#b91c1c', '#1d4ed8', '#15803d', '#7c3aed', '#ffffff'];
