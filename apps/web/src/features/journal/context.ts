import { createContext, useContext, type ComponentType } from 'react';
import type { CampaignEdition } from '../../app/campaigns/model';

/**
 * What the journal's views (editor, previews, embeds) need to know about the open journal and
 * how to act on it. Provided by `JournalPage`.
 */
export interface JournalView {
  campaignId: string;
  edition: CampaignEdition;
  notes: ReadonlyMap<string, string>;
  attachments: readonly string[];
  /** The open note: links resolve relative to it. */
  notePath: string | undefined;
  isResolved: (target: string) => boolean;
  openLink: (inner: string, newTab: boolean) => void;
  openUrl: (url: string) => void;
  openTag: (tag: string) => void;
  /** Draws `![[embeds]]` (passed in, so viewers and embeds need not import each other). */
  Embed: ComponentType<{ inner: string }>;
}

export const JournalViewContext = createContext<JournalView | null>(null);

export function useJournalView(): JournalView {
  const view = useContext(JournalViewContext);
  if (!view) throw new Error('useJournalView outside JournalViewContext');
  return view;
}

/** How deep in embeds we are: a note embedding a note embedding… stops after a few levels. */
export const EmbedDepthContext = createContext(0);
export const MAX_EMBED_DEPTH = 2;
