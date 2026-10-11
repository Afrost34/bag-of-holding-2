import { GROUND_CATEGORIES, type CategoryId } from '../../app/maps/packCategories';
import type { TerrainRef } from '../../app/maps/terrain';
import { AssetGrid } from './AssetGrid';

/**
 * The textures of the imported asset packs (grass, cobblestone, wooden floors, roofs…) as a grid of
 * previews with a search. Empty, with a hint, until a pack is imported.
 */
export function PackTextures({
  value,
  onPick,
  cats = GROUND_CATEGORIES,
}: {
  value: TerrainRef | undefined;
  onPick: (ref: TerrainRef) => void;
  cats?: readonly CategoryId[];
}) {
  return (
    <AssetGrid
      cats={cats}
      label="Pack textures"
      value={value}
      onPick={(_, ref) => {
        onPick(ref as TerrainRef);
      }}
      emptyHint="No textures yet. Import an asset pack (Assets) to paint with its grass, stone and wood."
    />
  );
}
