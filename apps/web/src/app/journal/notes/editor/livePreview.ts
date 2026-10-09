import {
  codeRanges,
  parseCompendiumRef,
  parseFrontmatter,
  parseLinkInner,
  parseTags,
} from '@boh/journal';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState, StateField, type Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { toggleTask } from './commands';

/**
 * Obsidian-style live preview: Markdown is shown formatted, and its syntax (`#`, `**`, `[[`…)
 * only appears on the lines the cursor is on, so you can edit it. Links are clickable where they
 * are not being edited.
 */

export interface LinkContext {
  /** Whether a note link resolves to a note (unresolved ones are shown faded). */
  isResolved: (target: string) => boolean;
  /** Draws `![[embeds]]`; without it they show as links. */
  embeds?: EmbedHost;
  /** Shows the note's Markdown (code mode), e.g. to edit a base block's YAML. */
  onEditSource?: () => void;
  /**
   * Formats the whole note at once, not only what is on screen: for read-only views (board
   * cards, previews), whose scrolling container or zoom can hide from the editor what is seen.
   */
  wholeDocument?: boolean;
}

/**
 * Embeds are drawn by the app (React, through portals) into elements the editor hands out:
 * `mount` when an embed appears, `unmount` when the editor drops it.
 */
export interface EmbedHost {
  mount: (el: HTMLElement, embed: Embed) => void;
  unmount: (el: HTMLElement) => void;
}

/** What an embed element shows: an `![[embed]]`, or a ```base block with a way back to its YAML. */
export type Embed =
  | { kind: 'embed'; inner: string; replace: (inner: string | null) => void }
  | { kind: 'base'; yaml: string; edit: () => void }
  | { kind: 'dice'; expression: string }
  | { kind: 'table'; source: string; replace: (source: string) => void };

/**
 * Replaces the text a widget stands for (`old`, found at the widget's position) with `next`;
 * null deletes it. Widgets use it so their editors (image size, table cells) change the note.
 */
function replaceAt(view: EditorView, el: HTMLElement, old: string, next: string | null): void {
  const from = view.posAtDOM(el);
  if (view.state.doc.sliceString(from, from + old.length) !== old) return;
  view.dispatch({ changes: { from, to: from + old.length, insert: next ?? '' } });
}

/** Obsidian callout types, folded into the few colours the journal draws. */
const CALLOUT_STYLE: Record<string, string> = {
  note: 'note',
  info: 'note',
  todo: 'note',
  abstract: 'note',
  summary: 'note',
  tldr: 'note',
  tip: 'tip',
  hint: 'tip',
  important: 'tip',
  success: 'tip',
  check: 'tip',
  done: 'tip',
  warning: 'warning',
  caution: 'warning',
  attention: 'warning',
  question: 'warning',
  help: 'warning',
  faq: 'warning',
  danger: 'danger',
  error: 'danger',
  bug: 'danger',
  failure: 'danger',
  fail: 'danger',
  missing: 'danger',
  quote: 'quote',
  cite: 'quote',
  example: 'quote',
  secret: 'secret',
};

const CALLOUT = /^\s*>\s*\[!([\w-]+)\][+-]?\s*(.*)$/;
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s,.%]+\))$/i;

const hide = Decoration.replace({});

const LINE_CLASS: Record<string, string> = {
  ATXHeading1: 'cm-jh1',
  ATXHeading2: 'cm-jh2',
  ATXHeading3: 'cm-jh3',
  ATXHeading4: 'cm-jh4',
  ATXHeading5: 'cm-jh5',
  ATXHeading6: 'cm-jh6',
  SetextHeading1: 'cm-jh1',
  SetextHeading2: 'cm-jh2',
  Blockquote: 'cm-jquote',
  FencedCode: 'cm-jcodeblock',
};

const MARK_CLASS: Record<string, string> = {
  Emphasis: 'cm-jem',
  StrongEmphasis: 'cm-jstrong',
  InlineCode: 'cm-jicode',
  Strikethrough: 'cm-jstrike',
};

/** Syntax hidden when the cursor is elsewhere. */
const HIDDEN_MARKS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'StrikethroughMark',
  'QuoteMark',
]);

