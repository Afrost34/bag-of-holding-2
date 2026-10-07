import type { CampaignRules, CharacterDecisions, OptionSummary } from '@boh/rules';
import { useEffect, useState } from 'react';
import { dataWorker } from '../../app/data/client';
import type { CharacterView } from '../../app/data/protocol';

/**
 * The rules engine's view of a character, run again in the data worker whenever its decisions
 * change. The previous view stays on screen while the next one is computed.
 */
export function useCharacterView(
  decisions: CharacterDecisions | undefined,
  rules?: CampaignRules,
): CharacterView | null {
  const [view, setView] = useState<CharacterView | null>(null);
  const key = decisions ? JSON.stringify([decisions, rules]) : '';
  useEffect(() => {
    if (!decisions) return;
    let cancelled = false;
    void dataWorker()
      .character(decisions, rules)
      .then((v) => {
        if (!cancelled) setView(v);
      });
    return () => {
      cancelled = true;
    };
    // `key` stands for decisions and rules: their identity changes on every save.
  }, [key]);
  return view;
}

/** What a choice can be answered with, loaded when `active`. */
export function useChoiceOptions(
  decisions: CharacterDecisions,
  choiceId: string,
  active: boolean,
  rules?: CampaignRules,
): OptionSummary[] | null {
  const [state, setState] = useState<{ for: string; options: OptionSummary[] } | null>(null);
  // Options depend on the character only through earlier picks; refresh when those change.
  const key = `${choiceId}|${JSON.stringify([decisions.classes, decisions.species, decisions.background, rules])}`;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void dataWorker()
      .choiceOptions(decisions, choiceId, rules)
      .then((options) => {
        if (!cancelled) setState({ for: key, options });
      });
    return () => {
      cancelled = true;
    };
  }, [key, active]);
  return state?.for === key ? state.options : null;
}
