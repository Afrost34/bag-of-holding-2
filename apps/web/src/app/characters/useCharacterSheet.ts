import type { CharacterDecisions } from '@boh/rules';
import { useEffect, useState } from 'react';
import { dataWorker } from '../data/client';
import type { CharacterView } from '../data/protocol';

/** The rules engine's view of a character (computed in the data worker). */
export function useCharacterSheet(
  decisions: CharacterDecisions | undefined,
  feats: boolean,
): CharacterView | null {
  const [view, setView] = useState<{ for: string; view: CharacterView } | null>(null);
  const key = decisions ? JSON.stringify([decisions, feats]) : '';
  useEffect(() => {
    if (!decisions) return;
    let live = true;
    void dataWorker()
      .character(decisions, { feats })
      .then((v) => {
        if (live) setView({ for: key, view: v });
      });
    return () => {
      live = false;
    };
    // `key` stands for the decisions (their identity changes on every save).
  }, [key]);
  return view?.view ?? null;
}
