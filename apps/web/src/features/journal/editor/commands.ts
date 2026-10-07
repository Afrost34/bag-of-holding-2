import {
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type TransactionSpec,
} from '@codemirror/state';

/**
 * Formatting commands for the toolbar, shortcuts and the "/" menu. Each takes the editor state
 * and returns the change to make, so they are tested without a browser.
 */

/** Text colours offered in the toolbar: readable on light and dark backgrounds. */
export const TEXT_COLORS = [
  { name: 'Red', value: '#e03131' },
  { name: 'Orange', value: '#e8590c' },
  { name: 'Yellow', value: '#d4a017' },
  { name: 'Green', value: '#2f9e44' },
  { name: 'Blue', value: '#1c7ed6' },
  { name: 'Purple', value: '#9c36b5' },
  { name: 'Gray', value: '#868e96' },
] as const;

/** Wraps each selection in `before`/`after` (`**bold**`), or unwraps it if it already is. */
export function toggleWrap(state: EditorState, before: string, after = before): TransactionSpec {
  return state.changeByRange((range) => {
    const doc = state.doc;
    const outerBefore = doc.sliceString(Math.max(0, range.from - before.length), range.from);
    const outerAfter = doc.sliceString(range.to, range.to + after.length);
    // Typing in bold and pressing Bold again steps out of it (when there is text inside).
    if (range.empty && outerAfter === after && outerBefore !== before) {
      return { range: EditorSelection.cursor(range.to + after.length) };
    }
    // Already wrapped just outside the selection: remove the marks.
    if (outerBefore === before && outerAfter === after) {
      return {
        changes: [
          { from: range.from - before.length, to: range.from },
          { from: range.to, to: range.to + after.length },
        ],
        range: EditorSelection.range(range.from - before.length, range.to - before.length),
      };
    }
    const text = doc.sliceString(range.from, range.to);
    // The selection includes the marks: remove them.
    if (
      text.length >= before.length + after.length &&
      text.startsWith(before) &&
      text.endsWith(after)
    ) {
      const inner = text.slice(before.length, text.length - after.length);
      return {
        changes: { from: range.from, to: range.to, insert: inner },
        range: EditorSelection.range(range.from, range.from + inner.length),
      };
    }
    return {
      changes: [
        { from: range.from, insert: before },
        { from: range.to, insert: after },
      ],
      range: EditorSelection.range(range.from + before.length, range.to + before.length),
    };
  });
}

/** A change to whole lines; the cursor moves with inserted prefixes (`- [ ] `|text). */
function lineEdit(state: EditorState, spec: { changes: ChangeSpec }): TransactionSpec {
  const changes = state.changes(spec.changes);
  return { changes, selection: state.selection.map(changes, 1) };
}

const HEADING = /^#{1,6}\s+/;
const LIST = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/;

/** The line numbers the selection touches. */
function selectedLines(state: EditorState): number[] {
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) lines.add(n);
  }
  return [...lines].sort((x, y) => x - y);
}

/** Makes the selected lines headings of `level` (0 = plain text); the same level again undoes it. */
export function setHeading(state: EditorState, level: number): TransactionSpec {
  const lines = selectedLines(state).map((n) => state.doc.line(n));
  const all = lines.every((l) => (/^#+/.exec(l.text)?.[0].length ?? 0) === level);
  const target = all ? 0 : level;
  return lineEdit(state, {
    changes: lines.map((l) => {
      const existing = HEADING.exec(l.text)?.[0] ?? '';
      return {
        from: l.from,
        to: l.from + existing.length,
        insert: target > 0 ? `${'#'.repeat(target)} ` : '',
      };
    }),
  });
}

export type LineKind = 'bullet' | 'number' | 'task' | 'quote';

const PREFIX_TEST: Record<LineKind, RegExp> = {
  bullet: /^\s*[-*+]\s+(?!\[[ xX]\])/,
  number: /^\s*\d+[.)]\s+/,
  task: /^\s*[-*+]\s+\[[ xX]\]\s+/,
  quote: /^\s*>/,
};

/** Turns the selected lines into a list (or quote); if they all already are, back to text. */
export function toggleLinePrefix(state: EditorState, kind: LineKind): TransactionSpec {
  const lines = selectedLines(state).map((n) => state.doc.line(n));
  const all = lines.every((l) => PREFIX_TEST[kind].test(l.text));
  return lineEdit(state, {
    changes: lines.map((l, i) => {
      const m = LIST.exec(l.text);
      const indent = m?.[1] ?? '';
      const existing = m?.[0] ?? '';
      const prefix = all
        ? ''
        : kind === 'bullet'
          ? '- '
          : kind === 'number'
            ? `${String(i + 1)}. `
            : kind === 'task'
              ? '- [ ] '
              : '> ';
      return { from: l.from, to: l.from + existing.length, insert: indent + prefix };
    }),
  });
}

/**
 * Inserts a block (a table, a divider, a callout…) on lines of its own at the cursor. `cursor`
 * is where the cursor goes within `text` (default: its end).
 */
export function insertBlock(
  state: EditorState,
  text: string,
  cursor = text.length,
): TransactionSpec {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const before = line.text.trim() === '' ? '' : '\n';
  const atLineStart = line.text.trim() === '';
  const from = atLineStart ? line.from : line.to;
  const to = atLineStart ? line.to : line.to;
  const after = state.doc.length > to && state.doc.sliceString(to, to + 1) === '\n' ? '' : '\n';
  const insert = `${before}${text}${after}`;
  return {
    changes: { from, to, insert },
    selection: { anchor: from + before.length + cursor },
  };
}

/** Inserts text at the cursor (replacing the selection), with the cursor `cursor` chars in. */
export function insertText(
  state: EditorState,
  text: string,
  cursor = text.length,
): TransactionSpec {
  const r = state.selection.main;
  return {
    changes: { from: r.from, to: r.to, insert: text },
    selection: { anchor: r.from + cursor },
  };
}

const SPAN_OPEN = /<span style="color:\s*[^"]*">$/;

