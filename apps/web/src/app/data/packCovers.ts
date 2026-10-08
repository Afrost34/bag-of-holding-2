import { packCover, packMeta } from '@boh/data5e';
import { useEffect, useMemo } from 'react';
import { useHomebrew } from './homebrew';

/** Homebrew packs' covers (data URLs), by lowercased source id: their books' covers too. */
export function usePackCovers(): Map<string, string> {
  const { packs, loaded, load } = useHomebrew();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  return useMemo(() => {
    const covers = new Map<string, string>();
    for (const p of packs) {
      const id = packMeta(p.json)?.id;
      const cover = packCover(p.json);
      if (id && cover) covers.set(id.toLowerCase(), cover);
    }
    return covers;
  }, [packs]);
}
