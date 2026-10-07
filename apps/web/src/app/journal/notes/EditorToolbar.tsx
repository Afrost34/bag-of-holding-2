import { cn } from '@boh/ui';
import type { EditorView } from '@codemirror/view';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {
  Bold,
  BookOpenText,
  ChevronDown,
  Code,
  Dices,
  FileCode2,
  Heading,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MessageSquareWarning,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { CALLOUTS, TEXT_COLORS } from './editor/commands';
import { actions, insertImages, type FormattingHost } from './editor/formatting';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

/**
 * Formatting buttons above a note, so nobody has to remember Markdown: headings, bold, colours,
 * lists, callouts, tables, links, embeds, images and dice. Sticks to the top while scrolling and
 * scrolls sideways on a phone.
 */
export function EditorToolbar({
  getView,
  host,
  codeMode,
  onToggleCode,
}: {
  codeMode: boolean;
  onToggleCode: () => void;
  /** The note's editor (read when a button is used, as it is made after the first render). */
  getView: () => EditorView | null;
  host: FormattingHost;
}) {
  const act = (fn: (v: EditorView) => unknown) => () => {
    const view = getView();
    if (view) fn(view);
  };
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      // Keep the editor's selection: buttons act on it without taking the focus.
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
      className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-0.5 overflow-x-auto border-b sm:flex-wrap sm:overflow-visible border-border bg-bg/95 px-1 py-1 backdrop-blur [scrollbar-width:none]"
    >
      <Tool icon={Undo2} label="Undo" keys={`${mod}Z`} onClick={act(actions.undo)} />
      <Tool icon={Redo2} label="Redo" keys={isMac ? '⇧⌘Z' : 'Ctrl+Y'} onClick={act(actions.redo)} />
      <Divider />
      <ToolMenu icon={Heading} label="Text style" getView={getView}>
        {(v) => (
          <>
            <Item onSelect={() => actions.heading(v, 0)}>Normal text</Item>
            {[1, 2, 3, 4].map((n) => (
              <Item key={n} onSelect={() => actions.heading(v, n)}>
                <span
                  className={cn(
                    'font-serif font-bold',
                    n === 1 ? 'text-xl' : n === 2 ? 'text-lg' : n === 3 ? 'text-base' : 'text-sm',
                  )}
                >
                  Heading {n}
                </span>
              </Item>
            ))}
          </>
        )}
      </ToolMenu>
      <Tool icon={Bold} label="Bold" keys={`${mod}B`} onClick={act(actions.bold)} />
      <Tool icon={Italic} label="Italic" keys={`${mod}I`} onClick={act(actions.italic)} />
      <Tool icon={Strikethrough} label="Strikethrough" onClick={act(actions.strike)} />
      <Tool icon={Highlighter} label="Highlight" onClick={act(actions.highlight)} />
      <ToolMenu icon={Palette} label="Text colour" getView={getView}>
        {(v) => (
          <>
            {TEXT_COLORS.map((c) => (
              <Item key={c.value} onSelect={() => actions.color(v, c.value)}>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.value }} />
                <span style={{ color: c.value }}>{c.name}</span>
              </Item>
            ))}
            <Item onSelect={() => actions.color(v, null)}>No colour</Item>
          </>
        )}
      </ToolMenu>
      <Tool icon={Code} label="Code" keys={`${mod}E`} onClick={act(actions.code)} />
      <Divider />
      <Tool icon={List} label="Bulleted list" onClick={act(actions.bullet)} />
      <Tool icon={ListOrdered} label="Numbered list" onClick={act(actions.number)} />
      <Tool icon={ListChecks} label="Checklist" onClick={act(actions.task)} />
      <Tool icon={IndentDecrease} label="Outdent" onClick={act(actions.outdent)} />
      <Tool icon={IndentIncrease} label="Indent" onClick={act(actions.indent)} />
      <Divider />
      <Tool icon={Quote} label="Quote" onClick={act(actions.quote)} />
      <ToolMenu icon={MessageSquareWarning} label="Callout" getView={getView}>
        {(v) =>
          CALLOUTS.map((c) => (
            <Item
              key={c.type}
              onSelect={() =>
                c.type === 'quote' ? actions.readAloud(v) : actions.callout(v, c.type)
              }
            >
              {c.label}
            </Item>
          ))
        }
      </ToolMenu>
      <Tool icon={Table} label="Table" onClick={act(actions.table)} />
      <Tool icon={Minus} label="Divider" onClick={act(actions.divider)} />
      <Divider />
      <Tool
        icon={Link2}
        label="Link to a note or entry"
        keys={`${mod}K`}
        onClick={act(actions.link)}
      />
      <Tool icon={BookOpenText} label="Embed a note or statblock" onClick={act(actions.embed)} />
      <Tool
        icon={ImagePlus}
        label="Insert image"
        onClick={act((v) => {
          void insertImages(v, host);
        })}
      />
      <Tool icon={Dices} label="Dice roll" onClick={act(actions.dice)} />
      <span className="flex-1" />
      <button
        type="button"
        aria-pressed={codeMode}
        title={codeMode ? 'Back to the formatted note' : 'Edit the Markdown by hand'}
        onClick={onToggleCode}
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium',
          codeMode
            ? 'bg-accent-soft text-accent-ink'
            : 'text-muted hover:bg-sunken hover:text-text',
        )}
      >
        <FileCode2 className="h-4 w-4" aria-hidden /> Markdown
      </button>
    </div>
  );
}

function Tool({
  icon: Icon,
  label,
  keys,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  keys?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={keys ? `${label} (${keys})` : label}
      onClick={onClick}
      className="shrink-0 rounded-md p-2 text-muted hover:bg-sunken hover:text-text sm:p-1.5"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function ToolMenu({
  icon: Icon,
  label,
  getView,
  children,
}: {
  icon: LucideIcon;
  label: string;
  getView: () => EditorView | null;
  children: (view: EditorView) => ReactNode;
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={label}
        title={label}
        className="flex shrink-0 items-center rounded-md p-2 text-muted hover:bg-sunken hover:text-text data-[state=open]:bg-sunken sm:p-1.5"
      >
        <Icon className="h-4 w-4" aria-hidden />
        <ChevronDown className="h-3 w-3" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          // Give the focus back to the note, not to the button.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            getView()?.focus();
          }}
          className="z-50 min-w-44 rounded-md border border-border bg-surface p-1 text-sm shadow-card"
        >
          <MenuBody getView={getView}>{children}</MenuBody>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** A menu's items, made when it opens (the editor exists by then). */
function MenuBody({
  getView,
  children,
}: {
  getView: () => EditorView | null;
  children: (view: EditorView) => ReactNode;
}) {
  const view = getView();
  return view ? children(view) : null;
}

function Item({ onSelect, children }: { onSelect: () => void; children: ReactNode }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
    >
      {children}
    </Menu.Item>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}
