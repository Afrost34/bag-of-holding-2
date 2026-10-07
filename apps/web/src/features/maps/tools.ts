import {
  Brush,
  Crosshair,
  Hand,
  MapPin,
  MousePointer2,
  PaintRoller,
  Ruler,
  Spline,
  Stamp,
  Triangle,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { TemplateShape } from '../../app/maps/model';

export type Tool =
  | 'select'
  | 'pan'
  | 'stamp'
  | 'pen'
  | 'terrain'
  | 'wall'
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
  { id: 'wall', label: 'Wall', icon: Spline, key: 'w' },
  { id: 'text', label: 'Text', icon: Type, key: 't' },
  { id: 'measure', label: 'Measure', icon: Ruler, key: 'm' },
  { id: 'template', label: 'Spell template', icon: Triangle, key: 'a' },
  { id: 'pin', label: 'Pin', icon: MapPin, key: 'p' },
];

export const CALIBRATE_ICON = Crosshair;

export interface BrushSettings {
  color: string;
  width: number;
}

export interface TemplateSettings {
  shape: TemplateShape;
  feet: number;
  color: string;
}

export const TERRAIN_COLORS = [
  { name: 'Grass', color: '#4d7c0f' },
  { name: 'Water', color: '#0369a1' },
  { name: 'Sand', color: '#d6b36a' },
  { name: 'Rock', color: '#57534e' },
  { name: 'Lava', color: '#c2410c' },
  { name: 'Snow', color: '#e7e5e4' },
];

export const PEN_COLORS = ['#111111', '#b91c1c', '#1d4ed8', '#15803d', '#7c3aed', '#ffffff'];
