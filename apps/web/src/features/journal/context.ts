import type { NoteInfo, NoteType, PropertyValue } from '@boh/journal';
import { createContext, useContext, type ComponentType } from 'react';
import type { CampaignEdition } from '../../app/campaigns/model';
import type { Embed } from './editor/livePreview';

/** What a new note is made from (a name is asked for first). */
export interface NewNoteSpec {
  name: string;
  /** A built-in kind: its fields, sections and folder. */
  type?: NoteType | undefined;
  /** Properties to set (from a base's filters, e.g. `location: [[Rustcrown]]`). */
  properties?: Record<string, PropertyValue>;
}

/**
 * What the journal's views (editor, previews, embeds, bases) need to know about the open journal
 * and how to act on it. Provided by `JournalPage`.
 */
export interface JournalView {
  campaignId: string;
  edition: CampaignEdition;
  notes: ReadonlyMap<string, string>;
  attachments: readonly string[];
  /** `.base` files → YAML. */
  bases: ReadonlyMap<string, string>;
  /** Every note as bases see it (properties, tags, links). */
  noteInfos: readonly NoteInfo[];
  /** The open note: links resolve relative to it. */
  notePath: string | undefined;
  /** The note or file a link target leads to, from a given note. */
  resolve: (target: string, from: string) => string | null;
  isResolved: (target: string) => boolean;
  openLink: (inner: string, newTab: boolean) => void;
  openPath: (path: string, newTab: boolean) => void;
  openUrl: (url: string) => void;
  openTag: (tag: string) => void;
  /** Creates a note and opens it. */
  createNote: (spec: NewNoteSpec) => Promise<void>;
  /** Draws embeds (passed in, so viewers and embeds need not import each other). */
  Embed: ComponentType<{ embed: Embed }>;
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
