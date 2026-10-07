import type { EntitySummary } from '@boh/data5e';
import { linkTargetFor, parseCompendiumRef } from '@boh/journal';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import type { Extension } from '@codemirror/state';
import { drawSelection, EditorView, keymap, placeholder } from '@codemirror/view';
import { linkClicks, livePreview, type LinkContext } from './livePreview';

export interface JournalEditorOptions extends LinkContext {
  /** Every note path, for link completion. */
  notePaths: () => readonly string[];
  /** Compendium entries matching typed text, for link completion. */
  searchCompendium: (query: string, type?: string) => Promise<EntitySummary[]>;
  /** How an entity is written in a link: `creature:Goblin@XMM`. */
  refFor: (entity: EntitySummary) => string;
  typeLabel: (type: string) => string;
  openLink: (inner: string, newTab: boolean) => void;
  openUrl: (url: string) => void;
  onChange: (text: string) => void;
}

/** `[[` starts a link: complete with notes first, then compendium entries. */
function linkCompletion(opts: JournalEditorOptions) {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const before = context.matchBefore(/\[\[[^[\]|#\n]*$/);
    if (!before) return null;
    const query = before.text.slice(2);
    const from = before.from + 2;
    // Swallow a `]]` the editor already closed.
    const after = context.state.sliceDoc(context.pos, context.pos + 2);
    const to = after === ']]' ? context.pos + 2 : context.pos;
    const q = query.toLowerCase();
    const paths = opts.notePaths();
    const notes: Completion[] = paths
      .filter((p) => p.toLowerCase().includes(q))
      .slice(0, 30)
      .map((p) => {
        const target = linkTargetFor(p, paths);
        return {
          label: target,
          detail: p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : 'Note',
          type: 'text',
          boost: 10,
          apply: (view, _c, f) => {
            view.dispatch({
              changes: { from: f, to, insert: `${target}]]` },
              selection: { anchor: f + target.length + 2 },
            });
          },
        };
      });
    // `creature:gob` searches creatures for "gob"; plain text searches everything.
    const typed = /^([a-z]+):(.*)$/i.exec(query);
    const prefix = typed ? parseCompendiumRef(`${typed[1] ?? ''}:x`)?.type : undefined;
    const search = prefix ? (typed?.[2] ?? '') : query;
    const entities: Completion[] =
      search.trim().length >= 2
        ? (await opts.searchCompendium(search, prefix)).slice(0, 15).map((e) => {
            const ref = opts.refFor(e);
            return {
              label: e.name,
              detail: `${opts.typeLabel(e.type)} · ${e.source}`,
              type: 'keyword',
              apply: (view, _c, f) => {
                view.dispatch({
                  changes: { from: f, to, insert: `${ref}]]` },
                  selection: { anchor: f + ref.length + 2 },
                });
              },
            };
          })
        : [];
    return { from, to, options: [...notes, ...entities], filter: false };
  };
}

const theme = EditorView.theme({
  '&': { fontSize: '16px', backgroundColor: 'transparent', color: 'var(--boh-text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-sans)', lineHeight: '1.65' },
  '.cm-content': { padding: '0 0 40vh', caretColor: 'var(--boh-accent)' },
  '.cm-line': { padding: '0 2px' },
  '.cm-cursor': { borderLeftColor: 'var(--boh-accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--boh-accent-soft) !important',
  },
  '.cm-placeholder': { color: 'var(--boh-text-faint)' },
  '.cm-jh1, .cm-jh2, .cm-jh3, .cm-jh4, .cm-jh5, .cm-jh6': {
    fontFamily: 'var(--font-serif)',
    fontWeight: '700',
    lineHeight: '1.3',
  },
  '.cm-jh1': { fontSize: '1.9em', paddingTop: '0.4em' },
  '.cm-jh2': { fontSize: '1.5em', paddingTop: '0.4em' },
  '.cm-jh3': { fontSize: '1.25em', paddingTop: '0.3em' },
  '.cm-jh4': { fontSize: '1.1em' },
  '.cm-jem': { fontStyle: 'italic' },
  '.cm-jstrong': { fontWeight: '700' },
  '.cm-jstrike': { textDecoration: 'line-through' },
  '.cm-jicode': {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.9em',
    backgroundColor: 'var(--boh-sunken)',
    borderRadius: '4px',
    padding: '0 3px',
  },
  '.cm-jcodeblock': {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.9em',
    backgroundColor: 'var(--boh-sunken)',
  },
  '.cm-jquote': {
    borderLeft: '3px solid var(--boh-border-strong)',
    paddingLeft: '12px !important',
    color: 'var(--boh-text-muted)',
  },
  '.cm-jlink': {
    color: 'var(--boh-link)',
    textDecoration: 'none',
    cursor: 'pointer',
    fontWeight: '500',
  },
  '.cm-jlink:hover': { textDecoration: 'underline' },
  '.cm-jlink-compendium': { color: 'var(--boh-accent)' },
  '.cm-jlink-missing': { opacity: '0.6', textDecoration: 'underline dotted' },
  '.cm-jlink-raw': { color: 'var(--boh-link)' },
  '.cm-jtag': {
    color: 'var(--boh-accent)',
    backgroundColor: 'var(--boh-accent-soft)',
    borderRadius: '999px',
    padding: '0 6px',
    fontSize: '0.9em',
  },
  '.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--boh-surface)',
    border: '1px solid var(--boh-border)',
    borderRadius: '8px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--boh-accent-soft)',
    color: 'var(--boh-text)',
  },
  '.cm-completionDetail': {
    color: 'var(--boh-text-faint)',
    marginLeft: '8px',
    fontStyle: 'normal',
  },
});

export function journalExtensions(opts: JournalEditorOptions): Extension[] {
  return [
    history(),
    drawSelection(),
    closeBrackets(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    livePreview(opts),
    linkClicks(opts.openLink, opts.openUrl),
    autocompletion({ override: [linkCompletion(opts)], icons: false }),
    keymap.of([
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    placeholder('Start writing… Type [[ to link a note or a compendium entry.'),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) opts.onChange(update.state.doc.toString());
    }),
    theme,
  ];
}
