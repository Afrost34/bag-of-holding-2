import { makeKey } from '@boh/data5e';
import { parseCompendiumRef, parseFrontmatter, parseWikiLinks, prettyName } from '@boh/journal';
import { useEffect, useMemo } from 'react';
import { useJournal } from '../journal/store';

/** A campaign NPC that can be added to an encounter: its note, name and stat block. */
export interface CampaignNpc {
  note: string;
  name: string;
  statBlock: string;
}

/**
 * The campaign's NPCs that name a stat block (`stat_block: "[[creature:Spy@XMM|Spy]]"`), by name.
 * A stat block without a source can't be resolved here and is left out.
 */
export function campaignNpcs(notes: ReadonlyMap<string, string>): CampaignNpc[] {
  const out: CampaignNpc[] = [];
  for (const [note, text] of notes) {
    const data = parseFrontmatter(text).data;
    if (data.type !== 'npc' || typeof data.stat_block !== 'string') continue;
    const target = parseWikiLinks(data.stat_block)[0]?.target ?? data.stat_block;
    const ref = parseCompendiumRef(target);
    if (ref?.type !== 'monster' || !ref.source) continue;
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null;
    out.push({
      note,
      name: title ?? prettyName(note),
      statBlock: makeKey('monster', [ref.name], ref.source),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** The NPCs of a campaign, read from its journal (loaded when needed). */
export function useCampaignNpcs(campaignId: string | undefined): CampaignNpc[] {
  const journal = useJournal();
  useEffect(() => {
    if (campaignId && journal.campaignId !== campaignId) void journal.load(campaignId);
  }, [campaignId, journal]);
  const notes = journal.campaignId === campaignId ? journal.notes : null;
  return useMemo(() => (notes ? campaignNpcs(notes) : []), [notes]);
}