function build(view: EditorView, ctx: LinkContext): DecorationSet {
  const { state } = view;
  // The note is always shown formatted: its Markdown is never revealed here (code mode is a
  // separate, plain editor). `isActive` is kept as the one place that decides it.
  const isActive = (_from: number, _to: number) => false;
  const decos: Range<Decoration>[] = [];

  const whole = ctx.wholeDocument === true;
  // The whole note parsed now (a read-only view does not wait for its background parse).
  const tree = whole
    ? (ensureSyntaxTree(state, state.doc.length, 1000) ?? syntaxTree(state))
    : syntaxTree(state);
  const ranges = whole ? [{ from: 0, to: state.doc.length }] : view.visibleRanges;
  for (const { from, to } of ranges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        let lineClass = LINE_CLASS[node.name];
        if (node.name === 'Blockquote') {
          // `> [!warning] Title`: a callout, drawn as a coloured box.
          const first = state.doc.lineAt(node.from);
          const m = CALLOUT.exec(first.text);
          if (m) {
            const style = CALLOUT_STYLE[(m[1] ?? '').toLowerCase()] ?? 'note';
            const last = state.doc.lineAt(Math.max(node.from, node.to - 1)).number;
            for (let n = first.number; n <= last; n++) {
              const cls = `cm-jcallout cm-jcallout-${style}${n === first.number ? ' cm-jcallout-title' : ''}${n === last ? ' cm-jcallout-last' : ''}`;
              decos.push(Decoration.line({ class: cls }).range(state.doc.line(n).from));
            }
            if (!isActive(first.from, first.to)) {
              const marker = /\[![\w-]+\][+-]?\s*/.exec(first.text);
              if (marker) {
                const from = first.from + marker.index;
                const label = (m[2] ?? '').trim()
                  ? ''
                  : (m[1] ?? '').replace(/^./, (c) => c.toUpperCase());
                decos.push(
                  Decoration.replace({ widget: new LabelWidget(label) }).range(
                    from,
                    from + marker[0].length,
                  ),
                );
              }
            }
            lineClass = undefined;
          }
        }
        if (node.name === 'ListMark' && !isActive(node.from, node.to)) {
          const mark = state.doc.sliceString(node.from, node.to);
          const task = /^ \[[ xX]\]/.test(state.doc.sliceString(node.to, node.to + 4));
          if (task) decos.push(hide.range(node.from, node.to + 1));
          else if (/^[-*+]$/.test(mark)) {
            decos.push(
              Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to),
            );
          }
        }
        if (node.name === 'TaskMarker') {
          const checked = /x/i.test(state.doc.sliceString(node.from, node.to));
          const line = state.doc.lineAt(node.from);
          if (checked) decos.push(Decoration.line({ class: 'cm-jtask-done' }).range(line.from));
          if (!isActive(node.from, node.to)) {
            decos.push(
              Decoration.replace({ widget: new CheckboxWidget(checked) }).range(node.from, node.to),
            );
          }
        }
        if (node.name === 'HorizontalRule' && !isActive(node.from, node.to)) {
          decos.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
        }
        if (node.name === 'InlineCode' && ctx.embeds && !isActive(node.from, node.to)) {
          // `dice: 2d6+3` (the Dice Roller plugin's syntax): a roll chip.
          const dice = /^`\s*dice:\s*([^`]+?)\s*`$/.exec(state.doc.sliceString(node.from, node.to));
          if (dice?.[1]) {
            decos.push(
              Decoration.replace({ widget: new DiceWidget(dice[1], ctx.embeds) }).range(
                node.from,
                node.to,
              ),
            );
            return false;
          }
        }
        if (lineClass) {
          const first = state.doc.lineAt(node.from).number;
          // A block ending at the start of a line does not include that line.
          const last = state.doc.lineAt(Math.max(node.from, node.to - 1)).number;
          for (let n = first; n <= last; n++) {
            decos.push(Decoration.line({ class: lineClass }).range(state.doc.line(n).from));
          }
        }
        const markClass = MARK_CLASS[node.name];
        if (markClass && node.to > node.from) {
          decos.push(Decoration.mark({ class: markClass }).range(node.from, node.to));
        }
        if (HIDDEN_MARKS.has(node.name) && !isActive(node.from, node.to)) {
          // A heading's `#` takes its following space with it.
          const end =
            node.name === 'HeaderMark' && state.doc.sliceString(node.to, node.to + 1) === ' '
              ? node.to + 1
              : node.to;
          if (end > node.from) decos.push(hide.range(node.from, end));
        }
        if (node.name === 'Link' && !isActive(node.from, node.to)) {
          // [text](url): show the text as a link.
          const text = state.doc.sliceString(node.from, node.to);
          const m = /^\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/.exec(text);
          if (m?.[1]) {
            const textFrom = node.from + 1;
            const textTo = textFrom + m[1].length;
            decos.push(hide.range(node.from, textFrom));
            decos.push(
              Decoration.mark({
                class: 'cm-jlink cm-jlink-url',
                attributes: { 'data-url': m[2] ?? '' },
              }).range(textFrom, textTo),
            );
            decos.push(hide.range(textTo, node.to));
          }
          return false;
        }
        return undefined;
      },
    });

    // Wikilinks and tags are not part of CommonMark: found by the journal parser.
    const text = state.doc.sliceString(from, to);
    const code = codeRanges(text);
    const inCode = (pos: number) => code.some(([s, e]) => pos >= s && pos < e);
    for (const m of text.matchAll(/(!?)\[\[([^[\]\n]+?)\]\]/g)) {
      if (inCode(m.index)) continue;
      const start = from + m.index;
      const end = start + m[0].length;
      // A link being typed (the cursor inside its brackets) stays text, so suggestions can show.
      const head = state.selection.main.head;
      if (view.hasFocus && state.selection.main.empty && head > start + 1 && head < end - 1) {
        decos.push(Decoration.mark({ class: 'cm-jlink-raw' }).range(start, end));
        continue;
      }
      if (m[1] === '!' && ctx.embeds) {
        decos.push(
          Decoration.replace({ widget: new EmbedWidget(m[2] ?? '', ctx.embeds) }).range(start, end),
        );
        continue;
      }
      if (isActive(start, end)) {
        decos.push(Decoration.mark({ class: 'cm-jlink-raw' }).range(start, end));
        continue;
      }
      const inner = m[2] ?? '';
      const link = parseLinkInner(inner);
      const shown =
        link.display ?? (link.heading ? `${link.target} › ${link.heading}` : link.target);
      const compendium = parseCompendiumRef(link.target) !== null;
      const resolved = compendium || ctx.isResolved(link.target);
      const shownText =
        compendium && !link.display ? (parseCompendiumRef(link.target)?.name ?? shown) : shown;
      // Hide the whole link and show a link-styled label in its place.
      decos.push(
        Decoration.replace({
          widget: new LinkWidget(shownText, inner, compendium, resolved),
        }).range(start, end),
      );
    }
    // ==highlight== and <span style="color: …">coloured text</span>.
    for (const m of text.matchAll(/==([^=\n]+)==/g)) {
      if (inCode(m.index)) continue;
      const start = from + m.index;
      const end = start + m[0].length;
      if (isActive(start, end)) {
        decos.push(Decoration.mark({ class: 'cm-jhighlight' }).range(start, end));
      } else {
        decos.push(hide.range(start, start + 2));
        decos.push(Decoration.mark({ class: 'cm-jhighlight' }).range(start + 2, end - 2));
        decos.push(hide.range(end - 2, end));
      }
    }
    for (const m of text.matchAll(/<span style="color:\s*([^";]+?);?\s*">([^<\n]*)<\/span>/g)) {
      const color = (m[1] ?? '').trim();
      if (inCode(m.index) || !SAFE_COLOR.test(color)) continue;
      const start = from + m.index;
      const open = m[0].indexOf('>') + 1;
      const innerFrom = start + open;
      const innerTo = innerFrom + (m[2] ?? '').length;
      const end = start + m[0].length;
      if (innerTo > innerFrom) {
        decos.push(
          Decoration.mark({ attributes: { style: `color: ${color}` } }).range(innerFrom, innerTo),
        );
      }
      if (!isActive(start, end)) {
        decos.push(hide.range(start, innerFrom));
        decos.push(hide.range(innerTo, end));
      }
    }
    for (const tag of parseTags(text, code)) {
      for (const m of text.matchAll(
        new RegExp(`(^|[^\\w&/#])#${escapeRegExp(tag)}(?![\\p{L}\\p{N}_/-])`, 'gu'),
      )) {
        const at = from + m.index + (m[1]?.length ?? 0);
        if (inCode(at - from)) continue;
        decos.push(
          Decoration.mark({ class: 'cm-jtag', attributes: { 'data-tag': tag } }).range(
            at,
            at + tag.length + 1,
          ),
        );
      }
    }
  }
  return Decoration.set(decos, true);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A wikilink drawn as a link; clicking it opens the target (see `linkClicks`). */
class LinkWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly inner: string,
    readonly compendium: boolean,
    readonly resolved: boolean,
  ) {
    super();
  }

  override eq(other: LinkWidget): boolean {
    return (
      other.label === this.label &&
      other.inner === this.inner &&
      other.compendium === this.compendium &&
      other.resolved === this.resolved
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement('a');
    el.textContent = this.label;
    el.href = '#';
    el.className = [
      'cm-jlink',
      this.compendium ? 'cm-jlink-compendium' : '',
      this.resolved ? '' : 'cm-jlink-missing',
    ]
      .filter(Boolean)
      .join(' ');
    el.dataset.linkTarget = this.inner;
    if (!this.resolved) el.title = 'Not created yet: click to create it';
    return el;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-jbullet';
    el.textContent = '•';
    return el;
  }
}

class RuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-jrule';
    return el;
  }
}

/** A callout's type shown in place of `[!warning]` when it has no title of its own. */
class LabelWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }

  override eq(other: LabelWidget): boolean {
    return other.label === this.label;
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-jcallout-label';
    el.textContent = this.label;
    return el;
  }
}

/** A task's checkbox: clicking it ticks the task in the text. */
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.checked;
    box.className = 'cm-jcheckbox';
    box.setAttribute('aria-label', this.checked ? 'Done' : 'To do');
    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const spec = toggleTask(view.state, view.posAtDOM(box));
      if (spec) view.dispatch(spec);
    });
    return box;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/** `dice: 1d20+5` drawn as a roll chip by the app. */
