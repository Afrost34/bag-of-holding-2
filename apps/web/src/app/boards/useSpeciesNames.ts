import { useEffect, useState } from 'react';
import { loadRows } from '../data/lists';
import { NPC_SPECIES } from './npc';

let cached: string[] | null = null;

/**
 * The species of the character builder (homebrew ones too), by name, for the NPC and name
 * generators; the built-in few until the compendium is loaded (or when there is none).
 */
export function useSpeciesNames(): readonly string[] {
  const [names, setNames] = useState<readonly string[]>(cached ?? NPC_SPECIES);
  useEffect(() => {
    if (cached) return;
    let live = true;
    void loadRows('species')
      .then((rows) => {
        const list = [...new Set(rows.filter((r) => !r.legacy).map((r) => r.name))].sort((a, b) =>
          a.localeCompare(b, 'en'),
        );
        if (list.length === 0) return;
        cached = list;
        if (live) setNames(list);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return names;
}
