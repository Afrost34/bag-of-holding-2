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
 * The campaign's notes that name a stat block, by name: NPCs (`stat_block: "[[creature:Spy@XMM|Spy]]"`)
 * and notes of any kind with a stat block property (a ship's crew, a custom kind). A stat block
 * without a source can't be resolved here and is left out.
 */
export function campaignNpcs(notes: ReadonlyMap<string, string>): CampaignNpc[] {
  const out: CampaignNpc[] = [];
  for (const [note, text] of notes) {
    const data = parseFrontmatter(text).data;
    // `stat_block` first, then any property linking to a creature.
    const values = [data.stat_block, ...Object.values(data)].filter(
      (v): v is string => typeof v === 'string' && v.includes('creature:'),
    );
    const ref = values
      .map((v) => parseCompendiumRef(parseWikiLinks(v)[0]?.target ?? v))
      .find((r) => r?.type === 'monster' && r.source);
    if (!ref?.source) continue;
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