class DiceWidget extends WidgetType {
  constructor(
    readonly expression: string,
    readonly host: EmbedHost,
  ) {
    super();
  }

  override eq(other: DiceWidget): boolean {
    return other.expression === this.expression && other.host === this.host;
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-jdice';
    this.host.mount(el, { kind: 'dice', expression: this.expression });
    return el;
  }

  override destroy(dom: HTMLElement): void {
    this.host.unmount(dom);
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * A Markdown table. With an app host it is drawn as an editable table (cells, rows and columns
 * change the note); in a read-only preview it is drawn as a plain table.
 */
class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly host: EmbedHost | undefined,
  ) {
    super();
  }

  override eq(other: TableWidget): boolean {
    return other.source === this.source && other.host === this.host;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-jtable';
    if (this.host) {
      const source = this.source;
      this.host.mount(wrap, {
        kind: 'table',
        source,
        replace: (next) => {
          replaceAt(view, wrap, source, next);
        },
      });
      return wrap;
    }
    const table = document.createElement('table');
    parseTable(this.source).forEach((cells, i) => {
      const tr = document.createElement('tr');
      for (const cell of cells) {
        const td = document.createElement(i === 0 ? 'th' : 'td');
        td.textContent = plainText(cell);
        tr.appendChild(td);
      }
      (i === 0 ? table.createTHead() : (table.tBodies[0] ?? table.createTBody())).appendChild(tr);
    });
    wrap.appendChild(table);
    return wrap;
  }

  override destroy(dom: HTMLElement): void {
    this.host?.unmount(dom);
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/** A table's rows of cells (the `|---|` line dropped). */
export function parseTable(source: string): string[][] {
  return source
    .split('\n')
    .filter((line, i) => i !== 1 && line.trim() !== '')
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/)
        .map((c) => c.trim()),
    );
}

/** Rows of cells back to a Markdown table (the first row is the header). */
export function tableSource(rows: readonly (readonly string[])[]): string {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const line = (cells: readonly string[]) =>
    `| ${Array.from({ length: cols }, (_, i) => (cells[i] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || ' ').join(' | ')} |`;
  const [head = [], ...body] = rows;
  return [line(head), line(Array.from({ length: cols }, () => '---')), ...body.map(line)].join(
    '\n',
  );
}

