import { prettyName } from '@boh/journal';
import { cn } from '@boh/ui';
import { ChevronRight, FileText, Hash } from 'lucide-react';
import { useState } from 'react';
import type { TagNode } from './tree';

/** Every tag in the journal, nested, with the notes that carry each one. */
export function TagsPane({
  tags,
  selected,
  onOpenNote,
}: {
  tags: TagNode[];
  /** A tag to show expanded (clicked in a note). */
  selected: string | null;
  onOpenNote: (path: string) => void;
}) {
  if (tags.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-muted">
        No tags yet. Write #tags in notes or add a tags property.
      </p>
    );
  }
  return (
    <ul aria-label="Tags" className="text-sm">
      {tags.map((t) => (
        <TagItem
          key={`${t.tag}:${selected ?? ''}`}
          node={t}
          depth={0}
          selected={selected}
          onOpenNote={onOpenNote}
        />
      ))}
    </ul>
  );
}

function TagItem({
  node,
  depth,
  selected,
  onOpenNote,
}: {
  node: TagNode;
  depth: number;
  selected: string | null;
  onOpenNote: (path: string) => void;
}) {
  const sel = selected?.toLowerCase() ?? null;
  const tag = node.tag.toLowerCase();
  const holdsSelected = sel !== null && (sel === tag || sel.startsWith(`${tag}/`));
  const [open, setOpen] = useState(holdsSelected);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className={cn(
          'flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left hover:bg-sunken',
          sel === tag && 'bg-accent-soft text-accent',
        )}
        style={{ paddingLeft: `${String(0.25 + depth * 0.85)}rem` }}
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
        <Hash className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
        <span className="flex-1 truncate">{node.name}</span>
        <span className="text-xs text-faint">{node.count}</span>
      </button>
      {open && (
        <ul>
          {node.children.map((c) => (
            <TagItem
              key={c.tag}
              node={c}
              depth={depth + 1}
              selected={selected}
              onOpenNote={onOpenNote}
            />
          ))}
          {node.notes.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => {
                  onOpenNote(p);
                }}
                className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-sunken"
                style={{ paddingLeft: `${String(1.3 + depth * 0.85)}rem` }}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                <span className="truncate">{prettyName(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