/** Colours the selection (`<span style="color: …">`, as Obsidian shows it); null removes it. */
export function setColor(state: EditorState, color: string | null): TransactionSpec {
  return state.changeByRange((range) => {
    const doc = state.doc;
    const lineStart = doc.lineAt(range.from).from;
    const before = doc.sliceString(lineStart, range.from);
    const open = SPAN_OPEN.exec(before)?.[0];
    const close = '</span>';
    const hasClose = doc.sliceString(range.to, range.to + close.length) === close;
    const text = doc.sliceString(range.from, range.to);
    if (open && hasClose) {
      const changes = [
        {
          from: range.from - open.length,
          to: range.from,
          insert: color ? `<span style="color: ${color}">` : '',
        },
        { from: range.to, to: range.to + close.length, insert: color ? close : '' },
      ];
      const shift = (color ? `<span style="color: ${color}">`.length : 0) - open.length;
      return { changes, range: EditorSelection.range(range.from + shift, range.to + shift) };
    }
    if (!color) return { range };
    const openTag = `<span style="color: ${color}">`;
    return {
      changes: { from: range.from, to: range.to, insert: `${openTag}${text}${close}` },
      range: EditorSelection.range(
        range.from + openTag.length,
        range.from + openTag.length + text.length,
      ),
    };
  });
}

/** Indents (or outdents) the selected lines by two spaces, for nested lists. */
export function indentLines(state: EditorState, out = false): TransactionSpec {
  const lines = selectedLines(state).map((n) => state.doc.line(n));
  return lineEdit(state, {
    changes: lines.flatMap((l): { from: number; to?: number; insert?: string }[] => {
      if (!out) return [{ from: l.from, insert: '  ' }];
      const spaces = /^ {1,2}|^\t/.exec(l.text)?.[0].length ?? 0;
      return spaces ? [{ from: l.from, to: l.from + spaces }] : [];
    }),
  });
}

/** A Markdown table with `cols` columns and `rows` empty rows. */
export function tableText(cols = 3, rows = 2): string {
  const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const header = row(Array.from({ length: cols }, (_, i) => `Column ${String(i + 1)}`));
  const sep = row(Array.from({ length: cols }, () => '---'));
  const body = Array.from({ length: rows }, () => row(Array.from({ length: cols }, () => ' ')));
  return [header, sep, ...body].join('\n');
}

export const CALLOUTS = [
  { type: 'note', label: 'Note' },
  { type: 'info', label: 'Info' },
  { type: 'tip', label: 'Tip' },
  { type: 'warning', label: 'Warning' },
  { type: 'danger', label: 'Danger' },
  { type: 'quote', label: 'Read aloud' },
  { type: 'secret', label: 'Secret (DM only)' },
] as const;

/** Toggles a task's checkbox on a line (`- [ ]` ↔ `- [x]`). */
export function toggleTask(state: EditorState, lineFrom: number): TransactionSpec | null {
  const line = state.doc.lineAt(lineFrom);
  const m = /^(\s*[-*+]\s+\[)([ xX])\]/.exec(line.text);
  if (!m) return null;
  const at = line.from + (m[1]?.length ?? 0);
  return { changes: { from: at, to: at + 1, insert: m[2] === ' ' ? 'x' : ' ' } };
}
