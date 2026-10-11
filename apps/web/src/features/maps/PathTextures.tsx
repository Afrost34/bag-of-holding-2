import { cn } from '@boh/ui';
import { useShowDrawn } from '../../app/maps/artPrefs';
import type { CategoryId } from '../../app/maps/packCategories';
import { AssetGrid } from './AssetGrid';

/** What a path can be drawn with: strips (trails, fences, cliffs) and ground tiles (roads). */
const PATH_CATEGORIES: readonly CategoryId[] = ['paths', 'cliffs', 'terrain', 'floors'];

/**
 * The picture a road, trail, fence or cliff is drawn with: a strip of a pack, or a ground texture
 * laid along the line. "Plain" is the drawn road, offered only with the drawn art.
 */
export function PathTextures({
  value,
  onPick,
}: {
  value: string | undefined;
  onPick: (ref: string | undefined) => void;
}) {
  const drawn = useShowDrawn();
  return (
    <div className="space-y-1.5">
      {drawn && (
        <button
          type="button"
          aria-pressed={value === undefined}
          onClick={() => {
            onPick(undefined);
          }}
          className={cn(
            'w-full rounded-md border-2 px-2 py-1 text-left text-xs',
            value === undefined ? 'border-accent' : 'border-border',
          )}
        >
          Plain (drawn)
        </button>
      )}
      <AssetGrid
        cats={PATH_CATEGORIES}
        label="Path pictures"
        value={value}
        columns={3}
        onPick={(_, ref) => {
          onPick(ref);
        }}
        emptyHint="No path pictures yet. Import an asset pack for trails, cliffs, cobblestone and dirt."
      />
    </div>
  );
}
