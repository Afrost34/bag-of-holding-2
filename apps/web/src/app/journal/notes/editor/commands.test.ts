import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  indentLines,
  insertBlock,
  setColor,
  setHeading,
  tableText,
  toggleLinePrefix,
  toggleTask,
  toggleWrap,
} from './commands';

/** A state from text where `[` and `]` mark the selection (or `|` the cursor). */
function state(marked: string): EditorState {
  const cursor = marked.indexOf('|');
  if (cursor !== -1) {
    return EditorState.create({
      doc: marked.replace('|', ''),
      selection: EditorSelection.cursor(cursor),
    });
  }
  const from = marked.indexOf('[');
  const to = marked.indexOf(']') - 1;
  return EditorState.create({
    doc: marked.replace('[', '').replace(']', ''),
    selection: EditorSelection.range(from, to),
  });
}

function apply(s: EditorState, spec: TransactionSpec | null): string {
  if (!spec) return s.doc.toString();
  const next = s.update(spec).state;
  const sel = next.selection.main;
  const doc = next.doc.toString();
  return sel.empty
    ? `${doc.slice(0, sel.head)}|${doc.slice(sel.head)}`
    : `${doc.slice(0, sel.from)}[${doc.slice(sel.from, sel.to)}]${doc.slice(sel.to)}`;
}

describe('formatting commands', () => {
  it('wraps and unwraps', () => {
    const bold = state('a [word] b');
    expect(apply(bold, toggleWrap(bold, '**'))).toBe('a **[word]** b');
    const again = state('a **[word]** b');
    expect(apply(again, toggleWrap(again, '**'))).toBe('a [word] b');
    const empty = state('a | b');
    expect(apply(empty, toggleWrap(empty, '=='))).toBe('a ==|== b');
    // Bold again after typing steps out of the bold text.
    const typed = state('a **word|** b');
    expect(apply(typed, toggleWrap(typed, '**'))).toBe('a **word**| b');
  });

  it('sets and toggles headings', () => {
    const s = state('Title|');
    expect(apply(s, setHeading(s, 2))).toBe('## Title|');
    const h = state('## Title|');
    expect(apply(h, setHeading(h, 1))).toBe('# Title|');
    expect(apply(h, setHeading(h, 2))).toBe('Title|');
  });

  it('makes lists and turns one kind into another', () => {
    const s = state('[one\ntwo]');
    expect(apply(s, toggleLinePrefix(s, 'number'))).toBe('1. [one\n2. two]');
    const b = state('[- one\n- two]');
    expect(apply(b, toggleLinePrefix(b, 'task'))).toBe('[- [ ] one\n- [ ] two]');
    expect(apply(b, toggleLinePrefix(b, 'bullet'))).toBe('[one\ntwo]');
    // On an empty line the cursor ends up after the new prefix, ready to type.
    const blank = state('Text\n|');
    expect(apply(blank, toggleLinePrefix(blank, 'task'))).toBe('Text\n- [ ] |');
    expect(apply(blank, setHeading(blank, 2))).toBe('Text\n## |');
  });

  it('inserts blocks on their own lines', () => {
    const s = state('Text|\nMore');
    expect(apply(s, insertBlock(s, '---'))).toBe('Text\n---|\nMore');
    const blank = state('|');
    expect(apply(blank, insertBlock(blank, tableText(2, 1), 2))).toBe(
      '| |Column 1 | Column 2 |\n| --- | --- |\n|   |   |\n',
    );
  });

  it('colours text and changes or removes the colour', () => {
    const s = state('a [red] b');
    const red = apply(s, setColor(s, '#e03131'));
    expect(red).toBe('a <span style="color: #e03131">[red]</span> b');
    const coloured = state('a <span style="color: #e03131">[red]</span> b');
    expect(apply(coloured, setColor(coloured, '#1c7ed6'))).toBe(
      'a <span style="color: #1c7ed6">[red]</span> b',
    );
    expect(apply(coloured, setColor(coloured, null))).toBe('a [red] b');
  });

  it('indents, outdents and ticks tasks', () => {
    const s = state('- a|');
    expect(apply(s, indentLines(s))).toBe('  - a|');
    const nested = state('  - a|');
    expect(apply(nested, indentLines(nested, true))).toBe('- a|');
    const task = state('- [ ] buy rope|');
    expect(apply(task, toggleTask(task, 0))).toBe('- [x] buy rope|');
  });
});
