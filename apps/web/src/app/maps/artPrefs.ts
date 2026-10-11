import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { usePacks } from './packs';

/**
 * Per-device choice: also offer the simple art drawn in code (flat terrains, glyph trees, drawn
 * walls). Off by default: with asset packs imported every tool works from the packs. With no pack
 * imported yet the drawn art is shown anyway, so a new map is never empty.
 */
export const useArtPrefs = create<{ drawnArt: boolean; setDrawnArt: (on: boolean) => void }>()(
  persist(
    (set) => ({
      drawnArt: false,
      setDrawnArt: (drawnArt) => {
        set({ drawnArt });
      },
    }),
    { name: 'boh.map-art', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Whether the tools list the drawn art: the switch is on, or no pack is imported. */
export function useShowDrawn(): boolean {
  const drawn = useArtPrefs((s) => s.drawnArt);
  const { entries, loaded, load } = usePacks();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  return drawn || (loaded && entries.length === 0);
}

/** Per-device: how large the previews of the asset lists are (pixels, the tile's height). */
export const MIN_TILE = 40;
export const MAX_TILE = 220;
export const useAssetPrefs = create<{ tile: number; setTile: (px: number) => void }>()(
  persist(
    (set) => ({
      tile: 64,
      setTile: (px) => {
        set({ tile: Math.min(MAX_TILE, Math.max(MIN_TILE, Math.round(px))) });
      },
    }),
    { name: 'boh.map-asset-tile', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