/** Cell text without Markdown marks: `**a**` → a, `[[x|y]]` → y. */
function plainText(md: string): string {
  return md
    .replace(
      /!?\[\[([^\]|]*)\|?([^\]]*)\]\]/g,
      (_, target: string, shown: string) => shown || target,
    )
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|==|~~|\*|_|`)/g, '');
}

/** Markdown tables: a header line, a `|---|` line, then rows. */
export function findTables(text: string): { from: number; to: number; source: string }[] {
  const out: { from: number; to: number; source: string }[] = [];
  const re =
    /^\|.*\|[ \t]*\n\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*(?:\n\|.*\|[ \t]*)*/gm;
  for (const m of text.matchAll(re))
    out.push({ from: m.index, to: m.index + m[0].length, source: m[0] });
  return out;
}

/** Draws tables (a state field, as they span lines). */
export function tableBlocks(host?: EmbedHost) {
  const compute = (state: EditorState): DecorationSet =>
    Decoration.set(
      findTables(state.doc.toString()).map((t) =>
        Decoration.replace({ block: true, widget: new TableWidget(t.source, host) }).range(
          t.from,
          t.to,
        ),
      ),
    );
  return StateField.define<DecorationSet>({
    create: compute,
    update: (value, tr) => (tr.docChanged ? compute(tr.state) : value),
    provide: (f) => [
      EditorView.decorations.from(f),
      EditorView.atomicRanges.of((view) => view.state.field(f)),
    ],
  });
}

/** An embedded note, image or compendium entry; the app draws its content. */
class EmbedWidget extends WidgetType {
  constructor(
    readonly inner: string,
    readonly host: EmbedHost,
  ) {
    super();
  }

  override eq(other: EmbedWidget): boolean {
    return other.inner === this.inner && other.host === this.host;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-jembed';
    const source = `![[${this.inner}]]`;
    this.host.mount(el, {
      kind: 'embed',
      inner: this.inner,
      replace: (inner) => {
        replaceAt(view, el, source, inner === null ? null : `![[${inner}]]`);
      },
    });
    return el;
  }

  override destroy(dom: HTMLElement): void {
    this.host.unmount(dom);
  }

  // Clicks inside an embed (its links, an image) belong to it, not to the editor.
  override ignoreEvent(): boolean {
    return true;
  }
}

/** A ```base block drawn as its views; "edit" shows its YAML in code mode. */
class BaseBlockWidget extends WidgetType {
  constructor(
    readonly yaml: string,
    readonly host: EmbedHost,
    readonly onEditSource: (() => void) | undefined,
  ) {
    super();
  }

  override eq(other: BaseBlockWidget): boolean {
    return other.yaml === this.yaml && other.host === this.host;
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-jbase';
    this.host.mount(el, {
      kind: 'base',
      yaml: this.yaml,
      edit: () => {
        this.onEditSource?.();
      },
    });
    return el;
  }

  override destroy(dom: HTMLElement): void {
    this.host.unmount(dom);
  }

  override ignoreEvent(): boolean {
    return true;
  }

  override get estimatedHeight(): number {
    return 160;
  }
}

