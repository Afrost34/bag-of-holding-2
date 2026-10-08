import { useCampaigns } from '../../app/campaigns/store';
import { tableRules, type CharacterFile } from '../../app/characters/model';

/** The advancement and encumbrance rules a character plays by (its campaign's, or its own). */
export function useTableRules(character: Pick<CharacterFile, 'campaign' | 'preferences'>) {
  const campaign = useCampaigns((s) => s.campaigns.find((c) => c.id === character.campaign));
  return tableRules(character, campaign);
}
