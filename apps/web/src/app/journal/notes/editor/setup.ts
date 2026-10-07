import type { EntitySummary } from '@boh/data5e';
import { isAttachment, linkTargetFor, parseCompendiumRef } from '@boh/journal';
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
import { EditorState, type Extension } from '@codemirror/state';
import { drawSelection, EditorView, keymap, placeholder } from '@codemirror/view';
import { DRAG_TYPE } from '../dnd';
import { formattingKeymap, slashCompletion, type FormattingHost } from './formatting';
import {
  baseBlocks,
  hideFrontmatter,
  linkClicks,
  tableBlocks,
  livePreview,
  type LinkContext,
} from './livePreview';

export interface JournalEditorOptions extends LinkContext, FormattingHost {
  /** Every note path, for link completion. */
  notePaths: () => readonly string[];
  /** Compendium entries matching typed text, for link completion. */
  searchCompendium: (query: string, type?: string) => Promise<EntitySummary[]>;
  /** How an entity is written in a link: `creature:Goblin@XMM`. */
  refFor: (entity: EntitySummary) => string;
  typeLabel: (type: string) => string;
  openLink: (inner: string, newTab: boolean) => void;
  openUrl: (url: string) => void;
  /** Clicking a #tag. */
  openTag?: (tag: string) => void;
  onChange: (text: string) => void;
  /** Saves pasted or dropped files, returning the link target for each. */
  saveFiles?: (files: File[]) => Promise<string[]>;
  /** The link target for a note or file dragged in from the file tree. */
  linkFor?: (path: string) => string;
  /**
   * Code mode: the note's Markdown as plain text, for editing by hand. Otherwise the note is
   * always shown formatted, with its properties and syntax hidden.
   */
  codeMode?: boolean;
}

/** Pasting or dropping files saves them and embeds them; dropping a note links to it. */
function drops(opts: JournalEditorOptions) {
  const insert = (view: EditorView, at: number, text: string) => {
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
    });
    view.focus();
  };
  const saveAndEmbed = (view: EditorView, files: File[], at: number) => {
    const save = opts.saveFiles;
    if (!save) return false;
    void save(files).then((targets) => {
      insert(view, at, targets.map((t) => `![[${t}]]`).join('\n'));
    });
    return true;
  };
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length === 0) return false;
      event.preventDefault();
      return saveAndEmbed(view, files, view.state.selection.main.head);
    },
    drop: (event, view) => {
      const data = event.dataTransfer;
      if (!data) return false;
      const at =
        view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
      const path = data.getData(DRAG_TYPE);
      if (path && opts.linkFor) {
        event.preventDefault();
        const target = opts.linkFor(path);
        insert(view, at, isAttachment(path) ? `![[${target}]]` : `[[${target}]]`);
        return true;
      }
      const files = [...data.files];
      if (files.length === 0) return false;
      event.preventDefault();
      return saveAndEmbed(view, files, at);
    },
  });
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
  '.cm-jembed': { display: 'block', margin: '4px 0' },
  '.cm-jbase': { margin: '4px 0' },
  '.cm-jhighlight': { backgroundColor: 'var(--boh-highlight)', borderRadius: '2px' },
  '.cm-jbullet': { color: 'var(--boh-text-muted)', padding: '0 4px 0 2px' },
  '.cm-jcheckbox': {
    width: '15px',
    height: '15px',
    margin: '0 6px 0 0',
    verticalAlign: '-2px',
    accentColor: 'var(--boh-accent)',
    cursor: 'pointer',
  },
  '.cm-jtask-done': { color: 'var(--boh-text-faint)', textDecoration: 'line-through' },
  '.cm-jrule': {
    display: 'inline-block',
    width: '100%',
    borderTop: '1px solid var(--boh-border-strong)',
    verticalAlign: 'middle',
  },
  '.cm-jcallout': {
    borderLeft: '4px solid var(--callout)',
    backgroundColor: 'color-mix(in srgb, var(--callout) 10%, transparent)',
    paddingLeft: '12px !important',
    paddingRight: '8px !important',
  },
  '.cm-jcallout-title': {
    fontWeight: '600',
    color: 'var(--callout)',
    borderTopRightRadius: '6px',
    paddingTop: '4px !important',
  },
  '.cm-jcallout-last': { borderBottomRightRadius: '6px', paddingBottom: '4px !important' },
  '.cm-jcallout-label': { fontWeight: '600' },
  '.cm-jcallout-note': { '--callout': 'var(--boh-callout-note)' },
  '.cm-jcallout-tip': { '--callout': 'var(--boh-callout-tip)' },
  '.cm-jcallout-warning': { '--callout': 'var(--boh-callout-warning)' },
  '.cm-jcallout-danger': { '--callout': 'var(--boh-callout-danger)' },
  '.cm-jcallout-secret': { '--callout': 'var(--boh-callout-secret)' },
  '.cm-jcallout-quote': {
    '--callout': 'var(--boh-readaloud-border)',
    backgroundColor: 'var(--boh-readaloud)',
    fontFamily: 'var(--font-serif)',
  },
  '.cm-jdice': { display: 'inline-block' },
  '.cm-jtable': { overflowX: 'auto', margin: '6px 0', cursor: 'text' },
  '.cm-jtable table': { borderCollapse: 'collapse', fontSize: '0.95em' },
  '.cm-jtable th, .cm-jtable td': {
    border: '1px solid var(--boh-border)',
    padding: '4px 10px',
    textAlign: 'left',
  },
  '.cm-jtable th': { backgroundColor: 'var(--boh-sunken)', fontWeight: '600' },
  '.cm-jtag': {
    color: 'var(--boh-accent)',
    backgroundColor: 'var(--boh-accent-soft)',
    borderRadius: '999px',
    padding: '0 6px',
    fontSize: '0.9em',
  },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-sans) !important', fontSize: '14px' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px !important' },
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

/** A note shown but not edited (link previews): formatted throughout, links still clickable. */
export function journalViewerExtensions(
  opts: LinkContext & Pick<JournalEditorOptions, 'openLink' | 'openUrl' | 'openTag'>,
): Extension[] {
  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    livePreview(opts),
    ...(opts.embeds ? [baseBlocks(opts.embeds)] : []),
    tableBlocks(),
    linkClicks(opts.openLink, opts.openUrl, opts.openTag),
    theme,
    EditorView.theme({ '.cm-content': { padding: '0 !important' }, '&': { fontSize: '14px' } }),
  ];
}

export function journalExtensions(opts: JournalEditorOptions): Extension[] {
  const editing: Extension[] = [
    history(),
    drawSelection(),
    closeBrackets(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    drops(opts),
    autocompletion({ override: [linkCompletion(opts), slashCompletion(opts)], icons: false }),
    formattingKeymap(),
    keymap.of([
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) opts.onChange(update.state.doc.toString());
    }),
    theme,
  ];
  if (opts.codeMode) {
    return [
      ...editing,
      placeholder('Markdown'),
      EditorView.theme({
        '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' },
        '&': { fontSize: '14px' },
      }),
    ];
  }
  return [
    ...editing,
    livePreview(opts),
    ...(opts.embeds ? [baseBlocks(opts.embeds, opts.onEditSource)] : []),
    tableBlocks(opts.embeds),
    hideFrontmatter(),
    linkClicks(opts.openLink, opts.openUrl, opts.openTag),
    placeholder('Start writing… Type / for headings, lists, tables and more, or [[ to link.'),
  ];
}