/** Fenced ```base blocks: their position and YAML. */
export function findBaseBlocks(text: string): { from: number; to: number; yaml: string }[] {
  const out: { from: number; to: number; yaml: string }[] = [];
  const re = /^```base[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;
  for (const m of text.matchAll(re)) {
    out.push({ from: m.index, to: m.index + m[0].length, yaml: m[1] ?? '' });
  }
  return out;
}

/**
 * Draws ```base blocks as their views. Block widgets have to come from a state field (not a view
 * plugin), hence this separate extension.
 */
export function baseBlocks(host: EmbedHost, onEditSource?: () => void) {
  const compute = (state: EditorState): DecorationSet =>
    Decoration.set(
      findBaseBlocks(state.doc.toString()).map((block) =>
        Decoration.replace({
          block: true,
          widget: new BaseBlockWidget(block.yaml, host, onEditSource),
        }).range(block.from, block.to),
      ),
    );
  return StateField.define<DecorationSet>({
    create: compute,
    update: (value, tr) => (tr.docChanged ? compute(tr.state) : value),
    provide: (f) => [
      EditorView.decorations.from(f),
      EditorView.atomicRanges.of((view) => view.state.field(f)),
    ],
  });
}

/** Hides a note's frontmatter: the properties panel above the editor shows and edits it. */
export function hideFrontmatter() {
  const compute = (state: EditorState): DecorationSet => {
    const { bodyStart } = parseFrontmatter(state.doc.toString());
    if (bodyStart === 0) return Decoration.none;
    // Up to the closing `---`, so the body's first line stays a line of its own.
    const end = state.doc.lineAt(Math.max(0, bodyStart - 1)).to;
    return Decoration.set([Decoration.replace({ block: true }).range(0, end)]);
  };
  const field = StateField.define<DecorationSet>({
    create: compute,
    update: (value, tr) => (tr.docChanged ? compute(tr.state) : value),
    provide: (f) => [
      EditorView.decorations.from(f),
      EditorView.atomicRanges.of((view) => view.state.field(f)),
    ],
  });
  return field;
}

export function livePreview(ctx: LinkContext) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      /** Hidden syntax and widgets: the cursor steps over them as one character. */
      atomic: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, ctx);
        this.atomic = atomicOf(this.decorations);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          // The background parse got further: what it reached can be formatted now.
          syntaxTree(update.state) !== syntaxTree(update.startState)
        ) {
          this.decorations = build(update.view, ctx);
          this.atomic = atomicOf(this.decorations);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
  return [
    plugin,
    EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none),
    skipHiddenPrefixes,
  ];
}

function atomicOf(decorations: DecorationSet): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  decorations.between(0, Number.MAX_SAFE_INTEGER, (from, to, value) => {
    if (value.point && to > from) ranges.push(value.range(from, to));
  });
  return Decoration.set(ranges, true);
}

/** Hidden line starts: `## `, `> `, `> [!note] `, `- `, `- [ ] `, `1. `. */
const HIDDEN_PREFIX =
  /^(?:#{1,6} |>[ \t]?(?:\[![\w-]+\][+-]?[ \t]?)?|[ \t]*[-*+] (?:\[[ xX]\] )?|[ \t]*\d+[.)] )/;

/**
 * Keeps an empty cursor out of a line's hidden prefix (before a heading's `## ` or a list's `- `),
 * where typing would break the formatting the reader sees.
 */
const skipHiddenPrefixes = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection) return tr;
  const doc = tr.newDoc;
  const before = tr.selection.ranges;
  const ranges = before.map((r) => {
    if (!r.empty) return r;
    const line = doc.lineAt(r.head);
    const prefix = HIDDEN_PREFIX.exec(line.text)?.[0].length ?? 0;
    return prefix > 0 && r.head < line.from + prefix
      ? EditorSelection.cursor(line.from + prefix)
      : r;
  });
  if (ranges.every((r, i) => r === before[i])) return tr;
  return [
    tr,
    { selection: EditorSelection.create(ranges, tr.selection.mainIndex), sequential: true },
  ];
});

/** Clicking a drawn link opens it; Ctrl/Cmd or middle click asks for a new tab. */
export function linkClicks(
  open: (inner: string, newTab: boolean) => void,
  openUrl: (url: string) => void,
  openTag?: (tag: string) => void,
) {
  return EditorView.domEventHandlers({
    mousedown: (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const link = target?.closest<HTMLElement>('[data-link-target]');
      const url = target?.closest<HTMLElement>('[data-url]');
      if (event.button > 1 || event.shiftKey) return false;
      if (link?.dataset.linkTarget) {
        event.preventDefault();
        open(link.dataset.linkTarget, event.ctrlKey || event.metaKey || event.button === 1);
        return true;
      }
      if (url?.dataset.url) {
        event.preventDefault();
        openUrl(url.dataset.url);
        return true;
      }
      const tag = target?.closest<HTMLElement>('[data-tag]')?.dataset.tag;
      if (tag && openTag && !event.ctrlKey) {
        event.preventDefault();
        openTag(tag);
        return true;
      }
      return false;
    },
    // The link was followed on mousedown; the anchor's own `#` must not be.
    click: (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[data-link-target]')) {
        event.preventDefault();
        return true;
      }
      return false;
    },
  });
}
