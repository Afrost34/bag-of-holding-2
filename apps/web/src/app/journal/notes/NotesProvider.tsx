import {
  isAttachment,
  noteTags,
  parseCompendiumRef,
  parseFrontmatter,
  parseLinkInner,
  parseWikiLinks,
  resolveLinkPath,
} from '@boh/journal';
import { useEffect, useMemo, type ReactNode } from 'react';
import type { CampaignEdition } from '../../campaigns/model';
import { entityPath } from '../../data/entities';
import { resolveCompendiumRef } from '../../journal/compendium';
import { JournalViewContext, type JournalView } from './context';
import { EmbedContent } from './JournalEmbed';
import { journalPath } from '../../journal/paths';
import { useJournal } from '../../journal/store';
import { useAppNavigate } from '../../navigation';

/**
 * Lets note cards (and the player window) show a campaign's journal notes, read-only: links open
 * in the journal or the compendium.
 */
export function NotesProvider({
  campaign,
  children,
}: {
  campaign: { id: string; edition: CampaignEdition } | undefined;
  children: ReactNode;
}) {
  const journal = useJournal();
  const navigate = useAppNavigate();
  useEffect(() => {
    if (campaign && journal.campaignId !== campaign.id) void journal.load(campaign.id);
  }, [campaign, journal]);

  const paths = useMemo(() => [...journal.notes.keys()].sort(), [journal.notes]);
  const noteInfos = useMemo(
    () =>
      [...journal.notes].map(([path, t]) => ({
        path,
        properties: parseFrontmatter(t).data,
        tags: noteTags(t),
        links: parseWikiLinks(t).map((l) => l.target),
      })),
    [journal.notes],
  );

  const view = useMemo<JournalView | null>(() => {
    if (!campaign) return null;
    const attachments = journal.attachments;
    const openLink = async (inner: string, newTab: boolean) => {
      const link = parseLinkInner(inner);
      const ref = parseCompendiumRef(link.target);
      if (ref) {
        const key = await resolveCompendiumRef(ref, campaign.edition);
        if (key) navigate(entityPath(key), { newTab });
        return;
      }
      if (isAttachment(link.target)) return;
      const path = resolveLinkPath(link.target, paths, undefined);
      if (path) navigate(journalPath(path), { newTab });
    };
    return {
      campaignId: campaign.id,
      edition: campaign.edition,
      notes: journal.notes,
      attachments,
      bases: journal.bases,
      noteInfos,
      notePath: undefined,
      resolve: (target, from) =>
        resolveLinkPath(target, isAttachment(target) ? attachments : paths, from),
      isResolved: (target) => resolveLinkPath(target, paths, undefined) !== null,
      openLink: (inner, newTab) => void openLink(inner, newTab),
      openPath: (path, newTab) => {
        navigate(journalPath(path), { newTab });
      },
      openUrl: (url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
      },
      openTag: () => undefined,
      createNote: () => Promise.resolve(),
      startNote: () => undefined,
      Embed: EmbedContent,
    };
  }, [campaign, journal.notes, journal.attachments, journal.bases, noteInfos, paths, navigate]);

  return view ? (
    <JournalViewContext.Provider value={view}>{children}</JournalViewContext.Provider>
  ) : (
    children
  );
}
