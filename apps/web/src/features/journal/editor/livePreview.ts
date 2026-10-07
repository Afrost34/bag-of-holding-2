import { codeRanges, parseCompendiumRef, parseLinkInner, parseTags } from '@boh/journal';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

/**
 * Obsidian-style live preview: Markdown is shown formatted, and its syntax (`#`, `**`, `[[`…)
 * only appears on the lines the cursor is on, so you can edit it. Links are clickable where they
 * are not being edited.
 */

export interface LinkContext {
  /** Whether a note link resolves to a note (unresolved ones are shown faded). */
  isResolved: (target: string) => boolean;
}

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

/** Line numbers the selection touches: their syntax stays visible for editing. */
function activeLines(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    const from = state.doc.lineAt(r.from).number;
    const to = state.doc.lineAt(r.to).number;
    for (let n = from; n <= to; n++) lines.add(n);
  }
  return lines;
}

function build(view: EditorView, ctx: LinkContext): DecorationSet {
  const { state } = view;
  // Without focus nothing is being edited: show the whole note formatted.
  const active = view.hasFocus ? activeLines(state) : new Set<number>();
  const isActive = (from: number, to: number) => {
    const a = state.doc.lineAt(from).number;
    const b = state.doc.lineAt(to).number;
    for (let n = a; n <= b; n++) if (active.has(n)) return true;
    return false;
  };
  const decos: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const lineClass = LINE_CLASS[node.name];
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
    for (const tag of parseTags(text, code)) {
      for (const m of text.matchAll(
        new RegExp(`(^|[^\\w&/#])#${escapeRegExp(tag)}(?![\\p{L}\\p{N}_/-])`, 'gu'),
      )) {
        const at = from + m.index + (m[1]?.length ?? 0);
        if (inCode(at - from)) continue;
        decos.push(Decoration.mark({ class: 'cm-jtag' }).range(at, at + tag.length + 1));
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

export function livePreview(ctx: LinkContext) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, ctx);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged
        ) {
          this.decorations = build(update.view, ctx);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/** Clicking a drawn link opens it; Ctrl/Cmd or middle click asks for a new tab. */
export function linkClicks(
  open: (inner: string, newTab: boolean) => void,
  openUrl: (url: string) => void,
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
