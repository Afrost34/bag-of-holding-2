import type { Edition } from './editions';
import type { RawEntity } from './identity';

/** Where an entity comes from: the 5etools release, or a homebrew pack. */
export type Layer = '5etools' | 'homebrew';

export interface EntitySummary {
  key: string;
  type: string;
  name: string;
  source: string;
  edition: Edition;
  page: number | null;
  layer: Layer;
}

export interface EntityDetail extends EntitySummary {
  /** Resolved JSON (after `_copy`). */
  data: RawEntity;
}
