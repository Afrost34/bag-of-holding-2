import type { NoteType } from '@boh/journal';
import { cn } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  LayoutTemplate,
  MoreHorizontal,
  Paperclip,
  Table2,
} from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { buildTree, moveTarget, type TreeNode } from './tree';
import { DRAG_TYPE } from './dnd';
import { NoteTypeIcon } from './NoteTypeIcon';

export interface FileTreeProps {
  notes: readonly string[];
  attachments: readonly string[];
  folders: readonly string[];
  /** The open note. */
  current: string | null;
  onOpen: (path: string) => void;
  onNewNote: (folder: string) => void;
  onNewFolder: (parent: string) => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string, kind: 'folder' | 'note' | 'file') => void;
  /** Move a note, file or folder into a folder ('' is the top level). */
  onMove: (path: string, folder: string) => void;
  /** Notes that can start a new note (in template folders). */
  templates?: readonly string[];
  onNewFromTemplate?: (template: string) => void;
  /** Built-in kinds of notes (NPC, location…). */
  noteTypes?: readonly NoteType[];
  onNewOfType?: (type: NoteType) => void;
  /** Opens the Obsidian import. */
  onImport?: () => void;
}

/** Drag state shared by the whole tree: the folder a drop would land in. */
interface DragProps {
  dropTarget: string | null;
  setDropTarget: (folder: string | null) => void;
}

/** Handlers that make an element a drop zone for `folder`. */
function dropZone(folder: string, props: FileTreeProps & DragProps) {
  return {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (props.dropTarget !== folder) props.setDropTarget(folder);
    },
    onDrop: (e: DragEvent) => {
      const path = e.dataTransfer.getData(DRAG_TYPE);
      if (!path) return;
      e.preventDefault();
      e.stopPropagation();
      props.setDropTarget(null);
      props.onMove(path, folder);
    },
  };
}

