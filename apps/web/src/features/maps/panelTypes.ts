/** Types and styles shared by the map maker's side panels. */
import type { Point } from '../../app/maps/geometry';
import { type MapDoc, type MapItem } from '../../app/maps/model';
import { type BrushSettings, type TemplateSettings, type Tool } from './tools';

export type Tab = 'stamps' | 'layers' | 'pins' | 'grid' | 'item';

export interface MapPanelsProps {
  doc: MapDoc;
  open: boolean;
  onClose: () => void;
  commit: (change: (d: MapDoc) => MapDoc) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  selected: MapItem | null;
  onDeselect: () => void;
  layerId: string;
  setLayerId: (id: string) => void;
  stamp: string | null;
  setStamp: (path: string, aspect: number) => void;
  brush: BrushSettings;
  setBrush: (b: BrushSettings) => void;
  terrain: BrushSettings;
  setTerrain: (b: BrushSettings) => void;
  /** The eraser's width, in map pixels. */
  eraser: number;
  setEraser: (w: number) => void;
  template: TemplateSettings;
  setTemplate: (t: TemplateSettings) => void;
  snap: boolean;
  setSnap: (s: boolean) => void;
  /** Starts measuring from a point (a pin's "Measure from here"). */
  onMeasureFrom?: (p: Point) => void;
}

export const field =
  'w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none';
