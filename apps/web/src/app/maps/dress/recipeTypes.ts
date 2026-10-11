import type { GlyphId } from '../glyphs';
import type { DressPlace, DressRule } from '../model';
import type { Wanted } from '../packDefaults';
import type { TerrainRef } from '../terrain';

/** The types of recipes (see `recipes.ts`), shared by the recipe lists. */

export type RecipeGroup =
  'Nature' | 'Edges' | 'Interior' | 'Clutter' | 'Decay' | 'Settlement' | 'Kits' | 'World';

export interface RecipeRule {
  /** Names the rule inside its recipe (`trees`, `undergrowth`): `recipe:key` finds it again. */
  key: string;
  place: DressPlace;
  /** The pack pictures it wants, and how many different ones to mix. */
  want?: Wanted;
  max?: number;
  /** Drawn stand-ins, sized for a 70-pixel square (`glyphSize`, `glyphSpacing`). */
  glyphs?: { id: GlyphId; weight: number }[];
  glyphSize?: [number, number];
  glyphSpacing?: number;
  /** Pack pictures: the gap between them as a multiple of their typical width (0 for interiors). */
  spacing: number;
  /** Interiors: the gap between pieces, in pack squares. */
  gap?: number;
  /** Pack pictures vary their own size between these (as a part of 100). */
  vary?: [number, number];
  rotation?: DressRule['rotation'];
  rotMin?: number;
  rotMax?: number;
  overlap?: number;
  cluster?: number;
  /** Along a line: how far to the side, in pack squares. */
  offset?: number;
  sides?: DressRule['sides'];
  jitter?: number;
  falloff?: number;
  /** Edge: how far in, in pack squares. */
  depth?: number;
  snap?: number;
  flip?: boolean;
  tint?: number;
  apart?: boolean;
  count?: number;
  /** The key of the earlier rule this one relates to (chairs round `tables`). */
  anchor?: string;
  fill?: number;
  loose?: number;
  floor?: boolean;
  beneath?: boolean;
  fit?: boolean;
  turn?: number;
  /** Only on ground this high / this steep (see `DressRule`). */
  height?: [number, number];
  slope?: [number, number];
}

export interface Recipe {
  id: string;
  name: string;
  hint: string;
  group: RecipeGroup;
  mode: 'area' | 'along';
  rules: RecipeRule[];
  onlyOn?: TerrainRef[];
  /** Stand on roads and rivers too (a market spills over the street). */
  overPaths?: boolean;
  /** A room type: offered by "Furnish it as…" (and by the building generator). */
  room?: boolean;
}