export function FileTree(treeProps: FileTreeProps) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const props = { ...treeProps, dropTarget, setDropTarget };
  const tree = buildTree(props.notes, props.attachments, props.folders);
  return (
    <nav
      aria-label="Journal files"
      className={cn('flex flex-1 flex-col text-sm', dropTarget === '' && 'bg-accent-soft/40')}
      {...dropZone('', props)}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
      }}
    >
      <div className="mb-2 flex items-center gap-1 px-2">
        <span className="flex-1" />
        <button
          type="button"
          aria-label="New note"
          title="New note"
          onClick={() => {
            props.onNewNote('');
          }}
          className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
        >
          <FilePlus className="h-4 w-4" aria-hidden />
        </button>
        {((props.templates?.length ?? 0) > 0 || (props.noteTypes?.length ?? 0) > 0) && (
          <Menu.Root>
            <Menu.Trigger
              aria-label="New note from template"
              title="New NPC, location, faction… or from a template"
              className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
            >
              <LayoutTemplate className="h-4 w-4" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="end"
                sideOffset={4}
                collisionPadding={8}
                className="z-50 max-h-96 min-w-48 overflow-y-auto rounded-md border border-border bg-surface p-1 text-sm shadow-card"
              >
                {props.noteTypes && props.noteTypes.length > 0 && (
                  <>
                    <Menu.Label className="px-2 py-1 text-xs text-muted">New</Menu.Label>
                    {props.noteTypes.map((t) => (
                      <Menu.Item
                        key={t.id}
                        onSelect={() => {
                          props.onNewOfType?.(t);
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
                      >
                        <NoteTypeIcon type={t} className="h-4 w-4 text-faint" />
                        {t.label}
                      </Menu.Item>
                    ))}
                  </>
                )}
                {props.templates && props.templates.length > 0 && (
                  <>
                    <Menu.Separator className="my-1 h-px bg-border" />
                    <Menu.Label className="px-2 py-1 text-xs text-muted">
                      From your templates
                    </Menu.Label>
                    {props.templates.map((t) => (
                      <MenuItem
                        key={t}
                        onSelect={() => {
                          props.onNewFromTemplate?.(t);
                        }}
                      >
                        {t.slice(t.lastIndexOf('/') + 1).replace(/\.md$/i, '')}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        )}
        {props.onImport && (
          <button
            type="button"
            aria-label="Import from Obsidian"
            title="Import an Obsidian vault"
            onClick={props.onImport}
            className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
          >
            <FolderInput className="h-4 w-4" aria-hidden />
          </button>
        )}
        <button
          type="button"
          aria-label="New folder"
          title="New folder"
          onClick={() => {
            props.onNewFolder('');
          }}
          className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
        >
          <FolderPlus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {tree.length === 0 ? (
        <p className="px-3 py-2 text-muted">No notes yet.</p>
      ) : (
        <ul role="tree" aria-label="Notes">
          {tree.map((n) => (
            <TreeItem key={n.path} node={n} depth={0} {...props} />
          ))}
        </ul>
      )}
      {/* Room below the files: dropping here moves to the top level. */}
      <div className="min-h-12 flex-1" />
    </nav>
  );
}

function TreeItem({
  node,
  depth,
  ...props
}: FileTreeProps & DragProps & { node: TreeNode; depth: number }) {
  const containsCurrent = props.current?.startsWith(`${node.path}/`) ?? false;
  const [open, setOpen] = useState(depth === 0 || containsCurrent);
  const [renaming, setRenaming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(node.name);
  const isOpen = open || containsCurrent;
  const isBase = node.kind === 'file' && node.path.toLowerCase().endsWith('.base');
  const Icon =
    node.kind === 'folder' ? Folder : node.kind === 'note' ? FileText : isBase ? Table2 : Paperclip;
  const selected = node.path === props.current;
  const isDropTarget = node.kind === 'folder' && props.dropTarget === node.path;
  const folderOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
  // Dropping on a note or file puts the dragged item next to it, in the same folder.
  const zone = dropZone(node.kind === 'folder' ? node.path : folderOf(node.path), props);
  const existing = [...props.notes, ...props.attachments, ...props.folders];
  const destinations = ['', ...props.folders].filter(
    (f) => moveTarget(node.path, f, existing, node.kind === 'folder').ok,
  );

  const commitRename = () => {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== node.name) props.onRename(node.path, trimmed);
    else setName(node.name);
  };

  return (
    <li
      role="treeitem"
      aria-expanded={node.kind === 'folder' ? isOpen : undefined}
      aria-selected={selected}
      className={cn(isDropTarget && 'rounded-md bg-accent-soft/40 ring-1 ring-accent/60')}
      {...(node.kind === 'folder' ? zone : {})}
    >
      <div
        draggable={!renaming}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, node.path);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          props.setDropTarget(null);
        }}
        {...(node.kind === 'folder' ? {} : zone)}
        className={cn(
          'group flex items-center gap-1 rounded-md pr-1',
          selected ? 'bg-accent-soft text-accent' : 'hover:bg-sunken',
        )}
        style={{ paddingLeft: `${String(0.25 + depth * 0.85)}rem` }}
      >
        {renaming ? (
          <input
            autoFocus
            value={name}
            aria-label={`New name for ${node.name}`}
            onChange={(e) => {
              setName(e.target.value);
            }}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setName(node.name);
                setRenaming(false);
              }
            }}
            className="my-0.5 h-7 min-w-0 flex-1 rounded border border-accent bg-surface px-1.5"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (node.kind === 'folder') setOpen(!isOpen);
              else if (node.kind === 'note' || isBase) props.onOpen(node.path);
            }}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
          >
            {node.kind === 'folder' ? (
              <ChevronRight
                className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')}
                aria-hidden
              />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <Icon className="h-4 w-4 shrink-0 text-faint" aria-hidden />
            <span className="truncate">{node.name}</span>
          </button>
        )}
        <Menu.Root
          onOpenChange={(o) => {
            if (!o) setPicking(false);
          }}
        >
          <Menu.Trigger
            aria-label={`Actions for ${node.name}`}
            className="rounded p-0.5 text-faint opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              align="start"
              sideOffset={4}
              collisionPadding={8}
              className="z-50 max-h-80 min-w-40 overflow-y-auto rounded-md border border-border bg-surface p-1 text-sm shadow-card"
            >
              {picking ? (
                // "Move to…" swaps the menu for the list of folders (a submenu is awkward on touch).
                <>
                  <Menu.Label className="px-2 py-1 text-xs text-muted">
                    Move “{node.name}” to
                  </Menu.Label>
                  {destinations.map((f) => (
                    <MenuItem
                      key={f}
                      onSelect={() => {
                        props.onMove(node.path, f);
                      }}
                    >
                      {f || 'Journal (top level)'}
                    </MenuItem>
                  ))}
                </>
              ) : (
                <>
                  {node.kind === 'folder' && (
                    <>
                      <MenuItem
                        onSelect={() => {
                          props.onNewNote(node.path);
                        }}
                      >
                        New note here
                      </MenuItem>
                      <MenuItem
                        onSelect={() => {
                          props.onNewFolder(node.path);
                        }}
                      >
                        New folder here
                      </MenuItem>
                    </>
                  )}
                  <MenuItem
                    onSelect={() => {
                      setRenaming(true);
                    }}
                  >
                    Rename
                  </MenuItem>
                  {destinations.length > 0 && (
                    <MenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setPicking(true);
                      }}
                    >
                      Move to…
                    </MenuItem>
                  )}
                  <MenuItem
                    onSelect={() => {
                      props.onDelete(node.path, node.kind);
                    }}
                  >
                    Delete
                  </MenuItem>
                </>
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
      {node.kind === 'folder' && isOpen && node.children.length > 0 && (
        <ul role="group">
          {node.children.map((c) => (
            <TreeItem key={c.path} node={c} depth={depth + 1} {...props} />
          ))}
        </ul>
      )}
    </li>
  );
}

function MenuItem({ onSelect, children }: { onSelect: (e: Event) => void; children: string }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className="cursor-pointer rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
    >
      {children}
    </Menu.Item>
  );
}
