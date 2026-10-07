import {
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { redo, undo } from '@codemirror/commands';
import type { TransactionSpec } from '@codemirror/state';
import { keymap, type EditorView, type KeyBinding } from '@codemirror/view';
import {
  CALLOUTS,
  indentLines,
  insertBlock,
  insertText,
  setColor,
  setHeading,
  tableText,
  toggleLinePrefix,
  toggleTask,
  toggleWrap,
} from './commands';

/**
 * What the toolbar, keyboard shortcuts and the "/" menu can do, in one place so they behave the
 * same everywhere.
 */

export interface FormattingHost {
  /** Asks for image files, saves them and returns their link targets. */
  pickImages?: () => Promise<string[]>;
}

export function run(view: EditorView, spec: TransactionSpec | null): boolean {
  if (spec) view.dispatch(spec);
  view.focus();
  return true;
}

/** Inserts `[[` (or `![[`) and opens the suggestions for notes and compendium entries. */
export function startLink(view: EditorView, embed = false): boolean {
  run(view, insertText(view.state, embed ? '![[]]' : '[[]]', embed ? 3 : 2));
  startCompletion(view);
  return true;
}

export async function insertImages(view: EditorView, host: FormattingHost): Promise<void> {
  const targets = (await host.pickImages?.()) ?? [];
  if (targets.length > 0)
    run(view, insertBlock(view.state, targets.map((t) => `![[${t}]]`).join('\n')));
}

export const actions = {
  undo: (v: EditorView) => undo(v),
  redo: (v: EditorView) => redo(v),
  heading: (v: EditorView, level: number) => run(v, setHeading(v.state, level)),
  bold: (v: EditorView) => run(v, toggleWrap(v.state, '**')),
  italic: (v: EditorView) => run(v, toggleWrap(v.state, '*')),
  strike: (v: EditorView) => run(v, toggleWrap(v.state, '~~')),
  highlight: (v: EditorView) => run(v, toggleWrap(v.state, '==')),
  code: (v: EditorView) => run(v, toggleWrap(v.state, '`')),
  color: (v: EditorView, color: string | null) => run(v, setColor(v.state, color)),
  bullet: (v: EditorView) => run(v, toggleLinePrefix(v.state, 'bullet')),
  number: (v: EditorView) => run(v, toggleLinePrefix(v.state, 'number')),
  task: (v: EditorView) => run(v, toggleLinePrefix(v.state, 'task')),
  quote: (v: EditorView) => run(v, toggleLinePrefix(v.state, 'quote')),
  callout: (v: EditorView, type: string) =>
    run(v, insertBlock(v.state, `> [!${type}] \n> `, `> [!${type}] `.length)),
  readAloud: (v: EditorView) => run(v, insertBlock(v.state, '> [!quote] Read aloud\n> ', 26)),
  table: (v: EditorView) => run(v, insertBlock(v.state, tableText(3, 2), 2)),
  divider: (v: EditorView) => run(v, insertBlock(v.state, '---')),
  codeBlock: (v: EditorView) => run(v, insertBlock(v.state, '```\n\n```', 4)),
  dice: (v: EditorView) => {
    // The selected text becomes the roll; without any, `1d20` is selected to type over.
    const { from, to } = v.state.selection.main;
    const expr = v.state.sliceDoc(from, to).trim() || '1d20';
    const text = `\`dice: ${expr}\``;
    return run(v, {
      changes: { from, to, insert: text },
      selection:
        from === to
          ? { anchor: from + 7, head: from + 7 + expr.length }
          : { anchor: from + text.length },
    });
  },
  link: (v: EditorView) => startLink(v),
  embed: (v: EditorView) => startLink(v, true),
  indent: (v: EditorView) => run(v, indentLines(v.state)),
  outdent: (v: EditorView) => run(v, indentLines(v.state, true)),
  toggleTask: (v: EditorView) => run(v, toggleTask(v.state, v.state.selection.main.head)),
  date: (v: EditorView) => run(v, insertText(v.state, new Date().toISOString().slice(0, 10))),
};

/** Shortcuts (Ctrl on Windows, Cmd on a Mac), as in Obsidian and word processors. */
export function formattingKeymap() {
  const bindings: KeyBinding[] = [
    { key: 'Mod-b', run: actions.bold },
    { key: 'Mod-i', run: actions.italic },
    { key: 'Mod-Shift-x', run: actions.strike },
    { key: 'Mod-Shift-h', run: actions.highlight },
    { key: 'Mod-e', run: actions.code },
    { key: 'Mod-k', run: actions.link },
    { key: 'Mod-Alt-1', run: (v) => actions.heading(v, 1) },
    { key: 'Mod-Alt-2', run: (v) => actions.heading(v, 2) },
    { key: 'Mod-Alt-3', run: (v) => actions.heading(v, 3) },
    { key: 'Mod-Alt-0', run: (v) => actions.heading(v, 0) },
    { key: 'Mod-Shift-7', run: actions.number },
    { key: 'Mod-Shift-8', run: actions.bullet },
    { key: 'Mod-Shift-9', run: actions.task },
    { key: 'Mod-Enter', run: actions.toggleTask },
  ];
  return keymap.of(bindings);
}

interface SlashItem {
  label: string;
  detail: string;
  keywords?: string;
  run: (view: EditorView, host: FormattingHost) => void;
}

const SLASH: SlashItem[] = [
  { label: 'Heading 1', detail: '#', run: (v) => actions.heading(v, 1) },
  { label: 'Heading 2', detail: '##', run: (v) => actions.heading(v, 2) },
  { label: 'Heading 3', detail: '###', run: (v) => actions.heading(v, 3) },
  { label: 'Bulleted list', detail: '-', run: actions.bullet },
  { label: 'Numbered list', detail: '1.', run: actions.number },
  { label: 'Checklist', detail: '- [ ]', keywords: 'todo task', run: actions.task },
  { label: 'Quote', detail: '>', run: actions.quote },
  { label: 'Read-aloud box', detail: 'callout', keywords: 'boxed text', run: actions.readAloud },
  ...CALLOUTS.filter((c) => c.type !== 'quote').map((c): SlashItem => ({
    label: `${c.label} callout`,
    detail: 'callout',
    run: (v) => actions.callout(v, c.type),
  })),
  { label: 'Table', detail: '| |', run: actions.table },
  { label: 'Divider', detail: '---', keywords: 'line rule', run: actions.divider },
  { label: 'Code block', detail: '```', run: actions.codeBlock },
  { label: 'Dice roll', detail: 'dice: 1d20', keywords: 'roll', run: actions.dice },
  { label: 'Link', detail: '[[ ]]', keywords: 'note', run: actions.link },
  {
    label: 'Embed a note or statblock',
    detail: '![[ ]]',
    keywords: 'creature monster spell item',
    run: actions.embed,
  },
  {
    label: 'Image',
    detail: 'upload',
    keywords: 'picture photo map',
    run: (v, host) => void insertImages(v, host),
  },
  { label: "Today's date", detail: 'date', run: actions.date },
];

/** Typing "/" at the start of a line or after a space offers blocks to insert. */
export function slashCompletion(host: FormattingHost) {
  return (context: CompletionContext): CompletionResult | null => {
    const m = context.matchBefore(/(?:^|\s)\/[\w' ]{0,24}$/);
    if (!m) return null;
    const slash = m.from + m.text.indexOf('/');
    // Kept in this order (headings first) rather than sorted by name.
    const options: Completion[] = SLASH.map((item, i) => ({
      label: item.label,
      boost: 50 - i,
      detail: item.detail,
      type: 'keyword',
      ...(item.keywords ? { info: item.keywords } : {}),
      apply: (view: EditorView, _c: Completion, _from: number, to: number) => {
        view.dispatch({ changes: { from: slash, to } });
        item.run(view, host);
      },
    }));
    return { from: slash + 1, options, validFor: /^[\w' ]*$/ };
  };
}
